'use strict';
/* ⚡ 메일을 «빨리» 연다 (2026-09-27, 대표 지시 「푸른메일함은 계속 팝업창이 너무 늦게 나오고
   메일을 열면 전송이 늦어 메일이 늦게 나온다 — 완전히 고쳐라」)

   ★ 실측 2026-09-27 — 무엇이 느렸나
     · 서버 기록(MB_TIME): 식은 그릇 2,558~2,799ms · 따뜻한 그릇 691~791ms.
       그중 다음메일에서 글을 받는 일은 0.2~0.4초뿐이었다.
     · 나머지는 «미국 실시간DB 왕복»을 차례로 기다린 것 — 폴더 주소 묻기 · 계정 주소 묻기 ·
       읽음 적기(본문보다 «먼저»). 한 번에 150~300ms.
     · 그릇이 식어 있으면 서버 묶음(index.js) 싣기 1.25초 — 그중 0.4초가 지문 로그인 부품
       (@simplewebauthn/server)이었다. 메일과 상관없는데 모든 함수가 깨어날 때마다 읽었다.
     · 줄에 마우스를 올려 미리 받는 중에 누르면 같은 메일을 «또» 불러, 한 그릇 한 부름인
       서버에서 줄을 섰다(08:04:23 → 08:04:26).
     · 메일 창은 전체메일 한 화면을 그리려고 1MB(25칸 × 100줄 × 437B)를 받아야 했다.
     · 메일쓰기 팝업은 누를 때마다 떠 있던 창을 «통째로 다시» 실었다(→ cards-mail-popup).

   여기서 지키는 것
   ① 폴더 주소를 담아 두고, 진짜 실패하면 버린다
   ② 읽음 적기(미국 DB)는 본문과 «함께» 간다 — 본문 앞에 줄 세우지 않는다
   ③ 계정 주소를 담아 두되 빈 값은 안 담는다
   ④ ☕ 서명 붙은 두드림으로 그릇·연결을 따뜻하게 — 서명이 틀리면 막는다, 메일은 안 읽는다
   ⑤ 지문 로그인 부품은 «부를 때» 싣는다
   ⑥ 받는 중인 통은 한 번만 부른다
   ⑦ 미리 받은 본문으로 열면 다음메일에도 읽음을 적는다
   ⑧ 📬 메일함 씨앗 — 먼저 그리고, 미리보기는 안 담고, 로그아웃하면 지운다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { sliceFn } = require('./fnslice.js');

const ROOT = path.join(__dirname, '..');
const MS_PATH = path.join(ROOT, 'functions', 'mail-sync.js');
const strip = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const MS = fs.readFileSync(MS_PATH, 'utf8').replace(/\r\n/g, '\n');
const IDX = fs.readFileSync(path.join(ROOT, 'functions', 'index.js'), 'utf8').replace(/\r\n/g, '\n');
const PK = fs.readFileSync(path.join(ROOT, 'functions', 'passkey.js'), 'utf8').replace(/\r\n/g, '\n');
const app = fs.readFileSync(path.join(ROOT, 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');

function 새로() { delete require.cache[require.resolve(MS_PATH)]; return require(MS_PATH); }

/* ── 가짜 메일함 · 가짜 DB ── */
function 판(opt) {
  const o = opt || {};
  const 기록 = { dbRead: 0, 붙음: 0, 잠금: 0, noop: 0, fetchOne: 0, dbSet: [] };
  const client = () => ({
    usable: true,
    async getMailboxLock() { 기록.잠금++; if (o.잠금실패) throw new Error('없는 폴더'); return { release() {} }; },
    async noop() { 기록.noop++; },
    async fetchOne() { 기록.fetchOne++; return null; },
    async logout() { this.usable = false; },
  });
  const deps = {
    functions: F(),
    MAIL_REGION: 'asia-northeast3',
    setCors: () => {},
    requireStaff: async () => { 기록.staff = (기록.staff || 0) + 1; return { uid: 'U1' }; },
    getDatabase: () => ({
      ref: (p) => ({
        once: async () => { 기록.dbRead++; 기록.last = p;
          if (/uid_roles/.test(p)) return { val: () => ({ sid: 'P-003', status: 'active' }) };
          if (/\/folders$/.test(p)) return { val: () => ({ 'INBOX-1': { path: 'INBOX' }, 'S-2': { path: 'Sent' } }) };
          return { val: () => (o.path === undefined ? 'INBOX' : o.path) }; },
        set: async (v) => { 기록.dbSet.push([p, v]); },
      }),
    }),
    mailUserAsync: async () => '370-6',
    mailPass: () => (o.pass === undefined ? 'pw-secret' : o.pass),
    MD: { loginIds: () => ['370-6'] },
    imapConnect: async () => { 기록.붙음++; return client(); },
  };
  return { 기록, deps };
}
function F() {
  const f = {};
  f.region = () => f;
  f.runWith = () => f;
  f.pubsub = { schedule: () => ({ timeZone: () => ({ onRun: (fn) => fn }) }) };
  f.https = { onRequest: (fn) => fn };
  return f;
}
async function call(fn, body, headers) {
  const out = {};
  const res = {
    status(c) { out.code = c; return res; }, json(b) { out.body = b; return res; }, send() { return res; },
  };
  await fn({ method: 'POST', headers: headers || {}, body: body || {} }, res);
  return out;
}
const sigOf = (pass) => crypto.createHmac('sha256', pass).update('pu-mail-warm-v1').digest('hex');

