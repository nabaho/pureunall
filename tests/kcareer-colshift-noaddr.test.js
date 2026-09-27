'use strict';
/* 세로 라벨 밀림 — «열 번호가 없는» 서식 (대표 제보 2026-09-13)
   ─────────────────────────────────────────────────────────────
   「내 정보로 채우기가 아무리 해도 제대로 안 채워진다」

   ■ 무엇이었나 (실측으로 되풀이했다)
   기관 이력서는 표 맨 앞에 「학력사항」·「자격및면허」·「경력사항」을 «세로로 합친»
   이름 칸으로 둔다. 그 칸은 머리줄에만 있고 자료 줄에는 없다 — 머리줄 6칸, 자료 줄 5칸.
   한글이 적어 주는 «열 번호(hp:cellAddr)»가 있으면 그것으로 맞춰 잘 채워진다.
   그런데 열 번호가 없는 서식(다른 프로그램이 만든 것, 편집기를 거쳐 다시 내보낸 것)에서는
     · 열 이름을 «칸 순서»로 세어 한 칸씩 밀리고
     · 그래서 「고등학교」가 적힌 줄에서 급을 못 찾아 학력 줄을 통째로 건너뛰고
     · 빗장도 없어서 그 아래 «자격 및 면허» 빈 줄에 학력이 박혔다
   대표 화면이 정확히 그 모양이었다 — 학력 줄은 비고, 자격·상벌 칸에
   「1996~1999 / 천안고등학교 / 인문계」가 들어가 있었다.

   여기서 못 박는 것은 «값»이 아니라 «규칙»이다:
     ① 세로 라벨만큼 밀어서 맞춘다 — 열 번호가 없어도 제 칸에 들어간다
     ② 칸 수가 달라지면 그 구역은 끝난 것으로 본다 — 남의 표에 박지 않는다
     ③ 열 번호가 있으면 그쪽이 이긴다 — 더 정확하다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const X = require('../js/kcareer-hwpxfill.js');

const t = (x) => (x ? '<hp:t>' + x + '</hp:t>' : '<hp:t/>');
const 칸 = (x, col, row, rs) =>
  '<hp:tc>'
  + (col == null ? '' : '<hp:cellAddr colAddr="' + col + '" rowAddr="' + row + '"/>')
  + '<hp:cellSpan colSpan="1" rowSpan="' + (rs || 1) + '"/>'
  + '<hp:subList><hp:p><hp:run>' + t(x) + '</hp:run></hp:p></hp:subList></hp:tc>';

/* 대표 서식 2쪽의 짜임 — 학력·자격·어학·경력이 «한 표»에 이어져 있고
   맨 앞에 세로로 합친 이름 칸이 있다. 열번호 없이 짓고 싶으면 addr:false. */
function 서식(addr) {
  const 줄들 = [
    [['학력사항', 0, 5], ['기 간', 1], ['학 교 명', 2], ['전   공', 3], ['소재지', 4], ['학 위', 5]],
    [['년  월 ~  년  월', 1], ['고등학교', 2], ['-', 3], ['', 4], ['-', 5]],
    [['년  월 ~  년  월', 1], ['대학교', 2], ['', 3], ['', 4], ['', 5]],
    [['년  월 ~  년  월', 1], ['대학원', 2], ['', 3], ['', 4], ['', 5]],
    [['자격및면허', 0, 3], ['종   류', 1], ['취득년월일', 2], ['상벌사항', 3], ['상벌기관', 4]],
    [['', 1], ['', 2], ['', 3], ['', 4]],
    [['', 1], ['', 2], ['', 3], ['', 4]],
    [['경력사항', 0, 3], ['근무기간', 1], ['근 무 처', 2], ['근무부서', 3], ['직 위', 4], ['담당업무', 5]],
    [['', 1], ['', 2], ['', 3], ['', 4], ['', 5]]
  ];
  return '<hp:tbl>' + 줄들.map((cs, ri) => '<hp:tr>'
    + cs.map((c) => 칸(c[0], addr ? c[1] : null, ri, c[2])).join('') + '</hp:tr>').join('') + '</hp:tbl>';
}

const 자료 = {
  fields: {},
  edu: [
    { period: '1996 ~ 1999', school: '천안고등학교', major: '인문계', degree: '졸업' },
    { period: '1999 ~ 2003', school: '영남대학교', major: '법과대학 법학부', degree: '학사' }
  ],
  career: [{ period: '2010 ~ 현재', org: '푸른노무법인', title: '대표', role: '노무자문' }]
};

