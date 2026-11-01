// 비밀번호 규칙·강제 변경 복구·해시 저장 중단 (개인정보 4단계, 2026-11-01)
// 배경: 재직 8명이 기본 비밀번호(123456) 그대로였다. 원인 — 일반 직원은 명부 사본에 loginPw 가 없어
//       「기본값 아님」으로 오판해 강제 변경 깃발이 지워졌다. 값이 아니라 «판단의 길»을 본다.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const Policy = require(path.join(__dirname, '..', 'js', 'pu-pw-policy.js'));
const erp = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
const enter = fs.readFileSync(path.join(__dirname, '..', 'enter.html'), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const erpCode = strip(erp);

test('★ 규칙: 10자 미만·흔한 값·반복·아이디 포함·현재와 같음은 거절한다', () => {
  assert.ok(Policy.weakReason('1234', 'P-001'));
  assert.ok(Policy.weakReason('abc12345', 'P-001'), '9자 이하');
  assert.ok(Policy.weakReason('1234567890', 'P-001'), '숫자 나열');
  assert.ok(Policy.weakReason('Hello123456!', 'P-001'), '123456 포함');
  assert.ok(Policy.weakReason('aaaaaaaaaaaa', 'P-001'), '한 글자 반복');
  assert.ok(Policy.weakReason('MyP001Secret!!', 'P-001'), '사번(p001) 포함');
  assert.ok(Policy.weakReason('Qwerty-Horse-9', 'A-002'), 'qwerty');
  assert.ok(Policy.weakReason('Same-Pass-9988', 'A-002', 'Same-Pass-9988'), '현재와 같음');
});

test('괜찮은 비밀번호는 통과한다 — 헛막힘은 사람들이 규칙을 피해 가게 만든다', () => {
  assert.strictEqual(Policy.weakReason('Blue-River-7491', 'P-001', 'old'), '');
  assert.strictEqual(Policy.weakReason('세글자 아님 긴 문장 비밀번호', 'A-010'), '');
  assert.strictEqual(Policy.MIN_LEN, 10);
});

test('이알피·로그인 화면이 같은 규칙 파일을 쓴다', () => {
  assert.match(erp, /js\/pu-pw-policy\.js/);
  assert.match(enter, /js\/pu-pw-policy\.js/);
  assert.match(erpCode, /PuPwPolicy\.weakReason\(newPw, u\.sid, oldPw\)/);
  assert.match(erpCode, /PuPwPolicy\.weakReason\(newPw, u\.sid, curPw\)/);
  assert.match(strip(enter), /PuPwPolicy\.weakReason\(n1, id, cur\)/);
  // 예전의 4자·6자 허용이 남아 있지 않다
  assert.doesNotMatch(erpCode, /newPw\.length < 4/);
  assert.doesNotMatch(strip(enter), /n1\.length < 6/);
});

test('★★ 비밀번호를 바꿔도 «진짜 비밀번호의 해시»를 명부에 넣지 않는다', () => {
  assert.doesNotMatch(erpCode, /loginPw: encodePw\(newPw\)/, '바꾼 비밀번호 해시가 명부에 저장됩니다');
  assert.ok((erpCode.match(/loginPw: PW_CHANGED_MARK/g) || []).length >= 2, '두 변경창 모두 표시 글자를 써야 합니다');
});

test('표시 글자는 «기본값 아님» — 기본값 판별은 그대로 작동한다', () => {
  const i = erp.indexOf('function sha256Hex(');
  const j = erp.indexOf('function sidToEmail(');
  assert.ok(i > 0 && j > i);
  const isDef = /function isDefaultPwStored\(stored\)\{[^\n]*\}/.exec(erp);
  assert.ok(isDef, 'isDefaultPwStored 를 못 찾았습니다');
  const src = erp.slice(i, j) + '\n' + isDef[0] + '\nvar PW_CHANGED_MARK = ' + /var PW_CHANGED_MARK = ('[^']+');/.exec(erp)[1] + ';\n'
    + 'this.api = { encodePw: encodePw, isDefaultPwStored: isDefaultPwStored, mark: PW_CHANGED_MARK };';
  const ctx = { window: { crypto: require('crypto').webcrypto }, atob, unescape, escape, decodeURIComponent, encodeURIComponent, Math, String, Uint8Array };
  vm.createContext(ctx); vm.runInContext(src, ctx);
  const api = ctx.api;
  assert.strictEqual(api.isDefaultPwStored(api.encodePw('123456')), true, '기본값 해시를 못 알아봅니다');
  assert.strictEqual(api.isDefaultPwStored(api.encodePw('Blue-River-7491')), false);
  assert.strictEqual(api.isDefaultPwStored(api.mark), false, '표시 글자가 «기본값»으로 읽힙니다');
});

test('★★ 강제 변경: 명부에 증거가 «없다»고 «이미 바꿨다»로 읽지 않는다', () => {
  const body = erpCode.slice(erpCode.indexOf("var _fpAsync = false;"), erpCode.indexOf("var fpcS = useState"));
  assert.ok(body.length > 100, '강제 변경 판단 자리를 못 찾았습니다');
  // 깃발을 지우는 조건은 «바꿨다는 증거»(pwChangedFb 또는 loginPw 가 있고 기본값이 아님)뿐
  assert.match(body, /_fpU\.pwChangedFb \|\| \(\(_fpU\.loginPw \|\| _fpU\.password\) && !isDefaultPwStored/);
  // 증거가 사본에 없으면 본인 칸을 읽어 본다
  assert.match(body, /else if\(_fpU && !_fpU\.loginPw && !_fpU\.password\)\{\s*_fpAsync = true;/);
  assert.match(erpCode, /uid_roles\/' \+ cu\.uid \+ '\/pwChangedAt'/);
  // 예전의 오판(「loginPw 가 비어 있으면 기본값 아님」)이 되살아나지 않았다
  assert.doesNotMatch(body, /if\(_fpU && !isDefaultPwStored\(/);
});

test('강제 변경창은 확인이 끝나기 «전»에는 뜨지 않고, 증거가 없으면 뜬다', () => {
  assert.match(erpCode, /useState\(_fpAsync \? '' : _fpRaw\)/);
  assert.match(erpCode, /function ask\(\)\{ if\(alive\) setForcePwSid\(sid\); \}/);
  // 읽기에 실패해도(오류) 창을 띄운다 — 안전한 쪽
  assert.match(erpCode, /else ask\(\);\s*\}, ask\);/);
});

test('비밀번호를 바꾸면 본인 칸에 바꾼 때를 남긴다(이알피·로그인 화면 둘 다)', () => {
  assert.ok((erpCode.match(/markPwChanged\(\);/g) || []).length >= 2);
  assert.match(erpCode, /'\/pwChangedAt'\)\.set\(Date\.now\(\)\)/);
  assert.match(strip(enter), /\/pwChangedAt'\)\.set\(Date\.now\(\)\)/);
});

test('★ 로그인마다 uid_roles 를 통째로 다시 쓰지만 pwChangedAt 은 지우지 않는다', () => {
  const i = erpCode.indexOf('function recordUidRole(');
  const body = erpCode.slice(i, i + 3500);
  assert.match(body, /child\('pwChangedAt'\)\.once\('value'\)/);
  assert.match(body, /rec\.pwChangedAt = v/);
});
