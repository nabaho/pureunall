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

/* ── 무엇을 그리나 — 알람시계 ──
   ⚠ 2026-09-19 에 «달력»에서 바꿨다 (대표 지시 「푸른캘린더 아이콘은 다른것으로 해라」).
     포털에서 바로 옆 정부사업일정이 같은 달력 그림이라 둘을 글자로만 가를 수 있었다.
     달력붙이를 다시 고르면 작아질수록 또 같아 보인다 — 아예 다른 물건으로 간다.
     이 앱이 다루는 것이 일정·근태, 곧 «시각»이기도 하다.
   ⚠ 바탕은 «가장자리까지» 채운다. 기기가 동그라미로 잘라도 흰 귀퉁이가 안 생긴다.
   ⚠ 시계는 안쪽 안전 구역에만 그린다 — 잘려도 안 잘리게. */
const BG_TOP = [30, 64, 175];      // #1e40af
const BG_BOT = [37, 99, 235];      // #2563eb
const WHITE = [255, 255, 255];
const FACE = [219, 234, 254];      // #dbeafe — 시계판(흰 테두리와 갈라 보이게)
const RED = [220, 38, 38];         // #dc2626 — 바늘(작아져도 «시계»로 읽히는 것이 이것이다)

function draw(size) {
  const S = 3;                                  // 한 칸을 3×3 으로 훑어 계단을 없앤다
  const cx = .50, cy = .565;                    // 몸통 한가운데

  function disc(u, v, x, y, r) { const dx = u - x, dy = v - y; return dx * dx + dy * dy <= r * r; }
  /* 점이 선분에서 w 안쪽인가 — 바늘 하나를 이렇게 그린다 */
  function seg(u, v, x1, y1, x2, y2, w) {
    const dx = x2 - x1, dy = y2 - y1;
    const t = Math.min(1, Math.max(0, ((u - x1) * dx + (v - y1) * dy) / (dx * dx + dy * dy)));
    const px = u - (x1 + dx * t), py = v - (y1 + dy * t);
    return px * px + py * py <= w * w;
  }

  return function (x, y) {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const u = (x + (sx + .5) / S) / size, v = (y + (sy + .5) / S) / size;
      const bg = [0, 1, 2].map(i => Math.round(BG_TOP[i] + (BG_BOT[i] - BG_TOP[i]) * v));
      let c = bg;
      /* 아래에서 위로 덮어 그린다 — 나중 것이 이긴다 */
      if (u >= .455 && u <= .545 && v >= .175 && v <= .275) c = WHITE;   // 위 손잡이
      if (disc(u, v, .285, .295, .115) || disc(u, v, .715, .295, .115)) c = WHITE;  // 종 둘
      if (disc(u, v, .235, .855, .070) || disc(u, v, .765, .855, .070)) c = WHITE;  // 다리 둘
      if (disc(u, v, cx, cy, .310)) c = WHITE;                            // 몸통(테두리)
      if (disc(u, v, cx, cy, .250)) c = FACE;                             // 시계판
      /* 바늘 — 10시 10분. 어느 쪽으로도 안 치우쳐 보여 작을수록 시계로 읽힌다 */
      if (seg(u, v, cx, cy, .385, .445, .026)) c = RED;                   // 짧은바늘
      if (seg(u, v, cx, cy, .655, .420, .020)) c = RED;                   // 긴바늘
      if (disc(u, v, cx, cy, .038)) c = RED;                              // 가운데 못
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
