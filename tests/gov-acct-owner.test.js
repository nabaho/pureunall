'use strict';
/* 정부사업신청(gov.html) — 한 브라우저에서 계정이 바뀌어도 이 기기 자료가 «다른 계정 클라우드로» 가지 않는다 (2026-11-22)

   ⚠★ 자동 보안 검토 «높음»(PR #3241 검토에서 «원래 있던 구조»로 갈라 옴):
      이 기기 저장소(gov3_*)에 계정 구분이 없어, A 가 쓰던 브라우저로 B 가 로그인하면
      A 의 인증키(key_data·key_biz)·공고(feed)·진행 사업(pursue)·«보낼 칸» 표시가 B 의 gov/{uid} 와 합쳐져 «B 클라우드로» 올라갔다.
      2026-10-30 부터 재직 직원도 이 앱을 써서 공용 PC 에서 실제로 생길 수 있다.

   ★ 여기서 못 박는 규칙 — 진짜 화면 코드(boot → 로그인 처리)를 가짜 파이어베이스로 «돌려» 본다(되풀이된 실수 ②: 글자만 찾는 검사는 헛돈다)
     ① A→B: A 의 인증키·공고·진행 사업이 gov/B 에 한 글자도 안 간다 · B 화면(이 기기 칸)에 A 것이 안 남는다 · A 것은 지우지 않고 옮겨 둔다
     ② B→A: A 자료가 그대로 돌아오고, A 가 못 보낸 고침은 «gov/A» 로 간다(B 것은 안 섞인다)
     ③ 대표 한 계정 흐름은 그대로 — 묻지 않고, 못 보낸 고침은 제 클라우드로 간다.
        주인 표시가 없는 옛 자료도 «이 계정과 주고받은 증거»(같은 시각표)가 있거나 올라갈 것이 없으면 묻지 않는다
     ④ 증거가 없고 올라갈 것이 있으면 «올리기 전에 묻는다» — 아니라면 올리지도 지우지도 않는다(따로 보관)
     ⑤ 주인이 다르면 받기·보내기가 아무것도 안 한다 · 읽는 사이 주인이 바뀌면 쓰지 않는다
     ⑥ 저장 공간이 꽉 차도 옮기기가 되고, 그래도 안 되면 아무것도 잃지 않고 이 계정으로는 잠근다
     ⑦ 열린 화면에서 다른 계정으로 바뀌면 «새로 연다»(화면이 쥔 앞 계정 것을 넘기지 않는다)

   node --test tests/gov-acct-owner.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'gov.html'), 'utf8');
const S = require('../js/gov-sync.js');
const CODE = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
  .map((m) => m[1]).join('\n').replace(/\bboot\(\);\s*$/, '');
assert.ok(/function boot\(/.test(CODE), '부팅 함수를 못 찾았습니다');

const TODAY = new Date().toISOString().slice(0, 10);
const FUTURE = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10) + ' 18:00';

/* ── 가짜 브라우저 저장소 — 한 브라우저를 여러 «화면»이 함께 쓴다. limit 을 주면 글자 수 한도(꽉 찬 저장소) ── */
function browser(init, limit) {
  const m = new Map(Object.entries(init || {}));
  const used = () => [...m].reduce((s, [k, v]) => s + k.length + v.length, 0);
  const ls = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      v = String(v);
      const old = m.has(k) ? k.length + m.get(k).length : 0;
      if (limit && used() - old + k.length + v.length > limit) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
      m.set(k, v);
    },
    removeItem: (k) => { m.delete(k); },
  };
  return { ls, m, used, setLimit(n) { limit = n; }, get: (k) => (m.has('gov3_' + k) ? m.get('gov3_' + k) : null) };
}

