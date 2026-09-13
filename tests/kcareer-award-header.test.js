'use strict';
/* 자격·상벌·어학 머리줄을 사전이 «한 낱말도» 몰랐다 (대표 제보 2026-09-13)
   ─────────────────────────────────────────────────────────────
   「내정보채우기에 상벌 기간 등 제대로 정리가 안되어 있다」

   ■ 실측
     종 류      → 열쇠 없음  (사전엔 「자격종류」만 있고 「종류」가 없었다)
     취득년월일  → 열쇠 없음  (사전엔 「취득«연»월일」만 — 년/연 한 글자 차이)
     상벌사항·상벌기관·성적(등급) → 열쇠 없음

   ■ 왜 큰일인가
   머리줄에서 열 이름이 «둘 이상» 잡혀야 isBoundary 가 「여기부터 남의 자리」로 본다.
   하나도 못 잡으니 자격·상벌 표가 머리줄로 안 보였고, 위쪽 학력 목록이 그 아래
   빈 줄까지 흘러 들어가 채웠다 — 대표 화면의 그 모양이다.

   여기서 못 박는 것은 «값»이 아니라 «규칙»이다:
     ① 이력서에 흔한 그 머리줄들을 머리줄로 «알아본다»
     ② 칸 수가 같아도 학력이 그 아래로 «안 샌다» (모양 빗장이 없어도 막힌다)
     ③ 그 열쇠들로는 «채우지 않는다» — 잘못 낸 서류는 되돌릴 수 없다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const X = require('../js/kcareer-hwpxfill.js');

const t = (x) => (x ? '<hp:t>' + x + '</hp:t>' : '<hp:t/>');
const 칸 = (x) => '<hp:tc><hp:subList><hp:p><hp:run>' + t(x) + '</hp:run></hp:p></hp:subList></hp:tc>';
const 줄 = (cs) => '<hp:tr>' + cs.map(칸).join('') + '</hp:tr>';
const 표 = (rs) => '<hp:tbl>' + rs.map(줄).join('') + '</hp:tbl>';

test('★ 이력서에 흔한 머리줄 낱말을 사전이 안다 — 모르면 머리줄로 안 보인다', () => {
  const 봐 = {
    '종   류': 'certName', '자격증명': 'certName',
    '취득년월일': 'gotAt', '취득연월일': 'gotAt',
    '상벌사항': 'awardWhat', '상벌기관': 'awardOrg',
    '성적(등급)': 'grade'
  };
  Object.keys(봐).forEach((말) => {
    assert.equal(X.colKeyOf(말), 봐[말], '「' + 말 + '」을 못 알아봅니다');
  });
});

test('★ 「취득년월일」과 「취득연월일」을 «둘 다» 안다 — 한 글자 차이로 못 알아봤다', () => {
  assert.equal(X.colKeyOf('취득년월일'), X.colKeyOf('취득연월일'),
    '년/연 한 글자가 다르다고 다른 칸으로 봅니다');
});

test('★ 자격·상벌 머리줄이 «남의 자리 시작»으로 잡힌다 — 이것이 첫 단추다', () => {
  const 자격머리 = X.splitCells(X.splitRows(표([['종   류', '취득년월일', '상벌사항', '상벌기관', '']]))[0]);
  assert.equal(X.isBoundary(자격머리), true,
    '자격·상벌 머리줄을 못 알아보면 위쪽 학력이 그 아래로 흘러 들어갑니다');
  const 어학머리 = X.splitCells(X.splitRows(표([['자격증명', '성적(등급)', '', '', '']]))[0]);
  assert.equal(X.isBoundary(어학머리), true, '어학 머리줄도 경계여야 합니다');
});

test('★★ 칸 수가 «같아도» 학력이 자격 표로 안 샌다 — 모양 빗장이 없어도 막힌다', () => {
  /* ⚠ 일부러 «칸 수를 똑같이» 만든다. 그래야 모양 빗장이 아니라
     «머리줄을 알아보는 힘»만으로 막히는지 볼 수 있다. */
  const xml = 표([
    ['기 간', '학 교 명', '전   공', '소재지', '학 위'],
    ['년  월 ~  년  월', '고등학교', '', '', ''],
    ['년  월 ~  년  월', '대학교', '', '', ''],
    ['종   류', '취득년월일', '상벌사항', '상벌기관', ''],
    ['', '', '', '', ''],
    ['', '', '', '', '']
  ]);
  const r = X.autoFill(xml, {
    fields: {},
    edu: [{ period: '1996 ~ 1999', school: '가나고등학교', major: '인문계', degree: '졸업' },
      { period: '1999 ~ 2003', school: '가나대학교', major: '법학', degree: '학사' },
      { period: '2003 ~ 2005', school: '가나대학원', major: '노동법', degree: '석사' }]
  });
  const 판 = [];
  X.eachTable(r.xml, (T) => {
    X.splitRows(T).forEach((row) => 판.push(X.splitCells(row).map((c) => X.cellText(c) || '')));
    return T;
  });
  const 자격아래 = 판[4].concat(판[5]).join(' ');
  ['가나대학원', '노동법', '석사', '2003', '2005'].forEach((말) => {
    assert.equal(자격아래.indexOf(말), -1,
      '자격·상벌 표에 「' + 말 + '」이 박혔습니다: ' + JSON.stringify([판[4], 판[5]]));
  });
  /* 학력 자리에는 제대로 들어가야 한다 — 지나치게 막아 아무것도 안 넣으면 안 된다 */
  assert.ok(판[1].join('|').indexOf('가나고등학교') >= 0, '고등학교 줄이 비었습니다');
  assert.ok(판[2].join('|').indexOf('가나대학교') >= 0, '대학교 줄이 비었습니다');
});

test('★ 그 열쇠들로는 «채우지 않는다» — 잘못 낸 서류는 되돌릴 수 없다', () => {
  ['certName', 'gotAt', 'awardWhat', 'awardOrg', 'grade'].forEach((k) => {
    assert.equal(X.LIST_FILL_KEYS.indexOf(k), -1,
      k + ' 로 값을 써 넣게 되었습니다 — 넣을지는 사람이 정할 일입니다');
  });
});

test('사전에 넣은 낱말이 «낱개 칸»을 흔들지 않는다 — 자격 라벨과 겹치면 안 된다', () => {
  /* 「자격」 낱개 칸(license)은 그대로 알아봐야 한다 */
  assert.equal(X.fieldKeyOf('자격'), 'license');
  assert.equal(X.fieldKeyOf('자격사항'), 'license');
  /* 목록 머리줄 쪽에서만 certName 이다 */
  assert.equal(X.colKeyOf('자격사항'), 'certName');
});
