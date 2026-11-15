#!/usr/bin/env node
'use strict';
/* Google Play Console 등록용 그래픽 자산 생성기 (외부 이미지 라이브러리 0개 · 순수 Node zlib)
 *
 * 생성 파일:
 *   1) playstore-icon-512x512.png        (512 × 512, 32비트 PNG — 고해상도 앱 아이콘)
 *   2) playstore-feature-1024x500.png    (1024 × 500, 32비트 PNG — 스토어 대표 그래픽 이미지)
 *
 * 주의:
 *   .gitignore 가 저장소 내부 임의 *.png 를 차단하므로 기본 출력 경로는 OS 임시 폴더 하위이며,
 *   `node scripts/make-playstore-assets.js --out <바탕화면_등_폴더>` 로 원하는 곳에 바로 저장한다.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf) >>> 0;
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  let r = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) r = table[(r ^ buf[i]) & 0xFF] ^ (r >>> 8);
  return (r ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePngRgba(width, height, pixelAt) {
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const rowOff = y * stride;
    raw[rowOff] = 0;
    for (let x = 0; x < width; x++) {
      const c = pixelAt(x, y);
      const o = rowOff + 1 + x * 4;
      raw[o] = c[0];
      raw[o + 1] = c[1];
      raw[o + 2] = c[2];
      raw[o + 3] = c[3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function roundedRectHit(u, v, x0, y0, x1, y1, radius) {
  if (u < x0 || u > x1 || v < y0 || v > y1) return false;
  const rr = Math.min(radius, (x1 - x0) / 2, (y1 - y0) / 2);
  const cx = Math.min(Math.max(u, x0 + rr), x1 - rr);
  const cy = Math.min(Math.max(v, y0 + rr), y1 - rr);
  const dx = u - cx;
  const dy = v - cy;
  return dx * dx + dy * dy <= rr * rr;
}

/* 포털 공식 「푸」 심벌 판별기 (0..1 정규화 좌표계) */
function isPuSymbolInk(u, v) {
  const L = 0.272, R = 0.728, W = 0.048, rad = 0.019, IN = 0.082;
  const P_TOP = 0.250, P_BOT = 0.492;
  return (
    roundedRectHit(u, v, L, P_TOP, R, P_TOP + W, rad) ||
    roundedRectHit(u, v, L, P_BOT - W, R, P_BOT, rad) ||
    roundedRectHit(u, v, L + IN, P_TOP + W * 0.55, L + IN + W, P_BOT - W * 0.55, rad) ||
    roundedRectHit(u, v, R - IN - W, P_TOP + W * 0.55, R - IN, P_BOT - W * 0.55, rad) ||
    roundedRectHit(u, v, L, 0.597, R, 0.597 + W, rad) ||
    roundedRectHit(u, v, 0.5 - W * 0.56, 0.597 + W * 0.55, 0.5 + W * 0.56, 0.762, rad)
  );
}

function generateStoreIcon512() {
  const size = 512;
  const BG_TOP = [0x1e, 0x3a, 0x8a];
  const BG_BOT = [0x25, 0x63, 0xeb];
  const S = 2;
  return encodePngRgba(size, size, (x, y) => {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < S; sy++) {
      for (let sx = 0; sx < S; sx++) {
        const u = (x + (sx + 0.5) / S) / size;
        const v = (y + (sy + 0.5) / S) / size;
        if (isPuSymbolInk(u, v)) {
          r += 255; g += 255; b += 255;
        } else {
          const t = Math.min(1, Math.max(0, v * 0.86 + (1 - u) * 0.14));
          r += Math.round(BG_TOP[0] + (BG_BOT[0] - BG_TOP[0]) * t);
          g += Math.round(BG_TOP[1] + (BG_BOT[1] - BG_TOP[1]) * t);
          b += Math.round(BG_TOP[2] + (BG_BOT[2] - BG_TOP[2]) * t);
        }
      }
    }
    const n = S * S;
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n), 255];
  });
}