/* ── 가짜 클라우드(RTDB) — 여러 계정이 한 나무를 쓴다. update 는 칸마다, set(통째)은 막는다 ── */
function cloudOf(init) {
  const tree = JSON.parse(JSON.stringify(init || {}));
  const writes = [], reads = [];
  let gate = null;
  const at = (p) => p.split('/').filter(Boolean).reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), tree);
  const put = (p, v) => {
    const ks = p.split('/').filter(Boolean); let o = tree;
    ks.slice(0, -1).forEach((k) => { if (!o[k] || typeof o[k] !== 'object') o[k] = {}; o = o[k]; });
    o[ks[ks.length - 1]] = JSON.parse(JSON.stringify(v));
  };
  const db = { ref(p) { return {
    once() {
      reads.push(p);
      const v = at(p); const snap = { val: () => (v === undefined ? null : JSON.parse(JSON.stringify(v))) };
      return gate ? gate.then(() => snap) : Promise.resolve(snap);
    },
    update(u) { writes.push({ path: p, upd: JSON.parse(JSON.stringify(u)) }); Object.keys(u).forEach((k) => put(p + '/' + k, u[k])); return Promise.resolve(); },
    set() { throw new Error('통째 set() 은 쓰지 않는다'); }
  }; } };
  return { db, tree, writes, reads, at,
    hold() { let r; gate = new Promise((res) => { r = res; }); return () => { gate = null; r(); }; },
    sentTo(uid) { return JSON.stringify(writes.filter((w) => w.path === 'gov/' + uid || w.path.indexOf('gov/' + uid + '/') === 0)); } };
}

/* ── 화면 하나를 연다(새로 고침 = 새 화면). 같은 브라우저 저장소를 쓴다 ── */
function openPage(br, cloud, opt) {
  opt = opt || {};
  const els = {}, toasts = [], reloads = [], asked = [];
  function el(id) {
    if (!els[id]) els[id] = { id, innerHTML: '', textContent: '', value: '', className: '', checked: false, title: '',
      style: {}, classList: { add() {}, remove() {}, toggle() {} } };
    return els[id];
  }
  el('uView').value = 'live';
  let authCb = null;
  const timers = [];
  const fb = {
    apps: [], initializeApp() { fb.apps.push(1); },
    database: () => cloud.db,
    auth: Object.assign(() => ({ setPersistence() {}, onAuthStateChanged(cb) { authCb = cb; }, signOut() {} }),
      { Auth: { Persistence: { LOCAL: 'local' } } })
  };
  const ctx = {
    console, Math, JSON, Date, String, Number, Object, Array, RegExp, Promise, TextDecoder, Uint8Array,
    setTimeout: (f) => { timers.push(f); return timers.length; }, clearTimeout: () => {},
    localStorage: br.ls,
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: el, createElement: () => ({ click() {}, style: {} }), addEventListener() {},
      documentElement: null, visibilityState: 'visible' },
    location: { protocol: 'https:', search: '', href: '', pathname: '/gov.html', reload() { reloads.push(1); } },
    navigator: {},
    GovG2b: require('../js/gov-g2b.js'), GovPlan: require('../js/gov-plan.js'), GovCareer: require('../js/gov-career.js'),
    KcareerAdvSummary: require('../js/kcareer-adv-summary.js'), GovAlio: require('../js/gov-alio.js'),
    GovBizinfo: require('../js/gov-bizinfo.js'), GovRecruit: require('../js/gov-recruit.js'),
    GovSubmit: require('../js/gov-submit.js'), GovMatch: require('../js/gov-match.js'), GovOrgRec: require('../js/gov-orgrec.js'),
    GovInbox: require('../js/gov-inbox.js'), GovSync: S, GovRegion: require('../js/gov-region.js'), GovAi: require('../js/gov-ai.js'),
    GovPursue: require('../js/gov-pursue.js'),
    PuGate: { show() {}, hide() {} },
    firebase: fb, fetch: () => Promise.reject(new Error('no net')),
    AbortController: function () { this.abort = () => {}; this.signal = null; },
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} }, Blob: function () {},
    prompt: () => null, open: () => ({}),
    confirm: (m) => { asked.push(m); return !!opt.confirm; },
  };
  ctx.window = ctx;
  vm.runInNewContext(CODE + '\n;toast=function(m){ __toasts.push(m); };'
    + 'globalThis.__api={boot,lsSet,lsGet,get,keyData,keyBiz,cloudPull,acctEnter,'
    + 'setUid:function(u){ fbUid=u; },state:function(){ return { fbUid:fbUid, syncOk:_syncOk, syncUid:_syncUid }; }};',
  Object.assign(ctx, { __toasts: toasts }));
  const api = ctx.__api;
  async function drain() { for (let i = 0; i < 12; i++) { timers.splice(0).forEach((f) => f()); await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r)); } }
  api.boot();
  return {
    api, el, toasts, reloads, asked, timers, drain,
    async login(uid) { await authCb({ uid, email: uid.toLowerCase() + '@test.invalid' }); await drain(); },
    locked: () => el('lock').style.display === 'flex',
  };
}

