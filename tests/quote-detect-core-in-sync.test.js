'use strict';
/* 📨 우리 견적서·계약서 메일 감지 — 서버 사본(functions/quote-detect-core/)이 화면 원본(js/pu-quote-detect.js)과 «한 글자까지» 같다
   (견적·계약 자동화 계획 3 · 작업 1)
   ★ 서버 배포에는 js/ 가 안 올라간다 — 사본은 scripts/sync-quote-detect-core.js 가 만든다(손으로 고치지 않는다).
   ★ 다르면 화면(총괄관리자 가져오기)과 서버(감지 훅)가 서로 다른 메일을 우리 견적으로 본다.
   ★ 사본 폴더가 배포에서 빠지지 않아야 한다(functions.ignore·package.json files·.gitignore). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { 옮길것 } = require('../scripts/sync-quote-detect-core.js');

const 뿌리 = path.join(__dirname, '..');
const 읽기 = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

test('★★★ 서버 사본이 화면 원본과 같다 — 다르면 화면과 서버가 다른 메일을 우리 견적으로 본다', () => {
  assert.ok(옮길것.indexOf('pu-quote-detect.js') >= 0);
  옮길것.forEach((이름) => {
    const 사본 = path.join(뿌리, 'functions', 'quote-detect-core', 이름);
    assert.ok(fs.existsSync(사본), '사본이 없다 — node scripts/sync-quote-detect-core.js 를 돌려 주세요');
    assert.ok(읽기(path.join(뿌리, 'js', 이름)) === 읽기(사본),
      '★★★ functions/quote-detect-core/' + 이름 + ' 이 js/ 원본과 다릅니다 — 고칠 곳은 js/ 쪽, 고친 뒤 sync 를 돌리고 서버 함수를 다시 올려 주세요');
  });
});

test('서버에서 그대로 불러 쓸 수 있다(module.exports) — 사본이 단독으로 돈다', () => {
  const S = require('../functions/quote-detect-core/pu-quote-detect.js');
  assert.strictEqual(S.docOf('[푸른노무법인] 견적서 송부의 건', ['견적서_가나기관.pdf']), 'quote');
  assert.strictEqual(S.docOf('[푸른노무법인] 비교견적서 요청의 건', []), '');
});

test('배포에 사본 폴더가 빠지지 않는다 — functions.ignore 가 없고 package.json 에 files 목록이 없다 · git 이 무시하지 않는다', () => {
  const fb = JSON.parse(fs.readFileSync(path.join(뿌리, 'firebase.json'), 'utf8'));
  assert.equal(fb.functions.source, 'functions');
  assert.equal(fb.functions.ignore, undefined, 'functions.ignore 가 있으면 사본 폴더가 빠지는지 다시 봐야 한다');
  const pk = JSON.parse(fs.readFileSync(path.join(뿌리, 'functions', 'package.json'), 'utf8'));
  assert.equal(pk.files, undefined, 'package.json files 목록이 있으면 사본 폴더를 넣어야 한다');
  const ig = ['.gitignore', path.join('functions', '.gitignore')].map((f) => path.join(뿌리, f)).filter(fs.existsSync).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  assert.doesNotMatch(ig, /quote-detect-core/, '사본 폴더를 git 이 무시하면 서버에 안 올라간다');
});

test('화면 쪽도 같은 한 벌을 쓴다 — 가져오기가 PuQuoteDetect 를 불러 쓰고 따로 낱말 규칙을 두지 않는다', () => {
  const imp = 읽기(path.join(뿌리, 'js', 'pu-quote-import.js'));
  assert.match(imp, /w\.PuQuoteDetect/);
  assert.doesNotMatch(imp, /var EXCL_QUOTE\s*=|var CONTRACT\s*=|var NOT_CONTRACT\s*=/, '가져오기에 감지 낱말 규칙이 따로 남아 있다 — 한 벌(js/pu-quote-detect.js)만 써야 한다');
});
