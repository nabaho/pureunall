'use strict';
/* Vision 무료 몫은 «달마다 1,000장» — 그 문턱을 못 박는다 (대표 결정 2026-09-08 ③㉮)
   실행: node --test tests/free-ocr-month-cap.test.js

   ★ 왜 이 검사가 있나 — 화면이 그 판독을 「0원」이라 적는다. 1,000장을 넘기면
     Vision 은 그냥 읽어 주고 **요금이 붙는다.** 그 순간 「0원」이 거짓이 된다.
     싸다는 것과 0원이라는 것을 섞어 적은 일이 창고 버킷에서 이미 있었다.
   ⚠ 1,000 은 «값 자체가 규칙»이다 — 구글이 정한 무료 몫이다(검사고정-허용). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripJs, stripComments } = require('./strip-comments.js');

const R = path.join(__dirname, '..');
const DR = require(path.join(R, 'functions', 'doc-read.js'));
const IDX = stripJs(fs.readFileSync(path.join(R, 'functions', 'index.js'), 'utf8'));

/* ══════ ① 세는 자리 ═══════════════════════════════════════════════════════ */

test('무료 몫은 달마다 1,000장이다 (검사고정-허용 — 구글이 정한 값)', () => {
  assert.equal(DR.VISION_FREE_MONTH, 1000);
});

test('★ 달을 «한국 날짜»로 가른다 — 서버와 화면이 같은 달을 봐야 숫자가 맞는다', () => {
  /* 한국 시각으로 9월 9일 새벽인 순간(UTC 로는 아직 9월 8일) */
  const 새벽 = Date.parse('2026-09-08T20:00:00Z');
  assert.equal(DR.ymKST(새벽), '2026-09');
  /* 달이 바뀌는 자리도 한국 날짜로 — UTC 로 재면 하루가 옆 달로 새어 든다 */
  assert.equal(DR.ymKST(Date.parse('2026-09-30T20:00:00Z')), '2026-10',
    '★ 달 경계를 UTC 로 재고 있습니다 — 월초·월말 하루가 옆 달로 셉니다');
});

test('★ Vision 셈은 «달 자리»도 함께 올린다 — 안 올리면 문턱이 볼 숫자가 없다', () => {
  const 길 = DR.tallyPaths('photos', '2026-09-08', 'vision');
  assert.ok(길.some(p => p === DR.visionMonthPath(Date.parse('2026-09-08T03:00:00Z'))),
    '★ 달 자리를 안 올립니다 — 이달 몇 장 썼는지 아무도 모르게 됩니다');
  assert.ok(길.length >= 3, '앱 자리·하루 합계·달 합계 셋이 있어야 합니다');
});

/* ⚠ 2026-09-10 에 규칙이 «바뀌었다» — 그전에는 「Gemini 셈(n)은 달 자리를 안 올린다」였다.
   이번 달 요금 한도(대표 결정 ₩30,000)가 생기면서 n 도 달 자리를 쓴다.
   ★ 그래도 지켜야 할 것은 그대로다: **둘이 한 숫자로 섞이지 않는 것.**
     Vision 은 무료 몫(달 1,000장)을 세고 n 은 유료 판독 횟수를 센다 —
     한 숫자가 되면 둘 다 못 읽는다. 그래서 «다른 열쇠»로 나란히 쌓는다. */
test('★ Vision 몫과 Gemini 셈이 «한 숫자로 섞이지» 않는다', () => {
  const v = DR.tallyPaths('photos', '2026-09-08', 'vision');
  const n = DR.tallyPaths('photos', '2026-09-08', 'n');
  assert.equal(v.filter(p => n.includes(p)).length, 0,
    '★ 무료 몫과 유료 셈이 같은 자리에 쌓입니다 — 둘 다 못 읽게 됩니다');
  v.forEach(p => assert.match(p, /\/vision$/));
  n.forEach(p => assert.match(p, /\/n$/));
  /* 달 자리는 둘 다 쓴다 — 다만 «끝 이름»이 달라 섞이지 않는다 */
  assert.ok(n.some(p => /\/2026-09\/_all\/n$/.test(p)),
    '★ 유료 판독이 달 자리를 안 올립니다 — 이번 달 요금 한도가 볼 숫자가 없습니다');
});

test('달 자리를 이미 받았으면 두 번 올리지 않는다', () => {
  const 길 = DR.tallyPaths('photos', '2026-09', 'vision');
  assert.equal(길.length, new Set(길).size,
    '★ 같은 자리를 한 번에 두 번 올립니다 — 셈이 두 배가 됩니다');
});

/* ══════ ② 부르기 «전»에 막는다 ════════════════════════════════════════════ */

