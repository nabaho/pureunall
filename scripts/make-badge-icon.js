#!/usr/bin/env node
/* 알림 «작은 아이콘»(badge) — icon-badge-96.png
   (대표 지시 2026-10-12 「카톡처럼 최상단 흰색 네모박스 푸 자 표시해줘 누구건지 모르겠다」)

   ★ 왜 흰 네모였나 — 폰 맨 위 상태줄의 작은 아이콘은 안드로이드가 «모양(투명도)만» 쓰고
     색은 버린 채 흰색으로 칠한다. 그런데 badge 로 icon-192.png(파란 바탕이 꽉 찬 네모)를
     주고 있었다 → 꽉 찬 네모 모양 그대로 «흰 네모» 가 되었다. 카톡은 투명 바탕에
     글자 모양만 있는 그림을 주기 때문에 상태줄에 TALK 가 보인다.

   ★ 그래서 — 바탕은 «투명», 「푸」 획만 흰색으로 그린다.
     상태줄 아이콘은 아주 작다(24dp 안팎). 큰 아이콘(make-portal-icon.js)처럼
     가운데 48% 에 가늘게 그리면 점으로 뭉개진다 → 칸을 거의 다 쓰고 획을 굵게 한다.

   고치려면 이 파일을 고치고 `node scripts/make-badge-icon.js` 를 다시 돌린다.
   (배포 때 scripts/ 는 통째로 빠지므로 인터넷에는 안 올라간다) */
'use strict';
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

/* ── PNG 로 묶기 (8비트 RGBA) — make-portal-icon.js 와 같은 방식, 그림 라이브러리 없음 ── */
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

/* 둥근 네모 한 획 */
function bar(x0, y0, x1, y1, r) {
  return function (u, v) {
    if (u < x0 || u > x1 || v < y0 || v > y1) return false;
    const rr = Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2);
    const cx = Math.min(Math.max(u, x0 + rr), x1 - rr);
    const cy = Math.min(Math.max(v, y0 + rr), y1 - rr);
    const dx = u - cx, dy = v - cy;
    return dx * dx + dy * dy <= rr * rr;
  };
}

function draw(size) {
  const S = 4;                                  // 한 칸을 4×4 로 훑어 가장자리를 부드럽게
  const L = .12, R = .88;                       // 글자 좌우 — 칸을 거의 다 쓴다
  const W = .115;                               // 획 굵기 — 작게 보여도 안 끊기게 굵게
  const r = .03;
  const IN = .13;                               // ㅍ 세로획을 가장자리에서 들이는 정도(«H» 가 안 되게)
  const P_TOP = .05, P_BOT = .50;
  const strokes = [
    bar(L, P_TOP, R, P_TOP + W, r),                                  // ㅍ 윗 가로
    bar(L, P_BOT - W, R, P_BOT, r),                                  // ㅍ 아랫 가로
    bar(L + IN, P_TOP + W * .5, L + IN + W, P_BOT - W * .5, r),     // ㅍ 왼 세로
    bar(R - IN - W, P_TOP + W * .5, R - IN, P_BOT - W * .5, r),     // ㅍ 오른 세로
    bar(L - .04, .60, R + .04, .60 + W, r),                          // ㅜ 가로
    bar(.5 - W * .58, .60 + W * .5, .5 + W * .58, .96, r),           // ㅜ 기둥
  ];
  function isInk(u, v) {
    for (let i = 0; i < strokes.length; i++) if (strokes[i](u, v)) return true;
    return false;
  }
  return function (x, y) {
    let hit = 0;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      if (isInk((x + (sx + .5) / S) / size, (y + (sy + .5) / S) / size)) hit++;
    }
    /* 색은 흰색, 덮인 만큼만 불투명 — 바탕은 완전 투명 */
    return [255, 255, 255, Math.round(255 * hit / (S * S))];
  };
}

const ROOT = path.join(__dirname, '..');
const out = path.join(ROOT, 'icon-badge-96.png');
fs.writeFileSync(out, toPng(96, draw(96)));
console.log('만듦:', path.basename(out), fs.statSync(out).size, 'bytes');