/* ══════ ① 폴더 주소를 담아 둔다 ══════ */

test('★★★ 두 번 열어도 폴더 주소는 «한 번만» 묻는다 — 미국 DB 왕복이 매번 본문 앞에 서지 않는다', async () => {
  const M = 새로();
  const { 기록, deps } = 판();
  await M.withFolder(deps, 'INBOX-1', async () => 1);
  await M.withFolder(deps, 'INBOX-1', async () => 2);
  assert.equal(기록.dbRead, 1, '★★★ 폴더 주소를 ' + 기록.dbRead + '번 물었습니다 — 담아 두지 않습니다');
});

test('★★ 담은 지 10분이 넘으면 «다시» 묻는다 — 폴더 이름을 바꾸면 따라가야 한다', async () => {
  const M = 새로();
  const { 기록, deps } = 판();
  await M.withFolder(deps, 'INBOX-1', async () => 1);
  const 진짜 = Date.now;
  try { Date.now = () => 진짜() + 11 * 60 * 1000; await M.withFolder(deps, 'INBOX-1', async () => 2); }
  finally { Date.now = 진짜; }
  assert.equal(기록.dbRead, 2, '★★ 낡은 폴더 주소를 영영 씁니다');
});

test('★★★ 진짜로 실패하면 담아 둔 주소를 «버린다» — 낡은 주소로 10분 내내 넘어지지 않게', async () => {
  const M = 새로();
  const bad = 판({ 잠금실패: true });
  await assert.rejects(M.withFolder(bad.deps, 'INBOX-1', async () => 1));
  const 전 = bad.기록.dbRead;
  await assert.rejects(M.withFolder(bad.deps, 'INBOX-1', async () => 1));
  assert.equal(bad.기록.dbRead, 전 + 1, '★★★ 실패한 주소를 그대로 들고 있습니다 — 새로 안 묻습니다');
});

/* ══════ ② 읽음 적기는 본문과 «함께» ══════ */

function readBody() {
  const i = MS.indexOf('readMailMessage: F');
  return strip(MS.slice(i, MS.indexOf('manageMailFolder: F', i)));
}

test('★★★ 읽음 적기(미국 DB)를 «기다린 뒤에» 본문을 받으러 가지 않는다', () => {
  const b = readBody();
  assert.doesNotMatch(b, /await\s+deps\.getDatabase\(\)\.ref\(ROOT \+ '\/msgs\/' \+ slug \+ '\/' \+ uid \+ '\/r'\)\.set\(1\)/,
    '★★★ 읽음 적기를 기다린 뒤에야 본문을 받습니다 — 한 통마다 150~300ms 가 늘어납니다');
  assert.match(b, /markDb\s*=\s*Promise\.resolve\(\)/, '★ 읽음 적기를 떠나보내지 않습니다');
});

