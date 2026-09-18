'use strict';
/* 자격 및 면허 · 상벌 표도 채운다 (대표 결정 2026-09-13 「채워라」)
   ─────────────────────────────────────────────────────────────
   대표 제보: 「내정보채우기에 상벌 기간 등 제대로 정리가 안되어 있다」
   자격증·표창 자료는 이미 담고 있는데 이력서의 그 칸은 «늘 빈 채로» 나갔다.

   ■ 짜임의 특징
   한 머리줄에 «두 목록»이 들어간다 — 왼쪽 절반(종류·취득년월일)은 자격,
   오른쪽 절반(상벌사항·상벌기관)은 상벌이다. 그래서 두 목록을 줄 번호로 짝지어
   한 벌(certaward)로 만들어 보낸다.

   ■ 만들다 찾은 것 (이 검사가 지킨다)
   줄을 «글자로 찾아» 바꾸고 있었다. 빈 줄끼리는 XML 이 글자 하나까지 같아서,
   경력을 「9번째 줄」에 넣으라고 했는데 «자격 표 첫 줄»에 박혔다(실측).
   칸에 대해서는 2026-09-06 에 고쳤는데(replaceCellAt) 줄에는 그대로 남아 있었다.

   여기서 못 박는 것은 «값»이 아니라 «규칙»이다:
     ① 자격은 자격 칸에, 상벌은 상벌 칸에
     ② 짝이 없으면 «빈다» — 지어내지 않는다
     ③ 어학은 그대로 둔다 — 담는 자료가 없다
     ④ 남의 표(학력·경력)가 흔들리지 않는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const X = require('../js/kcareer-hwpxfill.js');

const t = (x) => (x ? '<hp:t>' + x + '</hp:t>' : '<hp:t/>');
const 칸 = (x) => '<hp:tc><hp:subList><hp:p><hp:run>' + t(x) + '</hp:run></hp:p></hp:subList></hp:tc>';
const 줄 = (cs) => '<hp:tr>' + cs.map(칸).join('') + '</hp:tr>';
const 표 = (rs) => '<hp:tbl>' + rs.map(줄).join('') + '</hp:tbl>';

/* ⚠ 머리줄에 «빈 칸»을 두지 않는다 — 「머리줄이 아니다」라는 빗장에 걸린다.
   실제 서식도 머리줄은 이름이 죽 적혀 있다. */
const 이력서 = () => 표([
  ['기 간', '학 교 명', '전   공', '소재지', '학 위'],
  ['년  월 ~  년  월', '고등학교', '', '', ''],
  ['년  월 ~  년  월', '대학교', '', '', ''],
  ['종   류', '취득년월일', '상벌사항', '상벌기관'],
  ['', '', '', ''],
  ['', '', '', ''],
  ['자격증명', '성적(등급)', '비 고'],
  ['', '', ''],
  ['근무기간', '근 무 처', '근무부서', '직 위', '담당업무'],
  ['', '', '', '', '']
]);

const 자료 = () => ({
  fields: {},
  edu: [{ period: '1996 ~ 1999', school: '가나고등학교', major: '인문계', degree: '졸업' },
    { period: '1999 ~ 2003', school: '가나대학교', major: '법학', degree: '학사' }],
  certaward: [
    { certName: '공인노무사', gotAt: '2003.11.20', awardWhat: '장관 표창', awardOrg: '고용노동부' },
    { certName: '직업상담사 2급', gotAt: '2016.06.15' }
  ],
  career: [{ period: '2010 ~ 현재', org: '가나노무법인', title: '대표', role: '노무자문' }]
});

function 판(xml) {
  const out = [];
  X.eachTable(xml, (T) => {
    X.splitRows(T).forEach((row) => out.push(X.splitCells(row).map((c) => X.cellText(c) || '')));
    return T;
  });
  return out;
}

test('★ 자격은 «자격 칸»에, 상벌은 «상벌 칸»에 들어간다', () => {
  const g = 판(X.autoFill(이력서(), 자료()).xml);
  assert.equal(g[4][0], '공인노무사', '종류 칸이 아닙니다: ' + JSON.stringify(g[4]));
  assert.equal(g[4][1], '2003.11.20', '취득년월일 칸이 아닙니다: ' + JSON.stringify(g[4]));
  assert.equal(g[4][2], '장관 표창', '상벌사항 칸이 아닙니다: ' + JSON.stringify(g[4]));
  assert.equal(g[4][3], '고용노동부', '상벌기관 칸이 아닙니다: ' + JSON.stringify(g[4]));
  assert.equal(g[5][0], '직업상담사 2급', '자격 둘째 줄이 비었습니다');
});

