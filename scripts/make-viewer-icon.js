#!/usr/bin/env node
/* 「푸른 문서뷰어」 홈 화면 아이콘을 만든다 — icon-viewer-192/512.png
   (대표 지시 2026-10-25 「폰용 문서 뷰어」 — 앱마다 제 아이콘이 있어야 바탕화면에서 한눈에 찾는다)

   그리는 법은 make-hr-fin-icons.js 와 같다 — 그림 라이브러리 없이 PNG 덩어리를 손으로 짠다.
   문서뷰어: 청록 바탕에 흰 문서(네모, 오른쪽 위 접힌 귀) + 청록 줄 셋
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

/* 문서뷰어 — 흰 문서 한 장 + 줄 셋. 좌표는 0~1 비율로 잡고 크기에 맞춘다 */
function viewerAt(size) {
  const top = [15, 118, 110], bot = [20, 184, 166];        // #0f766e → #14b8a6
  const pg = [0.27, 0.17, 0.73, 0.83], fold = 0.15;        // 문서 네모 · 접힌 귀 크기
  return (x, y) => {
    const u = x / size, v = y / size;
    const base = grad(top, bot, y, size);
    if (!inRect(u, v, pg[0], pg[1], pg[2], pg[3])) return base;
    // 오른쪽 위 귀: 윗삼각형은 잘라 내고(바탕), 아랫삼각형은 접힌 면(연한 청록)
    const cu = u - (pg[2] - fold), cv = v - pg[1];
    if (cu > 0 && cv < fold) return cu > cv ? base : [203, 236, 232, 255];
    const lx0 = pg[0] + 0.07, lx1 = pg[2] - 0.07;
    for (const ly of [0.40, 0.52, 0.64]) {
      const x1 = ly === 0.64 ? lx0 + (lx1 - lx0) * 0.6 : lx1;
      if (inRect(u, v, lx0, ly - 0.022, x1, ly + 0.022)) return [15, 118, 110, 255];
    }
    return WHITE;
  };
}

for (const size of [192, 512]) {
  const file = path.join(__dirname, '..', 'icon-viewer-' + size + '.png');
  fs.writeFileSync(file, toPng(size, viewerAt(size)));
  console.log('만듦:', path.basename(file));
}
