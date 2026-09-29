'use strict';
/* 📏 한글 서식 칸 맞춤 — 채운 글자가 칸보다 길면 장평·크기를 줄여 한 줄에 (대표 지시 2026-09-29)
   ─────────────────────────────────────────────────────────────
   대표 지시: 「글자크기등은 자동으로 조절되어서 칸안에 들어갈 수 있게 해달라」
   실측: 근무기간 「2011.05 ~ 2014.02」의 「02」가 아랫줄로 꺾여 옆 칸과 겹쳤다.

   여기서 못 박는 것은 «줄이는 것»보다 «안 줄이는 것»이다:
     ① 이번에 안 바꾼 칸(줄 정보가 남은 칸)은 안 건드린다 — 서식 원래 글자다
     ② 문단이 여럿인 칸은 안 건드린다 — 여러 줄이 뜻이다
     ③ 한참 긴 글은 안 줄인다 — 깨알 글씨보다 줄바꿈이 낫다
     ④ 원래 글자 모양은 고치지 않고 «새 모양»을 덧붙인다 — 다른 칸도 그 모양을 쓴다
     ⑤ 장평·크기는 정한 아래 한도 밑으로 내려가지 않는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const F = require(path.join(__dirname, '..', 'js', 'kcareer-hwpxfit.js'));

const HEADER = '<hh:head><hh:refList>'
  + '<hh:charProperties itemCnt="1">'
  + '<hh:charPr id="0" height="1000" textColor="#000000"><hh:fontRef hangul="0" latin="0"/>'
  + '<hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>'
  + '<hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>'
  + '<hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/></hh:charPr>'
  + '</hh:charProperties>'
  + '<hh:paraProperties itemCnt="1"><hh:paraPr id="0"><hh:margin><hc:intent value="0"/><hc:left value="0"/><hc:right value="0"/></hh:margin></hh:paraPr></hh:paraProperties>'
  + '</hh:refList></hh:head>';

const LINES = '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="5000" flags="393216"/></hp:linesegarray>';
function para(text, withLines) {
  return '<hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
    + '<hp:run charPrIDRef="0"><hp:t>' + text + '</hp:t></hp:run>' + (withLines ? LINES : '') + '</hp:p>';
}
/* 칸 폭 width(HWPUNIT). 10pt 한글 한 글자 ≈ 1000 */
function cell(inner, width) {
  return '<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="3">'
    + '<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER">' + inner + '</hp:subList>'
    + '<hp:cellAddr colAddr="0" rowAddr="0"/><hp:cellSpan colSpan="1" rowSpan="1"/>'
    + '<hp:cellSz width="' + width + '" height="1500"/><hp:cellMargin left="510" right="510" top="141" bottom="141"/></hp:tc>';
}
function section(...cells) {
  return '<hs:sec><hp:p id="0" paraPrIDRef="0" styleIDRef="0"><hp:run charPrIDRef="0">'
    + '<hp:tbl id="0" rowCnt="1" colCnt="' + cells.length + '"><hp:inMargin left="510" right="510" top="141" bottom="141"/>'
    + '<hp:tr>' + cells.join('') + '</hp:tr></hp:tbl></hp:run></hp:p></hs:sec>';
}
const charPrs = h => (h.match(/<hh:charPr\b[^>]*>/g) || []);
const refOf = s => (/<hp:tc[\s\S]*?charPrIDRef="([^"]+)"/.exec(s) || [])[1];

test('넘치는 채운 칸은 새 글자 모양으로 바뀌고, 한 줄에 드는 폭이 된다', () => {
  /* 9글자 한글 + 여백 1020 → 폭 8000 이면 넘친다 */
  const r = F.fit(section(cell(para('권형하노무사사무소'), 8000)), HEADER);
  assert.ok(r.changed);
  assert.equal(charPrs(r.header).length, charPrs(HEADER).length + 1, '글자 모양 하나가 덧붙는다');
  const id = refOf(r.section);
  assert.notEqual(id, '0', '칸은 새 모양을 가리킨다');
  const cnt = /<hh:charProperties\b[^>]*itemCnt="(\d+)"/.exec(r.header)[1];
  assert.equal(+cnt, charPrs(r.header).length, '개수 표시가 실제와 맞아야 한글이 연다');
  const info = F._readHeader(r.header).chars[id].info;
  const avail = 8000 - 1020;
  assert.ok(F._runWidth('권형하노무사사무소', info) <= avail, '줄인 뒤에는 칸 안에 든다');
});

