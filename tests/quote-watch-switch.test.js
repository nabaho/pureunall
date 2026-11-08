'use strict';
/* 📨 견적 자동 감지 — «켜는 길과 푸는 길을 함께» (STATUS.md 「되풀이된 실수」 ④: 켤 길 없는 기능)
   서버 훅(functions/mail-quote-watch.js)이 읽는 칸과, 총괄관리자가 누르는 화면 단추가 쓰는 칸이 «같은 칸»이어야 한다.
   그리고 그 칸을 쓸 수 있는 사람은 규칙이 총괄관리자만 허용해야 한다(아무나 켜면 이알피에 요청이 쏟아진다). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const W = require('../functions/mail-quote-watch.js');

const R = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8').replace(/\r\n/g, '\n');

test('화면 단추가 쓰는 칸 = 서버 훅이 읽는 칸(pucards/config/quoteWatch/on)', () => {
  const html = read('docs-esign.html');
  const m = /var quoteWatchSwitch = \{([\s\S]*?)\n\};/.exec(html);
  assert.ok(m, 'quoteWatchSwitch 가 없다 — 켤 길이 없는 기능이 된다');
  const paths = m[1].match(/db\.ref\('([^']+)'\)/g).map((s) => /'([^']+)'/.exec(s)[1]);
  assert.ok(paths.length >= 2 && paths.every((p) => p === W.CFG + '/on'), '화면이 쓰는 칸과 서버가 읽는 칸이 다르다: ' + paths.join(', '));
  assert.match(html, /watch: quoteWatchSwitch/, '화면에 연결되지 않았다');
  assert.match(m[1], /PuWorklog\.log\('auto_detect'/, '켜고 끈 일을 작업 기록에 남긴다');
});

test('그 칸을 쓸 수 있는 사람은 총괄관리자뿐이다 — pucards 쓰기는 ADMIN', () => {
  const rules = read('scripts/make-firebase-rules.js');
  assert.match(rules, /rules\.pucards = \{\s*\n\s*'\.read': LOGIN, '\.write': ADMIN,/);
  /* 하위 칸이 config 를 따로 열어 두지 않았다 — 키 이름 config 가 쓰기를 LOGIN 으로 풀면 안 된다 */
  const block = rules.slice(rules.indexOf('rules.pucards = {'), rules.indexOf('rules.pucards_private'));
  assert.ok(!/\bconfig\s*:/.test(block), 'pucards 안에서 config 를 따로 풀어 두었다');
});

test('서버 훅은 스위치가 «true» 일 때만 돈다(기본 꺼짐) — 값 모양을 화면과 맞춘다', () => {
  const src = read('functions/mail-quote-watch.js');
  assert.match(src, /if \(on !== true\) return out;/);
  const html = read('docs-esign.html');
  assert.match(html, /set\(!!on\)/, '화면은 true/false 로만 쓴다');
});