/* ── 지어낸 자료 — 계정마다 «알아볼 표시»를 넣어 섞였는지 본다 ── */
const T = 1763700000000;   /* 고친 시각(천분의 1초) — 계정마다 다르다 */
function rowOf(no, nm) {
  return { id: 'G0001', src: '나라장터', no, type: '관심', nm, org: '점검기관', ntce: '점검기관', closeDt: FUTURE,
    prc: 0, mthd: '일반경쟁', kw: '노무', url: 'https://example.com/' + no, savedAt: TODAY + 'T09:00:00', hidden: false };
}
function pursueOf(id, title) {
  return { id, entityType: 'Project', schemaVersion: 1, kind: 'corp', state: '진행', src: 'feed', ref: 'G0001', title, org: '점검기관',
    files: [], createdAt: TODAY + 'T01:00:00.000Z', updatedAt: TODAY + 'T01:00:00.000Z' };
}
/* A 가 쓰던 이 기기 — 클라우드와 주고받은 적이 있고(같은 시각표), 진행 사업 한 줄은 아직 «못 보냈다»(보낼 칸) */
function deviceOfA(owner) {
  const o = {
    gov3_key_data: 'A-열쇠-데이터', gov3_key_biz: 'A-열쇠-기업', gov3_last: TODAY,
    gov3_feed: JSON.stringify([rowOf('A-공고-1', 'A 노무관리 컨설팅 용역')]),
    gov3_pursue: JSON.stringify([pursueOf('PS-A1', 'A 진행 사업')]),
    gov3__stamps: JSON.stringify({ key_data: { _: T + 1 }, key_biz: { _: T + 2 }, last: { _: T + 3 }, feed: { 'A-공고-1': T + 4 }, pursue: { 'PS-A1': T + 5 } }),
    gov3__dirty: JSON.stringify({ pursue: 1 }),
    gov3_ai_back: JSON.stringify({ at: T, months: 6, weeks: { '2026-11-02': 1 } })
  };
  if (owner) o.gov3__owner = owner;
  return o;
}
/* A 의 클라우드 — 진행 사업(PS-A1)만 아직 안 왔다 */
const cloudA = () => ({ sv: 2, key_data: 'A-열쇠-데이터', key_biz: 'A-열쇠-기업', last: TODAY, feed: [rowOf('A-공고-1', 'A 노무관리 컨설팅 용역')],
  stamp: { key_data: { _: T + 1 }, key_biz: { _: T + 2 }, last: { _: T + 3 }, feed: { 'A-공고-1': T + 4 } } });
const cloudB = () => ({ sv: 2, key_data: 'B-열쇠-데이터', last: TODAY, feed: [rowOf('B-공고-1', 'B 임금체계 컨설팅')],
  pursue: [pursueOf('PS-B1', 'B 진행 사업')],
  stamp: { key_data: { _: T + 101 }, last: { _: T + 102 }, feed: { 'B-공고-1': T + 103 }, pursue: { 'PS-B1': T + 104 } } });