test('원래 글자 모양(id 0)은 그대로다 — 다른 칸도 쓴다', () => {
  const r = F.fit(section(cell(para('권형하노무사사무소'), 8000)), HEADER);
  const orig = /<hh:charPr id="0"[\s\S]*?<\/hh:charPr>/.exec(r.header)[0];
  assert.equal(orig, /<hh:charPr id="0"[\s\S]*?<\/hh:charPr>/.exec(HEADER)[0]);
});

test('줄 정보가 남은 칸(이번에 안 바꾼 서식 글자)은 건드리지 않는다', () => {
  const s = section(cell(para('권형하노무사사무소', true), 8000));
  const r = F.fit(s, HEADER);
  assert.equal(r.changed, false);
  assert.equal(r.section, s);
});

test('문단이 둘 이상인 칸은 건드리지 않는다', () => {
  const s = section(cell(para('권형하노무사사무소') + para('대표노무사'), 8000));
  assert.equal(F.fit(s, HEADER).changed, false);
});

test('한참 긴 글은 줄이지 않는다 — 줄을 바꿔 읽히게 둔다', () => {
  const long = '연구원 인사·노무, 노사 관계 전반에 대한 자문을 성실히 수행하겠습니다';
  const s = section(cell(para(long), 8000));
  assert.equal(F.fit(s, HEADER).changed, false);
});

test('칸 안에 드는 글자는 그대로다', () => {
  const s = section(cell(para('대표'), 8000));
  assert.equal(F.fit(s, HEADER).changed, false);
});

test('장평·크기는 아래 한도 밑으로 내려가지 않는다', () => {
  const r = F.fit(section(cell(para('권형하노무사사무소대표'), 8000)), HEADER);
  assert.ok(r.changed);
  const block = /<hh:charPr id="1"[\s\S]*?<\/hh:charPr>/.exec(r.header)[0];
  const ratio = +/<hh:ratio\b[^>]*hangul="(\d+)"/.exec(block)[1];
  const height = +/height="(\d+)"/.exec(block)[1];
  assert.ok(ratio >= 80 && ratio < 100, '장평은 줄되 한도 안');
  assert.ok(height >= 550 && height <= 1000, '크기는 줄되 한도 안');
  r.fitted.forEach(f => { assert.ok(f.ratio >= 85 && f.size >= 60); });
});

test('같은 줄임이면 글자 모양을 한 번만 덧붙인다', () => {
  const c = cell(para('권형하노무사사무소'), 8000);
  const r = F.fit(section(c, c), HEADER);
  assert.equal(charPrs(r.header).length, charPrs(HEADER).length + 1);
  assert.equal(r.fitted.length, 2);
});

test('글자 모양을 못 읽으면 아무것도 안 한다', () => {
  const s = section(cell(para('권형하노무사사무소'), 8000));
  assert.equal(F.fit(s, '<hh:head></hh:head>').changed, false);
  const bad = section(cell(para('권형하노무사사무소').replace('charPrIDRef="0"', 'charPrIDRef="99"'), 8000));
  assert.equal(F.fit(bad, HEADER).changed, false);
});

test('앱은 줄 배치를 다시 잡기 «전»에 칸 맞춤을 돌린다', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
  assert.match(html, /<script src="js\/kcareer-hwpxfit\.js\?v=\d+"><\/script>/);
  const fn = /async function rhFinalizeHwpx\(bytes\)\{[\s\S]*?\n\}/.exec(html);
  assert.ok(fn, 'rhFinalizeHwpx 가 있어야 한다');
  const fitAt = fn[0].indexOf('rhFitCellsHwpx(');
  const reflowAt = fn[0].indexOf('reflowLinesegs');
  assert.ok(fitAt > 0 && reflowAt > fitAt, '맞춤이 줄 배치보다 먼저다');
});
