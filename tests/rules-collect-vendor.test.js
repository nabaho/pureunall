/* 서버가 쓰는 kordoc 은 브라우저와 «같은 바이트»여야 한다 — 가림 규칙이 두 벌로 갈라지면
   서고(브라우저)와 모은 자료(서버)가 다른 것을 가린다. 고치면 scripts/sync-functions-kordoc.js 를 돌린다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const R = path.join(__dirname, '..');
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(path.join(R, p))).digest('hex');

test('서버 사본이 원본과 같은 바이트다', () => {
  assert.equal(sha('functions/vendor/kordoc/kordoc.browser.min.js'), sha('vendor/kordoc/kordoc.browser.min.js'),
    '★ 묶음이 갈라졌다 — node scripts/sync-functions-kordoc.js');
  assert.equal(sha('functions/vendor/kordoc/pu-kordoc-text.js'), sha('js/pu-kordoc-text.js'),
    '★ 가림 규칙이 갈라졌다 — node scripts/sync-functions-kordoc.js');
  assert.ok(fs.existsSync(path.join(R, 'functions/vendor/kordoc/LICENSE')), 'MIT 고지문이 없다');
});

test('node 에서 사본을 실어 읽을 수 있다', async () => {
  const { pathToFileURL } = require('node:url');
  const T = require(path.join(R, 'functions/vendor/kordoc/pu-kordoc-text.js'));
  T._use(await import(pathToFileURL(path.join(R, 'functions/vendor/kordoc/kordoc.browser.min.js')).href));
  const H = require(path.join(R, 'hwpx_gen.js'));
  const r = await T.read(H.build(H.para('제1조(목적) 이 규칙은 가나상사 사원의 근로조건을 정한다.')));
  assert.ok(r && /제1조/.test(r.text));
});