const world = (gov) => cloudOf({ gov: gov || { A: cloudA(), B: cloudB() },
  uid_roles: { A: { status: 'active', sid: 'P-001' }, B: { status: 'active', sid: 'P-002' } } });
const A_MARKS = ['A-열쇠-데이터', 'A-열쇠-기업', 'A-공고-1', 'PS-A1'];
const B_MARKS = ['B-열쇠-데이터', 'B-공고-1', 'PS-B1'];
const has = (s, marks) => marks.filter((m) => String(s).indexOf(m) >= 0);
/* 이 기기에서 지금 «쓰는» 칸(옮겨 둔 자리 gov3__acct.* 는 빼고) */
const liveOf = (br) => JSON.stringify([...br.m].filter(([k]) => k.indexOf('gov3_') === 0 && k.indexOf('gov3__acct.') !== 0));
const parkedOf = (br, owner) => JSON.stringify([...br.m].filter(([k]) => k.indexOf('gov3__acct.' + owner) === 0));

/* ═══ ① ② 계정 전환 ═══ */

test('★★★ A→B — A 의 인증키·공고·진행 사업·보낼 칸이 gov/B 로 가지 않고, B 화면에도 남지 않는다', async () => {
  const br = browser(deviceOfA('A')), cloud = world();
  const p = openPage(br, cloud);
  await p.login('B');
  assert.deepEqual(has(cloud.sentTo('B'), A_MARKS), [], 'A 의 자료가 B 클라우드로 올라갔습니다');
  assert.deepEqual(has(JSON.stringify(cloud.tree.gov.B), A_MARKS), []);
  assert.deepEqual(has(liveOf(br), A_MARKS), [], 'B 가 쓰는 이 기기 칸에 A 자료가 남았습니다');
  assert.equal(p.api.keyData(), 'B-열쇠-데이터', 'B 는 제 클라우드의 인증키를 받는다');
  assert.ok(p.api.get('feed').some((r) => r.no === 'B-공고-1'), 'B 의 공고를 받는다');
  assert.equal(br.get('_owner'), 'B');
  /* 지우지 않고 옮겨 둔다 — 보낼 칸 표시·시각·받은 기록까지 */
  const parked = parkedOf(br, 'A');
  assert.deepEqual(has(parked, A_MARKS), A_MARKS, 'A 자료를 지웠습니다 — 옮겨 둬야 합니다');
  assert.ok(br.m.has('gov3__acct.A._dirty') && br.m.has('gov3__acct.A._stamps') && br.m.has('gov3__acct.A.ai_back'));
  assert.equal(p.asked.length, 0, '계정 전환은 묻지 않는다(옮겨 두기만 하므로)');
  assert.ok(p.toasts.some((t) => /따로 보관/.test(t)), '앞 계정 자료를 어디 뒀는지 말한다');
  assert.ok(!p.locked());
});

test('★★★ A→B→A — A 로 돌아오면 A 자료가 그대로이고, A 가 못 보낸 고침은 gov/A 로 간다(B 것은 안 섞인다)', async () => {
  const br = browser(deviceOfA('A')), cloud = world();
  await openPage(br, cloud).login('B');
  const before = cloud.writes.length;
  const p2 = openPage(br, cloud);
  await p2.login('A');
  assert.equal(p2.api.keyData(), 'A-열쇠-데이터'); assert.equal(p2.api.keyBiz(), 'A-열쇠-기업');
  assert.ok(p2.api.get('feed').some((r) => r.no === 'A-공고-1'));
  assert.ok(p2.api.get('pursue').some((r) => r.id === 'PS-A1'));
  assert.deepEqual(has(liveOf(br), B_MARKS), [], 'A 가 쓰는 이 기기 칸에 B 자료가 남았습니다');
  const toA = JSON.stringify(cloud.writes.slice(before).filter((w) => w.path.indexOf('gov/A') === 0));
  assert.ok(toA.indexOf('PS-A1') >= 0, 'A 가 못 보낸 진행 사업이 A 클라우드로 가야 합니다');
  assert.deepEqual(has(toA, B_MARKS), [], 'B 자료가 A 클라우드로 올라갔습니다');
  assert.deepEqual(has(JSON.stringify(cloud.tree.gov.A), B_MARKS), []);
  assert.deepEqual(has(parkedOf(br, 'B'), ['B-열쇠-데이터']), ['B-열쇠-데이터'], 'B 것도 지우지 않고 옮겨 둔다');
  assert.equal(br.m.has('gov3__acct.A.feed'), false, '꺼낸 자리는 비운다(두 벌로 두지 않는다)');
});

