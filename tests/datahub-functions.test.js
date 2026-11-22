'use strict';
/* 📊 데이터관리 서버 함수(functions/datahub.js) — 가짜 DB·가짜 인증으로 «막아야 할 것을 막는가»를 본다 (2026-11-21)

   ★ 지키는 것 (계획서 4·5·6절)
     ① 대표 표지(app_owner/uid)와 같은 uid 만 — 관리자대행(isAdmin)도 막는다. 표지를 못 읽어도 막는다(모르면 닫는다)
     ② 질문마다 등록 기기 서명 — 서명 뒤 질문·집계를 바꾸면 거절
     ③ 일회용 문제는 한 번만 — 같은 문제를 동시에 두 번 보내면 하나만 통과, 만료된 것은 거절
     ④ 15분 자리 비움 — 재인증 없이는 401 {reauth:true}
     ⑤ 주민번호·계좌·휴대전화·전자우편·명부 실명이 든 글은 AI 로 보내지 않는다
     ⑥ 현황판 집계는 원본을 읽기만 하고, 쓰는 값의 글자는 앱 key·상태·이름표뿐
   ⚠ 사람 이름·업체·금액은 모두 지어낸 값이다(저장소가 공개). */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DH = require('../functions/datahub.js');
const Device = require('../scripts/datahub-device.js');
const Owner = require('../scripts/datahub-owner.js');

/* ── 가짜 실시간DB — 쓰기를 모두 적어 두고, 트랜잭션은 실제 SDK 처럼 «모르는 값(null)»으로 먼저 부른다 ── */
function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
function segs(p) { return String(p || '').split('/').filter(Boolean); }
function makeDb(init, opts) {
  const o = opts || {};
  const st = { root: clone(init || {}), writes: [] };
  const failRead = o.failRead || [];
  function get(p) {
    let c = st.root;
    for (const s of segs(p)) { if (!c || typeof c !== 'object') return null; c = c[s]; }
    return c === undefined ? null : clone(c);
  }
  function setAt(p, v) {
    const ss = segs(p);
    if (!ss.length) { st.root = v == null ? {} : clone(v); return; }
    let c = st.root;
    for (let i = 0; i < ss.length - 1; i++) {
      if (!c[ss[i]] || typeof c[ss[i]] !== 'object') { if (v == null) return; c[ss[i]] = {}; }
      c = c[ss[i]];
    }
    if (v == null) delete c[ss[ss.length - 1]]; else c[ss[ss.length - 1]] = clone(v);
  }
  function ref(p) {
    const at = segs(p).join('/');
    const blocked = () => failRead.some((f) => at === f || at.startsWith(f + '/'));
    return {
      once: async () => { if (blocked()) throw new Error('읽기 실패(시험)'); return { val: () => get(at) }; },
      set: async (v) => { st.writes.push({ kind: 'set', path: at }); setAt(at, v); },
      update: async (obj) => { st.writes.push({ kind: 'update', path: at }); Object.keys(obj).forEach((k) => setAt(at + '/' + k, obj[k])); },
      remove: async () => { st.writes.push({ kind: 'remove', path: at }); setAt(at, null); },
      push: () => { st.writes.push({ kind: 'push', path: at }); return ref(at + '/x'); },
      transaction: async (fn) => {
        st.writes.push({ kind: 'transaction', path: at });
        await Promise.resolve();
        /* 여기부터 한 번에(동기) — 같은 자리 트랜잭션 둘이 섞이지 않는다 */
        let seen = null;
        let next = fn(seen);
        const actual = get(at);
        if (JSON.stringify(seen) !== JSON.stringify(actual)) { seen = actual; next = fn(clone(actual)); }
        if (next === undefined) return { committed: false, snapshot: { val: () => get(at) } };
        setAt(at, next);
        return { committed: true, snapshot: { val: () => get(at) } };
      },
      child: (c) => ref(at + '/' + c)
    };
  }
  return { ref: ref, st: st, get: get };
}

/* ── 가짜 인증 — index.js requireReader 의 꼴(401·403 + decoded) ── */
function makeReader(tokens) {
  return async function (req) {
    const m = /^Bearer\s+(.+)$/i.exec(String((req.headers || {}).authorization || ''));
    const t = m && tokens[m[1]];
    if (!t) { const e = new Error('로그인'); e.status = 401; throw e; }
    if (t.staff === false) { const e = new Error('재직'); e.status = 403; throw e; }
    return { uid: t.uid, auth_time: Math.floor(t.authAt / 1000) };
  };
}
function call(handler, body, token) {
  return new Promise((resolve) => {
    const res = {
      _s: 200,
      status(s) { this._s = s; return this; },
      json(o) { resolve({ status: this._s, body: o }); },
      send(x) { resolve({ status: this._s, body: x }); },
      set() { return this; }
    };
    handler({ method: 'POST', headers: token ? { authorization: 'Bearer ' + token } : {}, body: body }, res);
  });
}

const OWNER = 'U_OWNER_0001';
const DELEGATE = 'U_DELEGATE_02';
const T0 = Date.UTC(2026, 10, 21, 3, 0, 0);
const MIN = 60 * 1000;
const FAKE_NAMES = ['가나다', '라마바사'];   /* 지어낸 이름 */
const FAKE_CO = '㈜시험가상상사';              /* 지어낸 업체명 */

function keyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const j = publicKey.export({ format: 'jwk' });
  return { jwk: { kty: j.kty, crv: j.crv, x: j.x, y: j.y }, privateKey: privateKey };
}
function sign(pk, nonce, ts, q, ctxJson) {
  return crypto.sign('sha256', Buffer.from(DH.signedMessage(nonce, ts, q, ctxJson), 'utf8'),
    { key: pk, dsaEncoding: 'ieee-p1363' }).toString('base64url');
}

