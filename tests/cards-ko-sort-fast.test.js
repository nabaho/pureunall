/* ⚡ 큰 목록의 한국어 정렬 — 정렬기 «하나», 견줄 값은 «먼저 한 번» (대표 화면 2026-10-02 「처음 뜰 때 느린 까닭」)
   ★ 못 박는 것
     ① 회사 목록(coListBuild)·명함 목록(listItems)이 견줄 때마다 localeCompare(…,'ko') 로 정렬기를 새로 만들지 않는다
     ② 정렬기는 함수에 붙여 «한 번만» 만든다 · 명함 목록은 견줄 값을 먼저 뽑는다(val 을 견줄 때마다 안 부른다)
     ③ 순서는 예전과 «글자 하나까지» 같다 — 같은 이름은 원래 차례를 지킨다
   node --test tests/cards-ko-sort-fast.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cutFn } = require('./cut-fn');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').split('\r\n').join('\n');
const bare = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ');

test('★★★ ① 큰 목록 둘은 견줄 때마다 정렬기를 만들지 않는다', () => {
  for (const f of ['function coListBuild(', 'function listItems(']) {
    const b = bare(cutFn(SRC, f));
    assert.ok(!/localeCompare\([^)]*'ko'\)/.test(b), '★★★ ' + f + ' 가 견줄 때마다 한국어 정렬기를 새로 만든다');
    assert.match(b, /\._ko \|\| \([\w.]+\._ko = new Intl\.Collator\('ko'\)\)/, '★ ' + f + ' 정렬기를 한 번만 만들지 않는다');
  }
});

test('★★ ② 명함 목록은 견줄 값을 먼저 뽑는다', () => {
  const b = bare(cutFn(SRC, 'function listItems('));
  assert.match(b, /result\.map\(it=>\(\{ it, v:val\(it\) \}\)\)/, '★ 견줄 때마다 val() 을 부른다 — 담당 열이면 ErpMatch 까지 8만 번');
  assert.ok(!/const x=val\(a\),y=val\(b\)/.test(b), '★ 옛 방식이 남았다');
});

test('★★★ ③ 순서는 예전과 같다 — 같은 이름은 원래 차례', () => {
  const ko = new Intl.Collator('ko');
  const names = ['나라', '(주)가나', '가나', 'abc', 'ABC', '다라', '가나', '1234', '', '가나다', '㈜가나', 'Zeta', '하늘'];
  const rows = names.map((n, i) => ({ n, i }));
  const oldWay = rows.slice().sort((a, b) => String(a.n).localeCompare(String(b.n), 'ko'));
  const newWay = rows.map(o => ({ o, n: String(o.n) })).sort((a, b) => ko.compare(a.n, b.n)).map(x => x.o);
  assert.deepEqual(newWay.map(r => r.i), oldWay.map(r => r.i), '★★★ 정렬 순서가 달라졌다');
});