/* ═══ ③ 대표 한 계정 흐름 ═══ */

test('★★★ 한 계정(주인 = 로그인 계정) — 묻지 않고, 아무것도 옮기지 않고, 못 보낸 고침은 제 클라우드로 간다', async () => {
  const br = browser(deviceOfA('A')), cloud = world();
  const p = openPage(br, cloud);
  await p.login('A');
  assert.equal(p.asked.length, 0);
  assert.ok(!p.toasts.some((t) => /따로 보관/.test(t)));
  assert.ok(![...br.m.keys()].some((k) => k.indexOf('gov3__acct.') === 0), '한 계정인데 옮겼습니다');
  assert.ok(cloud.sentTo('A').indexOf('PS-A1') >= 0, '못 보낸 고침이 그대로 가야 합니다');
  assert.equal(p.api.keyData(), 'A-열쇠-데이터');
  assert.equal(p.api.state().syncUid, 'A');
});

test('★★★ 주인 표시 없는 옛 자료 + 이 계정과 주고받은 증거(같은 시각표) — 묻지 않고 이 계정 것으로, 못 보낸 고침도 간다', async () => {
  const br = browser(deviceOfA(null)), cloud = world();
  const p = openPage(br, cloud);
  await p.login('A');
  assert.equal(p.asked.length, 0, '대표가 늘 쓰던 기기에서 묻게 됐습니다');
  assert.equal(br.get('_owner'), 'A');
  assert.ok(cloud.sentTo('A').indexOf('PS-A1') >= 0);
});

test('★★ 주인 표시 없는 옛 자료 + 올라갈 것이 없음 — 묻지 않고 이 계정 것으로', async () => {
  const br = browser({ gov3_kw: '["노무"]' }), cloud = world({ A: { sv: 2, kw: '["노무"]' } });
  const p = openPage(br, cloud);
  await p.login('A');
  assert.equal(p.asked.length, 0);
  assert.equal(br.get('_owner'), 'A');
  assert.equal(cloud.sentTo('A'), '[]', '올릴 것이 없으면 쓰지 않는다');
});

test('★ 빈 기기 — 묻지 않고 이 계정 것으로, 제 클라우드에서 받는다', async () => {
  const br = browser({}), cloud = world();
  const p = openPage(br, cloud);
  await p.login('B');
  assert.equal(p.asked.length, 0);
  assert.equal(br.get('_owner'), 'B');
  assert.equal(p.api.keyData(), 'B-열쇠-데이터');
});

/* ═══ ④ 증거 없는 옛 자료 ═══ */

