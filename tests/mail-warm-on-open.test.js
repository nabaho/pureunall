/* ☕ 메일함을 «열고 있는 동안» 서버를 깨워 둔다 (대표 승인 2026-11-01)
   「메일함 전반적으로 모두 늦다 — 메일 열 때 등등」
   실측(대표 PC 크롬, 일요일): 서버가 따뜻할 때 한 통 0.45~0.55초 · 식었을 때 첫 통 4.7초.
   서명 두드림(mailKeepWarm)은 월~토 8~20시에만 돈다 — 일요일·밤에는 늘 식어 있었다.
   ★ 화면이 열려 있는 동안만 직원이 직접 깨운다 — 메일은 한 글자도 안 읽고, 재직 직원만 닿는다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const ROOT = path.join(__dirname, '..');
const MS_PATH = path.join(ROOT, 'functions', 'mail-sync.js');
const MS = fs.readFileSync(MS_PATH, 'utf8').replace(/\r\n/g, '\n');
const app = fs.readFileSync(path.join(ROOT, 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const strip = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, ' ');

function 새로() { delete require.cache[require.resolve(MS_PATH)]; return require(MS_PATH); }
function F() {
  const f = {}; f.region = () => f; f.runWith = () => f;
  f.pubsub = { schedule: () => ({ timeZone: () => ({ onRun: (fn) => fn }) }) };
  f.https = { onRequest: (fn) => fn };
  return f;
}
function 판(opt) {
  const o = opt || {};
  const 기록 = { 붙음: 0, noop: 0, fetchOne: 0, dbSet: [], staff: 0 };
  const client = () => ({ usable: true,
    async getMailboxLock() { return { release() {} }; },
    async noop() { 기록.noop++; },
    async fetchOne() { 기록.fetchOne++; return null; },
    async logout() { this.usable = false; } });
  const deps = {
    functions: F(), MAIL_REGION: 'asia-northeast3', setCors: () => {},
    requireStaff: async () => {
      기록.staff++;
      if (o.비직원) { const e = new Error('직원이 아닙니다'); e.status = 403; throw e; }
      return { uid: 'U1' };
    },
    getDatabase: () => ({ ref: (p) => ({
      once: async () => {
        if (/uid_roles/.test(p)) return { val: () => ({ sid: 'P-003', status: 'active' }) };
        if (/\/folders$/.test(p)) return { val: () => ({ 'INBOX-1': { path: 'INBOX' } }) };
        return { val: () => 'INBOX' };
      },
      set: async (v) => { 기록.dbSet.push([p, v]); },
      update: async (v) => { 기록.dbSet.push([p, v]); },
    }) }),
    mailUserAsync: async () => '370-6', mailPass: () => 'pw-secret',
    MD: { loginIds: () => ['370-6'] },
    imapConnect: async () => { 기록.붙음++; return client(); },
  };
  return { 기록, deps };
}
async function call(fn, body, headers) {
  const out = {};
  const res = { status(c) { out.code = c; return res; }, json(b) { out.body = b; return res; }, send() { return res; } };
  await fn({ method: 'POST', headers: headers || {}, body: body || {} }, res);
  return out;
}

for (const name of ['readMailMessage', 'readMailAttachment']) {
  test('★★★ 직원이 깨우면(' + name + ') 연결을 살리고(NOOP) 폴더 주소를 담는다 — 메일은 한 통도 안 읽는다', async () => {
    const M = 새로(); const { 기록, deps } = 판(); const api = M(deps);
    const r = await call(api[name], { warm: 1 });
    assert.equal(r.code, 200);
    assert.equal(r.body.ok, true, '깨웠는데 연결을 못 살렸다');
    assert.equal(r.body.warm, true);
    assert.equal(기록.staff, 1, '★★★ 직원 확인 없이 깨운다 — 아무나 다음메일 접속을 일으킬 수 있다');
    assert.equal(기록.붙음, 1);
    assert.equal(기록.noop, 1);
    assert.equal(기록.fetchOne, 0, '★★★ 깨우기가 메일을 읽는다');
    assert.equal(기록.dbSet.length, 0, '★★ 깨우기가 DB 에 쓴다(읽음 표시 등)');
  });

  test('★★★ 재직 직원이 아니면(' + name + ') 깨워 주지 않는다 — 다음메일에 접속도 안 한다', async () => {
    const M = 새로(); const { 기록, deps } = 판({ 비직원: true }); const api = M(deps);
    const r = await call(api[name], { warm: 1 });
    assert.equal(r.code, 403);
    assert.equal(기록.붙음, 0, '★★★ 직원이 아닌데 다음메일에 붙었다');
  });
}

test('★★ 깨우기가 아닌 보통 부름(warm 없음)은 예전 그대로 — 슬러그·번호가 없으면 400', async () => {
  const M = 새로(); const { 기록, deps } = 판(); const api = M(deps);
  const r = await call(api.readMailMessage, {});
  assert.equal(r.code, 400);
  assert.equal(기록.붙음, 0);
});

/* ── 화면 쪽 ── */
function 화면(over) {
  const log = { fetches: [], timers: [], cleared: [] };
  const box = Object.assign({
    Date, JSON, Promise, MB_FN: 'https://fn/',
    document: { hidden: false },
    state: { view: 'mail' },
    firebase: { auth: () => ({ currentUser: { getIdToken: () => Promise.resolve('TOK') } }) },
    fetch: (url, init) => { log.fetches.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization }); return Promise.resolve({}); },
    setInterval: (fn, ms) => { log.timers.push({ fn, ms }); return log.timers.length; },
    clearInterval: (id) => log.cleared.push(id),
  }, over || {});
  vm.createContext(box);
  vm.runInContext('const MB_WARM_GAP = 150000; let _mbWarmAt = 0, _mbWarmTimer = 0;\n'
    + sliceFn(app, 'function mbWarmPing(') + '\n' + sliceFn(app, 'function mbWarmStart(')
    + '\n;this.ping = mbWarmPing; this.start = mbWarmStart;', box);
  return { box, log };
}
const tick = () => new Promise((r) => setImmediate(r));

