#!/usr/bin/env node
/* 「직원 인사」·「재무」 홈 화면 아이콘을 만든다 — icon-hr-192/512.png · icon-fin-192/512.png
   (대표 지시 2026-10-09 「완벽히 분리해서 별도앱으로」 — 앱마다 제 아이콘이 있어야 바탕화면에서 한눈에 찾는다)

   그리는 법은 make-mail-icon.js 와 같다 — 그림 라이브러리 없이 PNG 덩어리를 손으로 짠다.
   직원 인사: 파랑 바탕에 흰 사람 둘(머리 동그라미 + 어깨 반원)
   재무:      초록 바탕에 흰 장부(네모) + 줄 셋
   ⚠ purpose "any" — 바탕은 가장자리까지 채우고, 그림은 안쪽 80% 안에만.
   고침이 필요하면 이 파일을 고치고 `node scripts/make-hr-fin-icons.js` 를 다시 돌린다.
   (배포 때 scripts/ 는 통째로 빠지므로 인터넷에는 안 올라간다) */
'use strict';
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf) >>> 0;
  let c, n, k, t = [];
  for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
  let r = 0xFFFFFFFF;
  for (n = 0; n < buf.length; n++) r = t[(r ^ buf[n]) & 0xFF] ^ (r >>> 8);
  return (r ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function toPng(size, pixelAt) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = pixelAt(x, y), o = y * stride + 1 + x * 4;
      raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; raw[o + 3] = c[3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const WHITE = [255, 255, 255, 255];
function grad(top, bot, y, size) {
  const t = y / (size - 1);
  return [0, 1, 2].map((i) => Math.round(top[i] + (bot[i] - top[i]) * t)).concat([255]);
}
function inCircle(x, y, cx, cy, r) { return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r; }
function inRect(x, y, x0, y0, x1, y1) { return x >= x0 && x <= x1 && y >= y0 && y <= y1; }

/* 직원 인사 — 사람 둘. 좌표는 0~1 비율로 잡고 크기에 맞춘다 */
function hrAt(size) {
  const top = [30, 64, 175], bot = [37, 99, 235];          // #1e40af → #2563eb
  return function (x, y) {
    const u = x / size, v = y / size;
    const person = (cx, cy, hr, sr) =>
      inCircle(u, v, cx, cy, hr) ||
      (v >= cy + hr * 1.35 && v <= 0.8 && inCircle(u, v, cx, cy + hr * 1.35 + sr, sr) && v <= cy + hr * 1.35 + sr);
    if (person(0.38, 0.34, 0.09, 0.17) || person(0.64, 0.38, 0.08, 0.15)) return WHITE;
    return grad(top, bot, y, size);
  };
}
/* 재무 — 장부와 줄 셋 */
function finAt(size) {
  const top = [21, 128, 61], bot = [22, 163, 74];          // #15803d → #16a34a
  return function (x, y) {
    const u = x / size, v = y / size;
    if (inRect(u, v, 0.26, 0.2, 0.74, 0.8)) {
      const lines = [0.38, 0.5, 0.62];
      const onLine = lines.some((ly) => Math.abs(v - ly) < 0.025) && u > 0.34 && u < 0.66;
      return onLine ? grad(top, bot, y, size) : WHITE;
    }
    return grad(top, bot, y, size);
  };
}

const root = path.join(__dirname, '..');
[['hr', hrAt], ['fin', finAt]].forEach(([tag, make]) => {
  [192, 512].forEach((size) => {
    const out = path.join(root, 'icon-' + tag + '-' + size + '.png');
    fs.writeFileSync(out, toPng(size, make(size)));
    console.log('만듦', path.basename(out), fs.statSync(out).size + 'B');
  });
});
