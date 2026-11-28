#!/usr/bin/env node
/* 「산재사건관리」·「부당해고·노동사건관리」 독립 앱 아이콘을 만든다.
   - icon-sanjae-192.png / icon-sanjae-512.png (초록 바탕 + 흰 의료 카드 + 적십자/안전 심볼)
   - icon-laborcase-192.png / icon-laborcase-512.png (파랑 바탕 + 의사봉/받침 심볼)
   tests/app-icons.test.js 와 각 manifest.json 이 두 아이콘의 고유성을 검증한다. */
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

function inRoundedRect(u, v, x0, y0, x1, y1, r) {
  if (u < x0 || u > x1 || v < y0 || v > y1) return false;
  const cx = Math.min(Math.max(u, x0 + r), x1 - r);
  const cy = Math.min(Math.max(v, y0 + r), y1 - r);
  const dx = u - cx, dy = v - cy;
  return dx * dx + dy * dy <= r * r;
}

function distToSeg(u, v, x1, y1, x2, y2) {
  const vx = x2 - x1, vy = y2 - y1;
  const wx = u - x1, wy = v - y1;
  const len2 = vx * vx + vy * vy || 1e-9;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
  const px = x1 + t * vx, py = y1 + t * vy;
  return Math.hypot(u - px, v - py);
}

function inRotBox(u, v, cx, cy, hw, hh, angRad, corner) {
  const ca = Math.cos(-angRad), sa = Math.sin(-angRad);
  const rx = (u - cx) * ca - (v - cy) * sa;
  const ry = (u - cx) * sa + (v - cy) * ca;
  return inRoundedRect(rx, ry, -hw, -hh, hw, hh, corner);
}

function sample(size, drawFn) {
  const S = 3;
  return function (x, y) {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const u = (x + (sx + 0.5) / S) / size;
      const v = (y + (sy + 0.5) / S) / size;
      const c = drawFn(u, v);
      r += c[0]; g += c[1]; b += c[2];
    }
    const n = S * S;
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n), 255];
  };
}

function lerpColor(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/* 산재사건관리: 깊은 초록 바탕 + 둥근 흰 의료 차트 카드 + 빨강 십자 + 상단 초록 띠 */
function drawSanjae(u, v) {
  const bg = lerpColor([22, 101, 52], [22, 163, 74], v);
  if (!inRoundedRect(u, v, 0.16, 0.16, 0.84, 0.84, 0.14)) return bg;
  if (v < 0.30) return [187, 247, 208]; // 상단 연두 헤더 띠 (#bbf7d0)
  const inHoriz = inRoundedRect(u, v, 0.31, 0.49, 0.69, 0.63, 0.03);
  const inVert = inRoundedRect(u, v, 0.43, 0.37, 0.57, 0.75, 0.03);
  if (inHoriz || inVert) return [220, 38, 38]; // 적십자 (#dc2626)
  return [255, 255, 255];
}

/* 부당해고·노동사건관리: 깊은 파랑 바탕 + 법정 의사봉(Gavel) + 하단 타격대 */
function drawLaborCase(u, v) {
  const bg = lerpColor([30, 64, 175], [37, 99, 235], v);
  // 하단 흰색/금색 타격 받침대
  if (inRoundedRect(u, v, 0.22, 0.71, 0.78, 0.81, 0.035)) return [255, 255, 255];
  if (inRoundedRect(u, v, 0.30, 0.65, 0.70, 0.71, 0.025)) return [191, 219, 254];
  // 대각선 의사봉 손잡이
  if (distToSeg(u, v, 0.45, 0.39, 0.75, 0.63) <= 0.042) return [253, 230, 138]; // 연노랑 자루 (#fde68a)
  // 기울어진 의사봉 머리
  const ang = -0.68;
  if (inRotBox(u, v, 0.42, 0.36, 0.15, 0.085, ang, 0.025)) return [255, 255, 255];
  if (inRotBox(u, v, 0.31, 0.45, 0.035, 0.105, ang, 0.015)) return [217, 119, 6]; // 타격면 테두리 (#d97706)
  if (inRotBox(u, v, 0.53, 0.27, 0.035, 0.105, ang, 0.015)) return [217, 119, 6];
  return bg;
}

const ROOT = path.join(__dirname, '..');
[
  ['sanjae', drawSanjae],
  ['laborcase', drawLaborCase],
].forEach(function (pair) {
  const tag = pair[0], fn = pair[1];
  [192, 512].forEach(function (size) {
    const out = path.join(ROOT, 'icon-' + tag + '-' + size + '.png');
    fs.writeFileSync(out, toPng(size, sample(size, fn)));
    console.log('만듦:', path.basename(out), fs.statSync(out).size, 'bytes');
  });
});