test('★★★ 주인 표시 없는 옛 자료 + 증거 없음 — «올리기 전에 묻고», 아니라면 올리지도 지우지도 않는다', async () => {
  const br = browser(deviceOfA(null)), cloud = world();
  const p = openPage(br, cloud, { confirm: false });
  await p.login('B');
  assert.equal(p.asked.length, 1, '한 번 묻는다');
  assert.match(p.asked[0], /인증키/, '무엇이 올라가는지 말한다');
  assert.match(p.asked[0], /지우지 않/);
  assert.deepEqual(has(cloud.sentTo('B'), A_MARKS), [], '«아니오»인데 올렸습니다');
  assert.deepEqual(has(liveOf(br), A_MARKS), []);
  const kept = JSON.stringify([...br.m].filter(([k]) => k.indexOf('gov3__acct.?') === 0));
  assert.deepEqual(has(kept, A_MARKS), A_MARKS, '«아니오»면 따로 보관해야 합니다 — 지웠습니다');
  assert.equal(br.get('_owner'), 'B');
  assert.equal(p.api.keyData(), 'B-열쇠-데이터');
});

test('★★ 같은 경우 «내 것이 맞다»면 그때 합쳐 올린다 — 묻는 것이 진짜 문이다', async () => {
  const br = browser(deviceOfA(null)), cloud = world();
  const p = openPage(br, cloud, { confirm: true });
  await p.login('B');
  assert.equal(p.asked.length, 1);
  assert.ok(cloud.sentTo('B').indexOf('PS-A1') >= 0);
  assert.equal(br.get('_owner'), 'B');
});

test('★★ 클라우드에 못 닿으면 옛 자료를 «정하지 않고» 아무것도 보내지 않는다', async () => {
  const br = browser(deviceOfA(null)), cloud = world();
  const p = openPage(br, cloud, { confirm: true });
  const realRef = cloud.db.ref;
  cloud.db.ref = (pth) => (pth.indexOf('gov/') === 0 ? { once: () => Promise.reject(new Error('net')), update() { throw new Error('보냈습니다'); } } : realRef(pth));
  await p.login('B');
  assert.equal(br.get('_owner'), null, '확인도 못 했는데 주인을 정했습니다');
  assert.equal(p.asked.length, 0);
  assert.ok(p.api.get('feed').some((r) => r.no === 'A-공고-1'), '못 닿았다고 이 기기 자료를 치우지 않는다');
});

/* ═══ ⑤ 주인이 다르면 받기·보내기가 아무것도 안 한다 ═══ */

test('★★★ 주인이 다르면(주인 맞추기 전) 받기·보내기가 클라우드를 읽지도 쓰지도 않는다', async () => {
  const br = browser(deviceOfA('A')), cloud = world();
  const p = openPage(br, cloud);            /* 로그인 처리 전 — 화면만 떴다 */
  p.api.setUid('B');
  p.api.lsSet('kw', '["노무","임금"]');      /* 보낼 것이 생긴다 */
  await p.drain();
  assert.equal(await p.api.cloudPull(), false);
  assert.deepEqual(cloud.reads.filter((r) => r.indexOf('gov/') === 0), [], '남의 계정 클라우드를 읽어 이 기기 자료와 합쳤습니다');
  assert.equal(cloud.writes.length, 0, '주인이 아닌 계정으로 보냈습니다');
  assert.equal(p.api.keyData(), 'A-열쇠-데이터', '이 기기 자료는 그대로');
});

test('★★★ 보내는 사이(클라우드를 읽는 동안) 다른 탭이 계정을 바꾸면 — 아무것도 쓰지 않고, A 의 보낼 칸 표시는 옮겨 둔 자리에 남는다', async () => {
  const br = browser(deviceOfA('A')), cloud = world();
  const p = openPage(br, cloud);
  await p.login('A');
  assert.equal(p.api.state().syncOk, true);
  const n0 = cloud.writes.length;
  const release = cloud.hold();
  p.api.lsSet('key_data', 'A-새열쇠');       /* A 가 고쳤다 → 보낼 칸 */
  p.timers.splice(0).forEach((f) => f());   /* 보내기 시작 — 클라우드 읽기에서 멈춰 있다 */
  await new Promise((r) => setImmediate(r));
  /* 다른 탭에서 B 로 로그인 — 이 기기 칸의 주인이 B 로 바뀐다 */
  p.api.setUid('B');
  assert.equal(await p.api.acctEnter('B'), 'ok');
  release();
  await p.drain();
  const late = JSON.stringify(cloud.writes.slice(n0));
  assert.deepEqual(has(late, ['A-새열쇠'].concat(A_MARKS)), [], 'A 자료가 계정이 바뀐 뒤에 올라갔습니다');
  assert.ok((br.m.get('gov3__acct.A._dirty') || '').indexOf('key_data') >= 0, 'A 가 못 보낸 표시를 잃었습니다 — 돌아오면 보내야 합니다');
  assert.equal(br.m.get('gov3__acct.A.key_data'), 'A-새열쇠');
});

