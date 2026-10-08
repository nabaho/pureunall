'use strict';
// 사진 한 장 속 서류 여러 장 찾기 · node --test tests/pu-photo-split.test.js
//
// 대표 지시 2026-10-08 「두장이 아니라 여러장이 될 수 있다」 — 서류마다 네모 하나.
// 이 검사가 지키는 것
//   ①★ 책상 위에 흩어 찍은 서류는 장마다 네모 하나
//   ②★ 흰 바탕에 나란히 놓인 서류는 하얀 틈에서 가른다(실제 제보 사진의 모양)
//   ③★★ 서류 «한 장»은 가르지 않는다 — 문단 사이 빈 줄에서 반 토막 내면 안 된다
//   ④   얼룩·도장 같은 작은 것은 서류로 안 센다 · 한 번에 12장까지
//   ⑤   칸 나누기·자를 자리 계산·읽는 차례

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require(path.join(__dirname, '..', 'js', 'pu-photo-split.js'));
const S = globalThis.PuPhotoSplit;

/* ── 가짜 사진 만들기 (밝기 0~255) ── */
function canvas(w, h, bg) { const L = new Uint8Array(w * h); L.fill(bg); return { L, w, h }; }
function fill(c, x0, y0, x1, y1, v) {
  for (let y = Math.max(0, y0); y < Math.min(c.h, y1); y++)
    for (let x = Math.max(0, x0); x < Math.min(c.w, x1); x++) c.L[y * c.w + x] = v;
}
/* 종이 한 장 — 하얀 바탕에 글줄 (줄 간격 6칸, 굵기 2칸) */
function paper(c, x0, y0, x1, y1, opt) {
  const o = opt || {};
  if (!o.noFill) fill(c, x0, y0, x1, y1, 240);
  const m = 3;
  for (let y = y0 + m; y + 2 <= y1 - m; y += 6) {
    if (o.skip && o.skip(y)) continue;
    fill(c, x0 + m, y, x1 - m, y + 2, 40);
  }
  if (o.border) {
    fill(c, x0, y0, x1, y0 + 1, 30); fill(c, x0, y1 - 1, x1, y1, 30);
    fill(c, x0, y0, x0 + 1, y1, 30); fill(c, x1 - 1, y0, x1, y1, 30);
  }
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;
function covers(box, x0, y0, x1, y1, c, tol) {
  const t = tol == null ? 0.04 : tol;
  return near(box.x, x0 / c.w, t) && near(box.y, y0 / c.h, t) &&
    near(box.x + box.w, x1 / c.w, t) && near(box.y + box.h, y1 / c.h, t);
}

test('★ 책상 위에 흩어 찍은 서류 세 장 → 네모 셋', () => {
  const c = canvas(240, 160, 90);
  paper(c, 10, 10, 80, 150);
  paper(c, 95, 12, 160, 90);
  paper(c, 175, 20, 230, 60);
  const r = S.findBoxesInLuma(c.L, c.w, c.h);
  assert.equal(r.how, 'paper');
  assert.equal(r.boxes.length, 3, JSON.stringify(r.boxes));
  assert.ok(covers(r.boxes[0], 10, 10, 80, 150, c), '첫 장 자리가 틀렸습니다');
  assert.ok(r.boxes.some(b => covers(b, 95, 12, 160, 90, c)));
  assert.ok(r.boxes.some(b => covers(b, 175, 20, 230, 60, c)));
});

test('★ 표 테두리가 있는 서류도 칸마다 쪼개지지 않고 한 장이다', () => {
  const c = canvas(240, 160, 90);
  paper(c, 10, 10, 110, 150, { border: true });
  fill(c, 10, 60, 110, 61, 30);            // 표 가로줄
  fill(c, 60, 10, 61, 150, 30);            // 표 세로줄
  paper(c, 130, 20, 230, 140);
  const r = S.findBoxesInLuma(c.L, c.w, c.h);
  assert.equal(r.boxes.length, 2, '표 칸이 저마다 서류로 잡혔습니다: ' + JSON.stringify(r.boxes));
});

test('★ 흰 바탕에 나란히 놓인 신청서·등록증 → 하얀 틈에서 둘로 (제보 사진의 모양)', () => {
  const c = canvas(240, 160, 245);
  paper(c, 12, 12, 112, 148, { noFill: true, border: true });
  paper(c, 132, 18, 228, 140, { noFill: true, skip: y => y > 60 && y < 75 });
  const r = S.findBoxesInLuma(c.L, c.w, c.h);
  assert.equal(r.how, 'gap');
  assert.equal(r.boxes.length, 2, JSON.stringify(r.boxes));
  assert.ok(r.boxes[0].x + r.boxes[0].w < 125 / 240, '왼쪽 서류가 오른쪽까지 넘어갔습니다');
  assert.ok(r.boxes[1].x > 118 / 240, '오른쪽 서류가 왼쪽까지 넘어갔습니다');
});

test('★ 흰 바탕에 위·아래로 놓인 두 장도 가른다', () => {
  const c = canvas(160, 240, 245);
  paper(c, 15, 10, 145, 100, { noFill: true });
  paper(c, 15, 140, 145, 230, { noFill: true });
  const r = S.findBoxesInLuma(c.L, c.w, c.h);
  assert.equal(r.boxes.length, 2, JSON.stringify(r.boxes));
  assert.ok(r.boxes[0].y < r.boxes[1].y, '위의 것이 먼저여야 합니다');
});

test('★★ 서류 한 장은 문단 사이 빈 줄에서 가르지 않는다', () => {
  const c = canvas(180, 240, 245);
  /* 문단 셋 — 사이가 보통 줄 간격의 두 배쯤 */
  paper(c, 15, 15, 165, 225, { noFill: true, skip: y => (y > 70 && y < 82) || (y > 150 && y < 162) });
  const r = S.findBoxesInLuma(c.L, c.w, c.h);
  assert.equal(r.boxes.length, 0, '한 장을 반 토막 냈습니다: ' + JSON.stringify(r.boxes));
  assert.equal(r.how, 'none');
});

test('★★ 서명란처럼 넓게 빈 자리(높이의 10%)가 있어도 한 장이다', () => {
  const c = canvas(180, 240, 245);
  paper(c, 15, 15, 165, 225, { noFill: true, skip: y => y > 130 && y < 156 });
  const r = S.findBoxesInLuma(c.L, c.w, c.h);
  assert.equal(r.boxes.length, 0, '서명란 자리에서 반 토막 냈습니다: ' + JSON.stringify(r.boxes));
});

test('★ 가는 왼쪽 제목 칸은 따로 떼지 않는다', () => {
  const c = canvas(240, 160, 245);
  paper(c, 10, 10, 22, 150, { noFill: true });     // 세로로 긴 제목 칸(폭 5%)
  paper(c, 30, 10, 230, 150, { noFill: true });
  const r = S.findBoxesInLuma(c.L, c.w, c.h);
  assert.equal(r.boxes.length, 0, '제목 칸이 서류 한 장으로 잡혔습니다: ' + JSON.stringify(r.boxes));
});

test('얼룩·도장 같은 작은 것은 서류로 안 센다', () => {
  const c = canvas(240, 160, 90);
  paper(c, 10, 10, 110, 150);
  paper(c, 130, 10, 230, 150);
  fill(c, 115, 70, 119, 74, 250);                   // 작은 하얀 점
  const r = S.findBoxesInLuma(c.L, c.w, c.h);
  assert.equal(r.boxes.length, 2);
});

test('한 번에 12장까지만', () => {
  const c = canvas(400, 300, 80);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) paper(c, 10 + i * 98, 10 + j * 72, 90 + i * 98, 70 + j * 72);
  const r = S.findBoxesInLuma(c.L, c.w, c.h);
  assert.equal(r.boxes.length, S.MAX_BOXES);
});