test('★★ 떠나보낸 읽음 적기는 «답하기 전에» 끝을 본다 — 1세대 함수는 답한 뒤를 책임지지 않는다', () => {
  const b = readBody();
  assert.match(b, /const done = async \(o\) => \{ if \(markDb\) await markDb; return o; \}/, '★ 끝을 안 기다립니다');
  const rets = (b.match(/return done\(\{/g) || []).length;
  assert.ok(rets >= 2, '★★ 본문을 돌려주는 길 가운데 끝을 안 기다리는 길이 있습니다(' + rets + ')');
  assert.doesNotMatch(b, /return \{ html:/, '★★ 끝을 안 기다리고 돌려주는 길이 남아 있습니다');
});

test('★ 미리 받기(peek)는 여전히 아무것도 안 적는다', () => {
  const b = readBody();
  assert.match(b, /if \(!peek\) \{[\s\S]{0,400}markDb = /, '★ 미리 받기에도 읽음을 적습니다');
});

/* ══════ ③ 계정 주소를 담아 둔다 ══════ */

test('★★ 계정 주소를 담아 둔다 — 빈 값은 안 담는다(못 읽은 것을 10분간 굳히면 메일이 통째로 멈춘다)', () => {
  const i = IDX.indexOf('async function mailUserAsync(');
  const b = strip(IDX.slice(i, IDX.indexOf('\n}', i) + 2));
  assert.match(b, /_mailUserHit && \(Date\.now\(\) - _mailUserHit\.at\) < MAIL_USER_TTL_MS\) return _mailUserHit\.v/,
    '★★ 담아 둔 주소를 안 씁니다 — 한 통마다 미국 DB 에 묻습니다');
  assert.match(b, /if \(v\) _mailUserHit = /, '★★ 빈 값까지 담습니다');
  assert.match(IDX, /const MAIL_USER_TTL_MS = (\d+) \* 60 \* 1000/, '담는 시간이 없습니다');
  const min = Number((IDX.match(/const MAIL_USER_TTL_MS = (\d+) \* 60 \* 1000/) || [])[1]);
  assert.ok(min > 0 && min <= 30, '★ 너무 오래 담습니다 — 주소를 바꿔도 안 따라갑니다(' + min + '분)');
});

/* ══════ ④ ☕ 따뜻하게 두기 ══════ */

test('★★★ 서명이 «틀린» 두드림은 막는다 — 직원 확인도, 다음메일 접속도 안 한다', async () => {
  const M = 새로();
  const { 기록, deps } = 판();
  const api = M(deps);
  const r = await call(api.readMailMessage, { warm: 1 }, { 'x-pu-warm': 'f'.repeat(64) });
  assert.equal(r.code, 403, '★★★ 아무나 두드려 다음메일 접속을 일으킬 수 있습니다');
  assert.equal(기록.붙음, 0, '★★ 막았어야 할 두드림이 다음메일에 붙었습니다');
});

test('★★★ 서명이 «맞는» 두드림은 연결을 살리고(NOOP) 폴더 주소를 담는다 — 메일은 한 통도 안 읽는다', async () => {
  const M = 새로();
  const { 기록, deps } = 판();
  const api = M(deps);
  const r = await call(api.readMailMessage, { warm: 1 }, { 'x-pu-warm': sigOf('pw-secret') });
  assert.equal(r.code, 200);
  assert.equal(r.body.ok, true, '★★ 두드렸는데 연결을 못 살렸습니다');
  assert.equal(기록.붙음, 1, '다음메일에 붙어야 합니다');
  assert.equal(기록.noop, 1, '★★ 연결을 살리는 NOOP 을 안 보냅니다');
  assert.equal(기록.fetchOne, 0, '★★★ 두드림이 메일을 읽습니다 — 서명만으로 메일이 새어 나갈 수 있습니다');
  assert.ok(r.body.paths >= 1, '★ 폴더 주소를 미리 안 담습니다');
  assert.equal(기록.staff || 0, 0, '★ 서버끼리의 두드림에 직원 증표를 요구합니다 — 늘 403 입니다');
  /* 두드린 뒤 여는 사람은 «물려받은 연결»·«담긴 주소»를 쓴다 */
  const 전 = 기록.dbRead;
  await M.withFolder(deps, 'INBOX-1', async () => 1);
  assert.equal(기록.붙음, 1, '★★★ 두드려 살린 연결을 안 물려줍니다 — 따뜻하게 둔 보람이 없습니다');
  assert.equal(기록.dbRead, 전, '★★ 두드려 담은 폴더 주소를 안 씁니다');
});

test('★★ 비밀번호가 없으면 서명도 없다 — 빈 서명으로 문이 열리지 않는다', async () => {
  const M = 새로();
  const { deps } = 판({ pass: '' });
  const api = M(deps);
  const r = await call(api.readMailMessage, { warm: 1 }, { 'x-pu-warm': '' + 'x' });
  assert.equal(r.code, 403);
});

test('★★ 두드림이 아닌 부름은 예전처럼 «문지기»를 지난다', async () => {
  const M = 새로();
  const { 기록, deps } = 판();
  const api = M(deps);
  const r = await call(api.readMailMessage, {});
  assert.equal(r.code, 400, '문을 지나 몸통이 답해야 합니다(본문 없음 → 400)');
  assert.equal(기록.staff, 1, '★★★ 직원 확인을 건너뛰었습니다');
});

test('★★★ mailKeepWarm 은 서명을 붙여 readMailMessage 를 두드린다', async () => {
  const M = 새로();
  const { deps } = 판();
  const api = M(deps);
  const 진짜 = global.fetch;
  const 부름 = [];
  global.fetch = async (url, o) => { 부름.push({ url, o }); return { status: 200, json: async () => ({ ok: true }) }; };
  try { await api.mailKeepWarm(); } finally { global.fetch = 진짜; }
  assert.equal(부름.length, 1, '★★★ 두드리지 않습니다');
  assert.match(부름[0].url, /^https:\/\/asia-northeast3-[\w-]+\.cloudfunctions\.net\/readMailMessage$/, '★ 엉뚱한 곳을 두드립니다');
  assert.equal(부름[0].o.headers['x-pu-warm'], sigOf('pw-secret'), '★★ 서명이 틀립니다 — 늘 403 입니다');
});

test('★★ 두드리는 사이가 «붙어 둔 연결을 버리는 잣대»보다 짧다 — 길면 매번 새로 붙는다', () => {
  const idle = Number((MS.match(/const WARM_IDLE_MS = (\d+) \* 60 \* 1000/) || [])[1]);
  const sched = (MS.match(/mailKeepWarm: F[\s\S]{0,400}\.pubsub\.schedule\('([^']+)'\)/) || [])[1] || '';
  const every = Number((sched.match(/^\*\/(\d+) /) || [])[1]);
  assert.ok(idle > 0 && every > 0, '두 값을 못 찾았습니다: ' + sched);
  assert.ok(every < idle, '★★ ' + every + '분마다 두드리는데 연결은 ' + idle + '분 놀면 버립니다');
  assert.match(sched, / (\d+)-(\d+) \* \* /, '★ 밤에도 두드립니다 — 업무 시간만 두드릴 것');
  assert.match(MS, /mailKeepWarm: F[\s\S]{0,400}\.timeZone\('Asia\/Seoul'\)/, '★ 한국 시간이 아닙니다');
});

test('★ index.js 가 mailKeepWarm 을 내보낸다 — 안 하면 두드리는 이가 없다', () => {
  assert.match(IDX, /exports\.mailKeepWarm\s*=\s*MSYNC\.mailKeepWarm/);
});

/* ══════ ⑤ 지문 로그인 부품은 «부를 때» ══════ */

test('★★★ passkey.js 를 실어도 @simplewebauthn/server 는 «안» 실린다 — 모든 함수가 깨어날 때마다 0.4초', () => {
  const pk = path.join(ROOT, 'functions', 'passkey.js');
  Object.keys(require.cache).forEach((k) => { if (/simplewebauthn|passkey\.js$/.test(k)) delete require.cache[k]; });
  require(pk);
  const loaded = Object.keys(require.cache).some((k) => /@simplewebauthn[\\/]server/.test(k));
  assert.equal(loaded, false, '★★★ 지문 로그인을 안 쓰는데도 그 부품을 싣습니다 — 메일 열기가 깨어날 때마다 느립니다');
});

test('★★ 부를 때는 그 부품의 진짜 함수로 간다 — 지문 로그인이 안 망가진다', () => {
  const b = strip(PK);
  ['generateRegistrationOptions', 'verifyRegistrationResponse', 'generateAuthenticationOptions',
    'verifyAuthenticationResponse'].forEach((n) => {
    assert.match(b, new RegExp('const ' + n + ' = \\(o\\) => swa\\(\\)\\.' + n + '\\(o\\)'), '★★ ' + n + ' 이 이어지지 않습니다');
  });
  assert.match(b, /require\("@simplewebauthn\/server"\)/, '부품을 아예 안 싣습니다 — 지문 로그인이 죽습니다');
});

/* ══════ ⑥ 받는 중인 통은 한 번만 ══════ */

function bodyBox(o) {
  const calls = [];
  let release;
  const ctx = {
    console, String, Object, Number, JSON, Promise,
    MB_OLD_ID: '*old', MB_FN: 'https://fn/', MB_BODY_MAX: 400000, MB_BODY_KEEP: 30,
    _mbBody: {}, _mbBodyOrder: [],
    firebase: { auth: () => ({ currentUser: { getIdToken: async () => 'tok' } }) },
    fetch: (url, opt) => { calls.push({ url, body: JSON.parse(opt.body) });
      return new Promise((ok) => { release = () => ok({ json: async () => ({ ok: true, html: '<p>본문</p>', atts: [] }) }); }); },
  };
  vm.createContext(ctx);
  vm.runInContext('let _mbBodyWait = {};\n' + ['mbBodyKey', 'mbBodyGet', 'mbBodyPut', 'mbBodyPending', 'mbFetchBody', 'mbFetchBodyNow']
    .map((n) => sliceFn(app, 'function ' + n + '(')).join('\n'), ctx);
  ctx._calls = calls; ctx._release = () => release && release();
  return ctx;
}

test('★★★ 미리 받는 중에 누르면 «같은 부름을 기다린다» — 두 번 부르면 서버에서 줄을 선다', async () => {
  const c = bodyBox();
  const a = c.mbFetchBody('INBOX-1', '7', true);       /* 마우스를 올려 미리 받기 */
  await new Promise((r) => setTimeout(r, 5));
  const b = c.mbFetchBody('INBOX-1', '7');             /* 곧바로 누름 */
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(c._calls.length, 1, '★★★ 같은 메일을 ' + c._calls.length + '번 불렀습니다');
  c._release();
  const [x, y] = await Promise.all([a, b]);
  assert.equal(x.html, y.html, '★ 기다린 쪽이 다른 본문을 받았습니다');
});

test('★★ 다 받은 뒤에는 «받는 중» 표를 지운다 — 안 지우면 실패한 통을 영영 다시 못 부른다', async () => {
  const c = bodyBox();
  const a = c.mbFetchBody('INBOX-1', '8', true);
  await new Promise((r) => setTimeout(r, 5));
  assert.ok(c.mbBodyPending('INBOX-1', '8'), '받는 중 표가 없습니다');
  assert.equal(c.mbBodyPending('INBOX-1', '8').peek, true, '★ 미리 받기인지 안 적습니다 — 여는 쪽이 읽음을 못 적습니다');
  c._release(); await a;
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(c.mbBodyPending('INBOX-1', '8'), null, '★★ 받는 중 표가 남았습니다');
});

/* ══════ ⑦ 미리 받은 본문으로 열면 읽음을 적는다 ══════ */

test('★★★ 미리 받은 본문으로 열면 «다음메일에도» 읽음을 적는다 — 안 적으면 다음 동기화에 도로 안 읽음이 된다', () => {
  const fn = strip(sliceFn(app, 'function mbOpenMsg('));
  assert.match(fn, /const wasUnread = /, '★ 열기 전에 안 읽음이었는지 안 봅니다');
  assert.match(fn, /const viaPeek = !!mbBodyGet\(slug, uid\) \|\| !!\(wait0 && wait0\.peek\)/, '★ 미리 받은 본문인지 안 봅니다');
  assert.match(fn, /if\(wasUnread && viaPeek\) mbReadMarkBg\(slug, uid\)/, '★★★ 서버에 읽음을 안 알립니다');
});

test('★★ mbReadMarkBg 는 다음메일에 «읽음»을 적는다 — 지난 메일(POP3)은 안 건드린다', async () => {
  const sent = [];
  const ctx = { console, String, JSON, MB_OLD_ID: '*old', MB_FN: 'https://fn/',
    firebase: { auth: () => ({ currentUser: { getIdToken: async () => 'tok' } }) },
    fetch: async (url, o) => { sent.push({ url, body: JSON.parse(o.body) }); return {}; } };
  vm.createContext(ctx);
  vm.runInContext(sliceFn(app, 'function mbReadMarkBg('), ctx);
  ctx.mbReadMarkBg('INBOX-1', '9');
  ctx.mbReadMarkBg('*old', 'k1');
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(sent.length, 1, '★ 지난 메일에도 부릅니다 — 다음메일 폴더에 없는 메일입니다');
  assert.match(sent[0].url, /flagMailMessages$/);
  assert.equal(sent[0].body.flag, 'read');
  assert.equal(sent[0].body.on, true, '★★ 읽음이 아니라 안 읽음을 적습니다');
});

/* ══════ ⑧ 📬 메일함 씨앗 ══════ */

function seedBox(over) {
  const put = [];
  const ctx = Object.assign({
    console, String, Object, Number, JSON, Date, Math, setTimeout, clearTimeout,
    MB_OLD_ID: '*old', MB_SEED_KEY: 'mail-v1', MB_SEED_ROWS: 2, MB_SEED_EVERY: 300000,
    _mbSeeded: false, _mbSeedSavedAt: 0,
    _mbFolders: { 'INBOX-1': { path: 'INBOX' } }, _mbMeta: {},
    _mbBins: {}, _mbPut: {}, _mbPutBy: {}, _mbHide: {}, _mbOwner: {}, _mbSucc: {}, _mbCo: {}, _mbNotCo: {},
    _mbWhoMsg: {}, _mbNoWho: {}, _mbNotSpam: {}, _mbSpamOff: false,
    _mbMsgs: {
      'INBOX-1': { 1: { u: 1, s: '가', p: '본문1' }, 2: { u: 2, s: '나', p: '본문2' }, 3: { u: 3, s: '다', p: '본문3' } },
      '*old': { a: { s: '옛것' } },
    },
    mbAuthOk: () => true,
    mbSeedIdb: (mode, fn) => fn({ put: (v, k) => put.push([k, v]) }, () => {}),
  }, over || {});
  vm.createContext(ctx);
  vm.runInContext(sliceFn(app, 'function mbSeedSave(') + '\n' + sliceFn(app, 'function mbSeedApply('), ctx);
  ctx._put = put;
  return ctx;
}

test('★★★ 씨앗에는 «본문 미리보기»를 안 담는다 — 기기에 남는 것을 줄인다', () => {
  const c = seedBox();
  c.mbSeedSave();
  assert.equal(c._put.length, 1, '담지 않았습니다');
  const rec = c._put[0][1];
  Object.values(rec.msgs['INBOX-1']).forEach((r) => assert.equal(r.p, undefined, '★★★ 미리보기(본문)를 기기에 담았습니다'));
  assert.equal(c._mbMsgs['INBOX-1'][3].p, '본문3', '★★ 담으면서 화면의 줄까지 망가뜨렸습니다');
});

test('★★ 칸마다 «최신 한 쪽»만 담는다 · 지난 메일은 안 담는다', () => {
  const c = seedBox();
  c.mbSeedSave();
  const rec = c._put[0][1];
  assert.deepEqual(Object.keys(rec.msgs['INBOX-1']).map(Number).sort(), [2, 3], '★★ 옛 줄까지 통째로 담습니다');
  assert.equal(rec.msgs['*old'], undefined, '★ 지난 메일을 담았습니다');
  assert.ok(rec.cfg && 'put' in rec.cfg && 'bins' in rec.cfg, '★ 분류 쪽지를 안 담았습니다 — 씨앗으로 칸을 못 그립니다');
});

test('★★★ 씨앗으로 그린 동안에는 씨앗을 «다시 담지 않는다» — 묵은 것이 새 것 행세를 한다', () => {
  const c = seedBox({ _mbSeeded: true });
  c.mbSeedSave();
  assert.equal(c._put.length, 0, '★★★ 씨앗 위에 씨앗을 담았습니다');
});

test('★★ 씨앗은 «이미 받은 것»을 안 덮는다 — 최신본이 먼저 왔으면 그것이 이긴다', () => {
  const c = seedBox({ _mbFolders: null, _mbBins: null });
  const ok = c.mbSeedApply({ folders: { 'INBOX-1': { path: 'INBOX' } }, meta: {}, cfg: { bins: { b: 1 } },
    msgs: { 'INBOX-1': { 9: { u: 9 } }, 'S-2': { 5: { u: 5 } } } });
  assert.equal(ok, true);
  assert.equal(c._mbSeeded, true, '★★ 씨앗으로 그렸다는 표를 안 남깁니다 — 최신본을 안 받습니다');
  assert.ok(c._mbMsgs['INBOX-1'][3], '★★ 이미 받은 받은메일함을 씨앗으로 덮었습니다');
  assert.ok(c._mbMsgs['S-2'][5], '씨앗에만 있는 칸은 채워야 합니다');
  const again = c.mbSeedApply({ folders: {}, msgs: {} });
  assert.equal(again, false, '★ 폴더가 이미 있는데 또 씨앗을 붓습니다');
});

test('★★★ 여는 자리가 씨앗을 «한 번» 찾고, 그리면 최신본을 받는다', () => {
  const fn = strip(sliceFn(app, 'function openMailBox('));
  const i = fn.indexOf('mbSeedGet(');
  assert.ok(i > 0, '★★★ 씨앗을 안 찾습니다 — 메일 창이 늘 1MB 를 다 받은 뒤에 뜹니다');
  assert.ok(fn.indexOf('if(!mbAuthOk()) return;') < i, '★★★ 로그인 «전»에 씨앗을 그립니다 — 로그인 화면 뒤로 메일이 비칩니다');
  assert.match(fn, /_mbSeedTried = true/, '★★ 씨앗을 여러 번 찾습니다');
  assert.match(fn, /mbSeedApply\(seed\)\)\{ openMailBox\(id\); mbSeedRefresh\(\); return; \}/, '★★★ 씨앗으로 그리고 최신본을 안 받습니다');
});

test('★★ 최신본은 «비우지 않고» 갈아 끼운다 — 비우면 「읽고 있습니다…」로 돌아간다', () => {
  const fn = strip(sliceFn(app, 'function mbSeedRefresh('));
  assert.doesNotMatch(fn, /_mb(Folders|Bins|Put|Msgs)\s*=\s*null/, '★★ 값을 비웠다가 채웁니다 — 화면이 한 번 텅 빕니다');
  assert.match(fn, /_mbSeeded = false/, '★ 씨앗 표를 안 내립니다 — 영영 다시 안 담습니다');
  assert.match(fn, /loadMailFolders\(/); assert.match(fn, /mbEnsureBins\(/); assert.match(fn, /loadMailBox\(/);
});

test('★★ 이레보다 묵은 씨앗은 안 쓴다', () => {
  assert.match(app, /const MB_SEED_MAX_AGE = 7 \* 24 \* 3600 \* 1000/);
  assert.match(strip(sliceFn(app, 'function mbSeedGet(')), /\(Date\.now\(\) - Number\(r\.at\|\|0\)\) < MB_SEED_MAX_AGE/, '★★ 묵은 씨앗을 씁니다');
});

test('★★★ 로그아웃하면 씨앗을 지운다 — 메일 제목에는 남의 사건 내용이 든다', () => {
  assert.match(strip(sliceFn(app, 'function doLogoutCards(')), /mbSeedDrop\(\)/, '★★★ 로그아웃해도 메일 목록이 기기에 남습니다');
  assert.match(strip(app), /else \{ try\{ if\(!u\) mbSeedDrop\(\); \}catch\(_\)\{ \} showCardsLogin\(\); \}/,
    '★★ 다른 앱에서 로그아웃하면(통합 로그인) 씨앗이 남습니다');
});

/* ══════ 다음메일에 있는데 없던 것 — 읽는 자리의 스팸신고·이동·인쇄 ══════ */

test('★★ 읽는 자리에 스팸신고 · 이동 · 인쇄가 있다 (다음메일 읽기 화면과 같은 자리)', () => {
  const r = sliceFn(app, 'function mbReadHtml(');
  assert.match(r, /onclick="mbSpamReportOne\('\$\{o\.slug\}','\$\{o\.uid\}'\)"/, '★ 읽다가 스팸을 신고할 길이 없습니다');
  assert.match(r, /onclick="mbMoveOne\('\$\{o\.slug\}','\$\{o\.uid\}',event\)"/, '★ 읽다가 옮길 길이 없습니다');
  assert.match(r, /onclick="mbPrintOne\(\)"/, '★ 인쇄할 길이 없습니다');
  assert.match(r, /mbSentBox\(o\.slug\) \? '' :/, '★ 보낸 칸에서도 스팸신고가 보입니다 — 우리가 쓴 것입니다');
});

test('★★★ 읽는 자리의 「이동」은 «펼친 그 한 통»에만 한다 — 목록에서 골라 둔 것을 안 건드린다', () => {
  const ctx = { String, state: {}, _picks: [{ _key: 'L:1' }, { _key: 'L:2' }],
    mbOneRow: (s, u) => ({ _key: s + ':' + u }), mbVisibleRows: () => ctx._picks,
    pickOf: () => ({}), pickOn: () => true };
  vm.createContext(ctx);
  vm.runInContext(sliceFn(app, 'function mbPicked('), ctx);
  ctx.state.mbOneAct = { slug: 'INBOX-1', uid: '5' };
  ctx.state.mbOpen = { slug: 'INBOX-1', uid: '5' };
  /* ⚠ 상자(vm) 안에서 만든 배열은 deepEqual 이 튕긴다 — 밖의 배열로 옮겨 담아 잰다 */
  assert.deepEqual(Array.prototype.map.call(ctx.mbPicked(), (v) => v._key), ['INBOX-1:5'],
    '★★★ 읽는 메일이 아니라 목록에서 골라 둔 것을 옮깁니다');
  ctx.state.mbOpen = null;                             /* 목록으로 나왔다 */
  assert.equal(ctx.mbPicked().length, 2, '★★★ 목록으로 나왔는데도 아까 읽던 한 통만 옮깁니다 — 엉뚱한 메일이 옮겨집니다');
});

test('★ 인쇄는 새 창을 안 연다 · 본문은 화면과 같은 거름(mbCleanHtml)을 거친다', () => {
  const p = strip(sliceFn(app, 'function mbPrintOne('));
  assert.doesNotMatch(p, /window\.open\(/, '★ 새 창을 엽니다 — 앱끼리 창은 하나(one-window-per-app)');
  assert.match(p, /mbCleanHtml\(o\.html\)/, '★★ 남의 HTML 을 거르지 않고 인쇄 틀에 넣습니다');
  assert.match(p, /createElement\('iframe'\)/);
});

test('★★ 「답장은 다음메일에서 하십니다」 같은 «틀린 안내»가 남아 있지 않다 — 답장 단추가 이미 있다', () => {
  const r = strip(sliceFn(app, 'function mbReadHtml('));
  assert.doesNotMatch(r, /답장은 <b>다음메일에서<\/b> 하십니다/, '★★ 읽는 자리에 틀린 안내가 남았습니다');
  const d = strip(sliceFn(app, 'function mbShowDetail('));
  assert.doesNotMatch(d, /답장·폴더 만들기는 다음메일에서/, '★★ 「상세」가 틀린 안내를 합니다');
});
