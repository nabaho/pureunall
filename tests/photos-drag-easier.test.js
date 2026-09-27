'use strict';
/* ↗ 끌어내기를 더 쉽게 (대표 결정 2026-09-18 「끌어내기를 더 쉽게」)
   실행: node --test tests/photos-drag-easier.test.js
   목업 docs/mockups/photos-drag-easier.html

   ■ 무엇이 없었나
   대표: 「사진을 드레그해서 첨부화일로 바로 올리고 싶다. 다른 화면에 있는 다른 프로그램에」

   격자 사진은 2026-08-23 부터 밖으로 끌어낼 수 있었다. 그런데
   ① 끌 수 있다는 **표시가 아무 데도 없었고**
   ② 여러 장을 골라 끌면 **조용히 한 장만** 나갔고
   ③ 주소를 안 남긴 서류(계약서·근태표)는 「준비하는 중입니다」가 떴다.

   ■ ★★★ 못 박는 것
   ① 안내가 **기능을 막으면 안 된다** — 손잡이가 눌림을 먹으면 정작 끌기가 안 된다.
   ② 여러 장일 때 말은 하되 **막지는 않는다** — 한 장만 필요한 때가 훨씬 많다.
   ③ 미리 받기는 **고른 것이 적을 때만** — 고르기는 지우기·분류에도 쓴다.
      상한이 없으면 「전부 고르기」 한 번에 원본 수백 장을 내려받는다(요금).
   ④ 「메일 첨부 칸에는 바로 못 놓는다」를 **미리 말한다** — 웹에서 웹으로 끌 때
      브라우저가 파일을 안 넘기는 것은 우리가 못 고친다. 말해 주는 것이 전부다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cutFn } = require('./cut-fn.js');
const { stripComments, stripJs } = require('./strip-comments.js');

const R = path.join(__dirname, '..');
const PHOTOS = fs.readFileSync(path.join(R, 'pu-photos.html'), 'utf8');
const 몸통 = stripComments(PHOTOS);

/* ══════ ㉠ 끌 수 있다는 것이 보인다 ═════════════════════════════ */

test('★★★ 격자 사진에 «끌 수 있다»는 표시가 있다', () => {
  const i = 몸통.indexOf('const GRAB_TAG = ');
  assert.ok(i >= 0,
    '★★★ 표시가 없으면 끌 수 있는 줄 모릅니다 — 모르는 기능은 없는 기능입니다');
  /* ⚠ 「이름이 있나」로 못 박으면 이빨이 없다 — 되돌림에서 잡혔다(2026-09-18).
     GRAB_TAG 를 «빈 것»으로 바꿔도 이름은 그대로라 검사가 통과했다.
     못 박을 것은 «눈에 보이는 손잡이가 그려진다»는 것이다. */
  const 줄 = 몸통.slice(i, i + 240).split(';')[0];
  assert.match(줄, /class="grab"/,
    '★★★ 빈 딱지는 아무것도 안 알려 줍니다 — 꾸밈이 걸릴 칸이 있어야 합니다');
  assert.match(줄, /끌/, '★★★ 딱지에 «무엇을 할 수 있는지»가 적혀 있어야 합니다');
  assert.match(몸통, /#grid \.cell:hover \.grab/,
    '★★ 얹었을 때 떠야 합니다 — 늘 떠 있으면 사진을 가립니다');
});

test('★★★ 그 표시가 «끌기를 막지 않는다»', () => {
  const i = 몸통.indexOf('#grid .cell .grab{');
  assert.ok(i >= 0, '.grab 꾸밈이 없습니다');
  const 덩이 = 몸통.slice(i, i + 400);
  assert.match(덩이, /pointer-events:\s*none/,
    '★★★ 딱지가 눌림을 먹으면 정작 끌기가 시작되지 않습니다 — 안내가 기능을 막습니다');
});

test('★★★ 칸이 두 벌(사진·서류)인데 «둘 다» 갖는다', () => {
  /* 한 벌에만 달면 서류 카드에서는 영영 안 보인다 — 정작 끌 일이 많은 쪽이 서류다 */
  const 손잡이 = (몸통.match(/GRAB_TAG/g) || []).length;
  const 말 = (몸통.match(/DRAG_TIP/g) || []).length;
  assert.ok(손잡이 >= 3, '★★★ 손잡이가 한 벌에만 달렸습니다 (쓰인 곳 ' + 손잡이 + ')');
  assert.ok(말 >= 3, '★★★ 안내가 한 벌에만 달렸습니다 (쓰인 곳 ' + 말 + ')');
});

