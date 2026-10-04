/* 📥 메일 신규 문의 → 관리자 폰 알림 + 메일함 띠 (대표 승인 목업 2026-10-04)

   지키는 것.
   ① 제목에 문의·상담·견적·의뢰 + 처음 보는 곳만 — 공공·자동발송·광고·아는 곳은 뺀다
   ② «아는 곳» = 이알피 업체·명함·직원 주소, 그 회사 도메인, 이어 둔/치운 주소
      — 단 개인 메일(네이버 등)은 «주소째»만. 네이버 하나를 알면 온 세상을 아는 게 된다
   ③ 서버와 화면의 잣대가 글자까지 같다
   ④ 알림이 죽어도 메일 동기화는 멀쩡하다
   ⑤ 폰 알림 — 관리자(퇴사 아님)의 기기에만, data 전용, 죽은 토큰은 지운다
   ⑥ 띠 — 읽은 문의는 빠지고, 오래된 것은 안 올리고, 한 줄이다
   ⑦ 알림을 누르면 «그 화면»으로 간다 — 포털 탭이 열려 있어도 메일 알림은 메일로 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { sliceFn } = require('./fnslice.js');

const ROOT = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'pu-cards.html'), 'utf8');
const NI = require(path.join(ROOT, 'functions', 'mail-new-inquiry.js'));
const PUSH = require(path.join(ROOT, 'functions', 'push-admins.js'));
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* ── 가짜 DB — 읽기는 표에서, 쓰기는 모아 둔다 ── */
function fakeDb(tree){
  const writes = [];
  const get = p => p.split('/').filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), tree);
  const snap = v => ({ val: () => (v === undefined ? null : v), key: null,
    forEach(fn){ Object.keys(v || {}).forEach(k => fn({ key: k, val: () => v[k] })); } });
  return {
    writes,
    ref(p){ return {
      once: async () => snap(get(p || '')),
      update: async (o) => { writes.push(o); },
    }; },
  };
}
function fakeMessaging(fail){
  const sent = [];
  return { sent, sendEachForMulticast: async (m) => {
    sent.push(m);
    return { successCount: m.tokens.length - (fail ? 1 : 0), failureCount: fail ? 1 : 0,
      responses: m.tokens.map((t, i) => (fail && i === 0
        ? { error: { code: 'messaging/registration-token-not-registered' } } : {})) };
  } };
}

/* ══════ ① 겉모양 ══════ */

test('★★ 제목에 문의·상담·견적·의뢰가 있어야 하고, 공공·자동발송·광고는 뺀다', () => {
  const ok = (e, s) => NI.looksInquiry({ e, s });
  assert.equal(ok('hong@gana.kr', '취업규칙 상담 문의드립니다'), true);
  assert.equal(ok('hong@gana.kr', '견적 요청'), true);
  assert.equal(ok('hong@gana.kr', '10월 급여대장'), false, '문의 낱말이 없는데 골랐습니다');
  assert.equal(ok('ad@gana.kr', '[광고] 무료 상담 문의'), false, '광고를 골랐습니다');
  assert.equal(ok('labor@moel.go.kr', '진정사건 문의'), false, '공공기관을 골랐습니다');
  assert.equal(ok('no-reply@gana.kr', '문의 접수 안내'), false, '자동발송을 골랐습니다');
  assert.equal(ok('', '문의'), false, '주소 없는 줄을 골랐습니다');
});

/* ══════ ③ 서버·화면 같은 잣대 ══════ */

test('★★ 서버와 화면의 잣대 다섯이 «글자까지» 같다 — 한쪽만 고치면 어긋난다', () => {
  const re = name => { const m = app.match(new RegExp('const ' + name + ' = (\\/.*\\/[a-z]*);')); assert.ok(m, name + ' 가 없습니다'); return m[1]; };
  assert.equal(re('MNEW_INQ'), String(NI.INQ_RE), '문의 낱말이 다릅니다');
  assert.equal(re('MNEW_AD'), String(NI.AD_RE), '광고 낱말이 다릅니다');
  assert.equal(re('MB_PUB_TAIL'), String(NI.PUB_TAIL), '공공기관 잣대가 다릅니다');
  assert.equal(re('MB_BOT_RE'), String(NI.BOT_RE), '자동발송 잣대가 다릅니다');
  const m = app.match(/const MB_PUB_DOM = (\[[\s\S]*?\]);/);
  assert.ok(m, 'MB_PUB_DOM 이 없습니다');
  assert.deepEqual(JSON.parse(JSON.stringify(vm.runInNewContext(m[1]))), NI.PUB_DOM, '개인 메일 목록이 다릅니다');
});

