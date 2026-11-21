/* 📋 업무관리 «내 업무 숫자» 한 줄(work_erp/mysum/$uid) 규칙을 진짜 Firebase 규칙 엔진에 묻는다 (2026-11-21)
   ─────────────────────────────────────────────────────────────────────────
   포털 머리줄 «📋 내 업무» 단추·이알피 「나의 업무」가 읽는 숫자 한 줄. 업무관리가 «본인 몫»만 적는다.
   ★ 지키는 것: 본인 UID 자리만 쓴다(남이 내 숫자를 못 덮는다 — 보안 검토 «중간») · 모양이 틀린 값(통짜 값·n 없음)은 막는다 ·
     자리 통째(work_erp/mysum) 교체는 막는다 · 관리자는 정리할 수 있다 · 업무관리의 다른 자리(items)는 그대로.
   다른 tests/*.test.js 와 달리 에뮬레이터가 필요해서 `node --test` 에 섞지 않는다(이름이 .emulator.mjs 인 까닭).

   실행: 임시 폴더에 rules.json(= docs/firebase-rules-전체-적용본.json)과
     firebase.json({"database":{"rules":"rules.json"},"emulators":{"database":{"port":9150,"host":"127.0.0.1"},"ui":{"enabled":false}}})
     → firebase emulators:start --only database --project pureun-erp
     → EMU_PORT=9150 node tests/work-mysum-rules.emulator.mjs
   ★ 옛 규칙(origin/main 의 적용본)을 끼우고 돌리면 «남의 자리 쓰기»가 통과(=실패)해야 한다 — 시험이 구멍을 잡는다는 증거.
   ⚠ 네임스페이스는 <프로젝트>-default-rtdb · 사용자 토큰은 ?auth=<JWT>(Bearer owner 는 규칙을 안 탄다 — 자료 심기 전용). */

const BASE = 'http://127.0.0.1:' + (process.env.EMU_PORT || '9150');
const NS = 'pureun-erp-default-rtdb';
const OWNER = '__owner__';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function tok(uid, email) {
  const now = Math.floor(Date.now() / 1000);
  return [b64({ alg: 'none', typ: 'JWT' }), b64({
    sub: uid, user_id: uid, email, email_verified: true, iat: now, exp: now + 3600, aud: 'pureun-erp',
    iss: 'https://securetoken.google.com/pureun-erp', firebase: { sign_in_provider: 'password', identities: { email: [email] } },
  }), ''].join('.');
}
const ADMIN = tok('U_ADMIN', 'admin@pureun.kr');
const STAFF = tok('U_STAFF', 'staff@pureun.kr');
const OTHER = tok('U_OTHER', 'other@pureun.kr');

async function call(method, path, auth, body) {
  const isOwner = auth === OWNER;
  const url = `${BASE}/${path}.json?ns=${NS}` + (isOwner ? '' : `&auth=${auth}`);
  const headers = {};
  if (isOwner) headers.Authorization = 'Bearer owner';
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return r.status;
}
const ok = (s) => s >= 200 && s < 300;
let pass = 0, fail = 0;
async function expect(label, method, path, auth, body, want) {
  const s = await call(method, path, auth, body);
  const got = ok(s) ? '허용' : '거부';
  const good = got === want;
  good ? pass++ : fail++;
  console.log(`  ${good ? '✓' : '✗'} ${label.padEnd(44)} 기대=${want} 실제=${got} (${s})`);
}
const 한줄 = (n) => ({ v: 1, n, dd: ['2026-11-25'], nx: ['2026-11-21'], at: Date.now() });

async function seed() {
  await call('PUT', 'uid_roles/U_ADMIN', OWNER, { isAdmin: true, sid: 'P-001', status: 'active' });
  await call('PUT', 'uid_roles/U_STAFF', OWNER, { isAdmin: false, sid: 'P-002', status: 'active' });
  await call('PUT', 'uid_roles/U_OTHER', OWNER, { isAdmin: false, sid: 'P-003', status: 'active' });
  await call('PUT', 'work_erp', OWNER, { items: { W1: { t: 'x' } }, mysum: { U_OTHER: 한줄(3) } });
}

const guard = await fetch(`${BASE}/work_erp.json?ns=${NS}`).then((r) => r.status);
if (ok(guard)) { console.error('\n  규칙이 적용되지 않았습니다. 네임스페이스가 ' + NS + ' 인지 확인하세요.\n'); process.exit(2); }

console.log('\n── 직원 — 내 자리 ──');
await seed();
await expect('내 숫자 적기  mysum/U_STAFF', 'PUT', 'work_erp/mysum/U_STAFF', STAFF, 한줄(5), '허용');
await expect('내 숫자 고치기(일부)  mysum/U_STAFF', 'PATCH', 'work_erp/mysum/U_STAFF', STAFF, { n: 6, at: Date.now() }, '허용');
await expect('내 숫자 지우기  mysum/U_STAFF', 'DELETE', 'work_erp/mysum/U_STAFF', STAFF, undefined, '허용');
await expect('★ 통짜 값  mysum/U_STAFF = "글자"', 'PUT', 'work_erp/mysum/U_STAFF', STAFF, '글자', '거부');
await expect('★ 건수(n) 없는 값', 'PUT', 'work_erp/mysum/U_STAFF', STAFF, { v: 1, at: Date.now() }, '거부');
await expect('★ 건수가 글자', 'PUT', 'work_erp/mysum/U_STAFF', STAFF, { n: '5', at: Date.now() }, '거부');

console.log('\n── 직원 — 남의 자리 ──');
await seed();
await expect('★ 남의 숫자 덮기  mysum/U_OTHER', 'PUT', 'work_erp/mysum/U_OTHER', STAFF, 한줄(99), '거부');
await expect('★ 남의 숫자 지우기  mysum/U_OTHER', 'DELETE', 'work_erp/mysum/U_OTHER', STAFF, undefined, '거부');
await expect('★ 자리 통째 교체  work_erp/mysum', 'PUT', 'work_erp/mysum', STAFF, { U_STAFF: 한줄(1) }, '거부');
await expect('남의 숫자 읽기(업무관리 전체와 같은 읽기)', 'GET', 'work_erp/mysum/U_OTHER', STAFF, undefined, '허용');
await expect('본인은 제 자리에 쓴다  mysum/U_OTHER', 'PUT', 'work_erp/mysum/U_OTHER', OTHER, 한줄(4), '허용');

console.log('\n── 관리자·회귀 ──');
await seed();
await expect('관리자 정리  mysum/U_OTHER 지우기', 'DELETE', 'work_erp/mysum/U_OTHER', ADMIN, undefined, '허용');
await expect('업무관리 업무 쓰기 그대로  items/W1', 'PUT', 'work_erp/items/W1', STAFF, { t: 'y' }, '허용');
await expect('로그인 안 한 사람  mysum/U_STAFF', 'PUT', 'work_erp/mysum/U_STAFF', '', 한줄(1), '거부');

console.log(`\n  통과 ${pass} · 실패 ${fail}\n`);
process.exit(fail ? 1 : 0);
