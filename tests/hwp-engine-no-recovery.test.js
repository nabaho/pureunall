'use strict';
/* 한글 편집기 「문서 복구」 창 — 모든 앱에서 막기 (2026-10-03)
   ■ 무엇이었나
     rhwp studio 는 편집 중 문서를 브라우저 IndexedDB(rhwpStudioAutosave)에 몰래 남기고,
     다음에 편집기를 열 때 「문서 복구」 창으로 지난 문서를 띄운다. 편집기는 우리 앱과 같은
     주소(origin)라, 한 앱에서 열었던 남의 서류가 다른 앱·다른 기금에서 튀어나온다.
     기금관리(#1841)·경력관리는 먼저 막았고, 이번에 공용 엔진·문서관리·이알피도 막는다.
   ■ 지금
     편집기를 부르기 전에, 그리고 닫을 때 세 저장소(자동저장·최근 파일·문서 이력)를 지운다.
   node --test tests/hwp-engine-no-recovery.test.js */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const { cutFn } = require('./cut-fn');
const R = path.join(__dirname, '..');
const rd = p => fs.readFileSync(path.join(R, p), 'utf8').replace(/\r\n/g, '\n');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const ENG = strip(rd('js/pu-hwp-engine.js'));
const DBS = ['rhwpStudioAutosave', 'rhwpStudioRecent', 'rhwpStudioDocHistory'];

test('★★★ 세 저장소 이름이 실제 편집기 안에 있다 (이름이 바뀌면 지우기가 헛돈다)', () => {
  const dir = path.join(R, 'vendor/rhwp-studio/assets');
  const all = fs.readdirSync(dir).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  for (const n of DBS) assert.ok(all.includes(n), n + ' 가 편집기 안에 없습니다 — 저장소 이름이 바뀌었나요?');
});

test('★★★ 공용 엔진: 편집기를 부르기 전에 지우고, 닫을 때도 지운다', () => {
  for (const n of DBS) assert.ok(ENG.includes("'" + n + "'"), '엔진 목록에 ' + n + ' 없음');
  const f = cutFn(ENG, 'function createEditor(');
  assert.match(f, /clearStudioStores\(\)\.then\(function \(\) \{ return dynamicImport\(/, '편집기 부르기 전에 지워야 합니다');
  assert.match(f, /withClearOnDestroy\(editor\)/, 'destroy 에 지우기를 걸어야 합니다');
  assert.match(ENG, /clearStudioStores: clearStudioStores/);
});

test('★★ 엔진 clearStudioStores 가 세 저장소를 실제로 지운다 (가짜 indexedDB)', async () => {
  const deleted = [];
  const g = {
    indexedDB: { deleteDatabase(n) { deleted.push(n); const r = {}; setTimeout(() => r.onsuccess && r.onsuccess(), 0); return r; } },
    setTimeout, location: { href: 'https://example.com/a/' }, document: { baseURI: 'https://example.com/a/' },
  };
  g.window = g; g.self = g;
  new Function('window', 'self', 'globalThis', rd('js/pu-hwp-engine.js'))(g, g, g);
  const api = g.PureunHwp;
  assert.ok(api && typeof api.clearStudioStores === 'function', 'PureunHwp.clearStudioStores 없음');
  await api.clearStudioStores();
  assert.deepStrictEqual(deleted.sort(), DBS.slice().sort());
  let destroyed = 0; deleted.length = 0;
  const ed = api.withClearOnDestroy({ destroy() { destroyed++; } });
  ed.destroy();
  assert.strictEqual(destroyed, 1);
  await new Promise(r => setTimeout(r, 5));
  assert.deepStrictEqual(deleted.sort(), DBS.slice().sort(), '닫을 때 지우지 않았습니다');
});

test('★★ 문서관리 서식 편집기: 부르기 전·닫을 때 지운다', () => {
  const S = strip(rd('docs-esign.html'));
  const i = S.indexOf("import('./vendor/rhwp-editor/index.js')");
  assert.ok(i > 0);
  const before = S.slice(Math.max(0, i - 400), i);
  assert.match(before, /await PureunHwp\.clearStudioStores\(\)/, '편집기 부르기 전에 지워야 합니다');
  assert.match(S, /bg\.remove\(\);[^\n]*PureunHwp\.clearStudioStores\(\)|bg\.remove\(\)[\s\S]{0,120}PureunHwp\.clearStudioStores\(\)/, '닫을 때 지워야 합니다');
});

test('★★ 이알피 계약서 편집기: ×·닫기·바깥 누르기 모두 지운다', () => {
  const S = strip(rd('pu-erp.html'));
  assert.match(S, /var shut=function\(\)\{ overlay\.remove\(\); try\{ PureunHwp\.clearStudioStores\(\); \}catch\(e\)\{\} \};/);
  assert.match(S, /close\.onclick=function\(\)\{shut\(\);\};/, '× 단추가 지우지 않습니다');
  const i = S.indexOf('var shut=function()');
  const tail = S.slice(i, i + 1500);
  assert.match(tail, /done\.onclick=[\s\S]*shut\(\)/);
});

test('★ 경력관리: 세 저장소 모두 지운다', () => {
  const S = rd('kcareer.html');
  for (const n of DBS) assert.ok(S.includes("'" + n + "'"), 'kcareer 에 ' + n + ' 없음');
});
