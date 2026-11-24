'use strict';
/* 기업정보함 명함 목록 — 사진 없는 명함은 썸네일에 첫 글자만 찍지 않고 전체 이름을 정확히 표시한다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8');

function extractFn(name) {
  const sig = 'function ' + name + '(';
  const start = src.indexOf(sig);
  assert.ok(start > 0, name + ' 함수를 찾지 못했습니다');
  let i = src.indexOf('{', start);
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(name + ' 함수 끝을 찾지 못했습니다');
}

function loadThumbTextHtml() {
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const ctx = vm.createContext({ esc });
  vm.runInContext(extractFn('thumbTextHtml'), ctx);
  return ctx.thumbTextHtml;
}

test('① thumbTextHtml 은 사진 없는 명함 이름을 첫 글자로 자르지 않고 전체 표시한다', () => {
  const fn = loadThumbTextHtml();
  ['가나다', '점검과장', '라마바사', '테스트대표'].forEach((nm) => {
    const h = fn(nm);
    assert.ok(h.includes('>' + nm + '<'), nm + ' 전체 이름이 들어가야 합니다: ' + h);
    assert.match(h, /class="thumb-tx"/);
  });
});

test('② 길이에 따라 sm/xs 클래스를 부여하고 긴 이름·상호도 절단 없이 표시한다', () => {
  const fn = loadThumbTextHtml();
  const mid = '홍길동수석노무사';
  const longName = '(주)가나다라마바사아자차카타파하';
  const hMid = fn(mid);
  const hLong = fn(longName);
  assert.match(hMid, /class="thumb-tx sm"/);
  assert.ok(hMid.includes(mid));
  assert.match(hLong, /class="thumb-tx xs"/);
  assert.ok(hLong.includes(longName));
  assert.equal(fn('   '), '<span class="thumb-tx">?</span>');
  assert.equal(fn('<script>'), '<span class="thumb-tx sm">&lt;script&gt;</span>');
});

test('③ rowHtml 과 thumbFill 이 전체 이름 및 no-img 토글을 배선한다', () => {
  const rowSrc = extractFn('rowHtml');
  assert.ok(!/name\.charAt\(0\)/.test(rowSrc), 'rowHtml 에 첫 글자(name.charAt(0))가 남아 있습니다');
  assert.match(rowSrc, /thumbTextHtml\(name\)/, 'rowHtml 이 thumbTextHtml(name) 을 부르지 않습니다');
  assert.match(rowSrc, /class="thumb\$\{thumbSrc\?'':' no-img'\}"/, 'rowHtml 이 no-img 클래스를 붙이지 않습니다');

  const fillSrc = extractFn('thumbFill');
  assert.match(fillSrc, /classList\.remove\(['"]no-img['"]\)/, 'thumbFill 이 사진 로드 후 no-img 를 떼지 않습니다');
});

test('④ .thumb.no-img 및 .thumb-tx 스타일이 760px 이하 모바일을 포함해 정의돼 있다', () => {
  assert.match(src, /\.thumb\.no-img\{[^}]*height:\s*auto[^}]*min-height:\s*88px/);
  assert.match(src, /\.thumb-tx\{[^}]*white-space:\s*normal/);
  assert.match(src, /@media\(max-width:760px\)[\s\S]*\.thumb\.no-img\{[^}]*min-height:\s*63px/);
});
