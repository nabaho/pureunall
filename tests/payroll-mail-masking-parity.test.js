/* 급여 메일연동 — 마스킹·사업장 매칭 «동일성» 검사 (2026-11-09)
   왜 생겼나: 같은 규칙이 화면(pu-payroll-mail-sync.html)·브릿지(js/pu-payroll-mail-bridge.js)·서버 함수
   (functions/payrollMailSync.js) 세 곳에 따로 있어, 외부 검토를 세 번 받는 동안 «한 곳을 고치면 다른 곳이 어긋나는»
   일이 되풀이됐다. 이제 규칙의 원본은 브릿지 하나이고, 서버 함수는 배포물이 js/ 를 못 가져가서 둔 사본이다.
   이 검사는 둘의 «결과»가 같은지, 그리고 화면이 따로 규칙을 갖지 않는지를 지킨다.
   (아래 입력은 모두 지어낸 값이다 — 실제 고객·근로자 자료가 아니다.) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const bridge = require('../js/pu-payroll-mail-bridge.js');

// 서버 모듈은 firebase-admin 을 바로 읽는다 — 이 검사에서는 껍데기로 대신한다(DB 에는 쓰지 않는다)
const written = [];
function loadServer() {
  const orig = Module._load;
  Module._load = function(request, ...rest) {
    if (request === 'firebase-admin') {
      const database = () => ({ ref: (p) => ({ set: async (v) => { written.push([p, v]); } }) });
      database.ServerValue = { TIMESTAMP: 0 };
      return { database };
    }
    return orig.call(this, request, ...rest);
  };
  try {
    delete require.cache[require.resolve('../functions/payrollMailSync.js')];
    return require('../functions/payrollMailSync.js');
  } finally {
    Module._load = orig;
  }
}
const server = loadServer();

/* 지어낸 입력들 — 계좌는 마디 수·길이·0으로 시작하는 마디까지 여러 모양으로 */
const MASK_INPUTS = [
  '920719-1234567', '9207191234567', 'x-920719-1234567',
  '010-1111-2222', '010 1111 2222', '010.1111.2222', '02-1234-5678', '041-556-0035',
  '352-1234-5678-83', '110-123-456789', '110123456789', '3333-12-1234567', '9002-1234-5678-1',
  '012-1234-5678-99', '123-01-1234-5678', '3333-01-1234567', '123-456789-01-1', '123-456-1234567',
  '계좌:352-1234-5678-83,010-1111-2222/041-556-0035',
  '계좌 123 456 789012', '계좌번호: 123.456.789012', '농협 123456789', '신현주대표 <a@example.invalid>', '홍길동(가람떡집) <a@example.invalid>',
  '920719-1234567-입사', '110-123-456789-농협', '010-1234-5678-본인', '3521234567890-신한', '0101234567-',
  '2026-11-02', '입사 2026-11-02 급여 2,600,000원', '월 3200000원', '11월 10-20일',
  'sample@example.invalid', '이철 <lee1234@example.invalid>', '홍길동 (010-1234-5678)'
];

test('화면용 마스킹(브릿지)과 서버 함수의 마스킹 결과가 같다', () => {
  for (const s of MASK_INPUTS) {
    assert.equal(server.maskPiiServer(s), bridge.maskPii(s), '마스킹 결과가 어긋남: ' + s);
    assert.equal(server.maskFromServer(s), bridge.maskFrom(s), '보낸이 마스킹 결과가 어긋남: ' + s);
  }
  for (const n of ['이철', '홍길동', '남궁민수', 'ABC', '']) {
    assert.equal(server.maskNameServer(n), bridge.maskName(n), '이름 마스킹 결과가 어긋남: ' + n);
  }
});

test('계좌·번호 모양이 어떻든 숫자가 8개 이상 이어진 덩어리는 남지 않는다 (날짜는 예외)', () => {
  for (const s of MASK_INPUTS) {
    const out = bridge.maskPii(s).replace(/\d{4}-\d{2}-\d{2}/g, '');
    const runs = out.match(/\d[\d-]*\d/g) || [];
    for (const r of runs) {
      assert.ok(r.replace(/-/g, '').length < 8, '숫자 덩어리가 그대로 남음: ' + s + ' → ' + out);
    }
  }
});

test('날짜·금액은 가리지 않는다 / 메일·이름은 가린다', () => {
  assert.equal(bridge.maskPii('2026-11-02'), '2026-11-02');
  assert.ok(bridge.maskPii('급여 2,600,000원').includes('2,600,000'));
  assert.ok(!bridge.maskPii('lee1234@example.invalid').includes('lee1234'));
  assert.ok(!bridge.maskFrom('이철 <lee1234@example.invalid>').includes('이철'));
  assert.ok(!bridge.maskNames('성명: 홍길동 님', ['홍길동']).includes('홍길동'));
});

