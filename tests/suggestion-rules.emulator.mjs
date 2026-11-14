/* 건의함 보안규칙(키 모양·칸·크기)을 «진짜 Firebase 규칙 엔진» 에 물어보는 검사 (2026-11-12 「건의함 보안규칙: 키 모양·크기 검사 추가」)
   ─────────────────────────────────────────────────────────────────────────────
   다른 tests/*.test.js 와 달리 에뮬레이터가 필요해서 `node --test` 에 섞지 않는다(파일 이름을 .test.js 로 두지 않은 까닭 —
   tests/firebase-rules-delete-permission.emulator.mjs 와 같다). 규칙의 «뜻»(와일드카드 우선순위·부분 갱신·기존 자료)은
   실제 엔진만 안다 — 저장소 안의 모의 평가기(tests/suggestion-rules.test.js)는 빠르지만 엔진과 다를 수 있어 이 검사로 «맞춰 본다».

   실행 방법(이 PC: 자바 설치됨, 에뮬레이터 파일은 처음 한 번 내려받는다)
     1) 규칙을 담은 임시 폴더에서 에뮬레이터를 띄운다
          mkdir rulestest && cd rulestest
          cp "<저장소>/docs/firebase-rules-전체-적용본.json" rules.json
          printf '{"database":{"rules":"rules.json"},"emulators":{"database":{"port":9150,"host":"127.0.0.1"},"ui":{"enabled":false}}}' > firebase.json
          firebase emulators:start --only database --project pureun-erp
     2) 다른 창에서   EMU_PORT=9150 node <저장소>/tests/suggestion-rules.emulator.mjs

   ⚠ 함정 둘(둘 다 «전부 통과» 라는 가짜 성공을 만든다) — 네임스페이스는 <프로젝트>-default-rtdb 여야 하고,
     사용자 토큰은 ?auth=<JWT> 로 보낸다(Authorization: Bearer 는 관리자 자격이라 규칙을 안 탄다 — 자료를 심을 때와
     «서버(Cloud Functions·감시 도구)가 쓰는 칸» 시험에만 쓴다).
   ★ «막히는 경우» 는 한 군데만 다른 «통과하는 짝» 과 함께 본다 — 엉뚱한 이유로 막힌 것을 성공으로 착각하지 않으려고. */

const PORT = process.env.EMU_PORT || '9000';
const BASE = `http://127.0.0.1:${PORT}`;
const NS = 'pureun-erp-default-rtdb';
const OWNER = '__owner__';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function tok(uid, email) {
  const now = Math.floor(Date.now() / 1000);
  return [
    b64({ alg: 'none', typ: 'JWT' }),
    b64({
      sub: uid, user_id: uid, email, email_verified: true, iat: now, exp: now + 3600, aud: 'pureun-erp',
      iss: 'https://securetoken.google.com/pureun-erp',
      firebase: { sign_in_provider: 'password', identities: { email: [email] } }
    }),
    ''
  ].join('.');
}
const ADMIN = tok('U_ADMIN', 'admin@pureun.kr');
const STAFF = tok('U_STAFF', 'staff@pureun.kr');
const STAFF2 = tok('U_STAFF2', 'staff2@pureun.kr');

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
const failures = [];
async function expect(label, method, path, auth, body, want) {
  const s = await call(method, path, auth, body);
  const got = ok(s) ? '허용' : '거부';
  const good = got === want;
  good ? pass++ : (fail++, failures.push(label));
  console.log(`  ${good ? '✓' : '✗'} ${label.padEnd(64)} 기대=${want} 실제=${got} (${s})`);
}
/* 한 군데만 다른 두 쓰기 — 짝(base)은 «허용», 나쁜 것(mutate 적용)은 «거부» 여야 한다 */
let seq = 0;
const nid = (p) => `-N${p}${String(++seq).padStart(6, '0')}`;
async function pair(label, method, pathOf, auth, base, mutate) {
  await expect(`${label} — 짝(정상)`, method, pathOf(nid('ok')), auth, base, '허용');
  await expect(`${label} — ★ 나쁜 것`, method, pathOf(nid('bd')), auth, mutate(structuredClone(base)), '거부');
}