test('★★ 안내를 «한 곳에서만» 만든다 — 두 곳에 적으면 서로 다른 말을 한다', () => {
  assert.equal((몸통.match(/const GRAB_TAG = /g) || []).length, 1);
  assert.equal((몸통.match(/const DRAG_TIP = /g) || []).length, 1);
});

test('★★★ 「메일 첨부 칸에는 바로 못 놓는다」를 미리 말한다', () => {
  const i = 몸통.indexOf('const DRAG_TIP = ');
  const 덩이 = 몸통.slice(i, i + 300);
  assert.match(덩이, /첨부/,
    '★★★ 안 적으면 다음메일 첨부 칸에 놓아 보고 «아무 일도 안 일어나는 것»을 겪습니다');
  assert.match(덩이, /폴더/, '★★ 못 한다고만 하면 안 됩니다 — 되는 길을 알려 줘야 합니다');
});

/* ══════ ㉡ 여러 장을 끌면 말해 준다 ═════════════════════════════ */

test('★★★ 여러 장을 끌면 «한 장만 나간다»고 그 자리에서 말한다', () => {
  const fn = stripJs(cutFn(PHOTOS, 'function attachFileDragOut(') || '');
  assert.ok(fn, 'attachFileDragOut 이 없습니다');
  assert.match(fn, /ids\.length > 1/,
    '★★★ 25장을 골라 끌어도 조용히 한 장만 나갑니다 — 폴더를 열어 보고서야 압니다');
  assert.match(fn, /내려받기/,
    '★★ 못 한다고만 하면 안 됩니다 — 나머지를 받는 길을 함께 알려 줘야 합니다');
});

test('★★★ 말은 하되 «막지는 않는다» — 한 장은 그대로 나간다', () => {
  const fn = stripJs(cutFn(PHOTOS, 'function attachFileDragOut(') || '');
  const 말 = fn.indexOf('ids.length > 1');
  const 실음 = fn.indexOf("setData('DownloadURL'");
  assert.ok(말 >= 0 && 실음 >= 0, '두 자리를 못 찾았습니다');
  assert.ok(말 < 실음,
    '★★★ 알림 뒤에도 파일을 실어야 합니다 — 막으면 「한 장만 필요한」 흔한 일이 안 됩니다');
  assert.ok(!/ids\.length > 1[\s\S]{0,200}?return;/.test(fn),
    '★★★ 여러 장이라고 되돌아가면 끌기가 통째로 죽습니다');
});

/* ══════ ㉢ 고른 사진을 미리 받아 둔다 ═══════════════════════════ */

test('★★★ 미리 받기에 «상한»이 있다 — 없으면 요금이 GB 단위로 샌다', () => {
  const fn = stripJs(cutFn(PHOTOS, 'function warmSelected(') || '');
  assert.ok(fn, 'warmSelected 가 없습니다');
  assert.match(fn, /selected\.size > [A-Z_]+/,
    '★★★ 고르기는 지우기·분류에도 씁니다. 상한이 없으면 「전부 고르기」 한 번에 원본 수백 장을 내려받습니다');
  assert.match(fn, /return;/, '★★★ 상한을 넘으면 «아무것도 안 받고» 돌아가야 합니다');
});

test('★★ 마우스가 있는 기기에서만 — 손가락 기기에는 끌어다 놓기가 없다', () => {
  const fn = stripJs(cutFn(PHOTOS, 'function warmSelected(') || '');
  assert.match(fn, /pointer: fine/,
    '★★ 폰에서 미리 받으면 쓰지도 않을 원본을 받습니다 — 데이터만 축냅니다');
});

test('★★★ 고르기가 바뀌면 «한 곳»에서 채비한다', () => {
  const fn = stripJs(cutFn(PHOTOS, 'function renderGridBar(') || '');
  assert.match(fn, /warmSelected\(\)/,
    '★★★ 고르기가 바뀌는 자리가 예닐곱 군데입니다 — 자리마다 부르면 한 곳을 빠뜨립니다');
});

test('★★ 이미 주소가 있는 사진은 «안 받는다» — 그것은 공짜로 나간다', () => {
  const fn = stripJs(cutFn(PHOTOS, 'function warmDragOut(') || '');
  assert.match(fn, /fullUrl/,
    '★★ 주소가 있는 사진까지 받으면 미리 받기가 그대로 요금이 됩니다');
});
