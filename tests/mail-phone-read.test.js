/* 📱 폰 메일 읽기 «머리를 줄인다 + 빠른 답장» (대표 승인 2026-10-31, 목업 안 B + 빠른 답장)
   「화면의 절반이 여러 정보라 본문을 보기 전에 상단이 너무 많은 공간을 차지한다」 「폰에서도 빠른 답장」
   ★ 빠른 답장은 «실제로 메일이 나가는» 자리다 — 빈 글 · 연타 · 실패 · 답장 표 순서를 검사가 지킨다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { sliceFn } = require('./fnslice');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ');

/* ── 아주 작은 가짜 화면 ── */
function make(over) {
  const log = { posts: [], toasts: [], answered: [], renders: 0, replies: [] };
  const els = {};
  const mk = (tag) => {
    const e = { tag, dataset: {}, _html: '', value: '', textContent: '', disabled: false, classList: new Set(),
      focus() {}, remove() { for (const k of Object.keys(els)) if (els[k] === e) delete els[k]; } };
    Object.defineProperty(e, 'innerHTML', { get() { return e._html; }, set(h) {
      e._html = h;
      for (const m of String(h).matchAll(/id="(\w+)"/g)) { if (!els[m[1]]) els[m[1]] = { dataset: {}, value: '', textContent: '', disabled: false, focus() {} }; }
    } });
    return e;
  };
  const document = {
    createElement: (t) => mk(t),
    getElementById: (id) => els[id] || null,
    body: { appendChild(e) { els[e.id] = e; } },
    querySelector: () => null,
  };
  const row = { u: 7, e: 'hong@example.com', f: '홍길동', s: '취업규칙 건', d: 1761782940000, t: 'me@firm.kr' };
  const box = Object.assign({
    String, Number, Date, JSON, Promise, Set, setTimeout,
    document, state: { mbOpen: { slug: 'INBOX', uid: '7', loading: false, text: '원문 한 줄' } },
    _mbMsgs: { INBOX: { '7': row } },
    mailModeOf: () => 'auto', matMailCfg: () => ({ mode: 'auto' }),
    mySign: () => false, _signThumb: null, loadSignThumb() {},
    mbNameOf: (a, f) => f || a,
    esc: (x) => String(x == null ? '' : x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    toast: (m) => log.toasts.push(m),
    mbReply: (all) => log.replies.push(all),
    mbReplyBody: (v, t) => '\n\n── 인용 ──\n> ' + t,
    textToHtml: (t) => '<p>' + t + '</p>', htmlToTextC: (h) => String(h).replace(/<[^>]+>/g, ' '),
    signBlockHtml: () => '<i>서명</i>',
    mbAnswered: (s, u) => log.answered.push([s, u]),
    renderMailPage: () => { log.renders++; },
    PuBack: { open: () => 1, close: () => true },
    postAutoMail: async (p) => { log.posts.push(p); if (box.fail) throw new Error('서버 응답 500'); return { ok: true, from: 'firm@daum.net' }; },
    fail: false,
  }, over || {});
  vm.createContext(box);
  const names = ['mbPhInfo', 'mbPhMoreSet', 'mbPhMore', 'mbPhMoreAuto', 'mbQrChip', 'mbQrClose', 'mbQrOpen', 'mbQrFull', 'mbQrSend'];
  vm.runInContext('let _mbMoreH = null, _mbQrH = null, _mbQrBusy = false;\n' + names.map((n) => sliceFn(HTML, (n === 'mbQrSend' ? 'async function ' : 'function ') + n + '(')).join('\n')
    + '\n;' + names.map((n) => 'this.' + n + ' = ' + n).join(';'), box);
  return { box, log, els };
}
const tick = () => new Promise((r) => setImmediate(r));

test('★★★ 빠른 답장 — 보낸 사람에게만 · RE: 제목 · 서명+원문 인용 · 보낸 «뒤에» 답장 표 · 시트 닫힘', async () => {
  const { box, log, els } = make();
  box.mbQrOpen();
  assert.ok(els.mbQr, '시트가 안 열린다');
  assert.match(els.mbQr.innerHTML, /홍길동/);
  els.mbQrText.value = '확인했습니다';
  const p = box.mbQrSend(); await p;
  assert.equal(log.posts.length, 1);
  const m = log.posts[0];
  assert.equal(m.to, 'hong@example.com');
  assert.equal(m.cc, '', '전체답장처럼 참조를 넣었다');
  assert.equal(m.subject, 'RE: 취업규칙 건');
  assert.match(m.html, /확인했습니다/);
  assert.match(m.html, /원문 한 줄/, '원문 인용이 빠졌다');
  assert.match(m.html, /서명/, '서명이 빠졌다');
  assert.equal(m.scheduleAt, 0);
  assert.deepEqual(log.answered, [['INBOX', '7']], '답장 표를 안 켠다');
  assert.equal(els.mbQr, undefined, '보낸 뒤 시트가 안 닫힌다');
});

test('★★★ 빈 글은 보내지 않는다', async () => {
  const { box, log, els } = make();
  box.mbQrOpen();
  els.mbQrText.value = '   \n ';
  await box.mbQrSend();
  assert.equal(log.posts.length, 0, '빈 글이 나갔다');
  assert.ok(els.mbQr, '시트가 닫혔다');
});

test('★★★ 연타해도 한 번만 나간다', async () => {
  const { box, log, els } = make();
  box.mbQrOpen();
  els.mbQrText.value = '감사합니다';
  const a = box.mbQrSend(); const b = box.mbQrSend();
  await Promise.all([a, b]);
  assert.equal(log.posts.length, 1, '두 번 나갔다');
});

test('★★★ 실패하면 시트를 닫지 않고 글을 남기고 답장 표를 켜지 않는다', async () => {
  const { box, log, els } = make({ fail: true });
  box.mbQrOpen();
  els.mbQrText.value = '검토 후 연락드리겠습니다';
  await box.mbQrSend();
  assert.ok(els.mbQr, '실패했는데 시트가 닫혔다');
  assert.equal(els.mbQrText.value, '검토 후 연락드리겠습니다', '쓴 글이 사라졌다');
  assert.equal(log.answered.length, 0, '실패했는데 답장 표를 켰다');
  assert.ok(log.toasts.some((t) => /보내지 못했습니다/.test(t)));
  assert.equal(els.mbQrGo.disabled, false, '다시 못 누른다');
});

test('★★ 자동 발송이 꺼졌거나 주소를 모르면 예전 길(mbReply)로 — 시트를 안 연다', () => {
  const off = make({ mailModeOf: () => 'mailto' });
  off.box.mbQrOpen();
  assert.equal(off.els.mbQr, undefined);
  assert.deepEqual(off.log.replies, [false]);
  const noAddr = make({ _mbMsgs: { INBOX: { '7': { u: 7, s: 'x' } } } });
  noAddr.box.mbQrOpen();
  assert.equal(noAddr.els.mbQr, undefined);
  assert.deepEqual(noAddr.log.replies, [false]);
});

test('★★ 본문을 가져오는 중이면 시트를 안 연다(인용할 글이 없다)', () => {
  const { box, els, log } = make({ state: { mbOpen: { slug: 'INBOX', uid: '7', loading: true } } });
  box.mbQrOpen();
  assert.equal(els.mbQr, undefined);
  assert.ok(log.toasts.length >= 1);
});

test('★ 문구 칩은 비었으면 채우고, 글이 있으면 «다음 줄»에 붙인다', () => {
  const { box, els } = make();
  box.mbQrOpen();
  box.mbQrChip('확인했습니다');
  assert.equal(els.mbQrText.value, '확인했습니다');
  box.mbQrChip('감사합니다');
  assert.equal(els.mbQrText.value, '확인했습니다\n감사합니다');
});

test('★★ 시트는 뒤로가기 층에 올린다 — 뒤로가기가 시트부터 닫는다', () => {
  const calls = [];
  const { box } = make({ PuBack: { open: (n, f) => { calls.push(n); return 3; }, close: () => true } });
  box.mbQrOpen();
  assert.deepEqual(calls, ['빠른 답장']);
  const m = make({ PuBack: { open: (n) => { calls.push(n); return 4; }, close: () => true } });
  m.box.mbPhMoreSet(true);
  assert.ok(calls.includes('더보기'));
  assert.equal(m.box.state.mbMoreOn, true);
  m.box.mbPhMoreSet(false);
  assert.equal(m.box.state.mbMoreOn, false);
});

test('★★ ⓘ 는 눌릴 때마다 펼침 ↔ 접힘(state 에 적어 다시 그려져도 유지)', () => {
  const { box } = make();
  box.mbPhInfo();
  assert.equal(box.state.mbInfoOn, true);
  box.mbPhInfo();
  assert.equal(box.state.mbInfoOn, false);
});

/* ── 마크업·CSS 규칙 ── */
const READ = strip(sliceFn(HTML, 'function mbReadHtml('));

test('★★ 읽기 마크업에 폰 요소 넷과 답장 막대가 있다 · 상태 클래스를 단다', () => {
  ['class="phtitle"', 'class="phfrom"', 'class="phbot"', 'mbPhInfo()', 'mbQrOpen()', 'mbPhMore()'].forEach((k) =>
    assert.ok(READ.includes(k), k + ' 가 없다'));
  assert.match(READ, /infoon/);
  assert.match(READ, /moreon/);
  assert.equal((READ.match(/class="rbtn pri"/g) || []).length, 3, '답장·전체답장·전달 셋만 pri(시트에서 가림)');
});

test('★★★ 새 폰 요소는 PC 에서 감춘다 · 보이게 하는 규칙은 전부 .dmr(폰) 안에서만', () => {
  const css = strip(HTML);
  assert.match(css, /\.dm-read \.phtitle,\.dm-read \.phinfo,\.dm-read \.phfrom,\.dm-read \.phbot\{display:none\}/, 'PC 에서 안 감춘다');
  const shows = css.match(/[^{}]*\.(phtitle|phinfo|phfrom|phbot)\b[^{}]*\{[^}]*display:(block|flex|inline-block)[^}]*\}/g) || [];
  assert.ok(shows.length >= 4, '폰에서 보이게 하는 규칙이 없다');
  shows.forEach((r) => assert.match(r.trim(), /^\.dmr /, 'PC 에서도 보이게 하는 규칙: ' + r.slice(0, 80)));
});