function generateFeatureGraphic1024x500() {
  const W = 1024, H = 500;
  return encodePngRgba(W, H, (x, y) => {
    const nx = x / W;
    const ny = y / H;
    // 배경: 짙은 네이비(#0F172A) → 브랜드 블루(#1E3A8A → #2563EB) 대각선 그라데이션
    const t = Math.min(1, Math.max(0, nx * 0.65 + ny * 0.35));
    let r = Math.round(15 + (37 - 15) * t);
    let g = Math.round(23 + (99 - 23) * t);
    let b = Math.round(42 + (235 - 42) * t);

    // 은은한 장식 원형 광원 (오른쪽 상단)
    const gx = (x - 830) / 260;
    const gy = (y - 110) / 260;
    const gd = gx * gx + gy * gy;
    if (gd < 1) {
      const glow = (1 - gd) * 0.20;
      r = Math.min(255, Math.round(r + (96 - r) * glow));
      g = Math.min(255, Math.round(g + (165 - g) * glow));
      b = Math.min(255, Math.round(b + (250 - b) * glow));
    }

    // 왼쪽 중앙: 공식 「푸」 앱 카드 (x: 130..350, y: 140..360, 크기 220×220)
    const bx0 = 130, by0 = 140, bSize = 220;
    if (roundedRectHit(x, y, bx0, by0, bx0 + bSize, by0 + bSize, 48)) {
      const bu = (x - bx0) / bSize;
      const bv = (y - by0) / bSize;
      if (isPuSymbolInk(bu, bv)) {
        return [255, 255, 255, 255];
      }
      const bt = Math.min(1, Math.max(0, bv * 0.85 + (1 - bu) * 0.15));
      return [
        Math.round(0x25 + (0x3b - 0x25) * bt),
        Math.round(0x63 + (0x82 - 0x63) * bt),
        Math.round(0xeb + (0xf6 - 0xeb) * bt),
        255,
      ];
    }

    // 오른쪽: 포털 대시보드 미니 카드 모티프 3열 (텍스트 깨짐 없는 깔끔한 기하학 카드)
    const cards = [
      [420, 152, 890, 202, 14, 0.94],
      [420, 222, 645, 278, 12, 0.22],
      [665, 222, 890, 278, 12, 0.22],
      [420, 296, 645, 352, 12, 0.16],
      [665, 296, 890, 352, 12, 0.16],
    ];
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      if (roundedRectHit(x, y, c[0], c[1], c[2], c[3], c[4])) {
        const a = c[5];
        if (i === 0 && roundedRectHit(x, y, c[0] + 18, c[1] + 16, c[0] + 128, c[1] + 34, 6)) {
          return [30, 64, 175, 255];
        }
        if (i === 0 && roundedRectHit(x, y, c[0] + 146, c[1] + 19, c[0] + 320, c[1] + 31, 5)) {
          return [148, 163, 184, 255];
        }
        return [
          Math.round(r * (1 - a) + 255 * a),
          Math.round(g * (1 - a) + 255 * a),
          Math.round(b * (1 - a) + 255 * a),
          255,
        ];
      }
    }

    return [r, g, b, 255];
  });
}

function generatePlayStoreAssets(outDir) {
  const targetDir = path.resolve(outDir || path.join(os.tmpdir(), 'pureun-playstore-assets'));
  fs.mkdirSync(targetDir, { recursive: true });
  const iconPath = path.join(targetDir, 'playstore-icon-512x512.png');
  const featurePath = path.join(targetDir, 'playstore-feature-1024x500.png');
  fs.writeFileSync(iconPath, generateStoreIcon512());
  fs.writeFileSync(featurePath, generateFeatureGraphic1024x500());
  return { targetDir, iconPath, featurePath };
}

if (require.main === module) {
  let outArg = '';
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out' && argv[i + 1]) outArg = argv[++i];
    else if (argv[i].startsWith('--out=')) outArg = argv[i].slice(6);
  }
  const res = generatePlayStoreAssets(outArg);
  console.log('Google Play 그래픽 자산 생성 완료:');
  console.log('  - 아이콘 (512×512)      :', res.iconPath, '(' + fs.statSync(res.iconPath).size + ' bytes)');
  console.log('  - 그래픽 이미지(1024×500):', res.featurePath, '(' + fs.statSync(res.featurePath).size + ' bytes)');
}

module.exports = { generatePlayStoreAssets };