/* ══════ ② 아는 곳 · 기록 · 폰 ══════ */

function tree(){
  return {
    data: {
      companies: { v: { c1: { name: '가람사', email: 'a@hy.kr', contacts: [{ email: 'boss@saja.co.kr' }] } } },
      user_accounts: { v: { u1: { name: '권형하', email: 'p001@pureun.kr' } } },
    },
    pucards: {
      items: { i1: { name: '김영희', email: 'kim@gana.kr' }, i2: { name: '박', email: 'park@naver.com' } },
      config: { mailCo: { '@dara,kr': { n: '다라' } }, mailWho: {}, mailNotCo: { 'x@y,kr': 1 } },
    },
    uid_roles: { U1: { isAdmin: true, status: 'active' }, U2: { isAdmin: true, status: 'resigned' },
                 U3: { isAdmin: false, status: 'active' } },
    fcm_tokens: { U1: { T1: 1 }, U2: { T2: 1 }, U3: { T3: 1 } },
  };
}
const R = (u, e, s, f) => ({ u, e, s, f: f || '', d: 1759500000000 + u });

test('★★ 처음 보는 곳만 기록하고 폰으로 알린다 — 아는 주소·아는 회사 도메인·치운 곳은 뺀다', async () => {
  const db = fakeDb(tree());
  const msg = fakeMessaging();
  const rows = [
    R(1, 'hong@new.kr', '상담 문의드립니다', '홍길동'),     // 새 곳 → 알림
    R(2, 'lee@gana.kr', '견적 문의', '이'),                  // 명함 회사 도메인 → 아는 곳
    R(3, 'a@hy.kr', '문의드립니다'),                          // 이알피 업체 주소
    R(4, 'ceo@saja.co.kr', '문의'),                           // 이알피 연락처 회사 도메인
    R(5, 'boss@dara.kr', '의뢰'),                             // 회사째 이어 둔 곳
    R(6, 'x@y.kr', '문의'),                                   // 「자문사 아님」
    R(7, 'lee@naver.com', '상담 문의', '이몽룡'),             // 개인 메일 — 남의 네이버를 알아도 새 곳
    R(8, 'park@naver.com', '문의'),                           // 개인 메일이지만 주소째 아는 곳
    R(9, 'kim@new2.kr', '10월 급여대장'),                      // 문의 아님
  ];
  const out = await NI.notifyNewInquiries({ getDatabase: () => db, getMessaging: () => msg },
    { slug: 'INBOX', rows });
  assert.equal(out.found, 2, '고른 수가 다릅니다: ' + out.found);
  const keys = Object.keys(Object.assign({}, ...db.writes)).filter(k => k.indexOf('mailbox/inq/') === 0);
  assert.equal(keys.length, 2, '기록 수가 다릅니다');
  const vals = keys.map(k => Object.assign({}, ...db.writes)[k].e).sort();
  assert.deepEqual(vals, ['hong@new.kr', 'lee@naver.com']);
  assert.ok(keys.every(k => /^mailbox\/inq\/\d+_INBOX_\d+$/.test(k)), '열쇠 앞이 시각이 아닙니다 — 화면이 최근 것만 못 읽습니다');
  assert.equal(msg.sent.length, 2, '폰 알림이 문의마다 안 갔습니다');
  assert.match(msg.sent[0].data.title, /새 문의/);
});

test('★★ 문의 낱말이 없는 회차는 «아무것도 안 읽는다» — 10분마다 도는 자리라 값이 싸야 한다', async () => {
  let reads = 0;
  const db = { ref(){ return { once: async () => { reads++; return { val: () => null, forEach(){} }; }, update: async () => {} }; } };
  const out = await NI.notifyNewInquiries({ getDatabase: () => db }, { slug: 'INBOX', rows: [R(1, 'a@b.kr', '급여대장')] });
  assert.equal(out.ran, false);
  assert.equal(reads, 0, '후보가 없는데 표를 읽었습니다');
});

