/* 정부지원금 화면(pu-govaid.html) — 문법·싣는 순서·쓰는 자리·☐+번호 (2026-10-11)
   ★ 주석은 걷고 본다 — 주석에 적힌 글자로 통과하지 않게. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-govaid.html'), 'utf8');
const NOC = SRC.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('인라인 스크립트가 문법에 맞다', () => {
  const blocks = [...NOC.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(blocks.length >= 1);
  blocks.forEach((b, i) => assert.doesNotThrow(() => new vm.Script(b), 'inline script #' + i));
});

test('엔진·묶음·씨앗 모듈을 캐시 번호와 함께 싣는다', () => {
  ['pu-govaid-match', 'pu-govaid-view', 'pu-govaid-seed'].forEach((n) =>
    assert.match(NOC, new RegExp('src="js/' + n + '\\.js\\?v=\\d+"'), n));
});

test('저장 관문을 Firebase 초기화 전에 싣고, 강제 모드 관문으로만 쓴다', () => {
  const gw = NOC.indexOf('js/pu-ontology-write.js'), init = NOC.indexOf('initializeApp(');
  assert.ok(gw > 0 && init > gw, '관문이 초기화보다 먼저여야 한다');
  assert.match(NOC, /createGateway\(\{\s*mode:'enforce'/);
  assert.doesNotMatch(NOC, /fbDb\.ref\([^)]*\)\s*\.(set|update|push|remove|transaction)\(/, '관문을 건너뛴 쓰기');
});

test('쓰는 자리는 govaid 아래 네 곳뿐이다', () => {
  const refs = [...NOC.matchAll(/gate\.(?:save|remove)\(fbDb\.ref\('([^']+)'/g)].map((m) => m[1]);
  assert.ok(refs.length >= 1);
  refs.forEach((r) => assert.match(r, /^govaid\/(programs|prospects|extras|reviews)\//, r));
});

test('자료 표는 맨 왼쪽 ☐ + 번호 — 보기 전용 표만 예외(data-viewonly)', () => {
  const lines = NOC.split('\n').filter((l) => l.indexOf('<table') >= 0);
  assert.ok(lines.length >= 1);
  lines.forEach((l) => assert.ok((/data-all=/.test(l) && /번호/.test(l)) || /data-viewonly/.test(l), l.trim().slice(0, 140)));
});

test('예비 고객은 업체관리 원장(data/companies)에 쓰지 않는다 — 읽기만', () => {
  assert.doesNotMatch(NOC, /gate\.(?:save|remove)\(fbDb\.ref\('data\//);
});
