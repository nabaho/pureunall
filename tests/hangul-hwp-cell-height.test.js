'use strict';
/* 한글 편집기 — 표 칸 높이가 «음수»인 .hwp 가 쪽 수를 터뜨리던 고장 (2026-11-08, 대표 «한글 위치나 글자 등이 이상하다»)
   ■ 무엇이었나
     HWP 표 칸의 높이 값은 «부호 있는» 32비트다. 한컴이 쓴 어떤 문서(바탕화면 표본 40개 중 1개, 157쪽짜리 서식)에는 -282 같은
     음수가 들어 있다. 편집기가 이것을 부호 없는 값(u32)으로 읽어 4,294,967,014 HWPUNIT = 15,151,689mm 짜리 칸이 되었고,
     표 한 개가 브라우저 한계(33,554,428px)까지 늘어나 쪽 수가 157 → 29,445 로 터지고 뒤의 글이 전부 화면 밖으로 밀렸다.
     → 음수는 «높이 지정 없음»(내용에 맞춤)으로 읽는다.
   ■ 이 검사
     buildHwp 로 칸 높이에 -282(=4294967014)·-1(=0xFFFFFFFF)을 넣은 표를 만들고 readHwp 로 읽어 높이가 0(없음)이 되는지 본다.
     정상 높이(5000 HWPUNIT ≈ 17.6mm)는 그대로여야 한다. 옛 코드로 되돌리면 천만 mm 가 되는 것도 «대조»로 확인한다.
   node --test tests/hangul-hwp-cell-height.test.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');
const R = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(R, 'hangul/js/hwp.js'), 'utf8');

function sandbox(hwpSrc) {
  const ctx = vm.createContext({ console, TextDecoder, TextEncoder, DecompressionStream, CompressionStream, Blob, Response, Uint8Array, Uint16Array, Uint32Array, DataView, setTimeout, performance, crypto: globalThis.crypto, atob, btoa, URL });
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  for (const f of ['zip', 'hwpx', 'shape']) vm.runInContext(fs.readFileSync(path.join(R, 'hangul/js', f + '.js'), 'utf8'), ctx, { filename: f });
  vm.runInContext(hwpSrc, ctx, { filename: 'hwp' });
  return ctx;
}
const HWPUNIT_MM = 7200 / 25.4;
const cell = (t, hh) => ({ colSpan: 1, rowSpan: 1, height: hh / HWPUNIT_MM, hh, margin: null, bg: null, borders: null, valign: 'middle', blocks: [{ type: 'p', align: 'left', runs: [{ text: t }] }] });
const place = { inline: true, affect: false, vertRelTo: 'PARA', vertAlign: 'TOP', horzRelTo: 'PARA', horzAlign: 'LEFT', flow: true, overlap: false, wrap: 'TOP_AND_BOTTOM', vertOffset: 0, horzOffset: 0, zOrder: 9, out: { l: 283, r: 283, t: 283, b: 283 }, pageBreak: 'CELL', repeatHeader: false, noAdjust: false, inMargin: { l: 510, r: 510, t: 141, b: 141 } };
async function roundTrip(ctx, hhs) {
  const H = ctx.PureunHwpx, K = ctx.PureunHwp;
  const table = { type: 'table', colWidths: [0.5, 0.5], place, rows: [[cell('가', hhs[0]), cell('나', hhs[1])], [cell('다', hhs[2]), cell('라', hhs[3])]], para: { align: 'left' }, widthRatio: 1 };
  const bytes = K.buildHwp({ page: H.defaultPage(), header: null, footer: null, pageNum: null, blocks: [table, { type: 'p', align: 'left', runs: [{ text: '끝' }] }] });
  const back = await K.readHwp(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));
  return back.blocks.find(b => b.rows).rows.map(r => r.map(c => ({ height: c.height, hh: c.hh })));
}

test('★★★ 칸 높이가 음수(-282 · -1)인 표는 «높이 없음»으로 읽는다 — 쪽 수가 터지지 않는다', async () => {
  const rows = await roundTrip(sandbox(SRC), [2 ** 32 - 282, 5000, 5000, 2 ** 32 - 1]);
  assert.deepStrictEqual(rows[0][0], { height: 0, hh: 0 }, '-282 가 천만 mm 짜리 칸이 됐습니다');
  assert.deepStrictEqual(rows[1][1], { height: 0, hh: 0 }, '-1 이 천만 mm 짜리 칸이 됐습니다');
  for (const r of rows) for (const c of r) assert.ok(c.height < 1000, '칸 높이가 말이 안 되게 큽니다: ' + c.height + 'mm');
});

test('★★ 정상 높이(5000 HWPUNIT)는 그대로다', async () => {
  const rows = await roundTrip(sandbox(SRC), [2 ** 32 - 282, 5000, 5000, 2 ** 32 - 1]);
  assert.strictEqual(rows[0][1].hh, 5000);
  assert.ok(Math.abs(rows[0][1].height - 17.6) < 0.06, '5000 HWPUNIT ≈ 17.6mm 이어야 합니다: ' + rows[0][1].height);
  assert.strictEqual(rows[1][0].hh, 5000);
});

test('★★ 대조: 옛 읽기(u32)로 되돌리면 같은 파일에서 천만 mm 짜리 칸이 나온다 — 검사가 헛돌지 않는다', async () => {
  const oldSrc = SRC.replace('height: mm(Math.max(0, i32(d, base + 12))), hh: Math.max(0, i32(d, base + 12)),', 'height: mm(u32(d, base + 12)), hh: u32(d, base + 12),');
  assert.notStrictEqual(oldSrc, SRC, '옛 읽기로 되돌리지 못했습니다 — 이 검사의 바꿔치기를 고쳐야 합니다');
  const rows = await roundTrip(sandbox(oldSrc), [2 ** 32 - 282, 5000, 5000, 2 ** 32 - 1]);
  assert.ok(rows[0][0].height > 1_000_000, '옛 코드가 천만 mm 를 내지 않았습니다(' + rows[0][0].height + ') — 대조가 고장을 못 재현합니다');
});

test('★ 소스에도 남아 있다 — 칸 높이를 i32 로 읽고 음수를 0 으로 자른다', () => {
  assert.match(SRC, /height: mm\(Math\.max\(0, i32\(d, base \+ 12\)\)\)/);
});
