'use strict';
/* 환경설정 — 병역·보훈·장애 칸 + 학력 바로 넣기 (대표 결정 2026-09-13)
   ─────────────────────────────────────────────────────────────
   ■ 2026-08-30 에 배운 것
   기본정보 칸을 여덟 → 열일곱으로 늘렸을 때, «서식이 그 칸을 알아보는 말»을 함께 넣지
   않으면 담아 두고도 영영 안 채워진다는 것을 알았다. 칸 하나에 «세 곳»이 짝이다:
     ① 담는 칸    PI_GROUPS        (환경설정 화면)
     ② 알아보는 말 FIELD_LABELS     (서식의 라벨 → 열쇠)
     ③ 내보내는 값 _cvFillData      (채우기에 건네는 값)
   하나라도 빠지면 조용히 안 채워진다 — 사람은 「넣었는데 왜 안 나오지」만 본다.

   ■ 학력은 «한 곳»에만 담는다
   환경설정에서 바로 넣게 하되, 자료는 학력 목록에만 남는다(대표 결정 「가)」).
   두 곳에 적으면 반드시 어긋난다 — 근무기간을 한 곳에서만 만드는 것과 같은 까닭이다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripComments } = require('./strip-comments');
const X = require('../js/kcareer-hwpxfill.js');

const R = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(R, 'kcareer.html'), 'utf8');
const CODE = stripComments(SRC);

function cutFn(s, decl) {
  const head = s.indexOf(decl);
  assert.notEqual(head, -1, decl + ' 을 찾지 못했습니다');
  let i = s.indexOf('{', head + decl.length), depth = 0;
  for (; i < s.length; i++) { if (s[i] === '{') depth++; else if (s[i] === '}') { depth--; if (!depth) break; } }
  return s.slice(head, i + 1);
}
const ctx = { String, Object, Array, Number, JSON };
vm.createContext(ctx);
vm.runInContext('var ' + cutFn(CODE, 'const PI_GROUPS=').replace(/^const /, '') + ';', ctx);
const PI = vm.runInContext('PI_GROUPS.reduce(function(a,g){return a.concat(g[2]);},[])', ctx);
const 열쇠들 = Array.prototype.map.call(PI, (f) => f[0]);
const 채움 = cutFn(CODE, 'function _cvFillData(');

/* ⚠ 일부러 안 채우는 칸 — 여기 더할 때는 «왜»를 함께 적을 것 */
const 안채움 = {
  rrn: '주민등록번호는 사람이 골라야 나간다(자동으로 나가면 안 된다)',
  addrHome: '집 주소는 addr 로 나간다(서식의 「주소」는 집이다)'
};

test('★★ 담는 칸마다 «알아보는 말»과 «내보내는 값»이 함께 있다 — 하나라도 빠지면 조용히 안 채워진다', () => {
  const 빠진것 = [];
  열쇠들.forEach((k) => {
    if (안채움[k]) return;
    if (X.FIELD_FILL_KEYS.indexOf(k) < 0) 빠진것.push(k + ' — 서식이 채울 수 있는 열쇠에 없다');
    else if (채움.indexOf(k + ':') < 0) 빠진것.push(k + ' — _cvFillData 가 값을 안 내보낸다');
  });
  assert.equal(빠진것.length, 0,
    '담아 두고도 영영 안 채워지는 칸이 있습니다:\n  - ' + 빠진것.join('\n  - '));
});

test('★ 병역·보훈·장애 칸이 «세 곳 모두»에 있다 (대표 결정 2026-09-13)', () => {
  ['military', 'militaryBranch', 'militaryRank', 'militaryPeriod', 'veteran', 'disability']
    .forEach((k) => {
      assert.ok(열쇠들.indexOf(k) >= 0, k + ' — 환경설정에 담는 칸이 없습니다');
      assert.ok(X.FIELD_FILL_KEYS.indexOf(k) >= 0, k + ' — 서식이 채울 수 있는 열쇠에 없습니다');
      assert.ok(채움.indexOf(k + ':') >= 0, k + ' — _cvFillData 가 값을 안 내보냅니다');
    });
});

test('★ 서식의 병역·보훈·장애 라벨을 알아본다 — 못 알아보면 담아 둬도 소용없다', () => {
  const 봐 = {
    '병역': 'military', '병역사항': 'military', '군필여부': 'military',
    '군별': 'militaryBranch', '계급': 'militaryRank', '복무기간': 'militaryPeriod',
    '보훈대상': 'veteran', '국가유공자': 'veteran',
    '장애여부': 'disability', '장애등급': 'disability'
  };
  Object.keys(봐).forEach((말) => {
    assert.equal(X.fieldKeyOf(말), 봐[말], '「' + 말 + '」을 못 알아봅니다');
  });
});