function setup(over) {
  const o = over || {};
  const kp = keyPair();
  const clock = { t: T0 };
  const init = {
    app_owner: { uid: OWNER },
    uid_roles: {
      [OWNER]: { sid: 'P-900', status: 'active', isAdmin: true, fin: true },
      [DELEGATE]: { sid: 'A-901', status: 'active', isAdmin: true, isSubAdmin: true }
    },
    data: { user_dir: { v: FAKE_NAMES.map((n, i) => ({ sid: 'A-' + (910 + i), name: n, status: 'active' })), u: 1 },
      companies: { v: { 'co-1': { id: 'co-1', name: FAKE_CO }, 'co-2': { id: 'co-2', name: '가나', status: 'active' } }, u: 1 } },
    datahub_device: { [OWNER]: { pub: kp.jwk, fp: DH.fingerprint(kp.jwk), name: '시험 PC', approvedAt: T0 - 86400000 } }
  };
  if (o.noDevice) delete init.datahub_device;
  if (o.noOwner) delete init.app_owner;
  const db = makeDb(init, { failRead: o.failRead });
  const tokens = {
    owner: { uid: OWNER, authAt: o.authAt == null ? T0 - MIN : o.authAt },
    delegate: { uid: DELEGATE, authAt: T0 - MIN },
    outsider: { uid: 'U_OUTSIDE_03', authAt: T0, staff: false }
  };
  const ai = { calls: [], tallies: [], spend: o.spend || { known: true, spent: 0, limit: 50000, warn: 45000, over: false } };
  const deps = {
    getDatabase: () => db,
    requireReader: makeReader(tokens),
    setCors: () => {},
    now: () => clock.t,
    log: () => {},
    aiMonthSpend: async () => ai.spend,
    readGeminiKey: async () => 'TEST-KEY',
    fetch: null,
    callGemini: async (fetchFn, key, parts) => {
      ai.calls.push(parts);
      return { ok: true, model: 'test', json: { candidates: [{ content: { parts: [{ text: '시험 답입니다.\n근거: 시험 자료' }] } }] } };
    },
    bumpReadTally: async (app, kind) => { ai.tallies.push([app, kind]); },
    bumpSpend: async () => {}
  };
  return { db, kp, clock, ai, h: DH.handlers(deps), deps };
}
async function nonceOf(env) {
  const r = await call(env.h.challenge, {}, 'owner');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.nonce;
}
function askBody(env, nonce, q, ctxJson, over) {
  const o = over || {};
  const ts = o.ts == null ? env.clock.t : o.ts;
  return { nonce: nonce, ts: ts, q: o.sendQ == null ? q : o.sendQ, ctxJson: o.sendCtx == null ? ctxJson : o.sendCtx,
    sig: sign(env.kp.privateKey, nonce, ts, q, ctxJson) };
}
/* 화면(js/pu-datahub-calc.js pseudonymize)이 만드는 모양 그대로 — 숫자와 가명뿐(지어낸 값) */
const CAT0 = { adv: 0, case: 0, cons: 0, fund: 0, etc: 0 };
const CTX_OBJ = { months: ['2026-09', '2026-10'], basis: 'cash', net: false, unit: '원',
  total: [{ inc: 1520000000, n: 3, task: 10, proc: 2, cat: Object.assign({}, CAT0, { adv: 1520000000 }) }, { inc: 0, n: 0, task: 0, proc: 0, cat: CAT0 }],
  none: [0, 0],
  people: [{ alias: 'P1', kind: '노무사', retired: false, cos: 3, recRate: 92, m: [{ inc: 1520000000, task: 10, proc: 2 }, { inc: 0, task: 0, proc: 0 }], wkN: [1, 2] },
    { alias: 'P2', kind: '직원', retired: false, cos: 0, recRate: null, m: [{ inc: 0, task: 4, proc: 1 }, { inc: 0, task: 0, proc: 0 }], wkN: [0, 1] }],
  companies: [{ alias: 'C-01', owner: 'P1', inc12: 1520000000, task: 4, misu: false, misuMonths: 0 }, { alias: 'C-02', owner: '', inc12: 0, task: 0, misu: null, misuMonths: 0 }] };
const CTX = JSON.stringify(CTX_OBJ);

/* ══ 묻기 ══════════════════════════════════════════════════════════════ */

