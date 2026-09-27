'use strict';
/* 🚧 AI 짝짓기 울타리 — 목록 표가 아닌 것을 목록으로 만들지 않는다 (대표 지시 2026-09-20)
   ─────────────────────────────────────────────────────────────
   대표 물음: 「인적사항 등을 넣으려는데 계속 제대로 못 읽거나 오류나거나 문제가 계속 발생한다.
   근본적으로 해결하고 싶다」

   ■ 무엇이 문제였나 — 대표 계정 실측
     경력관리는 사전이 못 알아본 표를 AI 에게 물어 그 답을 «서식 지문에 기억»한다.
     대표 계정에 21개가 쌓였는데, 그 가운데 여섯이 «목록 표가 아닌 것»을 목록으로 만들었다:
       현근무처 | 기관명:부서명:직위:        → 인적사항 줄이 «경력 목록»
       A|B|C|D|E|점수                      → 평가기준표가 «경력 목록»
       자격및면허|종류|취득년월일|상벌|…       → 자격·상벌 표가 «경력 목록»
     그래서 이름이 겹쳐 쌓이고(「푸른노무법인푸른노무법인푸른노무법인」이 기억에 그대로 남아 있었다)
     학력·경력이 엉뚱한 표에 박혔다.

   ■ 뚫린 자리
     「머리행에는 빈 칸이 없다」 빗장이 if(!hit) 안에 있어 colMap 이 맞으면 통째로 건너뛰었다.

   여기서 못 박는 것은 «값»이 아니라 «규칙»이다:
     ①★ AI 짝짓기도 사전과 «같은» 빗장을 지난다
     ②★ 칸 안 라벨이 든 줄(「기관명:부서명:직위:」)은 머리행이 아니다
     ③★ 한 글자 이름이 절반을 넘으면(A|B|C|D|E) 머리행이 아니다
     ④★ 사전이 «이미 알아보는» 머리행에는 AI 답을 쓰지 않는다 — AI 는 모를 때만 거든다
     ⑤★ 사전이 못 알아보는 진짜 목록 표는 «그대로» AI 가 거든다 (이 울타리가 그걸 막으면 안 된다)
     ⑥★ 울타리는 «쓸 때» 걸린다 — 이미 쌓인 기억을 지우지 않아도 해가 멈춘다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const X = require(path.join(__dirname, '..', 'js', 'kcareer-hwpxfill.js'));

function p(t) {
  return '<hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0">'
    + '<hp:run charPrIDRef="0"><hp:t>' + (t || '') + '</hp:t></hp:run></hp:p>';
}
function tc(t, col) {
  return '<hp:tc><hp:cellAddr colAddr="' + col + '" rowAddr="0"/><hp:subList>' + p(t) + '</hp:subList></hp:tc>';
}
function tr(cells) { return '<hp:tr>' + cells.map((t, i) => tc(t, i)).join('') + '</hp:tr>'; }
function tbl(rows) {
  return '<hp:p><hp:run><hp:tbl id="0" rowCnt="' + rows.length + '" colCnt="' + rows[0].length
    + '" borderFillIDRef="3">' + rows.map(tr).join('') + '</hp:tbl></hp:run></hp:p>';
}
const 경력 = [{ period: '2020.01~현재', org: '가나상사', dept: '노무팀', title: '대표', role: '노무고문' }];
const 학력 = [{ period: '1999~2003', school: '가나대학교', major: '사법전공', degree: '법학사' }];
const 자료 = { fields: {}, edu: 학력, career: 경력, work: 경력 };

function 채워보기(rows, colMap) {
  const r = X.autoFill(tbl(rows), 자료, colMap ? { colMap: colMap } : undefined);
  return { xml: r.xml, lists: r.report.lists || [] };
}

/* ── 대표 계정에 실제로 쌓여 있던 나쁜 기억들 ────────────────── */

test('①★ 「기관명:부서명:직위:」 — 인적사항 줄을 경력 목록으로 보지 않는다', () => {
  /* 실제로 쌓여 있던 것: 현근무처|기관명:부서명:직위:  →  org, role */
  const rows = [['현 근무처', '기관명:  부서명:  직위:'], ['', '']];
  const r = 채워보기(rows, { '현근무처|기관명:부서명:직위:': ['org', 'role'] });
  assert.deepEqual(r.lists, [], '인적사항 줄이 목록 표로 잡혔습니다');
  assert.ok(r.xml.indexOf('가나상사') < 0, '경력이 인적사항 줄에 박혔습니다');
});

