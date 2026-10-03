'use strict';
/* 문서관리 — 손보기·PDF·메일 host (설계 2026-09-29 §6·§7)
   ⓐ 편집기는 저장소 안 것만(서류가 남의 주소로 가지 않는다) ⓑ 메일 첨부는 명함첩과 같은 창고로
   ⓒ 보낸 기록은 받는 주소 없이 sentKeys 마다 ⓓ 사본은 규칙 안의 값(kind:'co', src:'upload') */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const R = path.join(__dirname, '..');
const H = fs.readFileSync(path.join(R, 'docs-esign.html'), 'utf8').replace(/\r\n/g, '\n');
const fnOf = (sig) => { const i = H.indexOf(sig); assert.ok(i >= 0, sig + ' 가 없습니다'); return H.slice(i, H.indexOf('\n}\n', i)); };

test('ⓐ 편집기 — 저장소 안 rhwp-editor + 우리 studio, 원본 형식으로 돌려준다', () => {
  const f = fnOf('function formHwpEdit(');
  assert.match(f, /import\('\.\/vendor\/rhwp-editor\/index\.js'\)/);
  assert.match(f, /studioUrl: 'vendor\/rhwp-studio\/index\.html'/);
  assert.match(f, /fmt === 'hwpx' \? ed\.exportHwpx\(\) : ed\.exportHwp\(\)/);
  assert.ok(!/esm\.sh\/@rhwp|edwardkim\.github\.io/.test(H), '남의 주소 편집기를 부릅니다');
});
test('ⓑ 메일 — PuDocFile 을 storage 없이 init, 같은 서버 sendMail, 첨부는 putMailFile', () => {
  assert.match(H, /<script src="js\/pu-doc-file\.js\?v=36"><\/script>/);
  assert.match(H, /PuDocFile\.init\(\{ db: db \}\)/, 'storage 를 넘기면 첨부가 다른 창고로 가서 빠진 채 나갑니다');
  const s = fnOf('async function formMailSend(');
  assert.match(s, /PuDocFile\.putMailFile\(/);
  assert.match(s, /PuDocFile\.sendMail\(/);
  assert.match(s, /cardId: ''/);
});
test('ⓒ 보낸 기록 — sentKeys 마다 sentRecord, 받는 주소 칸 없음', () => {
  const r = fnOf('function formMailRecord(');
  assert.match(r, /PuFormCardFill\.sentKeys\(/);
  assert.match(r, /PuFormCardFill\.sentRecord\(/);
  assert.match(r, /'pucards\/sentDocs\/' \+ k/);
  assert.ok(!/\bto\s*:/.test(r), '기록에 받는 주소를 넣습니다');
});
test('ⓓ 사본 보관 — kind co · src upload (규칙 안의 값)', () => {
  const k = fnOf('function formMailKeep(');
  assert.match(k, /kind: 'co'/);
  assert.match(k, /src: 'upload'/);
  assert.match(k, /PuOfficeStore\.addCoDoc\(/);
});
test('ⓔ host 배선', () => {
  assert.match(H, /hwpEdit: formHwpEdit, hwpPdf: formHwpPdf,/);
  assert.match(H, /mail: \{ mode: formMailMode, send: formMailSend, record: formMailRecord, keep: formMailKeep \}/);
});