test('★ 짝이 없으면 «빈다» — 지어내지 않는다', () => {
  /* 자격은 둘, 상벌은 하나. 둘째 줄의 상벌 칸은 비어야 한다. */
  const g = 판(X.autoFill(이력서(), 자료()).xml);
  assert.equal(g[5][2], '', '상벌이 없는데 뭔가 들어갔습니다: ' + JSON.stringify(g[5]));
  assert.equal(g[5][3], '', '상벌기관이 없는데 뭔가 들어갔습니다: ' + JSON.stringify(g[5]));
});

test('★ 어학 표는 그대로 둔다 — 담는 자료가 없다', () => {
  const g = 판(X.autoFill(이력서(), 자료()).xml);
  assert.ok(g[7].every((c) => !c), '어학 줄에 뭔가 들어갔습니다: ' + JSON.stringify(g[7]));
});

test('★★ 어학 표가 «자격 표와 똑 닮았어도» 안 채운다 — 가르는 자는 「성적」 하나다', () => {
  /* ⚠ 어학 표는 「자격증명 | 취득년월일 | 성적(등급)」처럼 자격 표와 거의 같게 생겼다.
     성적(등급) 칸이 있으면 어학이다 — 그것만으로 가른다.
     담는 자료가 없으므로 채우면 빈 값이 자리만 차지한다. */
  const xml = 표([
    ['자격증명', '취득년월일', '성적(등급)'],
    ['', '', ''],
    ['', '', '']
  ]);
  const g = 판(X.autoFill(xml, 자료()).xml);
  assert.ok(g[1].every((c) => !c),
    '어학 표에 자격증이 박혔습니다: ' + JSON.stringify(g[1]));
  assert.ok(g[2].every((c) => !c), '어학 표 둘째 줄에도 박혔습니다: ' + JSON.stringify(g[2]));
});

test('★★ 남의 표가 흔들리지 않는다 — 줄을 «글자»가 아니라 «자리»로 센다', () => {
  /* ⚠ 실측 2026-09-13: 빈 줄끼리 XML 이 똑같아, 경력을 넣으라고 한 줄 대신
     «자격 표 첫 줄»이 바뀌었다. 줄도 자리로 세야 한다. */
  const g = 판(X.autoFill(이력서(), 자료()).xml);
  assert.equal(g[9][0], '2010 ~ 현재', '경력이 제 줄에 안 갔습니다: ' + JSON.stringify(g[9]));
  assert.equal(g[9][1], '가나노무법인', '경력 근무처가 제자리가 아닙니다');
  assert.equal(g[1][1], '가나고등학교', '학력 첫 줄이 흔들렸습니다');
  assert.equal(g[2][1], '가나대학교', '학력 둘째 줄이 흔들렸습니다');
});

test('★ 상벌만 있는 표도 채운다 — 자격 칸이 없다고 못 본 척하면 안 된다', () => {
  /* 상벌을 «따로» 두는 서식이 있다(자격 표와 갈라진 것). 그때도 채워야 한다. */
  const xml = 표([
    ['상벌사항', '상벌기관', '비 고'],
    ['', '', ''],
    ['', '', '']
  ]);
  const g = 판(X.autoFill(xml, 자료()).xml);
  assert.equal(g[1][0], '장관 표창', '상벌만 있는 표를 못 채웁니다: ' + JSON.stringify(g[1]));
  assert.equal(g[1][1], '고용노동부', '상벌기관이 안 들어갔습니다: ' + JSON.stringify(g[1]));
});

test('★ 줄을 «자리»로 바꾸는 자가 하나뿐이다 — 두 곳이면 다시 어긋난다', () => {
  const { stripComments, stripJs } = require('./strip-comments');
  const src = stripJs(require('node:fs')
    .readFileSync(require('node:path').join(__dirname, '..', 'js', 'kcareer-hwpxfill.js'), 'utf8'));
  assert.match(src, /function replaceRowAt\(/, '줄을 자리로 바꾸는 자가 없습니다');
  /* 줄(tr)을 글자로 찾아 바꾸는 곳이 남아 있으면 안 된다 */
  assert.doesNotMatch(src, /replaceOnce\(newTbl,\s*(?:tr|rows\[)/,
    '줄을 «글자로 찾아» 바꾸는 곳이 남아 있습니다 — 같은 모양 줄이 있으면 맨 앞 것이 바뀝니다');
});

test('한 머리줄에 자격과 상벌이 «함께» 와도 한 갈래로 본다 — 줄을 나눠 쓰면 어긋난다', () => {
  const r = X.autoFill(이력서(), 자료());
  const 갈래 = (r.report.lists || []).map((l) => l.kind);
  assert.ok(갈래.indexOf('certaward') >= 0, '자격·상벌을 채웠다고 보고하지 않습니다: ' + JSON.stringify(갈래));
  assert.equal(갈래.filter((k) => k === 'certaward').length, 1,
    '한 표를 두 번 채웠습니다 — 같은 줄에 두 번 쓰면 값이 겹칩니다');
});