/* ── 화면(enter.html)이 실제로 쓰는 모양 ── */
const NOW = Date.now();
const IMG = 'data:image/jpeg;base64,' + 'A'.repeat(2000);
const rec = (uid, o) => Object.assign({
  cat: 'erp', title: '제목', content: '내용', images: [IMG, IMG, IMG], author: '홍길동', authorEmail: 'a@pureun.kr',
  authorUid: uid, status: 'new', reply: '', createdAt: NOW
}, o || {});
const meta = (uid, o) => Object.assign({ author: '홍길동', authorEmail: 'a@pureun.kr', authorUid: uid, status: 'new', cat: 'erp', title: '제목', createdAt: NOW }, o || {});
const own = (o) => Object.assign({ title: '제목', cat: 'erp', status: 'new', at: NOW, seen: true }, o || {});

async function seed() {
  /* ⚠ 시험 계정 «세 자리만» 심는다 — uid_roles 전체를 덮어쓰면 같은 에뮬레이터를 쓰는 다른 시험의 역할이 지워진다(외부 재검증 지적) */
  await call('PUT', 'uid_roles/U_ADMIN', OWNER, { isAdmin: true, sid: 'admin', status: 'active' });
  await call('PUT', 'uid_roles/U_STAFF', OWNER, { isAdmin: false, sid: 'staff', status: 'active' });
  await call('PUT', 'uid_roles/U_STAFF2', OWNER, { isAdmin: false, sid: 'staff2', status: 'active' });
  await call('DELETE', 'suggestions_private', OWNER);
  await call('DELETE', 'suggestions_meta_private', OWNER);
  await call('DELETE', 'suggestions_resolved_private', OWNER);
}

// 아무 자격 없이 읽어서 통과하면 규칙이 안 걸린 것 — 그대로 두면 전부 통과하는 가짜 성공이 난다
const guard = await fetch(`${BASE}/suggestions_private.json?ns=${NS}`).then((r) => r.status);
if (ok(guard)) { console.error('\n  규칙이 적용되지 않았습니다. 네임스페이스가 ' + NS + ' 인지 확인하세요.\n'); process.exit(2); }

await seed();
console.log('\n── ① 정상 쓰기는 하나도 막히면 안 된다 (직원) ──');
await expect('새 건의(그림 3장·분류·본인 uid)', 'PUT', 'suggestions_private/-Nfirst000001', STAFF, rec('U_STAFF'), '허용');
await expect('새 건의의 경량 메타', 'PUT', 'suggestions_meta_private/-Nfirst000001', STAFF, meta('U_STAFF'), '허용');
await expect('내 진행함에도 접수 기록', 'PUT', 'suggestions_resolved_private/U_STAFF/-Nfirst000001', STAFF, own(), '허용');
await expect('재요청(relatedId·↩ 제목)', 'PUT', 'suggestions_private/-Nredo0000001', STAFF, rec('U_STAFF', { title: '↩ 재요청: 제목', relatedId: '-Nfirst000001' }), '허용');
await expect('길잡이 채팅 접수(source·그림 없음)', 'PUT', 'suggestions_private/-Nchat0000001', STAFF, (() => { const r = rec('U_STAFF', { source: 'chatbot' }); delete r.images; return r; })(), '허용');
await expect('길잡이 채팅 내 진행함(source·relatedId)', 'PUT', 'suggestions_resolved_private/U_STAFF/-Nchat0000001', STAFF, own({ source: 'chatbot', relatedId: '-Nfirst000001' }), '허용');
await expect('건의자 확인 「해결됐어요」(부분 갱신)', 'PATCH', 'suggestions_resolved_private/U_STAFF/-Nfirst000001', STAFF, { seen: true, resolvedOk: true, resolvedAt: NOW }, '허용');
await expect('건의자 「아직 안 됐어요」(피드백)', 'PATCH', 'suggestions_resolved_private/U_STAFF/-Nchat0000001', STAFF, { seen: true, resolvedOk: false, feedback: '안 됩니다', feedbackAt: NOW }, '허용');