test('본문의 «성명:» 라벨 뒤 이름을 모두 찾고 라벨 글자는 건드리지 않는다', () => {
  const body = '- 성명: 박지훈\n- 주민등록번호: 940815-1234567\n퇴사자 이영희\n- 이름 없음';
  const names = bridge.findNames(body);
  assert.deepEqual(names.sort(), ['박지훈', '이영희']);
  const out = bridge.maskNames(bridge.maskPii(body), names);
  assert.ok(out.includes('주민등록번호'), '라벨이 훼손되면 안 됩니다');
  assert.ok(!out.includes('박지훈') && !out.includes('이영희'));
});

/* 사업장 — 같은 이름의 지점 둘, 괄호 생략, ㈜, 같은 발신 주소 */
const COMPANIES = [
  { id: 'a', name: '늘봄반찬(배방점)', pay_mail: 'shared1@example.invalid' },
  { id: 'b', name: '늘봄반찬(모종점)', pay_mail: 'shared1@example.invalid' },
  { id: 'c', name: '일등한우', pay_mail: 'shared2@example.invalid' },
  { id: 'd', name: '일등한우 주식회사', pay_mail: 'shared2@example.invalid' },
  { id: 'e', name: '화덕고등어' },
  { id: 'f', name: '화덕고등어(안양역점)' },
  { id: 'g', name: '㈜경보엔지니어링' },
  { id: 'h', name: '우리와(곱창회관)' },
  { id: 'i', name: '써브웨이 서산호수공원점' },
  { id: 'j', name: '써브웨이 서울역점' },
  { id: 'k', name: '단독상회', pay_mail: 'only@example.invalid' },
  { id: 'm', name: '주식회사 세창이엔지' },
  { id: 'n', name: '농업회사법인 주식회사 유명육가공(양념육지점)' },
  { id: 'o', name: '고려면옥 아산점→보리촌 바지락 해물 칼국수' },
  { id: 'q', name: '(주)화덕고등어(천안점)' }
];
const MATCH_CASES = [
  ['shared1@example.invalid', '늘봄반찬(배방점) 11월', 'a'],
  ['shared1@example.invalid', '늘봄반찬 모종점 11월', 'b'],
  ['shared1@example.invalid', '늘봄반찬 11월', null],            // 같은 이름의 지점 둘 — 못 정함
  ['shared2@example.invalid', '일등한우주식회사 건', 'd'],
  ['shared2@example.invalid', '제목없음', null],                  // 같은 주소 둘인데 이름도 없다
  ['other@example.invalid', '일등한우 급여', 'c'],
  ['other@example.invalid', '화덕고등어 안양역점 11월', 'f'],       // 괄호를 빼고 써도 지점을 찾는다
  ['other@example.invalid', '화덕고등어 11월', 'e'],
  ['other@example.invalid', '경보엔지니어링 급여', 'g'],            // ㈜ 를 빼고 써도 찾는다
  ['other@example.invalid', '우리와 곱창회관', 'h'],
  ['other@example.invalid', '써브웨이서울역점', 'j'],              // 예외 없이 같은 점수 규칙
  ['other@example.invalid', '써브웨이 서산호수공원점', 'i'],
  ['other@example.invalid', '[세창이엔지] 11월 급여', 'm'],         // 주식회사를 빼고 써도 찾는다
  ['other@example.invalid', '유명육가공(양념육지점) 10월분 근태', 'n'], // 농업회사법인·주식회사를 빼고 써도 찾는다
  ['other@example.invalid', '[보리촌 바지락 해물 칼국수] 11월 급여', 'o'], // 바뀐 이름(→ 뒤)으로 써도 찾는다
  ['other@example.invalid', '화덕고등어 천안점 11월', 'q'],          // (주)가 붙은 지점
  ['only@example.invalid', '제목없음', 'k'],                      // 주소가 하나뿐이면 그곳
  ['nobody@example.invalid', '아무 이름 없음', null]
];

test('사업장 매칭: 화면용(브릿지)과 서버 함수가 같은 답을 낸다', () => {
  for (const [from, subject, want] of MATCH_CASES) {
    const mail = { from, subject, body: '' };
    const b = bridge.matchCompany(mail, COMPANIES);
    const s = server.pickCompany(mail, COMPANIES);
    assert.equal(b ? b.id : null, want, '브릿지: ' + subject);
    assert.equal(s ? s.id : null, want, '서버: ' + subject);
  }
});

