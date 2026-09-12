/* 파이어베이스 «문»이 제대로 잠겼나 — 2026-09-12 보안 훑기에서 나온 구멍 둘
 *
 * ■ 무엇이 문제였나 (실측)
 *   ㉠ 파이어베이스 «가입이 열려 있다» — 웹 열쇠(HTML 에 공개돼 있다)만 있으면
 *      아무나 이메일 계정을 만든다. 그런데 옛 LOGIN 은 「비번 계정인가」만 봤다.
 *      → 232곳(고객사·계약·사건·명함첩·직원명부)이 «아무나»에게 열려 있었다.
 *   ㉡ uid_roles 를 «자기 손으로» 쓸 수 있는데 sid·status 를 아무도 안 지켰다.
 *      → 가입한 뒤 {sid:'X-999', status:'active'} 를 스스로 써서 직원이 될 수 있었다.
 *
 *   ★ 둘은 «함께» 막아야 뜻이 있다. ㉠만 막으면 스스로 재직자가 되고,
 *     ㉡만 막으면 가입만으로 열린 채다. 그래서 이 검사도 둘을 함께 본다.
 *
 * ■ 무엇을 보나 — «규칙»이지 «지금 값»이 아니다 (CLAUDE.md)
 *   조건문을 글자로 박지 않는다. 「로그인만으로 열리는 자리가 있는가」처럼
 *   **성질**을 본다. 그래야 조건이 다듬어져도 안 깨지고, 구멍이 다시 나면 깨진다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const rules = JSON.parse(execFileSync(process.execPath,
  [path.join(ROOT, 'scripts', 'make-firebase-rules.js')],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })).rules;

/* 규칙 나무를 훑어 (경로, 칸, 조건) 을 모은다 */
function 모으기() {
  const out = [];
  (function 걷기(node, 길) {
    if (!node || typeof node !== 'object') return;
    ['.read', '.write', '.validate'].forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(node, k)) out.push({ p: 길 || '/', k: k, v: String(node[k]) });
    });
    Object.keys(node).forEach(function (k) {
      if (k.charAt(0) === '.') return;
      걷기(node[k], 길 + '/' + k);
    });
  })(rules, '');
  return out;
}
const 모두 = 모으기();

/* 「우리 직원인가」를 보는 조건이 들어 있는가 */
function 재직자를보나(v) {
  return /uid_roles'\)\.child\(auth\.uid\)\.child\('status'\)/.test(v)
      || /uid_roles'\)\.child\(auth\.uid\)\.child\('sid'\)/.test(v)      /* STAFF 쪽 잣대 */
      || /child\('isAdmin'\)|child\('isSubAdmin'\)|child\('fin'\)/.test(v);
}

/* ══ ㉠ 「가입만 하면 열리는 자리」가 없어야 한다 ══ */

test('★★ 비번 로그인«만»으로 열리는 자리가 없다 — 가입이 열려 있기 때문이다', function () {
  /* 검사고정-허용: 아래 두 자리는 «일부러» 로그인 방식만 본다. 까닭이 저마다 있다.
     여기에 새 자리가 늘면 그건 구멍이므로 이 검사가 걸어야 한다. */
  const 봐줄곳 = [
    '/uid_roles/$uid',   /* 새 직원이 자기 칸을 «처음» 만드는 길. 막으면 영영 못 들어온다.
                            대신 아래 ㉡ 검사가 그 칸의 내용을 sid_roles 와 견준다. */
  ];
  const 샌곳 = 모두.filter(function (x) {
    if (x.k === '.validate') return false;
    if (!/sign_in_provider/.test(x.v)) return false;     /* 로그인 방식을 안 보는 자리는 여기 대상이 아니다 */
    if (봐줄곳.indexOf(x.p) >= 0) return false;
    return !재직자를보나(x.v);
  });
  assert.deepEqual(샌곳.map(function (x) { return x.p + ' [' + x.k.slice(1) + ']'; }), [],
    '로그인만 하면 열리는 자리가 있습니다 — 아무나 가입할 수 있으므로 «아무나»에게 열린 것입니다');
});

test('LOGIN 이 걸린 자리가 여전히 많다 — 조건을 통째로 빼 버리지 않았는가', function () {
  /* ⚠ 「샌 곳 0」은 조건을 «전부 지워도» 통과한다. 그래서 반대쪽도 함께 본다.
       수를 박지 않고 «넉넉한 하한»만 둔다 — 자리가 늘어도 안 깨진다. */
  const 걸린곳 = 모두.filter(function (x) { return /sign_in_provider/.test(x.v) && 재직자를보나(x.v); });
  assert.ok(걸린곳.length > 50,
    '재직자 잣대가 걸린 자리가 너무 적습니다(' + 걸린곳.length + ') — 조건이 사라진 것 아닙니까');
});

/* ══ ㉡ uid_roles 를 스스로 못 쓰게 막았는가 ══ */