test('★★★ 화면이 열려 있으면 메일 열기·첨부 두 함수를 깨운다(본문 warm:1, 로그인 증표 포함)', async () => {
  const { box, log } = 화면();
  box.ping(); await tick(); await tick();
  assert.deepEqual(log.fetches.map((f) => f.url).sort(), ['https://fn/readMailAttachment', 'https://fn/readMailMessage']);
  log.fetches.forEach((f) => { assert.deepEqual(f.body, { warm: 1 }); assert.equal(f.auth, 'Bearer TOK'); });
});

test('★★★ 보이지 않는 탭에서는 안 깨운다 · 로그인 전에도 안 깨운다', async () => {
  const hid = 화면({ document: { hidden: true } });
  hid.box.ping(); await tick(); await tick();
  assert.equal(hid.log.fetches.length, 0, '안 쓰는 탭이 두드린다 — 그게 요금이다');
  const out = 화면({ firebase: { auth: () => ({ currentUser: null }) } });
  out.box.ping(); await tick();
  assert.equal(out.log.fetches.length, 0);
});

test('★★ 2분 30초 안에 또 부르면 건너뛴다 — 연타해도 두 번 나가지 않는다', async () => {
  const { box, log } = 화면();
  box.ping(); box.ping(); box.ping(); await tick(); await tick();
  assert.equal(log.fetches.length, 2, '한 번의 깨우기(두 함수)여야 한다: ' + log.fetches.length);
});

test('★★ 타이머는 한 번만 달고, 메일 화면을 떠나면 스스로 멈춘다', async () => {
  const { box, log } = 화면();
  box.start(); box.start();
  assert.equal(log.timers.length, 1, '타이머가 겹쳐 붙었다');
  assert.ok(log.timers[0].ms <= 60000, '확인 주기가 너무 길다');
  box.state.view = 'cards';
  log.timers[0].fn();
  assert.equal(log.cleared.length, 1, '메일 화면을 떠났는데 계속 두드린다');
});

test('★★ 메일 화면을 그릴 때 시작한다(mbLiveStart 바로 뒤) · 두드림은 «함수 두 개»만', () => {
  assert.match(strip(app), /mbLiveStart\(\);\s*mbWarmStart\(\);/);
  const ping = strip(sliceFn(app, 'function mbWarmPing('));
  assert.match(ping, /\['readMailMessage', 'readMailAttachment'\]/);
  assert.match(ping, /document\.hidden/);
});

test('★ 서명 두드림(월~토 업무 시간)은 그대로 있다 — 이번 일은 «더하기»다', () => {
  assert.match(strip(MS), /mailKeepWarm: F/);
  assert.match(strip(MS), /async function warmReply\(req, res\) \{\s*if \(!warmSigOk\(req\)\)/);
});

test('★★★ 깨우기가 터져도 메일 화면은 안 깨진다 — 시작 함수는 절대 던지지 않는다(그리는 길 위에 있다)', () => {
  const boom = 화면({ firebase: { auth: () => { throw new Error('인증 부품 없음'); } } });
  assert.doesNotThrow(() => boom.box.start());
  const noToken = 화면({ firebase: { auth: () => ({ currentUser: {} }) } });
  assert.doesNotThrow(() => noToken.box.start());
  assert.equal(noToken.log.fetches.length, 0);
});
