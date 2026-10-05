/* 가림의 «마지막 그물» — 파일째 가리기가 놓친 번호를 다시 읽은 글에서 한 번 더 찾는다 (대표 「추천대로」 2026-10-05)

   ■ 무엇이 있었나
     모은 자료 전수 재검사가 규칙본문 1건에서 «유선 전화번호» 5곳(담당자·부담당자·팩스)을 찾았다.
     kordoc 의 글 가림(redactText)은 유선 번호도 가린다(031-●●●-4567) — 그런데 한글 «파일째» 가리기가
     표 칸 속 번호 몇 개를 놓쳤고, 그 파일을 다시 읽은 글이 그대로 담겼다. 「남은 것」 셈(residual)은
     kordoc 가 파일 안에서 스스로 센 것뿐이라, 다시 읽은 글을 «다시 훑지는» 않았다.
   ■ 지키는 규칙
     ① 다시 읽은 글을 같은 규칙으로 한 번 더 훑는다 — 걸리면 그 글을 가려 쓰고(leak 에 센다)
     ② 그때는 «파일을 믿지 않는다» — data 를 버린다(가린 파일에 번호가 남아 있다는 뜻이다). 글만 담는다
     ③ 서버 수집(redactOne)도 그것을 따른다 — 원본 파일을 내보내지 않고, 보류하지도 않고 «글만»
   실행: node --test tests/kordoc-redact-leak.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const H = require('../hwpx_gen.js');

const R = path.join(__dirname, '..');
async function setup() {
  delete require.cache[require.resolve('../functions/vendor/kordoc/pu-kordoc-text.js')];
  const T = require('../functions/vendor/kordoc/pu-kordoc-text.js');
  const real = await import(pathToFileURL(path.join(R, 'functions/vendor/kordoc/kordoc.browser.min.mjs')).href);
  /* 파일째 가리기가 «아무것도 못 찾은» 꼴 — 표 칸 속 번호를 놓친 실제 일을 흉내 낸다. 글 가림·읽기는 진짜 */
  const missed = Object.assign({}, real, {
    redactDocument: async () => ({ format: 'hwpx', markdownHits: [], fileHits: [], residual: [], unscanned: [], data: null, changed: false }),
  });
  T._use(missed);
  return T;
}
const LINE = '제30조(영상정보 처리기기) 담당자 연락처 031-123-4567, 팩스 041-555-1234';

test('★★★ 파일째 가리기가 놓친 유선 번호를 다시 훑어 가린다 — 파일은 버리고 글만', async () => {
  const T = await setup();
  const r = await T.redactFile(H.build(H.para(LINE)), LINE);
  assert.ok(r.leak >= 2, '★★★ 놓친 번호를 다시 안 훑었다: leak=' + r.leak);
  assert.doesNotMatch(r.text, /123-4567|555-1234/, '★★★ 가린 글에 번호가 그대로 남았다');
  assert.match(r.text, /●/);
  assert.equal(r.data, null, '★★ 번호가 남은 파일을 내보낸다');
  assert.equal(r.fileOk, false);
  assert.ok((r.count.phone || 0) >= 2, '가린 셈에 더해져야 화면에 보인다');
});

test('★★ 서버 수집(redactOne)은 «글만» 담는다 — 원본도 가린 파일도 안 내보내고, 보류하지도 않는다', async () => {
  const T = await setup();
  const X = require('../functions/rules-collect-redact.js');
  const r = await X.redactOne(H.build(H.para(LINE)), 'hwpx', { read: T.read, redactFile: T.redactFile });
  assert.equal(r.ok, true, '★★ 다시 가려 담을 수 있는데 보류했다: ' + r.holdWhy);
  assert.equal(r.data, null, '★★★ 번호가 남은 파일(원본)을 내보낸다');
  assert.doesNotMatch(r.text, /123-4567/);
});

test('놓친 것이 없으면 그대로 — 파일도 그대로 둔다', async () => {
  const T = require('../functions/vendor/kordoc/pu-kordoc-text.js');
  const real = await import(pathToFileURL(path.join(R, 'functions/vendor/kordoc/kordoc.browser.min.mjs')).href);
  T._use(real);
  const r = await T.redactFile(H.build(H.para('제1조(목적) 이 규칙은 근로조건을 정한다.')), '제1조(목적) 이 규칙은 근로조건을 정한다.');
  assert.ok(!r.leak);
  assert.notEqual(r.fileOk, false);
});