console.log('\n── ② 정상 쓰기 (관리자) ──');
await expect('답변 저장(상태·답·답변 그림·시각)', 'PATCH', 'suggestions_private/-Nfirst000001', ADMIN, { status: 'done', reply: '고쳤습니다', replyImages: [IMG], repliedAt: NOW }, '허용');
await expect('메타 상태 갱신', 'PATCH', 'suggestions_meta_private/-Nfirst000001', ADMIN, { status: 'done' }, '허용');
await expect('건의자 진행함에 완료 답 반영', 'PATCH', 'suggestions_resolved_private/U_STAFF/-Nfirst000001', ADMIN, { title: '제목', reply: '고쳤습니다', replyImages: [IMG], cat: 'erp', status: 'done', at: NOW, seen: false }, '허용');
await expect('건의자 uid 채우기', 'PUT', 'suggestions_private/-Nfirst000001/authorUid', ADMIN, 'U_STAFF', '허용');
await expect('관리자가 직접 남긴 건의(남의 uid 가 아님)', 'PUT', 'suggestions_private/-Nadmin000001', ADMIN, rec('U_ADMIN'), '허용');

console.log('\n── ③ 예전 자료와 «서버가 쓰는 칸» — 기존 자료가 있어도 정상 처리가 막히면 안 된다 ──');
await seed();
// 운영 자료와 같은 모양: assist·watchNotice 가 붙은 건의, status 없는 옛 진행함
await call('PUT', 'suggestions_private/-Nlegacy00001', OWNER, Object.assign(rec('U_STAFF'), { assist: { at: NOW, draft: 'd', kinds: 'x', ok: true, summary: 's' }, watchNotice: { '-Nn1': { at: NOW, kind: 'pr', text: 't' } } }));
await call('PUT', 'suggestions_meta_private/-Nlegacy00001', OWNER, meta('U_STAFF'));
await call('PUT', 'suggestions_resolved_private/U_STAFF/-Nlegacy00001', OWNER, { title: '옛', cat: 'erp', at: NOW, seen: false, reply: '답' });
await expect('★ 서버 칸(assist)이 붙은 건의에 관리자 답변 저장', 'PATCH', 'suggestions_private/-Nlegacy00001', ADMIN, { status: 'done', reply: '답변입니다', repliedAt: NOW }, '허용');
await expect('★ status 없는 옛 진행함에 건의자 확인', 'PATCH', 'suggestions_resolved_private/U_STAFF/-Nlegacy00001', STAFF, { seen: true, resolvedOk: true, resolvedAt: NOW }, '허용');
await expect('서버(감시 도구·함수)는 assist 를 쓴다 — 관리자 권한은 규칙을 안 탄다', 'PUT', 'suggestions_private/-Nlegacy00001/assist', OWNER, { at: NOW, draft: 'new' }, '허용');
await expect('서버(감시 도구)는 watchNotice 를 쓴다', 'POST', 'suggestions_private/-Nlegacy00001/watchNotice', OWNER, { at: NOW, kind: 'done', text: '끝' }, '허용');
await call('PUT', 'suggestions_private/-Nweird-key/x', OWNER, 1);   // 키 모양 밖(하이픈은 허용이라 아래에서 따로)
await call('PUT', 'suggestions_private/' + encodeURIComponent('x&calc&'), OWNER, rec('U_STAFF'));
await expect('이상한 번호의 옛 건의도 관리자는 «지울 수» 있다', 'DELETE', 'suggestions_private/' + encodeURIComponent('x&calc&'), ADMIN, undefined, '허용');

console.log('\n── ④ 번호(키) 모양 — 셸 글자가 든 번호는 막힌다 ──');
await seed();
for (const bad of ['x&calc&', 'a|b', 'a^b', '%PATH%', 'a b', 'a;b', 'a"b', "a'b", 'a`b', 'a(b)']) {
  await expect(`건의 번호 «${bad}» (직원 새 건의)`, 'PUT', 'suggestions_private/' + encodeURIComponent(bad), STAFF, rec('U_STAFF'), '거부');
}
await expect('건의 번호 65자', 'PUT', 'suggestions_private/' + 'a'.repeat(65), STAFF, rec('U_STAFF'), '거부');
await expect('건의 번호 64자(경계)', 'PUT', 'suggestions_private/' + 'a'.repeat(64), STAFF, rec('U_STAFF'), '허용');
await expect('메타 번호 «x&calc&»', 'PUT', 'suggestions_meta_private/' + encodeURIComponent('x&calc&'), STAFF, meta('U_STAFF'), '거부');
await expect('진행함 번호 «x&calc&»(내 진행함)', 'PUT', 'suggestions_resolved_private/U_STAFF/' + encodeURIComponent('x&calc&'), STAFF, own(), '거부');
await expect('진행함 번호 «a|b»(관리자도)', 'PUT', 'suggestions_resolved_private/U_STAFF/' + encodeURIComponent('a|b'), ADMIN, own(), '거부');
await expect('진행함 uid 칸 «a&b»(관리자가 써도)', 'PUT', 'suggestions_resolved_private/' + encodeURIComponent('a&b') + '/-Nx0000000001', ADMIN, own(), '거부');
await expect('진행함 정상 번호(짝)', 'PUT', 'suggestions_resolved_private/U_STAFF/-Nok0000000001', STAFF, own(), '허용');

