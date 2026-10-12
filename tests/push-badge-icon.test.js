/* 알림 상태줄 아이콘(badge)은 «투명 바탕 + 모양» 이어야 한다
   (2026-10-12 대표 「카톡처럼 최상단 흰색 네모박스 푸 자 표시해줘 누구건지 모르겠다」)

   안드로이드는 badge 그림의 «투명도만» 보고 흰색으로 칠한다. 바탕이 꽉 찬 그림(icon-192.png)을
   주면 상태줄에 흰 네모만 뜬다 — 무슨 앱 알림인지 알 수 없다.
   그래서 «지금 그림이 무엇인가» 가 아니라 «바탕이 투명한가·모양이 있는가» 를 본다. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const sw = fs.readFileSync(path.join(ROOT, 'firebase-messaging-sw.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function badgeFile() {
  const m = sw.match(/badge\s*:\s*['"]([^'"]+)['"]/);
  assert.ok(m, '알림 워커에 badge 가 있어야 한다');
  return m[1].replace(/^\/pureunall\//, '');
}

/* PNG → 투명도 읽기 (8비트 RGBA·거르개 없음 — 만들개가 그렇게 만든다. 다른 꼴이면 여기서 알린다) */
function alphaOf(file) {
  const buf = fs.readFileSync(path.join(ROOT, file));
  let p = 8, w = 0, h = 0, type = -1, idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), t = buf.toString('ascii', p + 4, p + 8);
    if (t === 'IHDR') { w = buf.readUInt32BE(p + 8); h = buf.readUInt32BE(p + 12); type = buf[p + 17]; }
    if (t === 'IDAT') idat.push(buf.slice(p + 8, p + 8 + len));
    p += 12 + len;
  }
  assert.strictEqual(type, 6, file + ' 은 투명도가 있는 RGBA PNG 여야 한다');
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * 4 + 1;
  return { w, h, a: (x, y) => raw[y * stride + 1 + x * 4 + 3] };
}

test('badge 는 바탕이 꽉 찬 앱 아이콘이 아니다', () => {
  const f = badgeFile();
  assert.ok(fs.existsSync(path.join(ROOT, f)), f + ' 파일이 있어야 한다');
  assert.ok(!/^icon-(portal-|erp-|mail-|cards-)?(192|512)\.png$/.test(f), 'badge 에 앱 아이콘(꽉 찬 네모)을 쓰면 상태줄에 흰 네모가 뜬다: ' + f);
});

test('badge 그림은 바탕이 투명하고 글자 모양이 있다', () => {
  const { w, h, a } = alphaOf(badgeFile());
  assert.ok(w >= 48 && w === h, '정사각형·48px 이상');
  let clear = 0, solid = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = a(x, y);
    if (v === 0) clear++; else if (v === 255) solid++;
  }
  const n = w * h;
  /* 네 귀퉁이는 투명이어야 한다 — 꽉 찬 네모면 여기서 걸린다 */
  [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]].forEach(([x, y]) => assert.strictEqual(a(x, y), 0, '귀퉁이 (' + x + ',' + y + ') 가 투명해야 한다'));
  assert.ok(clear / n >= 0.3, '투명한 자리가 30% 이상이어야 모양이 보인다');
  assert.ok(solid / n >= 0.15, '진한 획이 15% 이상이어야 작게 줄여도 안 사라진다');
});

test('포털이 쓰는 알림 길에도 같은 badge 를 준다', () => {
  const enter = fs.readFileSync(path.join(ROOT, 'enter.html'), 'utf8');
  const lines = enter.split(/\r?\n/).filter(l => /new Notification\(/.test(l));
  lines.forEach(l => assert.match(l, /badge\s*:\s*['"][^'"]*badge[^'"]*\.png['"]/, '포털 알림에도 투명 badge: ' + l.trim()));
});
