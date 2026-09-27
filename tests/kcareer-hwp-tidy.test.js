'use strict';
/* 🧹 한글 서식 정리 — 쪽 빼기 · 남은 안내 글자 · 표 끝 빈 줄 (대표 지시 2026-09-13)
   ─────────────────────────────────────────────────────────────
   대표 지시: 「불필요한 페이지는 삭제하고 싶다」 「박스 정리 안 되는 것 어떻게 해야 하나」

   지우는 일은 «되돌릴 수 없다». 그래서 여기서 못 박는 것은 「무엇을 지우나」보다
   **「무엇을 안 지우나」**다:
     ① 전부 빼려 하면 하나도 안 뺀다 — 빈 서류가 나가는 것보다 낫다
     ② 맨 앞 쪽을 빼면 그다음 쪽의 「쪽 나누기」를 뗀다 — 안 떼면 첫 장이 빈 쪽이 된다
     ③ 가운데 빈 줄은 안 지운다 — 서식이 일부러 비워 둔 자리일 수 있다
     ④ 머리줄만 남기지 않는다 — 표가 사라진 것처럼 보인다
     ⑤ 사람이 친 글자는 안 지운다 — 자리표이거나 «온통» 기울임일 때만 비운다
     ⑥ 기울임 여부를 못 읽으면 아무것도 안 지운다
     ⑦ 줄 수(rowCnt)를 실제와 맞춘다 — 안 맞추면 한글이 표를 못 그린다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const T = require(path.join(__dirname, '..', 'js', 'kcareer-hwpxtidy.js'));

/* ── 서식 흉내 ─────────────────────────────────────────────── */
function p(text, opt) {
  const brk = (opt && opt.brk) ? '1' : '0';
  const cp = (opt && opt.cp) || '0';
  return '<hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="' + brk + '" columnBreak="0">'
    + '<hp:run charPrIDRef="' + cp + '"><hp:t>' + text + '</hp:t></hp:run></hp:p>';
}
function tc(text, cp) {
  return '<hp:tc><hp:cellAddr colAddr="0" rowAddr="0"/><hp:subList>'
    + '<hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0">'
    + '<hp:run charPrIDRef="' + (cp || '0') + '"><hp:t>' + (text || '') + '</hp:t></hp:run>'
    + '</hp:p></hp:subList></hp:tc>';
}
/* 칸 하나에 조각이 둘 — 하나는 곧고 하나는 기울임 */
function tcMixed(a, b) {
  return '<hp:tc><hp:cellAddr colAddr="0" rowAddr="0"/><hp:subList>'
    + '<hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0">'
    + '<hp:run charPrIDRef="0"><hp:t>' + a + '</hp:t></hp:run>'
    + '<hp:run charPrIDRef="9"><hp:t>' + b + '</hp:t></hp:run>'
    + '</hp:p></hp:subList></hp:tc>';
}
function tr(cells) { return '<hp:tr>' + cells.join('') + '</hp:tr>'; }
function tbl(rows) {
  return '<hp:tbl id="0" rowCnt="' + rows.length + '" colCnt="3" borderFillIDRef="3">'
    + rows.join('') + '</hp:tbl>';
}
/* 표는 문단에 싸여 있다 — 진짜 hwpx 가 그렇다 */
function wrap(inner) {
  return '<hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0">'
    + '<hp:run charPrIDRef="0">' + inner + '</hp:run></hp:p>';
}
const HEADER = '<hh:charProperties>'
  + '<hh:charPr id="0" height="1000"><hh:bold/></hh:charPr>'
  + '<hh:charPr id="9" height="1000"><hh:italic/></hh:charPr>'
  + '<hh:charPr id="12" height="1000" italic="1"/>'
  + '</hh:charProperties>';

/* ── 쪽 묶음 ───────────────────────────────────────────────── */
const 넉쪽 = p('표지') + p('1. 인적사항') + p('2. 학력사항', { brk: true })
  + p('3. 경력사항') + p('수행계획서', { brk: true }) + p('내용')
  + p('붙임 서류', { brk: true });

test('① 「쪽 나누기」에서 갈린다 — 넷으로 나뉜다', () => {
  const ps = T.pages(넉쪽);
  assert.equal(ps.length, 4, '쪽 묶음 수가 다릅니다: ' + JSON.stringify(ps.map((x) => x.head)));
  assert.equal(ps[0].head, '표지');
  assert.equal(ps[1].head, '2. 학력사항');
  assert.equal(ps[2].head, '수행계획서');
  assert.equal(ps[3].head, '붙임 서류');
  assert.equal(ps[0].blocks, 2, '첫 묶음은 문단 두 개입니다');
});