test('★★ uid_roles 에 «명단 맞춤»이 걸려 있다 — 스스로 직원이 될 수 없다', function () {
  const v = (rules.uid_roles && rules.uid_roles.$uid && rules.uid_roles.$uid['.validate']) || '';
  assert.ok(v, 'uid_roles/$uid 에 .validate 가 없습니다 — sid·status 를 아무 값이나 쓸 수 있습니다');
  assert.match(v, /sid_roles/, '믿을 수 있는 명단(sid_roles)과 견주지 않습니다');
  assert.match(v, /auth\.token\.email/, '내 이메일과 견주지 않습니다 — 남의 사번을 쓸 수 있습니다');
  assert.match(v, /status/, 'status 를 견주지 않습니다 — 스스로 active 라고 쓸 수 있습니다');

  /* ⚠ 「sid_roles 가 나오는가」만 보면 약하다 — 두 번 보는데 «한 곳만» 딴 데를
       가리켜도 통과한다(2026-09-12 고장넣기에서 실제로 안 물었다).
       그래서 이 잣대가 «뿌리에서 보는 자리 전부»를 본다. */
  const 보는곳 = (v.match(/root\.child\('([^']+)'\)/g) || [])
    .map(function (s) { return /root\.child\('([^']+)'\)/.exec(s)[1]; });
  const 뜻밖 = 보는곳.filter(function (n) { return n !== 'sid_roles' && n !== 'uid_roles'; });
  assert.deepEqual(뜻밖, [],
    '명단맞춤이 믿을 수 없는 자리를 봅니다 — sid_roles(관리자만 씀) 말고는 견줄 근거가 못 됩니다');
  assert.ok(보는곳.indexOf('sid_roles') >= 0, 'sid_roles 를 아예 안 봅니다');
});

test('★ sid_roles 는 «관리자만» 쓴다 — 명단이 믿을 만해야 견주는 뜻이 있다', function () {
  const w = String((rules.sid_roles && rules.sid_roles['.write']) || '');
  assert.match(w, /child\('isAdmin'\)/, 'sid_roles 를 관리자 아닌 사람이 쓸 수 있으면 명단이 믿을 게 못 됩니다');
});

test('★ uid_roles «쓰기»는 새 LOGIN 을 쓰지 않는다 — 닭과 달걀을 피한다', function () {
  /* 새 직원은 아직 uid_roles 가 없다. 쓰기 문이 「재직자여야 한다」면
     자기 칸을 못 만들어 영영 못 들어온다. */
  const w = String((rules.uid_roles && rules.uid_roles.$uid && rules.uid_roles.$uid['.write']) || '');
  assert.match(w, /sign_in_provider/, '로그인 방식을 안 봅니다');
  assert.equal(/uid_roles'\)\.child\(auth\.uid\)\.child\('status'\)/.test(w), false,
    '쓰기 문이 «재직자»를 요구합니다 — 새 직원이 영영 등록을 못 합니다');
});

test('스스로 못 올리는 칸 셋(fin·isAdmin·isSubAdmin)이 그대로 지켜진다', function () {
  const $u = (rules.uid_roles && rules.uid_roles.$uid) || {};
  ['fin', 'isAdmin', 'isSubAdmin'].forEach(function (k) {
    const g = String(($u[k] || {})['.validate'] || '');
    assert.ok(g, k + ' 을 지키는 잣대가 사라졌습니다');
    assert.match(g, /child\('isAdmin'\)/, k + ' 을 관리자가 아니어도 올릴 수 있습니다');
  });
});

/* ══ 익명(계정도 없이) 열리는 자리 ══ */

test('★ 익명으로 열리는 자리는 «정해진 곳»뿐이다 (전자서명·이음)', function () {
  /* 검사고정-허용: 이 목록은 «정책»이다. 익명 로그인은 근로자가 링크로 들어와
     서명하는 길이라 꼭 필요하다(sign.html). 그래서 끄지 않고 «어디까지»를 못 박는다.
     새 자리가 늘면 사람이 봐야 하므로 여기서 걸린다. */
  const 허락 = ['/ieum_public', '/esign/cases/$caseId/meta'];
  const 익명가능 = 모두.filter(function (x) {
    if (x.k === '.validate') return false;
    const v = x.v;
    if (!/auth\s*!=\s*null/.test(v)) return false;
    if (/sign_in_provider|passkey/.test(v)) return false;        /* 비번을 요구하면 익명은 못 온다 */
    if (/auth\.token\.email/.test(v)) return false;              /* 이메일을 요구해도 익명은 못 온다 */
    if (/\$uid|auth\.uid\s*===?|child\('isAdmin'\)|child\('sid'\)/.test(v)) return false;
    return true;
  }).map(function (x) { return x.p; });
  const 뜻밖 = 익명가능.filter(function (p) { return 허락.indexOf(p) < 0; });
  assert.deepEqual(뜻밖, [],
    '익명(계정 없이)으로 열리는 자리가 늘었습니다 — 뜻한 것인지 사람이 봐야 합니다');
});

/* ══ 통째 열린 자리 ══ */

test('로그인도 없이 열리는 자리는 «판번호» 하나뿐이다', function () {
  /* 검사고정-허용: appBuild 는 «새 판이 나왔나»를 로그인 전에 보는 칸이다. */
  const 통째 = 모두.filter(function (x) { return x.k === '.read' && x.v === 'true'; }).map(function (x) { return x.p; });
  assert.deepEqual(통째, ['/appBuild'],
    '로그인 없이 읽히는 자리가 늘었습니다');
});

test('만들개가 깨진 JSON 을 내지 않는다', function () {
  assert.ok(rules && typeof rules === 'object', '규칙이 객체가 아닙니다');
  assert.ok(Object.keys(rules).length > 20, '규칙 칸이 너무 적습니다 — 통째로 사라진 것 아닙니까');
});
