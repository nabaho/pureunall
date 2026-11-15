/* 푸른메일 열기 속도 개선 검사 (2026-11-15)
   ① 클라이언트: mousedown 즉시 미리 받기(mbPressPeek) · 목록 상위 자동 미리 받기(mbPrefetchTop) ·
      로딩 중 0ms 즉시 미리보기(mbLoadingBodyHtml, XSS 이스케이프 확인)
   ② 서버: readMailMessage 메모리 캐시(msgBodyPut/Get/Forget)로 재열기·peek 시 불필요한 IMAP 재왕복 제거 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'pu-cards.html'), 'utf8');
const MS = require(path.join(ROOT, 'functions', 'mail-sync.js'));

function pickFn(src, name) {
  const head = 'function ' + name + '(';
  const i = src.indexOf(head);
  assert.ok(i >= 0, name + ' 함수를 찾지 못했습니다');
  let depth = 0, started = false, j = i;
  for (; j < src.length; j++) {
    const ch = src[j];
    if (ch === '{') { depth++; started = true; }
    else if (ch === '}') { depth--; if (started && depth === 0) { j++; break; } }
  }
  return src.slice(i, j);
}

test('① mbLoadingBodyHtml — 본문 도착 전 0ms 에 목록 미리보기(v.p)와 첨부 이름(v.an)을 XSS 없이 먼저 보여 준다', () => {
  const ctx = {
    MB_OLD_ID: '*old',
    esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
  };
  vm.createContext(ctx);
  vm.runInContext(pickFn(HTML, 'mbLoadingBodyHtml'), ctx);

  const out = ctx.mbLoadingBodyHtml(
    { slug: 'INBOX-1', uid: '55', loading: true },
    { p: '안녕하세요 <script>alert(1)</script> 개최 안내입니다.', an: ['공문<1>.pdf', '참석자명단.hwpx'] }
  );
  assert.ok(out.includes('공문&lt;1&gt;.pdf'), '첨부 파일명이 즉시 표시되고 이스케이프되어야 한다');
  assert.ok(out.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), '미리보기 글이 즉시 표시되고 XSS 가 막혀야 한다');
  assert.ok(!out.includes('<script>'), '날 태그가 섞이면 안 된다');

  const empty = ctx.mbLoadingBodyHtml({ slug: 'INBOX-1', uid: '56', loading: true }, { p: '', an: [] });
  assert.ok(empty.includes('본문을 가져오고 있습니다'), '미리보기 글이 없으면 안내 문구를 보여 준다');
});

test('② mbPressPeek & mbPrefetchTop — 마우스 누름 즉시·목록 상위 메일을 peek(읽음 표시 변경 없이)으로 미리 받는다', async () => {
  const calls = [];
  const ctx = {
    MB_OLD_ID: '*old',
    _mbPreBusy: 0,
    _mbTopPreT: 0,
    state: { view: 'mail', mailSent: 'box', mbOpen: null },
    document: { hidden: false },
    firebase: { auth: () => ({ currentUser: { uid: 'u1' } }) },
    mbHoverCancel: () => {},
    mbBodyGet: () => null,
    mbBodyPending: () => null,
    mbVisibleRows: () => [
      { _slug: '*old', u: 1, r: 0 },
      { _slug: 'INBOX-1', u: 101, r: 1 },
      { _slug: 'INBOX-1', u: 102, r: 0 },
      { _slug: 'INBOX-1', u: 103, r: 0 },
    ],
    mbFetchBody: (slug, uid, peek) => { calls.push({ slug, uid, peek }); return Promise.resolve({}); },
    clearTimeout,
    setTimeout,
  };
  vm.createContext(ctx);
  vm.runInContext(pickFn(HTML, 'mbPressPeek') + '\n' + pickFn(HTML, 'mbPrefetchTop'), ctx);

  ctx.mbPressPeek('*old', 1);
  assert.equal(calls.length, 0, '지난 메일(POP3)은 미리 받지 않는다');

  ctx.mbPressPeek('INBOX-1', 999);
  assert.deepEqual(calls[0], { slug: 'INBOX-1', uid: 999, peek: true });
  await new Promise((r) => setTimeout(r, 10));

  calls.length = 0;
  ctx._mbPreBusy = 2;
  ctx.mbPressPeek('INBOX-1', 998);
  assert.equal(calls.length, 0, '_mbPreBusy 가 2 이상이면 mbPressPeek 도 동시 요청 상한을 지킨다');
  ctx._mbPreBusy = 0;

  ctx.mbPrefetchTop();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(calls.length, 2, '동시 미리 받기 상한(_mbPreBusy<=2) 안에서 안 읽은 줄부터 먼저 받는다');
  assert.deepEqual(calls.map((c) => c.uid), [102, 103], '안 읽은 최신 메일을 우선 미리 받는다');
  assert.ok(calls.every((c) => c.peek === true), '모두 peek=true 여야 읽음 표시가 안 바뀐다');
});

test('③ 서버 msgBodyPut/Get/Forget — 캐시 적중·상한·폴더 이동 시 비우기가 정확히 동작한다', () => {
  MS.msgBodyForget();
  assert.equal(MS.msgBodyGet('INBOX-1', '77'), null);

  MS.msgBodyPut('INBOX-1', '77', { html: '<p>본문</p>', text: '본문', atts: [{ name: 'a.pdf' }], full: true });
  const hit = MS.msgBodyGet('INBOX-1', '77');
  assert.deepEqual(hit, { html: '<p>본문</p>', text: '본문', atts: [{ name: 'a.pdf' }], full: true });

  /* 30만 자 넘는 초대형 본문은 그릇 메모리를 아끼기 위해 담지 않는다 */
  MS.msgBodyPut('INBOX-1', '78', { html: 'x'.repeat(310000), text: '', atts: [], full: false });
  assert.equal(MS.msgBodyGet('INBOX-1', '78'), null);

  MS.msgBodyForget('INBOX-1', '77');
  assert.equal(MS.msgBodyGet('INBOX-1', '77'), null);
});