test('서버 함수: 못 정한 메일은 미분류, uid 는 안전한 형식만', async () => {
  written.length = 0;
  const r = await server.routeIncomingPureunMail({ uid: 'u1', from: 'shared1@example.invalid', subject: '늘봄반찬 11월', body: 'x' }, COMPANIES);
  assert.equal(r.targetId, 'unclassified');
  assert.ok(written.every((w) => /unclassified/.test(w[0])));
  for (const bad of [null, undefined, false, true, NaN, {}, [], '', '   ', '...', 'a/b', 'a.b', -1, 1.5, 'x'.repeat(65)]) {
    await assert.rejects(() => server.routeIncomingPureunMail({ uid: bad }, []), undefined, 'uid 를 거절해야 함: ' + String(bad));
  }
  assert.equal(server.validUid('abc_1-2'), 'abc_1-2');
  assert.equal(server.validUid(7), '7');
});

test('서버 함수: 저장하는 마스킹본에 번호·이름·메일이 남지 않는다', async () => {
  written.length = 0;
  const body = '- 성명: 박지훈\n- 주민등록번호: 940815-1234567\n퇴사자 이영희\n연락처 010-1234-5678-본인\n계좌 3333-12-1234567\n입사일 2026-11-01 월보수액 2,600,000원';
  await server.routeIncomingPureunMail({ uid: 'u9', from: '홍길동 <hong@example.invalid>', subject: '성명: 박지훈 입사', body }, COMPANIES);
  const masked = written.find((w) => /inbox_masked/.test(w[0]))[1];
  const all = JSON.stringify(masked);
  for (const secret of ['박지훈', '이영희', '940815', '1234567', '010-1234', 'hong@', '홍길동']) {
    assert.ok(all.indexOf(secret) === -1, '마스킹본에 남음: ' + secret);
  }
  assert.ok(masked.maskedBody.includes('주민등록번호'), '라벨이 훼손되면 안 됩니다');
  assert.ok(masked.maskedBody.includes('2026-11-01') && masked.maskedBody.includes('2,600,000'), '날짜·금액은 남아야 합니다');
  // 화면용 모듈과 같은 결과
  const names = bridge.findNames(body + '\n성명: 박지훈 입사');
  assert.equal(masked.maskedBody, bridge.maskNames(bridge.maskPii(body), names));
});

test('서버 함수: 한국시간 기준 연월', () => {
  assert.equal(server.monthKey('2026-11-01T08:00:00+09:00'), '2026_11');
  assert.equal(server.monthKey('2026-10-31T16:00:00Z'), '2026_11');
  assert.match(server.monthKey('이상한 날짜'), /^\d{4}_\d{2}$/);
});

test('화면은 마스킹·매칭 규칙을 따로 갖지 않고 브릿지를 쓴다', () => {
  const html = read('pu-payroll-mail-sync.html');
  assert.match(html, /<script src="js\/pu-payroll-mail-bridge\.js[^"]*"><\/script>/, '브릿지를 읽어야 합니다');
  assert.ok(html.indexOf('PuPayrollMailBridge.maskPii') !== -1, '화면의 마스킹은 브릿지를 써야 합니다');
  assert.ok(html.indexOf('PuPayrollMailBridge.matchCompany') !== -1, '화면의 사업장 매칭은 브릿지를 써야 합니다');
  assert.ok(!/\\d\{10,16\}/.test(html), '화면 안에 따로 만든 계좌 마스킹 정규식이 있습니다 — 브릿지 한 곳에서만 고칩니다');
});

test('구형 사파리가 죽지 않게 lookbehind 정규식을 쓰지 않는다', () => {
  for (const f of ['js/pu-payroll-mail-bridge.js', 'pu-payroll-mail-sync.html']) {
    assert.ok(!/\(\?<[!=]/.test(read(f)), f + ' 에 lookbehind 가 있습니다');
  }
});

test('공개 저장소로 사업장 마스터를 보내는 길이 막혀 있다', () => {
  const html = read('pu-payroll-mail-sync.html');
  const at = html.indexOf("getElementById('btnExecuteGithubPush').addEventListener");
  assert.ok(at > 0, '단추 핸들러를 찾지 못했습니다');
  // 핸들러 첫머리부터 «안전 페이로드를 만드는 줄» 앞까지에, 조건 없는 return(들여쓰기 8칸)이 있어야 한다.
  // (조건부 if (...) { return; } 는 인정하지 않는다 — 이전 검사는 그것 때문에 차단 블록을 지워도 통과했다)
  const end = html.indexOf('buildGithubSafeCompaniesPayload();', at);
  assert.ok(end > at, '안전 페이로드 줄을 찾지 못했습니다');
  const head = html.slice(at, end);
  assert.ok(/\n {8}return;\n/.test(head), '핸들러 첫머리에 조건 없는 return 이 있어야 합니다');
  assert.ok(/보안 차단/.test(head), '막은 까닭을 사용자에게 보여 주어야 합니다');
  assert.ok(head.indexOf('api.github.com') === -1, 'GitHub 호출이 막는 return 보다 앞에 있으면 안 됩니다');
});