/* 채운 결과를 «줄 × 칸» 글자판으로 */
function 판(xml) {
  const out = [];
  X.eachTable(xml, (T) => {
    X.splitRows(T).forEach((row) => out.push(X.splitCells(row).map((c) => X.cellText(c) || '')));
    return T;
  });
  return out;
}

['열 번호 있음', '열 번호 없음'].forEach((이름, i) => {
  const addr = (i === 0);

  test('★ [' + 이름 + '] 학력이 «학력 줄»에 들어간다 — 밀리면 급을 못 찾아 통째로 건너뛴다', () => {
    const g = 판(X.autoFill(서식(addr), 자료).xml);
    /* 1·2줄이 학력 자리(고등학교·대학교) */
    assert.ok(g[1].join('|').indexOf('천안고등학교') >= 0,
      '고등학교 줄에 안 들어갔습니다: ' + JSON.stringify(g[1]));
    assert.ok(g[2].join('|').indexOf('영남대학교') >= 0,
      '대학교 줄에 안 들어갔습니다: ' + JSON.stringify(g[2]));
  });

  test('★ [' + 이름 + '] 기간은 «기간 칸»에, 학교는 «학교 칸»에 — 한 칸 밀리면 안 된다', () => {
    const g = 판(X.autoFill(서식(addr), 자료).xml);
    /* 자료 줄은 세로 라벨이 없으므로 0번이 기간, 1번이 학교명이다 */
    assert.equal(g[1][0], '1996 ~ 1999', '기간 칸이 아닙니다: ' + JSON.stringify(g[1]));
    assert.equal(g[1][1], '천안고등학교', '학교명 칸이 아닙니다: ' + JSON.stringify(g[1]));
  });

  test('★ [' + 이름 + '] 자격·상벌 표에는 «한 글자도» 안 들어간다 — 잘못 낸 서류가 된다', () => {
    const g = 판(X.autoFill(서식(addr), 자료).xml);
    const 자격아래 = g[5].concat(g[6]).join(' ');
    ['천안고등학교', '영남대학교', '인문계', '법과대학', '1996', '1999', '2003']
      .forEach((말) => assert.equal(자격아래.indexOf(말), -1,
        '자격·상벌 표에 「' + 말 + '」이 박혔습니다: ' + JSON.stringify([g[5], g[6]])));
  });

  test('[' + 이름 + '] 경력도 제 칸에 들어간다', () => {
    const g = 판(X.autoFill(서식(addr), 자료).xml);
    assert.equal(g[8][0], '2010 ~ 현재', '근무기간 칸이 아닙니다: ' + JSON.stringify(g[8]));
    assert.equal(g[8][1], '푸른노무법인', '근무처 칸이 아닙니다: ' + JSON.stringify(g[8]));
  });
});

test('★ 밀림은 «딱 맞을 때만» — 어림짐작으로 밀면 멀쩡한 서식이 어긋난다', () => {
  /* 머리줄 앞에 열쇠 없는 칸이 하나인데 자료 줄이 두 칸 짧으면 밀지 않는다 */
  const head = { kind: 'edu', map: ['', 'period', 'school', 'major'], lead: 1, byCol: null };
  const 두칸 = ['<hp:tc></hp:tc>', '<hp:tc></hp:tc>'];
  const 세칸 = ['<hp:tc></hp:tc>', '<hp:tc></hp:tc>', '<hp:tc></hp:tc>'];
  assert.equal(X.shiftOf(head, 세칸), 1, '한 칸 짧으면 밀어야 합니다');
  assert.equal(X.shiftOf(head, 두칸), 0, '두 칸 짧은데 밀었습니다 — 어긋납니다');
  assert.equal(X.shiftOf(Object.assign({}, head, { byCol: { 1: 'period' } }), 세칸), 0,
    '열 번호가 있으면 밀지 않습니다 — 그쪽이 더 정확합니다');
});

test('★ 칸 수가 달라지면 구역이 끝난다 — 열 번호가 없을 때의 «유일한» 빗장이다', () => {
  assert.equal(X.rowShape(['<hp:tc></hp:tc>', '<hp:tc></hp:tc>']), 'n2');
  assert.notEqual(X.rowShape(['<hp:tc></hp:tc>', '<hp:tc></hp:tc>']),
                  X.rowShape(['<hp:tc></hp:tc>']),
                  '칸 수가 달라도 같은 모양이라 보면 남의 표까지 채웁니다');
});