test('④ mbCalInboxSet / mbCalInboxInner — 저장 중 버튼 비활성화(중복 클릭 차단)·접근성 속성 및 실패 시 복구', async () => {
  let resolveSet = null, rejectSet = null;
  const writes = [];
  const toasts = [];
  let renders = 0;
  const ctx = {
    _mbCalInbox: { on: false, autoAdd: false, perRunMax: 8, dayLimit: 40 },
    _mbCalInboxBusy: false,
    _mbCalInboxSaving: false,
    state: { isAdmin: true, view: 'mail' },
    Store: { mode: 'firebase' },
    mbMyName: () => '김대표',
    mbDrawSoon: () => {},
    renderMailPage: () => { renders++; },
    toast: (m) => { toasts.push(m); },
    firebase: {
      database: () => ({
        ref: (p) => ({
          once: () => Promise.resolve({ val: () => ctx._mbCalInbox }),
          set: (v) => new Promise((res, rej) => { writes.push({ p, v }); resolveSet = res; rejectSet = rej; }),
        }),
      }),
    },
    Date, Math, Number, String, Promise,
  };
  vm.createContext(ctx);
  vm.runInContext(
    pickFn(HTML, 'mbCalInboxLoad') + '\n' + pickFn(HTML, 'mbCalInboxInner') + '\n' + pickFn(HTML, 'mbCalInboxSet'),
    ctx
  );

  const beforeHtml = ctx.mbCalInboxInner();
  assert.ok(beforeHtml.includes('aria-pressed="false"') && beforeHtml.includes('aria-label="메일 일정 자동 등록 켜기"'));

  ctx.mbCalInboxSet(true);
  ctx.mbCalInboxSet(true); /* 연속 두 번째 클릭은 무시되어야 한다 */
  assert.equal(writes.length, 1, '저장 진행 중에는 중복 쓰기가 막혀야 한다');
  assert.equal(writes[0].p, 'cal_inbox/cfg');
  const savingHtml = ctx.mbCalInboxInner();
  assert.ok(savingHtml.includes('disabled') && savingHtml.includes('저장 중…'), '저장 중에는 버튼이 disabled 되어야 한다');

  resolveSet();
  await new Promise((r) => setTimeout(r, 10));
  const afterHtml = ctx.mbCalInboxInner();
  assert.ok(!afterHtml.includes('disabled') && afterHtml.includes('aria-pressed="true"'), '저장 완료 후 버튼이 다시 활성화되어야 한다');

  /* 저장 실패 시에도 disabled 가 풀려야 한다 */
  ctx.mbCalInboxSet(false);
  assert.ok(ctx.mbCalInboxInner().includes('disabled'));
  rejectSet(new Error('일시 오류'));
  await new Promise((r) => setTimeout(r, 10));
  assert.ok(!ctx.mbCalInboxInner().includes('disabled'), '저장 실패 시에도 버튼이 다시 활성화되어야 한다');
  assert.ok(renders >= 4);
  assert.ok(toasts.some((t) => t.includes('바꾸지 못했습니다')));
});