console.log('\n── ⑤ 모르는 칸·서버 전용 칸은 직원이 못 쓴다 ──');
await seed();
const S = (n) => (id) => `${n}/${id}`;
await pair('건의 원문에 모르는 칸(zzz)', 'PUT', S('suggestions_private'), STAFF, rec('U_STAFF'), (r) => Object.assign(r, { zzz: 'x'.repeat(5000) }));
await pair('새 건의에 assist(서버 칸)을 함께 담기', 'PUT', S('suggestions_private'), STAFF, rec('U_STAFF'), (r) => Object.assign(r, { assist: { draft: 'x' } }));
await pair('새 건의에 watchNotice(서버 칸)을 함께 담기', 'PUT', S('suggestions_private'), STAFF, rec('U_STAFF'), (r) => Object.assign(r, { watchNotice: { a: { kind: 'pr', text: 'x' } } }));
await pair('메타에 모르는 칸', 'PUT', S('suggestions_meta_private'), STAFF, meta('U_STAFF'), (r) => Object.assign(r, { blob: 'x'.repeat(5000) }));
await pair('내 진행함에 모르는 칸', 'PUT', (id) => `suggestions_resolved_private/U_STAFF/${id}`, STAFF, own(), (r) => Object.assign(r, { blob: 'x'.repeat(5000) }));

console.log('\n── ⑥ 칸의 종류·길이·모양 ──');
await seed();
await pair('relatedId 가 셸 글자(건의)', 'PUT', S('suggestions_private'), STAFF, rec('U_STAFF', { relatedId: '-Nfirst000001' }), (r) => Object.assign(r, { relatedId: 'a&b' }));
await pair('relatedId 가 셸 글자(진행함)', 'PUT', (id) => `suggestions_resolved_private/U_STAFF/${id}`, STAFF, own({ relatedId: '-Nfirst000001' }), (r) => Object.assign(r, { relatedId: 'a&b' }));
await pair('source 모양 밖', 'PUT', S('suggestions_private'), STAFF, rec('U_STAFF', { source: 'chatbot' }), (r) => Object.assign(r, { source: 'Chat!bot' }));
await pair('그림 한 장이 100만 자 초과', 'PUT', S('suggestions_private'), STAFF, rec('U_STAFF', { images: ['x'.repeat(900000)] }), (r) => Object.assign(r, { images: ['x'.repeat(1000001)] }));
await pair('그림 4장째(인덱스 3)', 'PUT', S('suggestions_private'), STAFF, rec('U_STAFF', { images: [IMG, IMG, IMG] }), (r) => Object.assign(r, { images: [IMG, IMG, IMG, IMG] }));
await pair('답변 글자 2만 자 초과(건의)', 'PUT', S('suggestions_private'), ADMIN, rec('U_ADMIN', { reply: 'x'.repeat(20000) }), (r) => Object.assign(r, { reply: 'x'.repeat(20001) }));
await pair('작성자 이름 100자 초과', 'PUT', S('suggestions_private'), STAFF, rec('U_STAFF', { author: 'x'.repeat(100) }), (r) => Object.assign(r, { author: 'x'.repeat(101) }));
await pair('createdAt 이 숫자가 아님', 'PUT', S('suggestions_private'), STAFF, rec('U_STAFF'), (r) => Object.assign(r, { createdAt: '지금' }));
await pair('메타 제목 200자 초과', 'PUT', S('suggestions_meta_private'), STAFF, meta('U_STAFF', { title: 'x'.repeat(200) }), (r) => Object.assign(r, { title: 'x'.repeat(201) }));
const OWN = (id) => `suggestions_resolved_private/U_STAFF/${id}`;
await pair('진행함 resolvedOk 가 글자 «true»', 'PUT', OWN, STAFF, own({ resolvedOk: true }), (r) => Object.assign(r, { resolvedOk: 'true' }));
await pair('진행함 seen 이 글자', 'PUT', OWN, STAFF, own(), (r) => Object.assign(r, { seen: 'yes' }));
await pair('진행함 resolvedAt 이 글자', 'PUT', OWN, STAFF, own({ resolvedAt: NOW }), (r) => Object.assign(r, { resolvedAt: '어제' }));
await pair('진행함 feedback 2000자 초과', 'PUT', OWN, STAFF, own({ feedback: 'x'.repeat(2000) }), (r) => Object.assign(r, { feedback: 'x'.repeat(2001) }));
await pair('진행함 reply 2만 자 초과', 'PUT', OWN, STAFF, own({ reply: 'x'.repeat(20000) }), (r) => Object.assign(r, { reply: 'x'.repeat(20001) }));
await pair('진행함 status 모양 밖', 'PUT', OWN, STAFF, own({ status: 'ing' }), (r) => Object.assign(r, { status: 'whatever' }));
await pair('진행함 제목 200자 초과', 'PUT', OWN, STAFF, own({ title: 'x'.repeat(200) }), (r) => Object.assign(r, { title: 'x'.repeat(201) }));