/* ══════ ⑤ 폰 알림 ══════ */

test('★★ 폰 알림은 «관리자(퇴사 아님)»의 기기에만 · 본인 제외 · data 전용 · 죽은 토큰은 지운다', async () => {
  const db = fakeDb(tree());
  const msg = fakeMessaging(true);
  const r = await PUSH.pushAdmins(db, msg, { title: 't', body: 'b', tag: 'g', url: '/u' });
  assert.deepEqual(msg.sent[0].tokens, ['T1'], '관리자 아닌 사람·퇴사자에게도 갔습니다');
  assert.equal(msg.sent[0].notification, undefined, 'notification 을 실으면 알림이 두 번 뜹니다');
  assert.deepEqual(Object.keys(msg.sent[0].data).sort(), ['body', 'tag', 'title', 'url']);
  assert.equal(r.cleaned, 1, '죽은 토큰을 안 지웠습니다');
  assert.ok(db.writes.some(w => Object.prototype.hasOwnProperty.call(w, 'fcm_tokens/U1/T1')));
  const msg2 = fakeMessaging();
  const r2 = await PUSH.pushAdmins(fakeDb(tree()), msg2, { title: 't' }, { exceptUid: 'U1' });
  assert.equal(r2.targets, 0, '본인에게도 보냈습니다');
});

test('★ 새 건의 알림도 같은 한 곳(push-admins)을 쓴다 — 베끼면 뒷정리가 한쪽에만 남는다', () => {
  const idx = strip(fs.readFileSync(path.join(ROOT, 'functions', 'index.js'), 'utf8'));
  const i = idx.indexOf('exports.notifySuggestion');
  const body = idx.slice(i, idx.indexOf('exports.', i + 30));
  assert.ok(/PUSH\.pushAdmins\(/.test(body), 'notifySuggestion 이 공용 길을 안 씁니다');
  assert.ok(!/sendEachForMulticast/.test(body), 'notifySuggestion 이 따로 보내고 있습니다');
});

/* ══════ ④ 동기화는 멀쩡 ══════ */

test('★★ 알림이 실패해도 동기화는 계속된다 — 받은메일함 새 줄에서만, try 안에서 부른다', () => {
  const ms = strip(fs.readFileSync(path.join(ROOT, 'functions', 'mail-sync.js'), 'utf8'));
  const i = ms.indexOf('NEWINQ.notifyNewInquiries(');
  assert.ok(i > 0, '부르는 자리가 없습니다');
  const before = ms.slice(Math.max(0, i - 1500), i);
  assert.ok(/r\.dir === 'fresh'[\s\S]*folderKind\(p\.box\) === 'inbox'/.test(before), '새 줄·받은메일함으로 좁히지 않았습니다');
  assert.ok(/try\s*\{\s*const inq = await NEWINQ\.notifyNewInquiries\(/.test(ms), 'try 안에서 부르지 않습니다');
});

/* ══════ ⑥ 띠 ══════ */

function box(inq, msgs, sent){
  const ctx = { _mbInq: inq, _mbMsgs: msgs || {}, mbSentBox: () => !!sent,
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])) };
  vm.createContext(ctx);
  ['MB_INQ_READ', 'MB_INQ_DAYS', 'MB_INQ_NAMES'].forEach(n => {
    const m = app.match(new RegExp('const ' + n + ' = [^;]+;')); assert.ok(m, n + ' 가 없습니다');
    vm.runInContext(m[0].replace(/^const/, 'var'), ctx);
  });
  ['mbInqRows', 'mbInqLineHtml'].forEach(n => vm.runInContext(sliceFn(app, 'function ' + n + '('), ctx));
  return ctx;
}
const NOW = Date.now();
const Q = (u, f, ago, slug) => ({ e: 'p' + u + '@new.kr', f, s: '문의 ' + u, d: NOW - ago, slug: slug || 'INBOX', u: String(u), at: NOW });