test('★★ 다른 탭이 주인을 바꾼 뒤에는 — 이 탭이 아직 앞 계정이어도 보내기가 클라우드를 읽지도 쓰지도 않는다', async () => {
  const br = browser(deviceOfA('A')), cloud = world();
  const p = openPage(br, cloud);
  await p.login('A');
  br.ls.setItem('gov3__owner', 'B');          /* 다른 탭에서 B 로 로그인해 이 기기 칸의 주인이 바뀌었다 */
  const r0 = cloud.reads.length, w0 = cloud.writes.length;
  p.api.lsSet('kw', '["노무","임금"]');
  await p.drain();
  assert.deepEqual(cloud.reads.slice(r0), [], '주인이 아닌데 보내려고 클라우드를 읽었습니다');
  assert.equal(cloud.writes.length, w0);
});

/* ═══ ⑥ 저장 공간 ═══ */

test('★★ 저장 공간이 거의 꽉 차도 옮긴다 — 큰 공고 목록은 «같은 크기를 비우고 바로» 옮겨, 한 글자도 안 잃는다', async () => {
  const dev = deviceOfA('A');
  const big = [rowOf('A-공고-1', 'A 노무관리 컨설팅 용역')];
  for (let i = 2; i < 30; i++) big.push(Object.assign(rowOf('A-공고-' + i, 'A 노무 컨설팅 ' + i + ' ' + 'ㄱ'.repeat(120)), { id: 'G' + String(i).padStart(4, '0') }));
  dev.gov3_feed = JSON.stringify(big);
  const br = browser(dev);
  br.setLimit(br.used() + 1500);             /* 공고 목록(수천 자)을 «복사»할 자리는 없다 */
  assert.ok(dev.gov3_feed.length > 1500);
  const cloud = world();
  const p = openPage(br, cloud);
  await p.login('B');
  assert.ok(!p.locked());
  assert.equal(br.m.get('gov3__acct.A.feed'), dev.gov3_feed, '옮기다 공고 목록이 달라졌습니다');
  assert.deepEqual(has(cloud.sentTo('B'), A_MARKS), []);
});

/* 옮겨 둔 자리 이름은 «_acct.A.» 만큼 길다 — 남은 자리가 그보다 작으면 첫 칸부터, 두세 칸어치면 «몇 칸 옮긴 뒤» 막힌다 */
[['첫 칸부터 못 옮김', 3], ['몇 칸 옮긴 뒤 막힘 — 옮긴 것을 되돌린다', 20]].forEach(([how, room]) => {
  test('★★★ 옮길 자리가 정말 없으면(' + how + ') — 아무것도 안 잃고, 섞이지 않게 이 계정으로는 잠근다', async () => {
    const dev = deviceOfA('A');
    const br = browser(dev);
    br.setLimit(br.used() + room);
    const cloud = world();
    const p = openPage(br, cloud);
    await p.login('B');
    assert.ok(p.locked(), '섞일 수 있는데 열었습니다');
    assert.match(p.el('lockWho').innerHTML, /옮겨 두지 못했습니다/);
    assert.equal(br.get('_owner'), 'A', '주인을 바꿨습니다');
    Object.keys(dev).forEach((k) => assert.equal(br.m.get(k), dev[k], k + ' 가 바뀌거나 사라졌습니다'));
    assert.ok(![...br.m.keys()].some((k) => k.indexOf('gov3__acct.') === 0), '반쯤 옮긴 것이 남았습니다');
    assert.equal(cloud.writes.length, 0);
    assert.deepEqual(cloud.reads.filter((r) => r.indexOf('gov/') === 0), []);
  });
});