console.log('\n── ⑥-2 «객체가 아닌 값» · 그림 번호의 빈틈 (외부 검토 2026-11-12 — 통짜 값은 자식 규칙을 «평가하지 않는다») ──');
await seed();
const BIG = 'X'.repeat(2000000);
await pair('images 에 통짜 글자(200만 자)', 'PUT', S('suggestions_private'), STAFF, rec('U_STAFF', { images: [IMG] }), (r) => Object.assign(r, { images: BIG }));
await pair('replyImages 에 통짜 글자(200만 자)', 'PUT', S('suggestions_private'), STAFF, rec('U_STAFF', { replyImages: [IMG] }), (r) => Object.assign(r, { replyImages: BIG }));
await pair('images 에 숫자 한 개', 'PUT', S('suggestions_private'), STAFF, rec('U_STAFF', { images: [IMG] }), (r) => Object.assign(r, { images: 12345 }));
await pair('그림이 0번 없이 2번만(빈틈 → 화면 images.map 이 죽는다)', 'PUT', S('suggestions_private'), STAFF, rec('U_STAFF', { images: [IMG] }), (r) => Object.assign(r, { images: { 2: IMG } }));
await pair('그림이 0번 없이 1번만', 'PUT', S('suggestions_private'), STAFF, rec('U_STAFF', { images: [IMG, IMG] }), (r) => Object.assign(r, { images: { 1: IMG } }));
await pair('그림이 0·2번(1번 빠짐)', 'PUT', S('suggestions_private'), STAFF, rec('U_STAFF', { images: [IMG, IMG, IMG] }), (r) => Object.assign(r, { images: { 0: IMG, 2: IMG } }));
await expect('★ 내 진행함 «칸 전체» 에 통짜 글자 200만 자', 'PUT', 'suggestions_resolved_private/U_STAFF', STAFF, BIG, '거부');
await expect('★ 내 진행함 «한 건» 자리에 통짜 글자 200만 자', 'PUT', 'suggestions_resolved_private/U_STAFF/-Nraw00000001', STAFF, BIG, '거부');
await expect('내 진행함 한 건 자리에 참/거짓 한 개', 'PUT', 'suggestions_resolved_private/U_STAFF/-Nraw00000002', STAFF, true, '거부');
await expect('관리자도 진행함 한 건 자리에 통짜 글자는 못 쓴다', 'PUT', 'suggestions_resolved_private/U_STAFF/-Nraw00000003', ADMIN, BIG, '거부');
await expect('건의 «한 건» 자리에 통짜 글자 200만 자', 'PUT', 'suggestions_private/-Nraw00000004', STAFF, BIG, '거부');
await expect('메타 «한 건» 자리에 통짜 글자 200만 자', 'PUT', 'suggestions_meta_private/-Nraw00000005', STAFF, BIG, '거부');
await expect('진행함 «칸 전체» 에 정상 객체(짝)', 'PUT', 'suggestions_resolved_private/U_STAFF', STAFF, { '-Nobj00000001': own() }, '허용');

