/* 강의자료 «강의 이력»(edulib/lectures) 보안규칙을 «진짜 Firebase 규칙 엔진» 에 물어보는 검사 (2026-11-27)
   ─────────────────────────────────────────────────────────────────────────────
   에뮬레이터가 필요해서 `node --test` 에 섞지 않는다(tests/suggestion-rules.emulator.mjs 와 같은 틀 — 실행 방법도 그 파일 머리 참고):
     1) 임시 폴더에 rules.json(= docs/firebase-rules-전체-적용본.json)·firebase.json 을 두고 `firebase emulators:start --only database --project pureun-erp`
     2) EMU_PORT=9150 node tests/edulib-lectures-rules.emulator.mjs
   ★ 막히는 경우는 한 군데만 다른 «통과하는 짝» 과 함께 본다 — 엉뚱한 까닭으로 막힌 것을 성공으로 착각하지 않게.
   ⚠ 자료는 모두 지어낸 것(가나상사·P 사번). */
const PORT = process.env.EMU_PORT || '9000';
const BASE = `http://127.0.0.1:${PORT}`;
const NS = 'pureun-erp-default-rtdb';
const OWNER = '__owner__';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function tok(uid, email) {
  const now = Math.floor(Date.now() / 1000);
  return [b64({ alg: 'none', typ: 'JWT' }), b64({ sub: uid, user_id: uid, email, email_verified: true, iat: now, exp: now + 3600, aud: 'pureun-erp',
    iss: 'https://securetoken.google.com/pureun-erp', firebase: { sign_in_provider: 'password', identities: { email: [email] } } }), ''].join('.');
}
const STAFF = tok('U_LSTAFF', 'lstaff@pureun.kr');
async function call(method, path, auth, body) {
  const isOwner = auth === OWNER;
  const url = `${BASE}/${path}.json?ns=${NS}` + (isOwner ? '' : `&auth=${auth}`);
  const headers = {};
  if (isOwner) headers.Authorization = 'Bearer owner';
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return r.status;
}
let pass = 0, fail = 0;
async function expect(label, method, path, auth, body, want) {
  const s = await call(method, path, auth, body);
  const got = s >= 200 && s < 300 ? '허용' : '거부';
  got === want ? pass++ : fail++;
  console.log(`  ${got === want ? '✓' : '✗'} ${label.padEnd(60)} 기대=${want} 실제=${got} (${s})`);
}
const T = 1764200000000;
const rec = (id, o) => Object.assign({ id, entityType: 'EduLecture', schemaVersion: 3, contractVersion: 1, revision: 1, date: '2026-11-24', time: '14:00',
  lecturerSid: 'P007', venue: '가나상사 본사', title: '가나상사 괴롭힘 예방교육', cat: 'bullying', note: '', status: 'auto',
  itemIds: { edu_mabc: true }, guess: { date: 'cal', lecturer: 'cal-creator', venue: 'cal-location', score: 9 },
  cal: { id: 'ev1', summary: '가나상사 교육', location: '가나상사 본사', date: '2026-11-24', time: '14:00' },
  createdAt: T, updatedAt: T, createdBy: 'lstaff', updatedBy: 'lstaff' }, o || {});

await call('PUT', 'uid_roles/U_LSTAFF', OWNER, { isAdmin: false, sid: 'lstaff', status: 'active' });
const P = (id) => 'edulib/lectures/' + id;

console.log('■ 새 기록');
await expect('재직 직원이 자기 사번으로 새 기록', 'PUT', P('lec_c0000000000000a01'), STAFF, rec('lec_c0000000000000a01'), '허용');
await expect('만든 사람을 남의 사번으로 꾸밈', 'PUT', P('lec_c0000000000000a02'), STAFF, rec('lec_c0000000000000a02', { createdBy: 'P999' }), '거부');
await expect('만든 사람을 «자동(메일자동정리)»로 꾸밈', 'PUT', P('lec_c0000000000000a03'), STAFF, rec('lec_c0000000000000a03', { createdBy: 'AI-메일자동정리' }), '거부');
await expect('열쇠 꼴이 아님(lec_ 아님)', 'PUT', P('xx_c0000000000000a04'), STAFF, rec('xx_c0000000000000a04'), '거부');
await expect('정해 두지 않은 칸(creator 메일)', 'PUT', P('lec_c0000000000000a05'), STAFF, rec('lec_c0000000000000a05', { creator: 'a@example.com' }), '거부');
await expect('강의자에 사번 꼴이 아닌 글', 'PUT', P('lec_c0000000000000a06'), STAFF, rec('lec_c0000000000000a06', { lecturerSid: '<b>홍길동</b>' }), '거부');
await expect('cal 자리에 통짜 글', 'PUT', P('lec_c0000000000000a07'), STAFF, rec('lec_c0000000000000a07', { cal: '아무 글' }), '거부');
await expect('itemIds 자리에 통짜 숫자', 'PUT', P('lec_c0000000000000a08'), STAFF, rec('lec_c0000000000000a08', { itemIds: 5 }), '거부');
await expect('상태가 auto·ok 가 아님', 'PUT', P('lec_c0000000000000a09'), STAFF, rec('lec_c0000000000000a09', { status: 'done' }), '거부');

console.log('■ 서버가 만든 기록을 사람이 고침·확인');
await call('PUT', P('lec_m0000000000000b01'), OWNER, rec('lec_m0000000000000b01', { createdBy: 'AI-메일자동정리', updatedBy: 'AI-메일자동정리' }));
await expect('만든 사람은 그대로 · 고친 사람·확인한 사람은 내 사번', 'PUT', P('lec_m0000000000000b01'), STAFF,
  rec('lec_m0000000000000b01', { createdBy: 'AI-메일자동정리', updatedBy: 'lstaff', status: 'ok', confirmedBy: 'lstaff', confirmedAt: T + 1, revision: 2 }), '허용');
await expect('확인한 사람을 남의 사번으로 꾸밈', 'PUT', P('lec_m0000000000000b01'), STAFF,
  rec('lec_m0000000000000b01', { createdBy: 'AI-메일자동정리', updatedBy: 'lstaff', status: 'ok', confirmedBy: 'P001', confirmedAt: T + 2, revision: 3 }), '거부');
await expect('고친 사람을 «자동»으로 꾸밈', 'PUT', P('lec_m0000000000000b01'), STAFF,
  rec('lec_m0000000000000b01', { createdBy: 'AI-메일자동정리', updatedBy: 'AI-메일자동정리', revision: 3 }), '거부');

console.log('■ 휴지통·지우기');
await expect('휴지통 표식(지운 사람 = 내 사번)', 'PUT', P('lec_c0000000000000a01'), STAFF, rec('lec_c0000000000000a01', { _deleted: true, deletedAt: T + 5, deletedBy: 'lstaff', revision: 2 }), '허용');
await expect('지운 사람을 남의 사번으로', 'PUT', P('lec_c0000000000000a01'), STAFF, rec('lec_c0000000000000a01', { _deleted: true, deletedAt: T + 6, deletedBy: 'P001', revision: 3 }), '거부');
await expect('기록 통째 지우기(빈 값)', 'DELETE', P('lec_c0000000000000a01'), STAFF, undefined, '거부');

console.log(`\n${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