test('★ 달 몫을 넘길 판이면 Vision 을 «부르기 전에» 막는다', () => {
  const 자리 = IDX.indexOf('exports.readVision');
  assert.ok(자리 > 0, 'readVision 을 못 찾았습니다');
  const 본문 = IDX.slice(자리, IDX.indexOf('\nexports.', 자리 + 10) + 1 || IDX.length);
  const 문턱 = 본문.indexOf('visionMonthLeft(');
  const 부름 = 본문.indexOf('VR.callVision(');
  assert.ok(문턱 > 0, '★ 달 몫을 보지 않고 부릅니다 — 넘겨도 그냥 읽히고 요금이 붙습니다');
  assert.ok(부름 > 0, 'Vision 을 부르는 자리를 못 찾았습니다');
  assert.ok(문턱 < 부름,
    '★ 부른 «뒤»에 셈을 봅니다 — 이미 요금이 나간 다음입니다');
  assert.match(본문, /남은것\.left < v\.images\.length/,
    '★ 보낼 «장 수»와 견주지 않습니다 — 한 장 남았는데 열 장을 보내면 아홉 장이 유료입니다');
});

test('★ 막을 때 429 로 말하고 «물러설 길»을 알려 준다', () => {
  const 자리 = IDX.indexOf('exports.readVision');
  const 본문 = IDX.slice(자리, 자리 + 4000);
  assert.match(본문, /status\(429\)/,
    '★ 429(너무 많이 불렀다)로 말하지 않습니다 — 부르는 쪽이 고장으로 읽습니다');
  assert.match(본문, /브라우저 판독/,
    '★ 「브라우저 판독으로 대신합니다」를 안 알려 줍니다 — 물러설 길이 있는데 못 찾습니다');
});

test('★ 셈을 «못 읽었을 때»와 «0장»을 갈라 다룬다', () => {
  const 자리 = IDX.indexOf('async function visionMonthLeft');
  assert.ok(자리 > 0, 'visionMonthLeft 를 못 찾았습니다');
  const fn = IDX.slice(자리, IDX.indexOf('\n}', 자리) + 2);
  assert.match(fn, /known:\s*true/, '읽었다는 표시가 없습니다');
  assert.match(fn, /known:\s*false/, '못 읽었다는 표시가 없습니다');
  /* ⚠⚠ 못 읽었으면 «안 부른다». 열어 두면 얼마 썼는지 모르는 채로 부르고, 그것이
       곧 요금이다. 막아도 일은 된다 — 브라우저 판독으로 계속 읽힌다. */
  assert.match(fn, /catch[\s\S]{0,400}?left:\s*0/,
    '★ 셈을 못 읽었는데 몫이 남은 것으로 답합니다 — 모르는 채로 유료 구간에 들어갑니다');
  assert.equal(/catch[\s\S]{0,400}?left:\s*(DR\.)?VISION_FREE_MONTH/.test(fn), false,
    '★ 못 읽었을 때 몫이 «가득» 남은 것으로 답합니다 — 문턱이 통째로 헛돕니다');
});

/* ══════ ③ 규칙 파일은 안 고쳐도 된다 ══════════════════════════════════════ */

test('달 자리도 지금 규칙이 그대로 받는다 — 규칙을 새로 열지 않는다', () => {
  const 만들개 = stripJs(fs.readFileSync(path.join(R, 'scripts', 'make-firebase-rules.js'), 'utf8'));
  const 자리 = 만들개.indexOf('rules.ai_read_tally');
  assert.ok(자리 > 0, 'ai_read_tally 규칙을 못 찾았습니다');
  const 칸 = 만들개.slice(자리, 만들개.indexOf('};', 자리));
  /* $ymd 가 «아무 글자»를 받으므로 2026-09 도 2026-09-08 도 같이 들어간다.
     ⚠ 날짜 꼴을 못 박는 규칙을 넣지 «말 것» — 그러면 달 셈이 서버에서 조용히 막힌다. */
  assert.match(칸, /\$ymd/, '$ymd 자리표가 없습니다');
  assert.match(칸, /vision:/, 'vision 칸이 없습니다');
  assert.match(칸, /'\.write':\s*false/,
    '★ 브라우저가 셈을 쓸 수 있게 열려 있습니다 — 몫을 스스로 되돌릴 수 있게 됩니다');
});

/* ══════ ④ 화면도 같은 숫자를 본다 ═════════════════════════════════════════ */

test('★ 화면이 서버와 «같은» 달 몫을 말한다', () => {
  const app = fs.readFileSync(path.join(R, 'pu-photos.html'), 'utf8');
  const m = app.match(/const VISION_FREE_MONTH = (\d+);/);
  assert.ok(m, '화면에 달 몫 값이 없습니다');
  assert.equal(Number(m[1]), DR.VISION_FREE_MONTH,
    '★ 화면과 서버가 다른 몫을 말합니다 — 화면은 남았다는데 서버가 막습니다');
});

test('화면은 달 셈을 «같은 표»에서 읽는다 (읽는 함수를 새로 만들지 않는다)', () => {
  const app = stripComments(fs.readFileSync(path.join(R, 'pu-photos.html'), 'utf8'));
  assert.match(app, /PuPhotoStore\.readTally\(ymd\.slice\(0, 7\)\)/,
    '★ 달 셈을 딴 길로 읽습니다 — 저장 층을 거치지 않으면 이 화면이 DB 를 직접 만지게 됩니다');
});