test('★★ 읽은 문의는 띠에서 빠지고, 며칠 지난 것은 안 올린다 — 최근 것이 앞', () => {
  const c = box({ a: Q(1, '홍길동', 60000), b: Q(2, '이몽룡', 3600000), c: Q(3, '읽음', 1000),
                  d: Q(4, '오래됨', 10 * 86400000) },
                { INBOX: { '3': { r: 1 }, '1': { r: 0 } } });
  const rows = JSON.parse(JSON.stringify(c.mbInqRows()));
  assert.deepEqual(rows.map(x => x.f), ['홍길동', '이몽룡'], '읽은 것·오래된 것이 남았거나 차례가 다릅니다');
});

test('★★ 띠는 한 줄 — 수·이름·보기, 넘치면 「외 n건」 · 이름을 누르면 그 메일이 열린다', () => {
  const c = box({ a: Q(1, '홍길동', 1000), b: Q(2, '이몽룡', 2000), c: Q(3, '성춘향', 3000), d: Q(4, '변학도', 4000) });
  const h = c.mbInqLineHtml();
  assert.match(h, /새 문의 4건/);
  assert.match(h, /외 1건/);
  assert.ok(h.indexOf("mbOpenMsg('INBOX','1')") > 0, '이름을 눌러 열 길이 없습니다');
  assert.ok(h.indexOf('<br') < 0, '띠가 두 줄입니다');
  assert.ok(/\.dm-inq\{[^}]*white-space:nowrap/.test(app), '띠가 한 줄로 묶여 있지 않습니다');
});

test('★ 없으면 띠 자체가 없고, 우리가 낸 칸에서는 안 보인다', () => {
  assert.equal(box({}).mbInqLineHtml(), '');
  assert.equal(box({ a: Q(1, '홍길동', 1000) }, {}, true).mbInqLineHtml(), '');
});

test('★★ 메일함을 읽을 때 기록도 «최근 것만» 함께 읽고, 못 읽어도 메일함은 열린다', () => {
  const f = strip(sliceFn(app, 'function loadMailFolders('));
  assert.ok(f.indexOf('mbInqRead()') > 0, '메일함을 읽을 때 기록을 함께 안 읽습니다');
  const r = strip(sliceFn(app, 'function mbInqRead('));
  assert.ok(/ref\(MB_ROOT\+'\/inq'\)\.orderByKey\(\)\.limitToLast\(MB_INQ_READ\)/.test(r), '최근 것만 읽지 않습니다');
  assert.ok(/\.once\('value'\)\s*\.catch\(/.test(r) && /catch\s*\(_\)\s*\{\s*return Promise\.resolve\(null\)/.test(r),
    '못 읽으면(또는 넘어지면) 메일함까지 멈춥니다');
  const list = strip(sliceFn(app, 'function mbListHtml('));
  assert.ok(list.indexOf('mbInqLineHtml()') > 0, '목록 위에 띠를 안 그립니다');
});

/* ══════ ⑦ 알림 누르기 ══════ */

test('★★ 알림을 누르면 «그 화면»으로 — 포털 탭이 열려 있어도 메일 알림은 메일을 연다', async () => {
  const sw = fs.readFileSync(path.join(ROOT, 'firebase-messaging-sw.js'), 'utf8');
  const handlers = {};
  let opened = null, focused = null;
  const tabs = [{ url: 'https://x.github.io/pureunall/enter.html', focus(){ focused = this.url; } }];
  const ctx = {
    importScripts(){}, firebase: { initializeApp(){}, messaging: () => ({ onBackgroundMessage(){} }) },
    self: { addEventListener: (n, fn) => { handlers[n] = fn; }, registration: { showNotification(){} },
      clients: { matchAll: async () => tabs, openWindow: async (u) => { opened = u; } } },
  };
  vm.createContext(ctx);
  vm.runInContext(sw, ctx);
  const click = async (url) => { let p; handlers.notificationclick({ notification: { close(){}, data: { url } },
    waitUntil: (x) => { p = x; } }); await p; };
  await click('/pureunall/pu-cards.html?view=mail');
  assert.equal(opened, '/pureunall/pu-cards.html?view=mail', '메일 알림이 포털 탭으로 갔습니다');
  assert.equal(focused, null);
  opened = null;
  await click('/pureunall/enter.html?sg=1');
  assert.ok(focused && /enter\.html/.test(focused), '건의 알림은 열린 포털 탭으로 가야 합니다');
});
