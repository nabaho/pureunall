'use strict';
/* 📊 데이터관리 보안규칙 — 만들개(scripts/make-firebase-rules.js) 출력을 «규칙»으로 본다 (2026-11-21, 계획서 4·6절)

   ★ 지키는 것
     ① 대표 표지(app_owner/uid)만이 대표를 가리킨다 — 관리자·관리자대행(isAdmin·isSubAdmin)·재무(fin)로 열리지 않는다
     ② app_owner·datahub_device·datahub_board 는 화면에서 아무도 못 쓴다(서버·터미널만)
     ③ datahub_device_req·datahub_nonce·datahub_activity 는 화면이 읽지도 쓰지도 못한다
     ④ datahub/{uid}/settings 는 대표 본인만, ViewState 만, 알려진 칸만 — 저장 관문이 붙이는 메타 칸은 빠짐없이 받는다
   ● 아래 «작은 규칙 엔진»은 이 검사에 필요한 만큼만 흉내 낸다(읽기·쓰기는 위에서 아래로 흐르고, .validate 는 새 값에).
     진짜 엔진 시험은 맨 아래 — DATAHUB_EMU_PORT 로 에뮬레이터를 띄웠을 때만 돈다(평소 전체 검사에서는 건너뜀).
   ⚠ 값(조건 글자)을 그대로 박지 않는다 — «그 조건이 들어 있는가»·«그 사람에게 열리는가»를 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const RULES = JSON.parse(execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'make-firebase-rules.js')], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })).rules;
const W = require('../js/pu-ontology-write.js');

/* ── 작은 규칙 엔진 ─────────────────────────────────────────────────── */
class Snap {
  constructor(v) { this.value = v; }
  child(p) { let c = this.value; for (const s of String(p).split('/').filter(Boolean)) c = (c && typeof c === 'object') ? c[s] : undefined; return new Snap(c); }
  val() { return this.value === undefined ? null : this.value; }
  exists() { return this.value !== undefined && this.value !== null; }
  hasChildren(ks) { if (!ks) return !!this.value && typeof this.value === 'object' && Object.keys(this.value).length > 0; return ks.every((k) => this.child(k).exists()); }
  hasChild(k) { return this.child(k).exists(); }
  isString() { return typeof this.value === 'string'; }
  isNumber() { return typeof this.value === 'number'; }
  isBoolean() { return typeof this.value === 'boolean'; }
}
function evalRule(expr, ctx, vars) {
  if (typeof expr === 'boolean') return expr;
  if (typeof expr !== 'string') return false;
  const names = Object.keys(vars);
  const fn = new Function('auth', 'root', 'data', 'newData', ...names, 'return (' + expr + ');');
  try { return !!fn(ctx.auth, ctx.root, ctx.data || new Snap(null), ctx.newData || new Snap(null), ...names.map((n) => vars[n])); }
  catch (e) { return false; }
}
function stepOf(node, seg) {
  if (!node || typeof node !== 'object') return null;
  if (Object.prototype.hasOwnProperty.call(node, seg)) return { node: node[seg], bind: null };
  const w = Object.keys(node).find((k) => k[0] === '$');
  return w ? { node: node[w], bind: w } : null;
}
function walk(p) {
  const out = [{ node: RULES, vars: {}, path: '' }];
  let node = RULES, vars = {}, at = '';
  for (const seg of String(p).split('/').filter(Boolean)) {
    const s = stepOf(node, seg);
    if (!s) break;
    vars = Object.assign({}, vars);
    if (s.bind) vars[s.bind] = seg;
    node = s.node; at = at ? at + '/' + seg : seg;
    out.push({ node: node, vars: vars, path: at });
  }
  return { chain: out, full: out.length - 1 === String(p).split('/').filter(Boolean).length };
}
function auth(uid) { return uid ? { uid: uid, token: { firebase: { sign_in_provider: 'password' }, email: uid + '@example.invalid' } } : null; }
function canRead(p, who, tree) {
  const ctx = { auth: auth(who), root: new Snap(tree) };
  return walk(p).chain.some((c) => evalRule(c.node['.read'], Object.assign({ data: new Snap(tree).child(c.path) }, ctx), c.vars));
}
/* 쓰기 — 경로 위 어딘가의 .write 가 참이고, 새 값이 닿는 모든 자리의 .validate 가 참이어야 한다($other:false 포함) */
function validateTree(node, value, vars, ctx, at) {
  if (value === null || value === undefined) return true;   /* 지우기는 .validate 를 안 탄다 */
  if (node && node['.validate'] !== undefined && !evalRule(node['.validate'], Object.assign({}, ctx, { newData: new Snap(value) }), vars)) return false;
  if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) {
      const s = stepOf(node, k);
      if (!s) continue;   /* 규칙이 없는 칸은 그 아래가 막지 않는다 */
      const v2 = s.bind ? Object.assign({}, vars, { [s.bind]: k }) : vars;
      if (!validateTree(s.node, value[k], v2, ctx, at + '/' + k)) return false;
    }
  }
  return true;
}
/* .write 를 볼 때도 data(전 값)·newData(그 자리의 새 값)를 넘긴다 — «통째 지우기 금지(newData.exists())» 같은 조건이 있다.
   쓰는 자리의 새 값은 value, 그 위 자리는 어림으로 지금 값을 넘긴다(데이터관리는 settings 한 자리만 연다). */