test('②★ 「A|B|C|D|E|점수」 — 평가기준표를 경력 목록으로 보지 않는다', () => {
  const rows = [['A', 'B', 'C', 'D', 'E', '점수'], ['', '', '', '', '', '']];
  const r = 채워보기(rows, { 'A|B|C|D|E|점수': ['period', 'org', 'dept', 'title', 'role', 'none'] });
  assert.deepEqual(r.lists, [], '평가기준표가 목록 표로 잡혔습니다');
  assert.ok(r.xml.indexOf('가나상사') < 0, '경력이 평가기준표에 박혔습니다');
});

test('③★ 사전이 «이미 아는» 머리행에는 AI 답을 쓰지 않는다', () => {
  /* 사전은 이 줄을 학력으로 안다. AI 가 경력이라고 해도 사전을 믿어야 한다. */
  const rows = [['기 간', '학 교 명', '전 공', '학 위'], ['', '', '', '']];
  const 엉뚱한AI = { '기간|학교명|전공|학위': ['period', 'org', 'role', 'none'] };
  const r = 채워보기(rows, 엉뚱한AI);
  assert.equal(r.lists.length, 1, '목록 표를 못 알아봤습니다');
  assert.equal(r.lists[0].kind, 'edu', 'AI 답이 사전을 이겼습니다: ' + r.lists[0].kind);
  assert.ok(r.xml.indexOf('가나대학교') >= 0, '학력이 안 들어갔습니다');
});

test('④★ 머리행에 빈 칸이 있으면 — AI 답이 있어도 목록이 아니다', () => {
  const rows = [['소속기관', '', '직위', ''], ['', '', '', '']];
  const r = 채워보기(rows, { '소속기관||직위|': ['org', 'none', 'title', 'none'] });
  assert.deepEqual(r.lists, [], '빈 칸이 든 줄이 목록 표로 잡혔습니다');
});

/* ── 울타리가 «막으면 안 되는» 것 ──────────────────────────── */

test('⑤★ 사전이 못 알아보는 진짜 목록 표는 그대로 AI 가 거든다', () => {
  /* 「복무기간|수행단체|맡은일」은 사전에 없는 말이다 — AI 가 있어야 하는 바로 그 경우다.
     울타리가 이것을 막으면 AI 를 부르는 뜻이 없어진다. */
  const rows = [['복무기간', '수행단체', '맡은일'], ['', '', '']];
  const 그냥 = 채워보기(rows);
  assert.deepEqual(그냥.lists, [], '사전이 이 말을 알면 이 검사는 뜻이 없습니다 — 다른 말로 바꾸세요');
  const r = 채워보기(rows, { '복무기간|수행단체|맡은일': ['period', 'org', 'role'] });
  assert.equal(r.lists.length, 1, 'AI 가 거들지 못했습니다 — 울타리가 너무 셉니다');
  assert.equal(r.lists[0].kind, 'career');
  assert.ok(r.xml.indexOf('가나상사') >= 0, '경력이 안 들어갔습니다');
});

test('⑤-2★ 사전이 «딱 하나만» 아는 머리행에서도 AI 가 거든다', () => {
  /* ⚠ 「사전이 안다」의 문턱은 «둘»이다 — 사전이 목록 표로 인정하는 문턱(hit<2)과 같아야 한다.
     하나만 맞아도 「안다」고 보면, 사전이 「기간」 하나만 아는 표에서 AI 가 막히고
     그 표는 아무도 못 채운다(사전은 hit=1 이라 스스로도 포기한다). */
  const rows = [['기 간', '수행단체', '맡은일'], ['', '', '']];
  const 그냥 = 채워보기(rows);
  assert.deepEqual(그냥.lists, [], '사전만으로는 못 알아보는 표여야 합니다');
  const r = 채워보기(rows, { '기간|수행단체|맡은일': ['period', 'org', 'role'] });
  assert.equal(r.lists.length, 1, '사전이 한 칸만 아는데 AI 가 막혔습니다 — 그 표는 아무도 못 채웁니다');
  assert.ok(r.xml.indexOf('가나상사') >= 0, '경력이 안 들어갔습니다');
});