test('② 쪽 나누기가 하나도 없으면 «한 묶음»이다 — 고장이 아니다', () => {
  const ps = T.pages(p('가') + p('나') + p('다'));
  assert.equal(ps.length, 1, '쪽 나누기가 없으면 통째로 하나입니다');
});

test('③ 고른 묶음만 빠지고 나머지는 «글자 하나까지» 그대로다', () => {
  const r = T.dropPages(넉쪽, [2]);
  assert.equal(r.dropped, 1);
  assert.equal(r.refused, false);
  assert.ok(r.xml.indexOf('수행계획서') < 0, '뺀 쪽이 남아 있습니다');
  assert.ok(r.xml.indexOf('내용') < 0, '뺀 쪽의 «뒷 문단»이 남아 있습니다');
  ['표지', '1. 인적사항', '2. 학력사항', '3. 경력사항', '붙임 서류']
    .forEach((s) => assert.ok(r.xml.indexOf(s) >= 0, s + ' 이(가) 사라졌습니다'));
  assert.equal(T.pages(r.xml).length, 3);
});

test('④ 여러 쪽을 한 번에 뺀다', () => {
  const r = T.dropPages(넉쪽, [1, 2]);
  assert.equal(r.dropped, 2);
  assert.equal(T.pages(r.xml).length, 2);
  assert.ok(r.xml.indexOf('2. 학력사항') < 0);
  assert.ok(r.xml.indexOf('붙임 서류') >= 0);
});

test('⑤★ 전부 빼려 하면 «하나도» 안 뺀다 — 빈 서류가 나가면 안 된다', () => {
  const r = T.dropPages(넉쪽, [0, 1, 2, 3]);
  assert.equal(r.dropped, 0, '전부 뺐습니다');
  assert.equal(r.refused, true, '막았다고 말해야 화면이 까닭을 보여 줍니다');
  assert.equal(r.xml, 넉쪽, '한 글자도 안 바뀌어야 합니다');
});

test('⑥★ 맨 앞 쪽을 빼면 그다음 쪽의 「쪽 나누기」를 뗀다 — 안 떼면 첫 장이 빈 쪽이 된다', () => {
  const r = T.dropPages(넉쪽, [0]);
  assert.equal(r.dropped, 1);
  const blocks = require(path.join(__dirname, '..', 'js', 'kcareer-hwpxfill.js'))
    .tagBlocks(r.xml, 'hp:p');
  assert.ok(/pageBreak="0"/.test(T._openTag(blocks[0].text)),
    '새로 맨 앞이 된 문단에 쪽 나누기가 남아 있습니다: ' + T._openTag(blocks[0].text));
  assert.ok(r.xml.indexOf('2. 학력사항') >= 0, '내용까지 지우면 안 됩니다');
});

test('⑦★ 표 «안»의 쪽 나누기는 쪽을 가르지 않는다 — 칸 안 문단도 그 속성을 가진다', () => {
  /* ⚠ 진짜 서식이 이렇다. 표 한 칸 안의 문단에 pageBreak="1" 이 붙어 있으면,
     여는 태그만 보지 않고 덩이 전체를 뒤지는 순간 표 하나가 «두 쪽»으로 갈린다. */
  const 속에쪽나누기 = '<hp:tc><hp:cellAddr colAddr="0" rowAddr="0"/><hp:subList>'
    + '<hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="1" columnBreak="0">'
    + '<hp:run charPrIDRef="0"><hp:t>가나</hp:t></hp:run></hp:p></hp:subList></hp:tc>';
  const 서식 = p('표지') + wrap(tbl([tr([속에쪽나누기, tc('나다')])])) + p('맺음');
  const ps = T.pages(서식);
  assert.equal(ps.length, 1, '표 안의 쪽 나누기가 쪽을 갈랐습니다: '
    + JSON.stringify(ps.map((x) => x.head)));
});

test('⑧ 없는 쪽 번호를 줘도 아무 일 없다', () => {
  const r = T.dropPages(넉쪽, [99, -1]);
  assert.equal(r.dropped, 0);
  assert.equal(r.xml, 넉쪽);
});

