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

/* 「푸」 마크 — make-portal-icon.js(포털 홈 아이콘)의 획 자리를 «그대로» 옮겨 온다
   (대표 「푸 마크로」). 포털 아이콘은 가운데 48% 에 그리므로, 같은 모양을 KX 배 키워
   칸을 거의 다 쓰게 한다 — 모양·비율은 같고 크기만 다르다. 획만 조금 굵게(WX) 해
   상태줄(24dp 안팎)에서 끊기지 않게 한다. */
const KX = 1.74, CX = .5, CY = .506;           // CY = 포털 마크 위(.250)·아래(.762) 가운데
const WX = 1.25;
function mark() {
  const L = .272, R = .728, W = .048 * WX, r = .019, IN = .082;
  const P_TOP = .250, P_BOT = .492;
  return [
    [L, P_TOP, R, P_TOP + W],                                   // ㅍ 윗 가로
    [L, P_BOT - W, R, P_BOT],                                   // ㅍ 아랫 가로
    [L + IN, P_TOP + W * .55, L + IN + W, P_BOT - W * .55],     // ㅍ 왼 세로
    [R - IN - W, P_TOP + W * .55, R - IN, P_BOT - W * .55],     // ㅍ 오른 세로
    [L, .597, R, .597 + W],                                     // ㅜ 가로
    [.5 - W * .56, .597 + W * .55, .5 + W * .56, .762],         // ㅜ 기둥
  ].map(([x0, y0, x1, y1]) => bar(
    CX + (x0 - CX) * KX, CY + (y0 - CY) * KX,
    CX + (x1 - CX) * KX, CY + (y1 - CY) * KX, r * KX));
}

function draw(size) {
  const S = 4;                                  // 한 칸을 4×4 로 훑어 가장자리를 부드럽게
  const strokes = mark();
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