test('⑥ 사전만으로 알아보는 표는 지금까지와 똑같다', () => {
  const rows = [['근무기간', '근무처', '근무부서', '직위', '담당업무'], ['', '', '', '', '']];
  const r = 채워보기(rows);
  assert.equal(r.lists.length, 1);
  assert.equal(r.lists[0].kind, 'career');
  assert.ok(r.xml.indexOf('가나상사') >= 0);
});

test('⑦ 학력 두 건이 «두 줄»로, 고등학교가 먼저 — 네 줄로 불어나지 않는다', () => {
  /* 대표 화면에서 대학교가 네 줄 박히고 고등학교가 빠졌던 그 모양 */
  const rows = [['기 간', '학 교 명', '전 공', '학 위'],
    ['', '', '', ''], ['', '', '', ''], ['', '', '', ''], ['', '', '', '']];
  const 두건 = [
    { period: '1991.03~1994.02', school: '가나고등학교', major: '인문계', degree: '졸업' },
    { period: '1999~2003', school: '가나대학교', major: '사법전공', degree: '법학사' }
  ];
  const r = X.autoFill(tbl(rows), { fields: {}, edu: 두건, career: [], work: [] });
  const 줄 = X.splitRows(r.xml).map((row) => X.splitCells(row).map(X.cellText).join('|'));
  const 고 = 줄.filter((s) => s.indexOf('가나고등학교') >= 0).length;
  const 대 = 줄.filter((s) => s.indexOf('가나대학교') >= 0).length;
  assert.equal(고, 1, '고등학교가 ' + 고 + '줄입니다');
  assert.equal(대, 1, '대학교가 ' + 대 + '줄입니다 — 같은 학력이 여러 줄에 박혔습니다');
});

/* ── 울타리가 «어디에» 걸리는가 ─────────────────────────────── */

test('⑧★ 울타리는 «쓸 때» 걸린다 — 쌓인 기억을 지우지 않아도 해가 멈춘다', () => {
  /* 대표 결정 2026-09-20 「그대로 두고 울타리만 친다」.
     나쁜 기억을 그대로 건네도 결과가 깨끗해야 한다. */
  const 쌓인것 = {
    '현근무처|기관명:부서명:직위:': ['org', 'role'],
    '현근무처|기관명:푸른노무법인부서명:직위:대표': ['org', 'role'],
    'A|B|C|D|E|점수': ['period', 'org', 'dept', 'title', 'role', 'none'],
    '자격및면허|종류|취득년월일|상벌|상벌사항|상벌기관':
      ['none', 'role', 'period', 'none', 'none', 'org'],
    '연번|기업명|컨설팅진행일': ['none', 'org', 'period']
  };
  const rows = [['현 근무처', '기관명:  부서명:  직위:'], ['', '']];
  const r = 채워보기(rows, 쌓인것);
  assert.deepEqual(r.lists, [], '쌓인 기억이 그대로 해를 끼칩니다');
});

test('⑨ 「머리행답나」 잣대를 검사도 같은 자로 쓴다', () => {
  /* ⚠ 잣대를 두 벌로 만들면 「채울 때는 머리행인데 검사에서는 아닌」 줄이 생긴다 */
  assert.equal(typeof X.isHeaderish, 'function', '잣대를 내보내지 않습니다');
  const 칸 = (t) => tc(t, 0);
  assert.equal(X.isHeaderish([칸('기 간'), 칸('학 교 명')]), true);
  assert.equal(X.isHeaderish([칸('현 근무처'), 칸('기관명:  부서명:  직위:')]), false);
  assert.equal(X.isHeaderish([칸('A'), 칸('B'), 칸('C'), 칸('D'), 칸('E'), 칸('점수')]), false);
  assert.equal(X.isHeaderish([칸('소속기관'), 칸(''), 칸('직위'), 칸('')]), false);
  assert.equal(X.isHeaderish([]), false);
});