test('사진 전체를 덮는 종이 한 장(바탕 없음)은 «못 찾음» — 억지로 안 가른다', () => {
  const c = canvas(200, 200, 240);
  paper(c, 0, 0, 200, 200, { noFill: true });
  const r = S.findBoxesInLuma(c.L, c.w, c.h);
  assert.equal(r.boxes.length, 0);
});

test('RGBA 그림을 받아도 같은 답', () => {
  const c = canvas(240, 160, 90);
  paper(c, 10, 10, 80, 150); paper(c, 120, 10, 220, 150);
  const rgba = new Uint8ClampedArray(c.w * c.h * 4);
  for (let i = 0; i < c.L.length; i++) { rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = c.L[i]; rgba[i * 4 + 3] = 255; }
  const a = S.findBoxes({ data: rgba, width: c.w, height: c.h });
  const b = S.findBoxesInLuma(c.L, c.w, c.h);
  assert.equal(a.boxes.length, b.boxes.length);
  assert.equal(a.boxes.length, 2);
});

test('칸 나누기 — 세로 2 · 2×2 · 한도', () => {
  const two = S.gridBoxes(2, 1);
  assert.equal(two.length, 2);
  assert.equal(two[0].x, 0); assert.equal(two[1].x, 0.5); assert.equal(two[0].w, 0.5); assert.equal(two[0].h, 1);
  const four = S.gridBoxes(2, 2);
  assert.equal(four.length, 4);
  assert.deepEqual(four.map(b => [b.x, b.y]), [[0, 0], [0.5, 0], [0, 0.5], [0.5, 0.5]]);
  assert.ok(S.gridBoxes(6, 6).length <= S.MAX_BOXES);
});

test('자를 자리는 정수이고 사진 밖으로 안 나간다', () => {
  const r = S.pixelRect({ x: 0.9, y: -0.1, w: 0.5, h: 0.3 }, 1000, 800);
  assert.ok(Number.isInteger(r.sx) && Number.isInteger(r.sw));
  assert.ok(r.sx + r.sw <= 1000 && r.sy >= 0 && r.sy + r.sh <= 800);
  assert.ok(r.sw >= 1 && r.sh >= 1);
  const z = S.pixelRect({ x: 0.5, y: 0.5, w: 0, h: 0 }, 10, 10);
  assert.ok(z.sw >= 1 && z.sh >= 1, '크기 0 이면 캔버스가 터집니다');
});

test('읽는 차례 — 같은 줄은 왼쪽부터, 조금 기울어도 안 뒤집힌다', () => {
  const s = S.sortBoxes([
    { x: 0.6, y: 0.10, w: 0.3, h: 0.2 },
    { x: 0.1, y: 0.13, w: 0.3, h: 0.2 },
    { x: 0.1, y: 0.60, w: 0.3, h: 0.2 }
  ]);
  assert.deepEqual(s.map(b => b.x + ',' + b.y), ['0.1,0.13', '0.6,0.1', '0.1,0.6']);
});

test('너무 작은 네모는 버린다 · 0~1 안으로 가둔다', () => {
  assert.equal(S.clampBox({ x: 0.5, y: 0.5, w: 0.01, h: 0.5 }), null);
  const b = S.clampBox({ x: -0.1, y: 0.2, w: 0.5, h: 2 });
  assert.equal(b.x, 0); assert.ok(b.y + b.h <= 1);
});
