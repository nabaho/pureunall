'use strict';
/* 나스 자동 백업 올리개 — 「올렸다」와 「된다」는 다르다 (2026-09-18 대표 지시 「올려라」)
   ─────────────────────────────────────────────────────────────────────────
   ■ 왜 이것이 생겼나
     대표님이 「올려라」고 하셨는데 클라우드에서 도는 방에는 파이어베이스 로그인이 없다
     (토큰·gcloud·서비스계정 전부 없음을 확인했고, CI 에도 함수 배포 경로가 없다).
     그래서 «로그인된 자리»에서 한 줄로 끝나게 만든다. 손으로 할 일이 셋이었다 —
     열쇠 만들기 · 서버에 넣기 · 함수 올리기.

   ★ 못 박는 것 — 값이 아니라 규칙이다
     ① 기본은 «보여만» 준다 — 실수로 돌려도 아무 일이 안 일어난다
     ② 함수 «하나만» 올린다 — 다른 함수를 건드리면 메일·급여가 함께 흔들린다
     ③ 열쇠가 이미 있으면 다시 만들지 않는다 — 새로 만들면 나스의 옛 열쇠가 조용히 죽는다
     ④ 열쇠를 파일로 남기지 않는다 — 남으면 그 하나로 백업 전부를 받아 갈 수 있다
     ⑤ 올린 뒤 실제로 한 번 받아 본다 — 「올렸다」와 「된다」는 다르다
     ⑥ 로그인이 없으면 그 자리에서 멈추고 «무엇을 하라»고 말한다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripJs } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const RAW = fs.readFileSync(path.join(ROOT, 'scripts', 'nas-backup-deploy.js'), 'utf8');
const SRC = stripJs(RAW);   // ⚠ 조각·.js 에는 stripJs — 주석의 낱말을 코드로 읽지 않게

test('①★★ 기본은 «보여만» 준다 — 실수로 돌려도 아무 일이 안 일어난다', () => {
  assert.match(SRC, /const 올린다 = process\.argv\.includes\('--deploy'\)/,
    '★ 문이 없으면 그냥 돌린 것이 곧 배포가 된다');
  const i = SRC.indexOf('if (!올린다)');
  const j = SRC.indexOf('올리기();');
  assert.ok(i > -1 && j > i,
    '★★ 「보여만 준다」가 올리기 «뒤»에 있으면 이미 올린 뒤다');
  assert.match(SRC.slice(i, j), /return;/, '★ 보여 준 뒤 돌아서지 않으면 그대로 올린다');
});

test('②★★ 함수 «하나만» 올린다 — 다른 함수를 건드리면 메일·급여가 함께 흔들린다', () => {
  assert.match(SRC, /'--only', 'functions:' \+ 함수/,
    '★★ --only 가 없으면 functions 전부가 다시 올라간다. 열쇠가 빠진 함수는 그 자리에서 멎는다');
  assert.ok(!/deploy'\]\s*\)/.test(SRC) , '★ 맨 deploy 를 부르는 길이 남아 있다');
});

test('③★ 열쇠가 이미 있으면 다시 만들지 않는다', () => {
  assert.match(SRC, /secrets:access/,
    '★ 있는지 안 보고 만들면 나스에 넣어 둔 옛 열쇠가 조용히 죽는다 — 다음 주 새벽에야 안다');
  const i = SRC.indexOf('if (있나)');
  const j = SRC.indexOf('randomBytes');
  assert.ok(i > -1 && j > i, '★★ 만들기가 «있나» 검사보다 앞이면 검사한 뜻이 없다');
  assert.match(SRC.slice(i, j), /return null/, '★ 있는데도 이어 가면 덮어쓴다');
});

test('④★★ 열쇠를 파일로 남기지 않는다', () => {
  assert.ok(!/writeFileSync|appendFileSync|createWriteStream/.test(SRC),
    '★★ 열쇠를 파일로 적으면 그 파일 하나로 백업 전부를 받아 갈 수 있다');
  assert.match(SRC, /이 화면에만 있습니다/, '★ 어디에 있는 것인지 말해 줘야 사람이 지킨다');
  /* 서버에 넣을 때도 명령줄이 아니라 «들어가는 물길»로 준다 — ps 에 안 보이게 */
  assert.match(SRC, /'--data-file', '-'/,
    '★★ 열쇠를 명령줄 인자로 주면 같은 PC 의 다른 프로그램이 ps 로 그대로 본다');
  assert.match(SRC, /input: 새열쇠/);
});

test('⑤★ 올린 뒤 실제로 한 번 받아 본다 — 「올렸다」와 「된다」는 다르다', () => {
  assert.match(SRC, /function 받아보기\(/);
  /* ⚠ 자리를 «부르는 곳»으로 잡는다 — 정의(function 받아보기…)는 위에 있으니
     그것으로 견주면 늘 깨진다(처음에 그랬다). */
  const i = SRC.indexOf('\n  올리기();');
  const j = SRC.indexOf('await 받아보기(');
  assert.ok(i > -1 && j > i, '★ 받아보기가 올리기보다 앞이면 옛 함수를 시험한 것이다');
  assert.match(SRC, /'X-Nas-Key'/, '★ 열쇠 없이 두드리면 403 만 보고 「됐다」를 못 가린다');
});

test('⑥ 로그인이 없으면 그 자리에서 멈추고 «무엇을 하라»고 말한다', () => {
  assert.match(SRC, /firebase-tools login/,
    '★ 「로그인하세요」만 있고 무엇을 치라는 말이 없으면 받는 사람은 멈춘다');
  const i = SRC.indexOf('로그인확인();');
  const j = SRC.indexOf('열쇠준비();');
  assert.ok(i > -1 && j > i, '★★ 로그인도 안 된 채로 열쇠를 만들면 엉뚱한 곳에 넣는다');
});

test('⑦ 나스에 넣을 두 줄을 끝에 그대로 찍는다 — 사람이 옮겨 적을 것이 없게', () => {
  assert.match(SRC, /NAS_KEY="/, '★ 스크립트가 쓰는 이름 그대로 찍어야 붙여넣기만 하면 된다');
  assert.match(SRC, /URL="/);
  const sh = fs.readFileSync(path.join(ROOT, 'docs', '나스-백업-스크립트.sh'), 'utf8');
  assert.match(sh, /^NAS_KEY=/m, '★★ 올리개가 찍는 이름과 나스 스크립트의 이름이 어긋나면 붙여넣어도 안 된다');
  assert.match(sh, /^URL=/m);
});
