'use strict';
// 경력관리 «📥 스캔 가져오기» — 실행: node --test tests/kcareer-scaninbox.test.js
// 대표 지시 2026-11-28 「경력 관리 앱 스캔하면 가져오기도 만들어줘」
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SI = require('../js/kcareer-scaninbox.js');
const html = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');

/* 화면 쪽 덩어리 — renderHomeScanInbox 까지 */
function block() {
  const a = html.indexOf('var _scanInboxDir=null');
  const b = html.indexOf('function navTile(id){', a);
  assert.ok(a > 0 && b > a, '스캔 가져오기 덩어리를 찾지 못했다');
  return html.slice(a, b);
}

test('갈래 폴더 이름은 PC «푸른 스캔 도우미»가 만드는 이름과 같다', () => {
  // 검사고정-허용: 폴더 이름 자체가 PC 도우미(scan_watcher.py CAREER_RULES)와의 약속이다 — 한쪽만 바뀌면 그 갈래가 영영 안 들어온다
  for (const c of ['위촉·위임', '자격·수료·표창', '경력증명', '실적', '회의']) assert.ok(SI.CATEGORIES.includes(c), c);
  assert.equal(SI.INBOX_PREFIX, '경력관리_'); // 검사고정-허용: PC 도우미가 만드는 폴더 «경력관리_<이름>» 의 머리말
});

test('갈래마다 경력관리의 «있는» 쪽으로 간다 — 모르는 갈래는 넣지 않는다', () => {
  assert.equal(SI.pageFor('위촉·위임', '261128_권형하_위촉장(시민청렴패널단)_근로복지공단 서산지사.pdf'), 'wiccok');
  assert.equal(SI.pageFor('자격·수료·표창', '261128_권형하_표창장_천안시.pdf'), 'award');
  assert.equal(SI.pageFor('자격·수료·표창', '261128_권형하_자격증_고용노동부.pdf'), 'license');
  assert.equal(SI.pageFor('자격·수료·표창', '261128_권형하_수료증_한국산업인력공단.pdf'), 'complete');
  assert.equal(SI.pageFor('경력증명', 'x.pdf'), 'certdoc');
  assert.equal(SI.pageFor('실적', '261128_권형하_강의확인서.pdf'), 'lecture');
  assert.equal(SI.pageFor('실적', '261128_권형하_컨설팅 실적증명서.pdf'), 'consult');
  assert.equal(SI.pageFor('실적', '261128_권형하_활동확인서.pdf'), 'etc');
  assert.equal(SI.pageFor('회의', 'x.pdf'), 'meetfee');
  assert.equal(SI.pageFor('기타', 'x.pdf'), null);
  assert.equal(SI.pageFor('', 'x.pdf'), null);
});

test('넣는 쪽(certdoc 빼고)은 모두 경력관리 OCR 판독 문구가 있는 쪽이다', () => {
  const pages = new Set();
  for (const c of SI.CATEGORIES) for (const n of ['a.pdf', '표창.pdf', '자격증.pdf', '강의.pdf', '컨설팅.pdf']) pages.add(SI.pageFor(c, n));
  pages.delete('certdoc');
  const start = html.indexOf('const PAGE_OCR_PROMPT={');
  assert.ok(start > 0);
  const prompts = html.slice(start, start + 20000);
  for (const p of pages) assert.match(prompts, new RegExp('\\n\\s*' + p + '\\s*:'), p + ' 쪽 판독 문구가 없다');
});

test('고른 폴더가 Scan 이든 경력관리_… 이든 받은편지함을 찾는다', () => {
  assert.deepEqual(SI.resolveInbox('경력관리_권형하', ['위촉·위임']), []);
  assert.deepEqual(SI.resolveInbox('아무폴더', ['실적', '회의']), []);
  assert.deepEqual(SI.resolveInbox('Scan', ['ScanFiles', '경력관리_권형하', '과거스켄']), ['경력관리_권형하']);
  assert.equal(SI.resolveInbox('Scan', ['ScanFiles']), null);
});