/* ── 기울임(예시) 글자 ─────────────────────────────────────── */
test('⑧ 기울임 글자모양 번호를 모은다 — 두 가지 적는 꼴을 모두 본다', () => {
  const ids = T.italicIds(HEADER);
  assert.equal(ids['9'], true, '<hh:italic/> 꼴을 못 읽습니다');
  assert.equal(ids['12'], true, 'italic="1" 꼴을 못 읽습니다');
  assert.ok(!ids['0'], '굵은 글자를 기울임으로 봤습니다');
});

test('⑨ header 를 못 읽으면 «빈 목록» — 그러면 기울임 지우기가 아무것도 안 한다', () => {
  assert.deepEqual(T.italicIds(''), {});
  assert.deepEqual(T.italicIds(null), {});
});

/* ── 남은 안내 글자 지우기 ─────────────────────────────────── */
const 안내표 = wrap(tbl([
  tr([tc('기 간'), tc('경 력 사 항'), tc('비 고')]),
  tr([tc('2020.01 ~ 현재'), tc('가나상사 노무고문'), tc('대표')]),
  tr([tc('1900.00.00'), tc('·(필수) 자격 취득일', '9'), tc('직위, 연수 등', '9')]),
  tr([tc(''), tc(''), tc('')])
]));

test('⑩ 자리표는 지운다 — 「1900.00.00」이 서류에 나가면 안 된다', () => {
  const r = T.clearHints(안내표, {});
  assert.ok(r.cleared >= 1, '아무것도 안 지웠습니다');
  assert.ok(r.xml.indexOf('1900.00.00') < 0, '자리표가 남아 있습니다');
  assert.ok(r.xml.indexOf('가나상사 노무고문') >= 0, '사람이 친 값을 지웠습니다');
  assert.ok(r.xml.indexOf('기 간') >= 0, '머리칸을 지웠습니다');
});

test('⑪ 기울임 예시는 «고를 때만» 지운다 — 기본으로는 안 건드린다', () => {
  const 그냥 = T.clearHints(안내표, {});
  assert.ok(그냥.xml.indexOf('직위, 연수 등') >= 0,
    '고르지 않았는데 예시 글자를 지웠습니다');
  const 기울임 = T.clearHints(안내표, { italic: T.italicIds(HEADER) });
  assert.ok(기울임.xml.indexOf('직위, 연수 등') < 0, '예시 글자가 남아 있습니다');
  assert.ok(기울임.xml.indexOf('·(필수) 자격 취득일') < 0, '예시 글자가 남아 있습니다');
  assert.ok(기울임.xml.indexOf('가나상사 노무고문') >= 0, '사람이 친 값을 지웠습니다');
});

test('⑫★ 「온통」 기울임일 때만 — 섞여 있으면 손대지 않는다', () => {
  const 섞임 = wrap(tbl([
    tr([tc('성 명'), tc('비 고')]),
    tr([tcMixed('홍길동', ' (예시)'), tc('가나')])
  ]));
  const r = T.clearHints(섞임, { italic: T.italicIds(HEADER) });
  assert.ok(r.xml.indexOf('홍길동') >= 0,
    '곧은 글자가 섞인 칸을 비웠습니다 — 사람이 친 값이 날아갑니다');
});

test('⑬ 지운 뒤에도 표가 성하다 — 칸·줄 수가 그대로다', () => {
  const X = require(path.join(__dirname, '..', 'js', 'kcareer-hwpxfill.js'));
  const 전 = X.splitRows(안내표).length;
  const r = T.clearHints(안내표, { italic: T.italicIds(HEADER) });
  assert.equal(X.splitRows(r.xml).length, 전, '줄 수가 바뀌었습니다');
  X.splitRows(r.xml).forEach((row, i) => {
    assert.equal(X.splitCells(row).length, 3, (i + 1) + '번째 줄의 칸 수가 바뀌었습니다');
  });
});

/* ── 표 끝의 빈 줄 ─────────────────────────────────────────── */
test('⑭ 표 «끝»의 빈 줄만 지운다', () => {
  const X = require(path.join(__dirname, '..', 'js', 'kcareer-hwpxfill.js'));
  const 표 = wrap(tbl([
    tr([tc('기 간'), tc('경 력'), tc('비 고')]),
    tr([tc('2020.01'), tc('가나상사'), tc('대표')]),
    tr([tc(''), tc(''), tc('')]),
    tr([tc(''), tc(''), tc('')]),
    tr([tc(''), tc(''), tc('')])
  ]));
  const r = T.dropEmptyRows(표);
  assert.equal(r.dropped, 3, '끝의 빈 줄 셋을 지워야 합니다');
  assert.equal(X.splitRows(r.xml).length, 2);
  assert.ok(r.xml.indexOf('가나상사') >= 0, '자료 줄을 지웠습니다');
});