test('★★ 폰은 제목 줄(h3)·자세한 정보를 접고, 이 메일에 하는 일(.lft)은 시트로만 연다', () => {
  const css = strip(HTML);
  assert.match(css, /\.dmr \.dm-read h3\{display:none\}/);
  assert.match(css, /\.dmr \.dm-read:not\(\.infoon\) \.dm-hint,\.dmr \.dm-read:not\(\.infoon\) \.meta,\.dmr \.dm-read:not\(\.infoon\) \.atts\{display:none\}/);
  assert.match(css, /\.dmr \.dm-read \.rtop \.lft\{display:none\}/);
  assert.match(css, /\.dmr \.dm-read\.moreon \.rtop \.lft\{display:flex/);
});

test('★★ 폰 입력칸은 16px(확대 막기) · 새 읽기 열면 접힌 채로 연다 · 목록으로 나가면 시트를 닫는다', () => {
  assert.match(strip(HTML), /#mbQr textarea\{[^}]*font-size:16px/);
  const open = strip(sliceFn(HTML, 'function mbOpenMsg('));
  assert.match(open, /state\.mbInfoOn *= *false; *mbPhMoreSet\(false\); *mbQrClose\(\)/);
  assert.match(strip(sliceFn(HTML, 'function mbBack(')), /mbPhMoreSet\(false\); *mbQrClose\(\)/);
});

test('★★ 아래 막대가 화면 맨 아래에 붙는다(.dmr 아래 패딩 0) · 더보기 시트는 막대 «위»에 뜬다', () => {
  /* 폰 폭(375×700)으로 재 보니 패딩 24px 가 남으면 막대 밑으로 본문이 비쳤다 — sticky bottom:0 은 패딩 «안쪽»에 붙는다 */
  const css = strip(HTML);
  assert.match(css, /\.dmr\{padding-bottom:0\}/);
  const m = /\.dmr \.dm-read\.moreon \.rtop \.lft\{[^}]*bottom:calc\((\d+)px \+ env\(safe-area-inset-bottom\)\)/.exec(css);
  assert.ok(m, '더보기 시트가 막대 위 간격을 안 둔다');
  assert.ok(Number(m[1]) >= 55, '시트가 막대(55px)를 덮는다: ' + m[1]);
});