console.log('\n── ⑥-3 «부분 삭제» 로 빈틈 만들기 (외부 재검증 지적 — 지울 때는 자식 규칙이 평가되지 않는다) ──');
/* 3장이 있는 정상 자료를 «서버 권한으로» 심고, 직원/관리자가 일부만 지우는 갱신(PATCH)을 시험한다 */
const OWNIMG = (id) => `suggestions_resolved_private/U_STAFF/${id}`;
await call('PUT', OWNIMG('-Ndel00000001'), OWNER, own({ replyImages: [IMG, IMG, IMG] }));
await expect('★ 진행함 그림 3장 중 0·1번만 지워 2번만 남기기', 'PATCH', OWNIMG('-Ndel00000001'), STAFF, { 'replyImages/0': null, 'replyImages/1': null }, '거부');
await expect('★ 진행함 그림 3장 중 0번만 지우기(1·2번만 남음)', 'PATCH', OWNIMG('-Ndel00000001'), STAFF, { 'replyImages/0': null }, '거부');
await expect('★ 진행함 그림 3장 중 1번만 지우기(0·2번만 남음)', 'PATCH', OWNIMG('-Ndel00000001'), STAFF, { 'replyImages/1': null }, '거부');
await expect('짝: 그림 3장 중 «마지막(2번)만» 지우기 → 0·1번 남음', 'PATCH', OWNIMG('-Ndel00000001'), STAFF, { 'replyImages/2': null }, '허용');
await call('PUT', OWNIMG('-Ndel00000002'), OWNER, own({ replyImages: [IMG, IMG, IMG] }));
await expect('짝: 그림 전체를 한 번에 지우기', 'PATCH', OWNIMG('-Ndel00000002'), STAFF, { replyImages: null }, '허용');
await call('PUT', 'suggestions_private/-Ndel00000003', OWNER, rec('U_STAFF', { replyImages: [IMG, IMG, IMG] }));
await expect('★ 건의 원문 답변 그림 0·1번만 지우기(관리자)', 'PATCH', 'suggestions_private/-Ndel00000003', ADMIN, { 'replyImages/0': null, 'replyImages/1': null }, '거부');
await expect('짝: 건의 원문 답변 그림 «마지막만» 지우기(관리자)', 'PATCH', 'suggestions_private/-Ndel00000003', ADMIN, { 'replyImages/2': null }, '허용');
await call('PUT', 'suggestions_private/-Ndel00000004', OWNER, rec('U_STAFF', { images: [IMG, IMG, IMG] }));
await expect('★ 건의 원문 첨부 그림 0번만 지우기(관리자)', 'PATCH', 'suggestions_private/-Ndel00000004', ADMIN, { 'images/0': null }, '거부');

console.log('\n── ⑦ 예전부터 막혀 있던 것은 그대로 막혀 있다(회귀) ──');
await seed();
await call('PUT', 'suggestions_private/-Nexist000001', OWNER, rec('U_STAFF'));
await expect('남의 uid 로 건의 등록', 'PUT', 'suggestions_private/-Nforge000001', STAFF, rec('U_STAFF2'), '거부');
await expect('직원이 기존 건의 수정', 'PATCH', 'suggestions_private/-Nexist000001', STAFF, { status: 'done' }, '거부');
await expect('직원이 건의 원문 읽기', 'GET', 'suggestions_private', STAFF, undefined, '거부');
await expect('직원이 남의 진행함에 쓰기', 'PUT', 'suggestions_resolved_private/U_STAFF2/-Nx0000000002', STAFF, own(), '거부');
await expect('직원이 남의 진행함 읽기', 'GET', 'suggestions_resolved_private/U_STAFF2', STAFF, undefined, '거부');
await expect('관리자는 건의 원문 읽기', 'GET', 'suggestions_private', ADMIN, undefined, '허용');
await expect('직원이 status 를 done 으로 새 건의 등록', 'PUT', 'suggestions_private/-Ndone0000001', STAFF, rec('U_STAFF', { status: 'done' }), '거부');

console.log(`\n  통과 ${pass} · 실패 ${fail}\n`);
if (fail) console.log('  실패한 것:\n   - ' + failures.join('\n   - ') + '\n');
process.exit(fail ? 1 : 0);