test('⑮★ 자리표만 든 끝 줄도 «빈 줄»이다 — 진짜 서식은 칸을 비워 두지 않는다', () => {
  /* ⚠ 기관 서식의 남는 줄에는 「____」·「1900.00.00」 같은 자리표가 박혀 있다.
     그것을 «값»으로 보면 끝의 빈 줄이 한 줄도 안 지워진다 — 이 기능이 통째로 헛돈다. */
  const X = require(path.join(__dirname, '..', 'js', 'kcareer-hwpxfill.js'));
  const 표 = wrap(tbl([
    tr([tc('기 간'), tc('경 력'), tc('비 고')]),
    tr([tc('2020.01'), tc('가나상사'), tc('대표')]),
    tr([tc('1900.00.00'), tc('____'), tc('')]),
    tr([tc('1900.00.00'), tc('____'), tc('')])
  ]));
  const r = T.dropEmptyRows(표);
  assert.equal(r.dropped, 2, '자리표가 든 끝 줄을 «값»으로 봤습니다');
  assert.equal(X.splitRows(r.xml).length, 2);
  assert.ok(r.xml.indexOf('가나상사') >= 0, '자료 줄을 지웠습니다');
});

test('⑯★ 가운데 빈 줄은 안 지운다 — 서식이 일부러 비워 둔 자리일 수 있다', () => {
  const X = require(path.join(__dirname, '..', 'js', 'kcareer-hwpxfill.js'));
  const 표 = wrap(tbl([
    tr([tc('기 간'), tc('경 력'), tc('비 고')]),
    tr([tc('2020.01'), tc('가나상사'), tc('대표')]),
    tr([tc(''), tc(''), tc('')]),
    tr([tc('2018.01'), tc('가나도'), tc('위원')])
  ]));
  const r = T.dropEmptyRows(표);
  assert.equal(r.dropped, 0, '가운데 빈 줄을 지웠습니다');
  assert.equal(X.splitRows(r.xml).length, 4);
});

test('⑯★ 머리줄만 남기지 않는다 — 표가 사라진 것처럼 보인다', () => {
  const X = require(path.join(__dirname, '..', 'js', 'kcareer-hwpxfill.js'));
  const 표 = wrap(tbl([
    tr([tc('기 간'), tc('경 력'), tc('비 고')]),
    tr([tc(''), tc(''), tc('')]),
    tr([tc(''), tc(''), tc('')]),
    tr([tc(''), tc(''), tc('')])
  ]));
  const r = T.dropEmptyRows(표);
  assert.ok(X.splitRows(r.xml).length >= 2, '머리줄만 남았습니다');
  assert.equal(r.dropped, 2, '한 줄은 남기고 둘만 지워야 합니다');
});

test('⑰★ 줄 수(rowCnt)를 실제와 맞춘다 — 안 맞추면 한글이 표를 못 그린다', () => {
  const 표 = wrap(tbl([
    tr([tc('기 간'), tc('경 력'), tc('비 고')]),
    tr([tc('2020.01'), tc('가나상사'), tc('대표')]),
    tr([tc(''), tc(''), tc('')]),
    tr([tc(''), tc(''), tc('')])
  ]));
  const r = T.dropEmptyRows(표);
  const m = /rowCnt="(\d+)"/.exec(r.xml);
  assert.ok(m, 'rowCnt 가 사라졌습니다');
  assert.equal(m[1], '2', 'rowCnt 가 실제 줄 수와 다릅니다');
});

test('⑱ 지울 것이 없으면 «한 글자도» 안 바꾼다', () => {
  const 표 = wrap(tbl([
    tr([tc('기 간'), tc('경 력'), tc('비 고')]),
    tr([tc('2020.01'), tc('가나상사'), tc('대표')])
  ]));
  assert.equal(T.dropEmptyRows(표).xml, 표);
  assert.equal(T.dropEmptyRows(표).dropped, 0);
  assert.equal(T.clearHints(표, { italic: T.italicIds(HEADER) }).xml, 표);
});

test('⑲ 표가 하나도 없는 서식에서도 터지지 않는다', () => {
  const 글만 = p('가나다') + p('라마바');
  assert.equal(T.clearHints(글만, {}).xml, 글만);
  assert.equal(T.dropEmptyRows(글만).xml, 글만);
  assert.deepEqual(T.pages('').length, 0);
});