test('새 것만 고른다 — 가져온 것·빈 파일·잠금 파일·받지 않는 확장자는 뺀다', () => {
  const f = (category, name, size) => ({ category, name, size, lastModified: 1 });
  const files = [f('위촉·위임', 'a.pdf', 10), f('위촉·위임', 'b.pdf', 0), f('위촉·위임', '~$c.pdf', 10),
    f('위촉·위임', 'd.txt', 10), f('기타', 'e.pdf', 10), f('회의', 'g.jpg', 10)];
  const known = {}; known[SI.keyOf(files[5])] = 1;
  assert.deepEqual(SI.pickNew(files, known).map(x => x.name), ['a.pdf']);
  // 같은 이름이라도 크기·시각이 다르면(새로 스캔해 덮어쓴 것) 다시 고른다
  assert.equal(SI.pickNew([f('회의', 'g.jpg', 11)], known).length, 1);
});

test('쪽마다 묶는다 — ocrDrop 은 한 번에 한 쪽으로만 넣는다', () => {
  const f = (category, name) => ({ category, name, size: 1, lastModified: 1 });
  const g = SI.groupByPage([f('위촉·위임', 'a.pdf'), f('회의', 'b.pdf'), f('위촉·위임', 'c.pdf')]);
  assert.deepEqual(g.map(x => x.page), ['wiccok', 'meetfee']);
  assert.deepEqual(g[0].files.map(x => x.name), ['a.pdf', 'c.pdf']);
});

test('화면: 모듈을 싣고 홈에 자리를 두고 홈을 그릴 때 함께 그린다', () => {
  assert.match(html, /<script src="js\/kcareer-scaninbox\.js\?v=\d+"><\/script>/);
  assert.match(html, /<div id="homeScanInbox"><\/div>/);
  assert.match(html, /_safe\(renderHomeBizDue\);\s*\n?\s*_safe\(function\(\)\{ renderHomeScanInbox\(\)/);
});

test('스캔 폴더는 읽기 전용 — 파일을 쓰거나 지우는 코드가 없다', () => {
  const b = block();
  assert.match(b, /showDirectoryPicker\(\{id:'kcareer-scaninbox', mode:'read'\}\)/);
  assert.doesNotMatch(b, /mode:'readwrite'\}\)|createWritable|removeEntry|\.remove\(\)|\.move\(/);
});

test('넣는 길은 이미 있는 OCR 등록(ocrDrop)과 서류 보관 창 — 새 저장 길을 만들지 않는다', () => {
  const b = block();
  assert.match(b, /await ocrDrop\(/);
  assert.match(b, /openDocSaveModal\('certdoc','existing'/);
  assert.doesNotMatch(b, /fbDb\.ref|firebase\.database\(|\.set\(|\.update\(/);
});

test('판독을 못 하는 상태면 «가져옴»으로 적기 전에 멈춘다', () => {
  const b = block();
  const imp = b.slice(b.indexOf('async function scanInboxImport'));
  const guard = imp.search(/!getApiKey\(\) && !getGVisionKey\(\) && !aiReady\(\)/);
  const mark = imp.indexOf('scanInboxMark(');
  assert.ok(guard > 0, '판독 가능 여부를 보지 않는다');
  assert.ok(mark > guard, '«가져옴» 표시가 판독 확인보다 앞에 있다');
  // 권한도 표시보다 먼저 확인한다
  assert.ok(imp.indexOf('fsEnsurePermission(h)') < mark);
});

test('폴더 열기가 없는 브라우저(폰)에서는 띠를 그리지 않는다', () => {
  const b = block();
  const r = b.slice(b.indexOf('async function renderHomeScanInbox'));
  assert.match(r, /if\(!fsSupported\(\)[^)]*\)\{ box\.innerHTML=''; return; \}/);
});