function canWrite(p, who, tree, value) {
  const base = { auth: auth(who), root: new Snap(tree) };
  const w = walk(p);
  const full = String(p).split('/').filter(Boolean).join('/');
  const writeOk = w.chain.some((c) => evalRule(c.node['.write'], Object.assign({}, base, {
    data: new Snap(tree).child(c.path),
    newData: c.path === full ? new Snap(value === undefined ? null : value) : new Snap(tree).child(c.path)
  }), c.vars));
  if (!writeOk) return false;
  if (!w.full) return true;
  const last = w.chain[w.chain.length - 1];
  return validateTree(last.node, value, last.vars, Object.assign({}, base, { data: new Snap(tree).child(full) }), p);
}

/* ── 사람들 (지어낸 uid) ── */
const OWNER = 'U_OWNER_0001', DELEGATE = 'U_DELEGATE_02', STAFF = 'U_STAFF_0003', RETIRED = 'U_RETIRED_04', SIGNUP = 'U_SIGNUP_05';
function tree(over) {
  return Object.assign({
    app_owner: { uid: OWNER },
    uid_roles: {
      [OWNER]: { sid: 'P-900', status: 'active', isAdmin: true, fin: true },
      [DELEGATE]: { sid: 'A-901', status: 'active', isAdmin: true, isSubAdmin: true, fin: true },
      [STAFF]: { sid: 'A-902', status: 'active' },
      [RETIRED]: { sid: 'A-903', status: 'retired', isAdmin: true }
    }
  }, over || {});
}
function settingsRecord(extra) {
  const g = W.createGateway({ program: 'datahub', mode: 'enforce', actor: 'P-900', now: () => 1763700000000 });
  const p = g.prepare(Object.assign({ id: 'settings', view: 'overview', period: '12m', basis: 'date', net: false, vmode: '3d',
    aLines: { 0: 'P1', 1: 'S1' }, cLines: 2, thresholds: { fund: { warn: 3, bad: 5 }, work: 10 }, baseline: { many: 14, over: 20 } }, extra || {}),
  { entityType: 'ViewState' });
  return p.value;
}

/* ══ 모양 ══════════════════════════════════════════════════════════════ */

test('새 자리 일곱이 모두 만들개에 있다', () => {
  for (const k of ['app_owner', 'datahub', 'datahub_device', 'datahub_device_req', 'datahub_nonce', 'datahub_activity', 'datahub_board']) {
    assert.ok(RULES[k], k + ' 규칙이 없다');
  }
});

