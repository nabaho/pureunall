#!/usr/bin/env node
/* 「푸른 캘린더」 홈 화면 아이콘을 만든다 — icon-cal-192.png · icon-cal-512.png

   왜 따로 그리나 — 바탕화면에 아이콘을 하나 더 두는 목적이 「한눈에 찾기」인데,
   다른 앱 아이콘을 그대로 쓰면 둘이 똑같이 생겨 나눈 값어치가 사라진다
   (tests/app-icons.test.js 가 그 되돌아감을 막는다).

   왜 손으로 PNG 를 짜나 — 이 저장소에는 그림 라이브러리가 없다(넣고 싶지도 않다).
   PNG 는 「길이+종류+자료+CRC」 덩어리를 이어 붙인 것뿐이라 zlib 하나로 충분하다.
   ⚠ 이 만들개는 scripts/ 에 있어 배포 때 통째로 빠진다 — 인터넷에는 안 올라간다.

   고침이 필요하면 이 파일을 고치고 `node scripts/make-cal-icon.js` 를 다시 돌린다. */
'use strict';
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

/* ── PNG 로 묶기 (8비트 RGBA) ── */
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
  const stride = size * 4 + 1;                 // 줄마다 앞에 「거르개 없음(0)」 한 바이트
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = pixelAt(x, y), o = y * stride + 1 + x * 4;
      raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; raw[o + 3] = c[3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;                    // 8비트 · RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ── 무엇을 그리나 — 달력 한 장 ──
   ⚠ 바탕은 «가장자리까지» 채운다. 기기가 동그라미로 잘라도 흰 귀퉁이가 안 생긴다.
   ⚠ 달력은 안쪽 안전 구역에만 그린다 — 잘려도 안 잘리게. */
const BG_TOP = [30, 64, 175];      // #1e40af
const BG_BOT = [37, 99, 235];      // #2563eb
const WHITE = [255, 255, 255];
const RED = [220, 38, 38];         // #dc2626 — 고리 아래 빨간 머리띠(달력임을 한눈에)

function draw(size) {
  const S = 3;                                  // 한 칸을 3×3 으로 훑어 계단을 없앤다
  const box = { x0: .20, x1: .80, y0: .26, y1: .80, r: .05 };
  const bandY = box.y0 + .10;                   // 머리띠 아래끝
  const ringY = box.y0 - .045;                  // 고리 두 개

  function inRounded(u, v) {
    if (u < box.x0 || u > box.x1 || v < box.y0 || v > box.y1) return false;
    const r = box.r;
    const cx = Math.min(Math.max(u, box.x0 + r), box.x1 - r);
    const cy = Math.min(Math.max(v, box.y0 + r), box.y1 - r);
    const dx = u - cx, dy = v - cy;
    return dx * dx + dy * dy <= r * r;
  }
  function onRing(u, v) {
    const w = .022, h = .055;
    return [.36, .64].some(function (cx) {
      return Math.abs(u - cx) <= w && v >= ringY && v <= ringY + h;
    });
  }
  /* 날짜 점 — 3줄 × 3칸. 가운데 한 칸만 빨갛게(「오늘」) */
  function onDot(u, v) {
    const cols = [.33, .50, .67], rows = [.46, .59, .72], rr = .045;
    for (let i = 0; i < rows.length; i++) {
      for (let j = 0; j < cols.length; j++) {
        if (i === 2 && j === 2) continue;        // 마지막 한 칸은 비운다(빽빽해 보이지 않게)
        const dx = u - cols[j], dy = v - rows[i];
        if (dx * dx + dy * dy <= rr * rr) return (i === 1 && j === 1) ? 'today' : 'day';
      }
    }
    return '';
  }

  return function (x, y) {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const u = (x + (sx + .5) / S) / size, v = (y + (sy + .5) / S) / size;
      const bg = [0, 1, 2].map(i => Math.round(BG_TOP[i] + (BG_BOT[i] - BG_TOP[i]) * v));
      let c = bg;
      if (onRing(u, v)) c = WHITE;
      else if (inRounded(u, v)) {
        if (v <= bandY) c = RED;                 // 머리띠
        else {
          const d = onDot(u, v);
          c = d === 'today' ? RED : d === 'day' ? bg : WHITE;
        }
      }
      r += c[0]; g += c[1]; b += c[2];
    }
    const n = S * S;
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n), 255];
  };
}

const ROOT = path.join(__dirname, '..');
[192, 512].forEach(function (size) {
  const out = path.join(ROOT, 'icon-cal-' + size + '.png');
  fs.writeFileSync(out, toPng(size, draw(size)));
  console.log('만듦:', path.basename(out), fs.statSync(out).size, 'bytes');
});