/* ═══ ⑦ 열린 화면에서 계정이 바뀌면 새로 연다 ═══ */

test('★★ 열린 화면에서 다른 계정으로 바뀌면 «새로 연다» — 그 화면은 새 계정으로 아무것도 받거나 보내지 않는다', async () => {
  const br = browser(deviceOfA('A')), cloud = world();
  const p = openPage(br, cloud);
  await p.login('A');
  const n0 = cloud.writes.length, r0 = cloud.reads.length;
  await p.login('B');
  assert.equal(p.reloads.length, 1, '새로 열지 않았습니다');
  assert.equal(p.api.state().fbUid, null);
  assert.equal(cloud.writes.length, n0);
  assert.deepEqual(cloud.reads.slice(r0).filter((r) => r.indexOf('gov/B') === 0), []);
  /* 같은 계정으로 다시 로그인(로그아웃 → 로그인)은 새로 열 까닭이 없다 */
  const q = openPage(br, cloud);
  await q.login('A'); await q.login('A');
  assert.equal(q.reloads.length, 0);
});

/* ═══ 판단 함수(순수) ═══ */

test('★★ 계정에 딸려 옮겨 다니는 칸 — 동기화 칸 «전부» + 시각·보낼 칸 표시', () => {
  const keys = S.acctKeys();
  S.FIELDS.forEach((f) => assert.ok(keys.includes(f.ls), f.ls + ' 가 빠졌다 — 그 칸은 계정이 바뀌어도 남는다'));
  ['_stamps', '_dirty', 'key_data', 'key_biz', 'feed', 'pursue'].forEach((k) => assert.ok(keys.includes(k), k));
  assert.notEqual(S.parkKey('A', 'feed'), S.parkKey('B', 'feed'));
  assert.notEqual(S.parkKey('A', 'feed'), 'feed', '옮겨 둔 자리가 쓰는 자리와 같으면 안 된다');
});

test('★★ 옛 자료 판단 — 증거는 «같은 열쇠·같은 시각», 올라갈 것은 합치면 클라우드가 바뀌는 칸', () => {
  const dev = deviceOfA(null);
  const local = { key_data: dev.gov3_key_data, key_biz: dev.gov3_key_biz, last: dev.gov3_last, feed: JSON.parse(dev.gov3_feed), pursue: JSON.parse(dev.gov3_pursue) };
  const st = JSON.parse(dev.gov3__stamps);
  const vA = S.legacyVerdict(local, st, cloudA());
  assert.ok(vA.proof > 0, '같은 시각표를 증거로 세지 않았다');
  assert.deepEqual(vA.send, ['pursue'], '못 보낸 진행 사업만 올라간다');
  const vB = S.legacyVerdict(local, st, cloudB());
  assert.equal(vB.proof, 0, '다른 계정 클라우드와는 시각표가 맞을 수 없다');
  /* B 의 key_data 는 더 나중에 고친 것이라 합쳐도 B 것이 남는다 — 올라가는 것은 B 에 없는 기업마당 열쇠와 A 의 공고 */
  assert.ok(vB.send.includes('key_biz') && vB.send.includes('feed') && vB.send.includes('pursue'), JSON.stringify(vB.send));
  assert.ok(!vB.send.includes('key_data'));
  assert.deepEqual(S.legacyVerdict({}, {}, cloudB()).send, [], '빈 기기는 올릴 것이 없다');
  assert.ok(S.acctLabels(vB.send).some((t) => /인증키/.test(t)));
});