test('대표 전용 조건은 «재직 로그인 + 대표 표지»이고 관리자·위임관리인·재무로 열지 않는다', () => {
  /* 쓰기는 settings 한 자리에만 연다($uid 통째 쓰기 없음 — 보안 검토 2026-11-21) */
  assert.equal(RULES.datahub.$uid['.write'], undefined, 'datahub/{uid} 통째 쓰기를 열지 않는다');
  const conds = [RULES.datahub.$uid['.read'], RULES.datahub.$uid.settings['.write'], RULES.datahub_device.$uid['.read'], RULES.datahub_board['.read']];
  for (const c of conds) {
    assert.equal(typeof c, 'string');
    assert.match(c, /app_owner/, '대표 표지를 본다');
    assert.match(c, /status'\)\.val\(\) === 'active'/, '재직자인가(LOGIN)');
    assert.match(c, /sign_in_provider/, '로그인 방식(LOGIN)');
    assert.doesNotMatch(c, /isAdmin|isSubAdmin|'fin'|child\('role'\)/, '관리자·관리자대행·재무·role 로 열면 안 된다');
  }
  for (const c of conds.slice(0, 3)) assert.match(c, /auth\.uid === \$uid/, '본인 자리만');
});

test('서버만 쓰는 자리는 화면에 쓰기를 열지 않는다', () => {
  assert.equal(RULES.app_owner['.write'], false);
  assert.equal(RULES.datahub_device.$uid['.write'], false);
  assert.equal(RULES.datahub_board['.write'], false);
  for (const k of ['datahub_device_req', 'datahub_nonce', 'datahub_activity']) {
    assert.equal(RULES[k]['.read'], false, k + ' 읽기');
    assert.equal(RULES[k]['.write'], false, k + ' 쓰기');
    assert.deepEqual(Object.keys(RULES[k]).filter((x) => x[0] === '$' || x[0] !== '.'), [], k + ' 아래에서 다시 여는 칸이 없다');
  }
});

test('보기 설정은 ViewState 만, 알려진 칸 밖은 막는다 — 저장 관문이 붙이는 메타 칸은 빠짐없이 받는다', () => {
  const s = RULES.datahub.$uid.settings;
  assert.match(s['.validate'], /entityType/);
  assert.match(s['.validate'], /ViewState/);
  assert.equal(s.$other['.validate'], false);
  assert.equal(RULES.datahub.$uid.$other['.validate'], false, 'settings 밖의 칸도 막는다');
  /* 메타 칸 목록은 js/pu-ontology-write.js 의 prepareRecord·tombstone 에서 «읽어 낸다» */
  const src = fs.readFileSync(path.join(ROOT, 'js', 'pu-ontology-write.js'), 'utf8');
  const prep = src.slice(src.indexOf('function prepareRecord('), src.indexOf('function tombstone('));
  const meta = new Set(Array.from(prep.matchAll(/out\.([A-Za-z_]\w*)\s*=(?!=)/g)).map((m) => m[1]));
  const tomb = /Object\.assign\(\{\},previous,\{([^}]*)\}/.exec(src);
  assert.ok(tomb, 'tombstone 의 지운 표시 칸을 못 찾았다');
  Array.from(tomb[1].matchAll(/([A-Za-z_]\w*)\s*:/g)).forEach((m) => meta.add(m[1]));
  meta.add('id');
  assert.ok(meta.size >= 8, '메타 칸을 거의 못 읽었다 — 읽는 식이 고장: ' + Array.from(meta));
  const missing = Array.from(meta).filter((k) => !s[k]);
  assert.deepEqual(missing, [], '규칙에 없는 메타 칸 — 저장이 막힌다');
});

/* ══ 누구에게 열리나 (작은 엔진) ═══════════════════════════════════════ */

test('대표는 자기 설정·기기·현황판을 읽고, 관리자대행·직원·퇴사자·가입만 한 계정은 못 읽는다', () => {
  const t = tree();
  for (const p of ['datahub/' + OWNER + '/settings', 'datahub_device/' + OWNER, 'datahub_board', 'datahub_board/erp', 'app_owner/uid']) {
    assert.equal(canRead(p, OWNER, t), true, '대표 ' + p);
  }
  for (const who of [DELEGATE, STAFF]) {
    for (const p of ['datahub/' + OWNER, 'datahub/' + who, 'datahub_device/' + OWNER, 'datahub_device/' + who, 'datahub_board', 'datahub_board/erp']) {
      assert.equal(canRead(p, who, t), false, who + ' 가 ' + p + ' 를 읽으면 안 된다');
    }
    assert.equal(canRead('app_owner/uid', who, t), true, '대표 표지는 재직자가 읽는다(화면이 «내가 대표인가»를 본다)');
  }
  /* 대표 표지가 퇴사자를 가리켜도 열리지 않는다 · 가입만 한 계정은 표지도 못 읽는다 */
  const t2 = tree({ app_owner: { uid: RETIRED } });
  assert.equal(canRead('datahub/' + RETIRED, RETIRED, t2), false);
  assert.equal(canRead('datahub_board', RETIRED, t2), false);
  assert.equal(canRead('app_owner/uid', SIGNUP, t), false);
  /* 대표 표지가 비면 아무에게도 안 열린다 */
  const t3 = tree({ app_owner: null });
  assert.equal(canRead('datahub/' + OWNER, OWNER, t3), false);
  assert.equal(canRead('datahub_board', OWNER, t3), false);
  /* 서버 자리는 대표도 못 읽는다 */
  for (const p of ['datahub_device_req/' + OWNER, 'datahub_nonce/' + OWNER, 'datahub_activity/' + OWNER]) {
    assert.equal(canRead(p, OWNER, t), false, p);
  }
});

test('화면에서는 대표도 표지·기기·현황판·서버 자리에 못 쓴다', () => {
  const t = tree();
  for (const who of [OWNER, DELEGATE]) {
    assert.equal(canWrite('app_owner/uid', who, t, who), false, who + ' app_owner');
    assert.equal(canWrite('app_owner', who, t, { uid: who }), false);
    assert.equal(canWrite('datahub_device/' + OWNER, who, t, { fp: 'x' }), false);
    assert.equal(canWrite('datahub_board/erp', who, t, { state: 'ok' }), false);
    for (const k of ['datahub_device_req', 'datahub_nonce', 'datahub_activity']) {
      assert.equal(canWrite(k + '/' + OWNER, who, t, { a: 1 }), false, who + ' ' + k);
    }
  }
});

test('저장 관문이 만든 보기 설정은 대표 본인만 저장되고, 모양이 다르면 막힌다', () => {
  const t = tree();
  const rec = settingsRecord();
  assert.equal(canWrite('datahub/' + OWNER + '/settings', OWNER, t, rec), true, '관문이 만든 레코드(메타 칸 포함)는 저장된다');
  const gone = W.tombstone(rec, { actor: 'P-900', now: 1763700000001 }).value;
  assert.equal(canWrite('datahub/' + OWNER + '/settings', OWNER, t, gone), true, '관문의 지우기 표시도 저장된다');
  assert.equal(canWrite('datahub/' + OWNER + '/settings', DELEGATE, t, rec), false, '관리자대행은 못 쓴다');
  assert.equal(canWrite('datahub/' + DELEGATE + '/settings', DELEGATE, t, rec), false, '대표가 아니면 자기 자리도 못 쓴다');
  assert.equal(canWrite('datahub/' + OWNER + '/settings', OWNER, t, Object.assign({}, rec, { entityType: 'Case' })), false, 'ViewState 만');
  assert.equal(canWrite('datahub/' + OWNER + '/settings', OWNER, t, Object.assign({}, rec, { secretNote: 'x' })), false, '알려진 칸 밖');
  assert.equal(canWrite('datahub/' + OWNER + '/settings', OWNER, t, 'string'), false, '통짜 값');
  assert.equal(canWrite('datahub/' + OWNER + '/settings', OWNER, t, Object.assign({}, rec, { view: 'x'.repeat(500) })), false, '긴 글');
  assert.equal(canWrite('datahub/' + OWNER + '/chat', OWNER, t, { q: 'x' }), false, '설정 밖 자리(채팅 기록 등)는 서버에 안 둔다');
});

test('보기 설정은 통째로 못 지우고, 수정차수는 «전 값 + 1»만 받는다 (보안 검토 2026-11-21)', () => {
  const rec = settingsRecord();
  const t = tree({ datahub: { [OWNER]: { settings: Object.assign({}, rec, { revision: 3 }) } } });
  const p = 'datahub/' + OWNER + '/settings';
  assert.equal(canWrite(p, OWNER, t, null), false, '통째 지우기는 막는다 — 지우려면 저장 관문의 _deleted 표식');
  assert.equal(canWrite('datahub/' + OWNER, OWNER, t, null), false, '위 자리째 지우기도 막는다');
  assert.equal(canWrite(p, OWNER, t, Object.assign({}, rec, { revision: 4 })), true, '전 값 + 1 은 저장된다');
  assert.equal(canWrite(p, OWNER, t, Object.assign({}, rec, { revision: 3 })), false, '같은 차수로 덮어쓰기는 막는다');
  assert.equal(canWrite(p, OWNER, t, Object.assign({}, rec, { revision: 9 })), false, '건너뛴 차수도 막는다');
  const noRev = Object.assign({}, rec); delete noRev.revision;
  assert.equal(canWrite(p, OWNER, t, noRev), false, '차수 없는 레코드는 막는다');
});

/* ══ 진짜 엔진(에뮬레이터) — DATAHUB_EMU_PORT 가 있을 때만 ══════════════
   띄우는 법(메모 «RTDB 규칙 에뮬레이터 시험»): 임시 폴더에 rules.json(만들개 출력)과
   firebase.json({"database":{"rules":"rules.json"},"emulators":{"database":{"port":9150,"host":"127.0.0.1"},"ui":{"enabled":false}}})
   → firebase emulators:start --only database --project pureun-erp → DATAHUB_EMU_PORT=9150 node --test tests/datahub-rules.test.js */
const EMU = process.env.DATAHUB_EMU_PORT;
test('에뮬레이터 — 관리자대행 읽기·화면 쓰기·서버 자리 읽기쓰기가 모두 거절된다', { skip: !EMU && '에뮬레이터 없음(DATAHUB_EMU_PORT 미설정)' }, async () => {
  const BASE = 'http://127.0.0.1:' + EMU, NS = 'pureun-erp-default-rtdb';
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const tok = (uid) => { const now = Math.floor(Date.now() / 1000); return [b64({ alg: 'none', typ: 'JWT' }), b64({ sub: uid, user_id: uid, iat: now, exp: now + 3600, aud: 'pureun-erp', iss: 'https://securetoken.google.com/pureun-erp', firebase: { sign_in_provider: 'password' } }), ''].join('.'); };
  const req = async (method, p, who, body) => {
    const url = BASE + '/' + p + '.json?ns=' + NS + (who === '__owner__' ? '' : '&auth=' + tok(who));
    const headers = who === '__owner__' ? { Authorization: 'Bearer owner' } : {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const r = await fetch(url, { method: method, headers: headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return r.status >= 200 && r.status < 300;
  };
  /* 규칙이 안 걸린 DB 면 무엇이든 통과한다 — 먼저 확인 */
  assert.equal(await req('GET', 'datahub_nonce', SIGNUP), false, '규칙이 걸리지 않았다(네임스페이스 확인)');
  await req('PUT', 'uid_roles', '__owner__', tree().uid_roles);
  await req('PUT', 'app_owner', '__owner__', { uid: OWNER });
  await req('PUT', 'datahub_board/erp', '__owner__', { state: 'ok', at: 1 });
  await req('PUT', 'datahub_device/' + OWNER, '__owner__', { fp: 'x' });
  await req('PUT', 'datahub_nonce/' + OWNER, '__owner__', { n: { exp: 1 } });
  const rec = settingsRecord();
  /* 짝 — 대표의 정상 읽기·쓰기는 통과해야 거절이 «엉뚱한 까닭»이 아니다 */
  assert.equal(await req('PUT', 'datahub/' + OWNER + '/settings', OWNER, rec), true, '대표 설정 저장');
  assert.equal(await req('GET', 'datahub/' + OWNER, OWNER), true, '대표 설정 읽기');
  assert.equal(await req('GET', 'datahub_board', OWNER), true, '대표 현황판 읽기');
  assert.equal(await req('GET', 'datahub_device/' + OWNER, OWNER), true, '대표 기기 읽기');
  /* 거절 */
  for (const p of ['datahub/' + OWNER, 'datahub_board', 'datahub_board/erp', 'datahub_device/' + OWNER]) {
    assert.equal(await req('GET', p, DELEGATE), false, '관리자대행 읽기 ' + p);
  }
  for (const who of [OWNER, DELEGATE]) {
    assert.equal(await req('PUT', 'app_owner/uid', who, who), false, who + ' app_owner 쓰기');
    assert.equal(await req('PUT', 'datahub_device/' + OWNER, who, { fp: 'y' }), false, who + ' 기기 쓰기');
    assert.equal(await req('PUT', 'datahub_board/erp', who, { state: 'ok' }), false, who + ' 현황판 쓰기');
    for (const k of ['datahub_nonce', 'datahub_activity', 'datahub_device_req']) {
      assert.equal(await req('GET', k + '/' + OWNER, who), false, who + ' ' + k + ' 읽기');
      assert.equal(await req('PUT', k + '/' + OWNER, who, { a: 1 }), false, who + ' ' + k + ' 쓰기');
    }
  }
  assert.equal(await req('PUT', 'datahub/' + OWNER + '/settings', OWNER, Object.assign({}, rec, { secretNote: 'x' })), false, '알려진 칸 밖');
  assert.equal(await req('PUT', 'datahub/' + OWNER + '/settings', OWNER, Object.assign({}, rec, { entityType: 'Case' })), false, 'ViewState 만');
});