test('정상 서명이면 통과하고, 질문·집계·답은 서버에 남기지 않는다', async () => {
  const env = setup();
  const q = '10월 입금이 왜 줄었나요?';
  const r = await call(env.h.ask, askBody(env, await nonceOf(env), q, CTX), 'owner');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.ok, true);
  assert.ok(r.body.answer.length > 0);
  assert.equal(env.ai.calls.length, 1);
  const sent = env.ai.calls[0].map((p) => p.text).join('\n');
  assert.ok(sent.includes(CTX) && sent.includes(q), 'AI 에 집계와 질문이 함께 간다');
  assert.ok(sent.includes(DH.SYSTEM_TEXT), '시스템 지시가 함께 간다');
  assert.match(DH.SYSTEM_TEXT, /근거/);
  assert.match(DH.SYSTEM_TEXT, /알 수 없습니다/);
  assert.match(DH.SYSTEM_TEXT, /순위|낙인/);
  assert.equal(env.db.get('datahub_nonce/' + OWNER), null, '쓴 문제는 지운다');
  assert.equal(env.db.get('datahub_activity/' + OWNER + '/last'), env.clock.t, '마지막 질문 시각을 적는다');
  assert.deepEqual(env.ai.tallies, [['datahub', 'n']]);
  const dump = JSON.stringify(env.db.st.root);
  assert.ok(!dump.includes(q) && !dump.includes('시험 답입니다') && !dump.includes('1520000000'), '질문·답·집계를 저장하지 않는다');
  assert.ok(env.db.st.writes.every((w) => /^datahub_(nonce|activity)\//.test(w.path)), '데이터관리 서버 자리 말고는 쓰지 않는다: ' + JSON.stringify(env.db.st.writes));
});

test('서명 뒤 질문이나 집계·시각을 바꾸면 거절한다', async () => {
  const env = setup();
  /* 바꾼 집계도 «모양은 맞게» — 모양 검사(ctxShape)보다 서명 검사가 잡는지를 본다 */
  const tampered = JSON.stringify(Object.assign({}, CTX_OBJ, { none: [1, 2] }));
  for (const over of [{ sendQ: '다른 질문' }, { sendCtx: tampered }]) {
    const r = await call(env.h.ask, askBody(env, await nonceOf(env), '원래 질문', CTX, over), 'owner');
    assert.equal(r.status, 403);
    assert.equal(r.body.why, 'sig');
  }
  const n = await nonceOf(env);
  const b = askBody(env, n, '원래 질문', CTX);
  b.ts = b.ts + 1;   /* 서명한 시각과 다르다 */
  const r = await call(env.h.ask, b, 'owner');
  assert.equal(r.body.why, 'sig');
  /* 다른 열쇠로 서명해도 거절 */
  const other = keyPair();
  const n2 = await nonceOf(env);
  const b2 = askBody(env, n2, '원래 질문', CTX);
  b2.sig = sign(other.privateKey, n2, b2.ts, '원래 질문', CTX);
  assert.equal((await call(env.h.ask, b2, 'owner')).body.why, 'sig');
  assert.equal(env.ai.calls.length, 0, 'AI 를 부르지 않는다');
});

test('같은 일회용 문제를 동시에 두 번 보내면 하나만 통과한다', async () => {
  const env = setup();
  const body = askBody(env, await nonceOf(env), '같은 질문', CTX);
  const rs = await Promise.all([call(env.h.ask, body, 'owner'), call(env.h.ask, body, 'owner')]);
  const codes = rs.map((r) => r.status).sort();
  assert.deepEqual(codes, [200, 403]);
  assert.equal(rs.find((r) => r.status === 403).body.why, 'nonce');
  assert.equal(env.ai.calls.length, 1);
  /* 통과한 뒤 다시 보내도 거절 */
  assert.equal((await call(env.h.ask, body, 'owner')).body.why, 'nonce');
});

test('만료된 일회용 문제는 거절한다', async () => {
  const env = setup();
  const n = await nonceOf(env);
  env.clock.t += DH.LIMITS.nonceMs + 1000;
  const r = await call(env.h.ask, askBody(env, n, '늦은 질문', CTX), 'owner');
  assert.equal(r.status, 403);
  assert.equal(r.body.why, 'nonce');
  /* 지어낸 문제도 거절 */
  const fake = crypto.randomBytes(32).toString('base64url');
  assert.equal((await call(env.h.ask, askBody(env, fake, '질문', CTX), 'owner')).body.why, 'nonce');
  /* 시계가 2분 넘게 다르면 거절 */
  const n2 = await nonceOf(env);
  const old = askBody(env, n2, '질문', CTX, { ts: env.clock.t - DH.LIMITS.clockSkewMs - 1000 });
  assert.equal((await call(env.h.ask, old, 'owner')).body.why, 'clock');
  assert.equal(env.ai.calls.length, 0);
});

test('대표 표지와 다른 uid 는 관리자대행이어도 세 함수 모두 거절한다', async () => {
  const env = setup();
  for (const h of [env.h.deviceRequest, env.h.challenge, env.h.ask]) {
    const r = await call(h, { pub: env.kp.jwk, name: 'x' }, 'delegate');
    assert.equal(r.status, 403);
    assert.equal(r.body.why, 'owner');
    assert.equal((await call(h, {}, null)).status, 401, '토큰이 없으면 401');
    assert.equal((await call(h, {}, 'outsider')).status, 403, '재직자가 아니면 403');
  }
  assert.equal(env.ai.calls.length, 0);
  assert.equal(env.db.st.writes.length, 0, '거절된 요청은 아무것도 쓰지 않는다');
});

test('대표 표지를 못 읽거나 비어 있으면 거절한다(모르면 닫는다)', async () => {
  for (const over of [{ failRead: ['app_owner'] }, { noOwner: true }]) {
    const env = setup(over);
    for (const h of [env.h.deviceRequest, env.h.challenge, env.h.ask]) {
      const r = await call(h, {}, 'owner');
      assert.equal(r.status, 403);
      assert.equal(r.body.why, 'owner');
    }
  }
});

test('15분 넘게 비운 뒤 재인증 없이 물으면 401 {reauth:true}', async () => {
  const env = setup({ authAt: T0 - 3 * 60 * MIN });
  env.db.ref('datahub_activity/' + OWNER + '/last').set(T0 - DH.LIMITS.idleMs - MIN);
  env.db.st.writes.length = 0;
  const r = await call(env.h.ask, askBody(env, await nonceOf(env), '질문', CTX), 'owner');
  assert.equal(r.status, 401);
  assert.equal(r.body.reauth, true);
  assert.equal(env.ai.calls.length, 0);
  /* 마지막 질문이 15분 안이면 통과 */
  env.db.ref('datahub_activity/' + OWNER + '/last').set(T0 - 5 * MIN);
  assert.equal((await call(env.h.ask, askBody(env, await nonceOf(env), '질문', CTX), 'owner')).status, 200);
  /* 방금 비밀번호를 다시 넣었으면(auth_time 이 15분 안) 통과 */
  const fresh = setup({ authAt: T0 - MIN });
  assert.equal((await call(fresh.h.ask, askBody(fresh, await nonceOf(fresh), '질문', CTX), 'owner')).status, 200);
});

test('주민번호·계좌·휴대전화·전자우편·명부 실명이 든 질문·집계는 AI 로 보내지 않는다', async () => {
  const env = setup();
  const esc = (s) => Array.from(s).map((c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
  const cases = [
    ['rrn', '900101-1234567 의 입금은?', CTX],
    ['account', '계좌 110-123-456789 로 들어온 돈', CTX],
    ['account', '국민은행 1234567890 입금', CTX],
    ['phone', '010-1234-5678 에게 물어볼까', CTX],
    ['email', 'abc@example.com 담당 건', CTX],
    ['name', FAKE_NAMES[0] + ' 노무사의 실적은?', CTX],
    ['name', '시험가상상사 입금은 얼마?', CTX]   /* 업체명도 실명처럼(㈜ 떼고도) — 보안 검토 2026-11-21 */
  ];
  void esc;
  for (const [kind, q, ctx] of cases) {
    const r = await call(env.h.ask, askBody(env, await nonceOf(env), q, ctx), 'owner');
    assert.equal(r.status, 400, kind + ' → ' + JSON.stringify(r.body));
    assert.equal(r.body.why, 'pii');
    assert.ok(r.body.kinds.includes(kind), kind + ' 를 잡는다: ' + r.body.kinds);
    assert.ok(!JSON.stringify(r.body).includes(FAKE_NAMES[0]), '걸린 글자를 되돌려주지 않는다');
  }
  assert.equal(env.ai.calls.length, 0);
  /* 가명·연월·금액·비율·업체 코드는 개인정보로 보지 않는다 */
  assert.deepEqual(DH.piiKinds([CTX, 'P1 과 S1 의 2026-10 입금 비교'], FAKE_NAMES), []);
  /* 업체명 — 지운 업체도 넣고(예전 고객도 고객), 두 글자는 «낱말 경계»에서만, 이름 칸 모양이 이상하면 목록이 온전하지 않다(null) */
  assert.deepEqual(DH.namesFromCompanies({ v: [{ name: '가나' }] }), { long: [], short: ['가나'] });
  assert.deepEqual(DH.namesFromCompanies({ v: [{ name: '주식회사 시험상사' }, { name: '옛회사', _deleted: true }, { name: '' }] }).long, ['시험상사', '옛회사']);
  assert.equal(DH.namesFromCompanies({ v: [{ name: { x: 1 } }] }), null);
  assert.equal(DH.shortNameHit(['가나 입금은?'], ['가나']), true);
  assert.equal(DH.shortNameHit(['(가나) 건'], ['가나']), true);
  assert.equal(DH.shortNameHit(['가나다라 입금'], ['가나']), false, '더 긴 낱말 안의 두 글자는 안 걸린다');
});

test('두 글자 업체명·지운 업체명이 든 질문도, 이름 칸이 이상한 업체 목록도 AI 로 보내지 않는다 (보안 2차 재검증)', async () => {
  const env = setup();
  const r = await call(env.h.ask, askBody(env, await nonceOf(env), '가나 입금은 얼마?', CTX), 'owner');
  assert.equal(r.status, 400);
  assert.equal(r.body.why, 'pii');
  await env.db.ref('data/companies/v/co-9').set({ id: 'co-9', name: '지운옛고객사', _deleted: true });
  const r2 = await call(env.h.ask, askBody(env, await nonceOf(env), '지운옛고객사 건은?', CTX), 'owner');
  assert.equal(r2.body.why, 'pii');
  await env.db.ref('data/companies/v/co-8').set({ id: 'co-8', name: { bad: 1 } });
  const r3 = await call(env.h.ask, askBody(env, await nonceOf(env), '질문', CTX), 'owner');
  assert.equal(r3.status, 503);
  assert.equal(env.ai.calls.length, 0);
});

test('집계는 «숫자와 가명» 모양만 받는다 — 모르는 칸·자유 글·이스케이프로 숨긴 실명은 통째로 거절 (보안 검토 2026-11-21 «높음»)', async () => {
  assert.equal(DH.ctxShapeOk(CTX_OBJ), true, '화면이 만드는 모양은 통과');
  const bad = (f) => { const o = JSON.parse(CTX); f(o); return o; };
  const cases = [
    ['모르는 칸', bad((o) => { o.memo = '메모'; })],
    ['자유 글 칸(거르개 설명)', bad((o) => { o.filters = '확정 입금만'; })],
    ['사람 가명 모양이 아님', bad((o) => { o.people[0].alias = FAKE_NAMES[0]; })],
    ['업체 가명 모양이 아님', bad((o) => { o.companies[0].alias = 'A-01'; })],
    ['숫자 칸에 글자', bad((o) => { o.total[0].inc = '1520000000'; })],
    ['사람 칸에 모르는 칸', bad((o) => { o.people[0].name = FAKE_NAMES[1]; })],
    ['담당 칸에 실명', bad((o) => { o.companies[0].owner = FAKE_NAMES[0]; })],
    ['달 모양이 아님', bad((o) => { o.months[0] = '지난달'; })],
    ['기준이 정해진 둘이 아님', bad((o) => { o.basis = 'x'; })],
  ];
  for (const [why, o] of cases) assert.equal(DH.ctxShapeOk(o), false, why + ' 를 통과시킨다');
  /* 서버 손잡이도 같은 검사를 — 서명이 맞아도 AI 를 부르지 않는다 */
  const env = setup();
  const esc = (s) => Array.from(s).map((c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
  const hidden = CTX.replace('"alias":"P1"', '"alias":"P1","사람":"' + esc(FAKE_NAMES[1]) + '"');
  const r = await call(env.h.ask, askBody(env, await nonceOf(env), '이 사람 실적은?', hidden), 'owner');
  assert.equal(r.status, 400);
  assert.equal(r.body.why, 'ctxShape');
  assert.ok(!JSON.stringify(r.body).includes(FAKE_NAMES[1]), '걸린 글자를 되돌려주지 않는다');
  assert.equal(env.ai.calls.length, 0);
});

test('업체 목록을 못 읽거나 «없거나» 모양이 이상하면 업체명 검사를 할 수 없으니 보내지 않는다', async () => {
  const env = setup({ failRead: ['data/companies'] });
  const r = await call(env.h.ask, askBody(env, await nonceOf(env), '질문', CTX), 'owner');
  assert.equal(r.status, 503);
  assert.equal(r.body.why, 'dirUnknown');
  assert.equal(env.ai.calls.length, 0);
  for (const bad of [null, '글자']) {
    const e2 = setup();
    await e2.db.ref('data/companies').set(bad);
    const r2 = await call(e2.h.ask, askBody(e2, await nonceOf(e2), '질문', CTX), 'owner');
    assert.equal(r2.status, 503, '업체 목록이 ' + JSON.stringify(bad) + ' 이면 막는다');
    assert.equal(e2.ai.calls.length, 0);
  }
});

test('업체명·실명 사이에 빈칸을 넣어도 걸린다 · AI 에는 «검사한 객체»를 다시 글로 만든 것만 간다 (보안 재검토 2026-11-21)', async () => {
  const env = setup();
  const r = await call(env.h.ask, askBody(env, await nonceOf(env), '시험 가상 상사 입금은?', CTX), 'owner');
  assert.equal(r.status, 400);
  assert.equal(r.body.why, 'pii');
  /* 같은 열쇠가 둘인 원문 — JSON.parse 는 뒤의 것만 남긴다. AI 로 가는 글에는 앞의 값이 없어야 한다 */
  const dup = CTX.replace('"unit":"원"', '"unit":"앞에 숨긴 글 SECRETXYZ","unit":"원"');
  const r2 = await call(env.h.ask, askBody(env, await nonceOf(env), '질문', dup), 'owner');
  assert.equal(r2.status, 200, JSON.stringify(r2.body));
  const sent = env.ai.calls[env.ai.calls.length - 1].map((p) => p.text).join('\n');
  assert.ok(!sent.includes('SECRETXYZ'), '원문의 숨긴 값이 AI 로 간다');
  assert.ok(sent.includes(JSON.stringify(JSON.parse(dup))), '검사한 객체를 다시 글로 만든 것이 간다');
});

test('명부를 못 읽으면 실명 검사를 할 수 없으니 보내지 않는다', async () => {
  const env = setup({ failRead: ['data/user_dir'] });
  const r = await call(env.h.ask, askBody(env, await nonceOf(env), '질문', CTX), 'owner');
  assert.equal(r.status, 503);
  assert.equal(r.body.why, 'dirUnknown');
  assert.equal(env.ai.calls.length, 0);
});

test('요금 한도에 걸리면 부르기 전에 막는다(readDoc 과 같은 DR.budgetGate, 사람이 누른 것으로)', async () => {
  const env = setup({ spend: { known: true, spent: 999999, limit: 50000, warn: 45000, over: true } });
  const r = await call(env.h.ask, askBody(env, await nonceOf(env), '질문', CTX), 'owner');
  assert.equal(r.status, 429);
  assert.equal(r.body.overBudget, true);
  assert.equal(env.ai.calls.length, 0);
});

/* ══ 기기 등록 요청 · 일회용 문제 ═══════════════════════════════════════ */

test('등록 요청은 공개 열쇠 네 칸만 받고, 지문은 RFC 7638 열쇠 지문 앞 16자다', async () => {
  const env = setup({ noDevice: true });
  const kp = keyPair();
  const r = await call(env.h.deviceRequest, { pub: kp.jwk, name: '대표 사무실 PC' }, 'owner');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const canon = JSON.stringify({ crv: kp.jwk.crv, kty: kp.jwk.kty, x: kp.jwk.x, y: kp.jwk.y });
  const want = crypto.createHash('sha256').update(canon).digest('base64url').slice(0, 16);
  assert.equal(r.body.fp, want);
  const saved = env.db.get('datahub_device_req/' + OWNER);
  assert.deepEqual(Object.keys(saved).sort(), ['at', 'fp', 'name', 'pub']);
  assert.equal(env.db.get('datahub_device/' + OWNER), null, '요청만으로는 기기가 등록되지 않는다');
  /* 1분 안에 또 보내면 거절 */
  assert.equal((await call(env.h.deviceRequest, { pub: kp.jwk, name: '또' }, 'owner')).status, 429);
  /* 비밀 반쪽(d)이 섞이거나, 칸이 다르거나, 이름이 길면 거절 */
  env.clock.t += 2 * MIN;
  const withD = Object.assign({ d: crypto.randomBytes(32).toString('base64url') }, kp.jwk);
  assert.equal((await call(env.h.deviceRequest, { pub: withD, name: 'x' }, 'owner')).status, 400);
  assert.equal((await call(env.h.deviceRequest, { pub: Object.assign({}, kp.jwk, { crv: 'P-384' }), name: 'x' }, 'owner')).status, 400);
  const offCurve = { kty: 'EC', crv: 'P-256', x: Buffer.alloc(32, 1).toString('base64url'), y: Buffer.alloc(32, 2).toString('base64url') };
  assert.equal((await call(env.h.deviceRequest, { pub: offCurve, name: 'x' }, 'owner')).status, 400, '곡선 밖의 점');
  assert.equal((await call(env.h.deviceRequest, { pub: kp.jwk, name: 'ㄱ'.repeat(DH.LIMITS.nameMax + 1) }, 'owner')).status, 400);
});

test('일회용 문제는 등록 기기가 있어야 나오고, 새 문제가 옛 문제를 갈음한다', async () => {
  const none = setup({ noDevice: true });
  const r0 = await call(none.h.challenge, {}, 'owner');
  assert.equal(r0.status, 403);
  assert.equal(r0.body.why, 'noDevice');
  const env = setup();
  const a = await nonceOf(env);
  const b = await nonceOf(env);
  assert.match(b, DH.NONCE_RE);
  assert.deepEqual(Object.keys(env.db.get('datahub_nonce/' + OWNER)), [b], '지난 문제는 지운다');
  assert.notEqual(a, b);
  /* 1분에 몇 번까지 — 넘으면 거절 */
  let last = 200;
  for (let i = 0; i < DH.LIMITS.chalPerMin + 1; i++) last = (await call(env.h.challenge, {}, 'owner')).status;
  assert.equal(last, 429);
});

/* ══ 현황판 집계 ═══════════════════════════════════════════════════════ */

function boardFixture(role) {
  const m = '2026-11';
  const secret = { client: '가나다상사', memo: '비밀 메모 본문', amount: 12345678 };
  return {
    secret: secret,
    init: {
      app_owner: { uid: OWNER },
      uid_roles: { [OWNER]: Object.assign({ sid: 'P-900', status: 'active' }, role) },
      data: {
        cases: { v: [
          { id: 'C1', receiveDate: m + '-03', status: 'progress', clientName: secret.client, memo: secret.memo },
          { id: 'C2', receiveDate: '2026-01-05', status: 'closed', clientName: secret.client },
          { id: 'C3', receiveDate: m + '-04', _deleted: true }
        ], u: 1 },
        contracts: { v: { K1: { id: 'K1', endDate: '2026-12-01', amount: secret.amount }, K2: { id: 'K2', endDate: '2026-12-01', status: 'cancelled' } }, u: 1 },
        finance_income: { v: [
          { id: 'F1', date: m + '-02', amount: secret.amount, payer: secret.client },
          { id: 'F2', date: m + '-09', amount: 1 },
          { id: 'F3', date: m + '-10', amount: 1, _deleted: true },
          { id: 'F4', date: m + '-11', amount: 1, undoneDate: m + '-12' },
          { id: 'F5', date: '2026-02-01', amount: 1 }
        ], u: 1 },
        ledger_held: { v: [{ id: 'H1', memo: secret.memo }], u: 1 },
        user_accounts: { v: { 'A-1': { name: secret.client, status: 'active', hireDate: m + '-01' } }, u: 1 },
        attendance_records: { v: [{ id: 'T1', date: '2026-11-21', note: secret.memo }], u: 1 }
      },
      harass_invest: { cases: { H1: { id: 'H1', receiveDate: m + '-01', dueDate: '2026-11-01', steps: { intake: { done: true } }, name: secret.client } } },
      work_erp: { items: { W1: { title: secret.memo, created_at: m + '-05T01:00:00.000Z', due: '2026-11-01', state: 'open' } }, steps: { W1: { s1: { done: true }, s2: { done: false } } } },
      gov_feed: { rows: { r1: { nm: secret.client } }, last: { added: 1, error: 'https://example.invalid/?serviceKey=SECRET', errors: ['x'] } },
      mailbox: { folders: { a: { kind: 'inbox', total: 10, unseen: 2, name: secret.client }, b: { kind: 'trash', total: 99, unseen: 9 } } },
      puphotos: { owners: { [OWNER]: { name: secret.client } }, u: { [OWNER]: { items: { 2026: { p1: { upAt: T0, read: { text: secret.memo } }, p2: { upAt: T0 } } }, blobs: { p1: 'BLOB' } } } }
    }
  };
}
function stringsDeep(v, out) {
  out = out || [];
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => stringsDeep(x, out));
  else if (v && typeof v === 'object') Object.keys(v).forEach((k) => stringsDeep(v[k], out));
  return out;
}
function numbersDeep(v, out) {
  out = out || [];
  if (typeof v === 'number') out.push(v);
  else if (v && typeof v === 'object') Object.keys(v).forEach((k) => numbersDeep(v[k], out));
  return out;
}

test('현황판 집계가 쓰는 값의 글자는 앱 key·상태·이름표뿐이고, 원본의 이름·본문·금액은 담지 않는다', async () => {
  const fx = boardFixture({ isAdmin: true, fin: true });
  const db = makeDb(fx.init);
  const r = await DH.boardTally({ getDatabase: () => db, now: () => T0, log: () => {} });
  assert.ok(r.wrote > 0);
  const board = db.get('datahub_board');
  const allowed = DH.allowedStrings();
  const strs = stringsDeep(board);
  assert.ok(strs.length > 0);
  for (const s of strs) assert.ok(allowed.has(s), '이름표 목록 밖의 글자: ' + s);
  const dump = JSON.stringify(board);
  for (const bad of [fx.secret.client, fx.secret.memo, 'serviceKey', 'SECRET', 'BLOB']) assert.ok(!dump.includes(bad), '원본 글자가 섞였다: ' + bad);
  assert.ok(!numbersDeep(board).includes(fx.secret.amount), '금액이 섞였다');
  for (const k of Object.keys(board)) {
    assert.match(k, /^[a-z][a-z0-9_]*$/);
    assert.ok(['ok', 'na'].includes(board[k].state), '상태는 ok·na 만(주의 색은 대표가 기준을 정한 뒤)');
    assert.ok(DH.checkBoardRecord(k, board[k]).ok, k);
  }
  /* 입금 줄은 erpIncomeLive 와 같은 거르개 — 지운 줄·되돌린 줄은 세지 않는다 */
  const fin = board.fin;
  assert.equal(fin.state, 'ok');
  const live = fx.init.data.finance_income.v.filter(DH.erpIncomeLive);
  assert.equal(fin.n[0].v, live.filter((f) => f.date.startsWith('2026-11')).length);
  assert.ok(fin.n[0].v < fx.init.data.finance_income.v.filter((f) => f.date.startsWith('2026-11')).length, '거르개가 실제로 걸렀다');
  /* 이알피 사건 — 휴지통은 빼고, 끝난 건은 종결 비율로만 */
  assert.equal(board.erp.n[0].v, fx.init.data.cases.v.filter((c) => !c._deleted).length);
  assert.equal(board.erp.n[2].v, 1, '끝난(취소) 계약은 만료 임박에서 뺀다');
  /* 수집 오류는 «횟수만» */
  assert.equal(typeof board.govbid.n[2].v, 'number');
  /* 서버가 못 세는 앱은 0 이 아니라 na + 까닭 */
  for (const k of ['hangul', 'pbox', 'orch', 'paydata', 'aliounion']) {
    assert.equal(board[k].state, 'na');
    assert.ok(board[k].why && !board[k].n.length, k);
  }
});

test('현황판 집계는 원본 자리에 쓰지 않는다 — 쓰는 곳은 datahub_board 한 번뿐', async () => {
  const fx = boardFixture({ isAdmin: true, fin: true });
  const db = makeDb(fx.init);
  await DH.boardTally({ getDatabase: () => db, now: () => T0, log: () => {} });
  assert.deepEqual(db.st.writes, [{ kind: 'update', path: 'datahub_board' }]);
  /* 사진 본문(blobs)은 읽지도 않는다 — 원본은 그대로 */
  assert.deepEqual(db.get('data'), fx.init.data);
  /* 대표 표지가 없으면 아무것도 쓰지 않는다 */
  const none = makeDb(Object.assign({}, fx.init, { app_owner: null }));
  const r = await DH.boardTally({ getDatabase: () => none, now: () => T0, log: () => {} });
  assert.equal(r.wrote, 0);
  assert.equal(none.st.writes.length, 0);
});

test('대표 계정에 그 원본을 읽을 권한이 없으면 그 카드는 채우지 않는다(결정 ⑨-2)', async () => {
  const fx = boardFixture({ isAdmin: true });   /* 재무 권한 없음 */
  const db = makeDb(fx.init);
  await DH.boardTally({ getDatabase: () => db, now: () => T0, log: () => {} });
  const board = db.get('datahub_board');
  for (const k of DH.BOARD_APPS.filter((a) => a.need === 'fin').map((a) => a.key)) {
    assert.equal(board[k].state, 'na', k);
    assert.equal(board[k].why, DH.WHY.noPerm);
  }
  assert.equal(board.erp.state, 'ok', '재직자면 읽는 자리는 그대로 채운다');
});

test('현황판 카드 열쇠는 포털 앱 key 다', () => {
  const html = fs.readFileSync(path.join(ROOT, 'enter.html'), 'utf8');
  const keys = new Set(Array.from(html.matchAll(/key\s*:\s*'([a-z][a-z0-9_]*)'/g)).map((m) => m[1]));
  const missing = DH.BOARD_APPS.map((a) => a.key).filter((k) => !keys.has(k));
  assert.deepEqual(missing, [], '포털에 없는 카드 열쇠');
  for (const a of DH.BOARD_APPS) {
    if (a.na) { assert.ok(DH.WHY[a.na], a.key); continue; }
    assert.ok(['login', 'staff', 'self', 'admin', 'mgr', 'fin', 'settleR'].includes(a.need), a.key + ' 읽기 권한');
    assert.ok(a.labels.length >= 1 && a.labels.length <= 3, a.key + ' 숫자는 1~3칸');
  }
});

/* ══ index.js 내보내기 ═════════════════════════════════════════════════ */

test('index.js 가 네 함수를 내보내고 배포 이름 대조를 지난다 — 열쇠는 묻기 함수만 건다', () => {
  const src = fs.readFileSync(path.join(ROOT, 'functions', 'index.js'), 'utf8');
  const names = ['datahubDeviceRequest', 'datahubChallenge', 'datahubAsk', 'datahubBoardTally'];
  const chk = require('../scripts/firebase-deploy-check.js').check(names.join(','), src);
  assert.equal(chk.ok, true, chk.why);
  const block = (n) => { const at = src.indexOf('exports.' + n + ' ='); const next = src.indexOf('\nexports.', at + 5); return src.slice(at, next < 0 ? undefined : next); };
  assert.match(block('datahubAsk'), /secrets\s*:\s*\[[^\]]*["']GEMINI_KEY["']/);
  assert.match(block('datahubAsk'), /MAIL_REGION/);
  assert.match(block('datahubBoardTally'), /pubsub\.schedule\(/);
  for (const n of ['datahubDeviceRequest', 'datahubChallenge']) assert.doesNotMatch(block(n), /readGeminiKey|GEMINI_KEY/, n + ' 는 AI 를 부르지 않는다');
  /* 문지기는 index.js 의 requireReader(토큰 철회 확인 + 재직 로그인)를 그대로 쓴다 */
  assert.match(src, /function datahubDeps\(\)[\s\S]{0,200}requireReader/);
  const { stripJs } = require('./strip-comments');
  const mod = stripJs(fs.readFileSync(path.join(ROOT, 'functions', 'datahub.js'), 'utf8'));
  assert.doesNotMatch(mod, /readDoc|PuAiCall/, '범용 판독 창구를 거치지 않는다');
});

/* ══ 터미널 도구 ═══════════════════════════════════════════════════════ */

function fakeIo(server) {
  const io = { server: server, updates: [], backups: [], logs: [], now: () => T0,
    get: (p) => { const v = segs(p).reduce((c, s) => (c && typeof c === 'object') ? c[s] : undefined, io.server); return v === undefined ? null : clone(v); },
    update: (patch) => { io.updates.push(patch); Object.keys(patch).forEach((k) => { const ss = segs(k); let c = io.server; for (let i = 0; i < ss.length - 1; i++) { c[ss[i]] = c[ss[i]] || {}; c = c[ss[i]]; } if (patch[k] == null) delete c[ss[ss.length - 1]]; else c[ss[ss.length - 1]] = clone(patch[k]); }); },
    writeBackup: (dir, name, v) => { io.backups.push(v); return '(백업)'; },
    log: (m) => io.logs.push(m) };
  return io;
}

test('기기 승인 도구 — --apply 없이는 쓰지 않고, 지문이 다르거나 10분 지난 요청은 멈춘다', () => {
  const kp = keyPair();
  const fp = DH.fingerprint(kp.jwk);
  const server = () => ({ app_owner: { uid: OWNER }, datahub_device_req: { [OWNER]: { pub: kp.jwk, name: '시험 PC', fp: fp, at: T0 - MIN } } });
  let io = fakeIo(server());
  assert.equal(Device.main(['--approve', fp], io), 0);
  assert.equal(io.updates.length, 0, '미리보기는 쓰지 않는다');
  io = fakeIo(server());
  assert.equal(Device.main(['--approve', 'A'.repeat(16), '--apply'], io), 2);
  assert.equal(io.updates.length, 0, '지문이 다르면 쓰지 않는다');
  const old = server();
  old.datahub_device_req[OWNER].at = T0 - DH.LIMITS.reqTtlMs - MIN;
  io = fakeIo(old);
  assert.equal(Device.main(['--approve', fp, '--apply'], io), 2);
  assert.equal(io.updates.length, 0, '10분 지난 요청은 받지 않는다');
  io = fakeIo(server());
  assert.equal(Device.main(['--approve', fp, '--apply'], io), 0);
  assert.equal(io.updates.length, 1);
  assert.equal(io.backups.length, 1, '쓰기 전에 백업');
  assert.equal(io.server.datahub_device[OWNER].fp, fp);
  assert.ok(!io.server.datahub_device_req || !io.server.datahub_device_req[OWNER], '승인하면 요청을 지운다');
  /* 해제 */
  assert.equal(Device.main(['--revoke', '--apply'], io), 0);
  assert.ok(!io.server.datahub_device || !io.server.datahub_device[OWNER]);
});

test('두 도구의 도움말은 서버를 읽지도 쓰지도 않는다', () => {
  for (const tool of [Device, Owner]) {
    const io = fakeIo({});
    let reads = 0;
    io.get = () => { reads++; return null; };
    assert.equal(tool.main(['--help'], io), 0);
    assert.equal(reads, 0);
    assert.equal(io.updates.length, 0);
  }
});

test('대표 표지 도구 — 지금 값이 있으면 --replace 없이 덮지 않고, 재직자가 아니면 멈춘다', () => {
  const base = () => ({ app_owner: { uid: OWNER }, uid_roles: { U_NEW_00001: { sid: 'P-1', status: 'active', isAdmin: true }, U_OLD_00002: { status: 'retired' } } });
  let io = fakeIo(base());
  assert.equal(Owner.main(['--uid', 'U_NEW_00001', '--apply'], io), 2);
  assert.equal(io.updates.length, 0);
  io = fakeIo(base());
  assert.equal(Owner.main(['--uid', 'U_OLD_00002', '--apply', '--replace'], io), 2);
  assert.equal(io.updates.length, 0);
  io = fakeIo(base());
  assert.equal(Owner.main(['--uid', 'U_NEW_00001', '--replace'], io), 0);
  assert.equal(io.updates.length, 0, '미리보기는 쓰지 않는다');
  assert.equal(Owner.main(['--uid', 'U_NEW_00001', '--apply', '--replace'], io), 0);
  assert.deepEqual(io.updates, [{ 'app_owner/uid': 'U_NEW_00001' }]);
  const empty = fakeIo({ uid_roles: base().uid_roles });
  assert.equal(Owner.main(['--uid', 'U_NEW_00001', '--apply'], empty), 0, '비어 있으면 --replace 없이 넣는다');
});