test('★ 「계급」이 «직위»로 잘못 잡히지 않는다 — 낱말이 겹치면 엉뚱한 값이 박힌다', () => {
  assert.equal(X.fieldKeyOf('계급'), 'militaryRank');
  /* 직위·직급은 그대로 title 이어야 한다 — 뒷걸음질하면 안 된다 */
  assert.equal(X.fieldKeyOf('직급'), 'title');
  assert.equal(X.fieldKeyOf('직위'), 'title');
});

test('★★ 학력은 «한 곳»에만 담는다 — 환경설정은 입구일 뿐이다', () => {
  const 그리기 = cutFn(CODE, 'function renderPiEdu(');
  assert.match(그리기, /get\('edu'\)/, '환경설정 학력 카드가 학력 목록을 안 봅니다');
  /* ⚠ 여기서 따로 담으면 자료가 두 곳이 되어 어긋난다 */
  assert.doesNotMatch(그리기, /\bset\(/, '환경설정 학력 카드가 «따로» 담고 있습니다');
  const 더하기 = cutFn(CODE, 'function piEduAdd(');
  assert.match(더하기, /openForm\('edu'\)/, '학력 넣는 창을 새로 만들었습니다 — 칸이 두 벌이 됩니다');
});

test('★★ 자격 표에는 «자격증만» 간다 — 수료증은 자격이 아니다', () => {
  /* ⚠ 목록 화면도 「수료·이수」로 자격증과 수료증을 가른다. 채우는 쪽이 다르게 가르면
     이력서의 자격 표에 수료증이 섞여 나간다 — 사실과 다른 서류가 된다.
     ⚠ 글자 찾기로는 못 잡는다(주석에도 「수료」가 있다). 실제로 돌려 본다. */
  const 가짜 = {
    cert: [{ title: '공인노무사', date: '2003-11-20' },
      { title: '중대재해처벌법 실무과정 수료증', date: '2023-07-14' },
      { title: '직업상담사 2급', date: '2016-06-15' }],
    /* ⚠ 위촉장은 «상벌이 아니다» — 같은 보관함(wiccok)에 함께 담기므로 걸러야 한다.
       안 거르면 이력서 상벌 칸에 위촉장이 줄줄이 나간다. */
    wiccok: [{ type: '표창', titleVal: '장관 표창', org: '고용노동부', issueDate: '2021-05-01' },
      { type: '위촉장', titleVal: '노동권익보호관', org: '가나도청', issueDate: '2025-01-01' }],
    edu: [], work: [], consult: [], case: [], lecture: [], profile_info: {}
  };
  const c2 = {
    String, Object, Array, Number, JSON, Math, Date,
    get: (k) => 가짜[k] || [],
    getProfileInfo: () => ({}),
    formatDate: (v) => String(v || '').replace(/-/g, '.'),
    isAwardType: (x) => /표창|포상/.test(String(x || '')),
    workPeriod: () => ''
  };
  vm.createContext(c2);
  vm.runInContext(cutFn(CODE, 'function _cvFillData('), c2);
  const d = vm.runInContext('_cvFillData()', c2);
  const 자격들 = Array.prototype.map.call(d.certaward, (r) => r.certName).filter(Boolean);
  assert.equal(자격들.indexOf('중대재해처벌법 실무과정 수료증'), -1,
    '자격 표에 수료증이 섞였습니다: ' + JSON.stringify(자격들));
  assert.equal(자격들.length, 2, '자격증 두 건이어야 합니다: ' + JSON.stringify(자격들));
  /* 최근 것부터 — 이력서는 최근 자격을 위에 적는다 */
  assert.equal(자격들[0], '직업상담사 2급', '취득일 최근 순이 아닙니다: ' + JSON.stringify(자격들));
  /* 상벌은 표창·포상만 — 위촉장이 섞이면 안 된다 */
  assert.equal(d.certaward[0].awardWhat, '장관 표창', '상벌이 안 들어갔습니다');
  const 상벌들 = Array.prototype.map.call(d.certaward, (r) => r.awardWhat).filter(Boolean);
  assert.equal(상벌들.indexOf('노동권익보호관'), -1,
    '상벌 칸에 위촉장이 섞였습니다: ' + JSON.stringify(상벌들));
  assert.equal(상벌들.length, 1, '표창 한 건이어야 합니다: ' + JSON.stringify(상벌들));
});

test('★ 학력을 고치면 환경설정 카드도 따라 바뀐다 — 「넣었는데 안 보인다」를 막는다', () => {
  assert.match(cutFn(CODE, 'function saveForm('), /page==='edu'[\s\S]{0,60}renderPiEdu/,
    '학력을 저장해도 환경설정 카드가 안 바뀝니다');
  assert.match(SRC, /id="piEduList"/, '환경설정에 학력 카드가 없습니다');
});
