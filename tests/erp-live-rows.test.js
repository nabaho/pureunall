/* 휴지통 딱지(_deleted) 붙은 줄은 «세기·알림·목록»에 안 섞는다 (2026-10-07)
   TrashBin.remove 는 줄을 지우지 않고 딱지만 붙인다. dbGet 을 그대로 읽던 자리들이
   휴지통에 넣은 기타사업·컨설팅·기금을 미수금 알림·미입금 목록·검색·업체 찾기에 그대로 세었다
   (2026-10-05 이음센터-2026-001 두 줄 — #2026 은 기타사업 표 하나만 고쳤다).
   이 검사는 «규칙»을 본다 — 고칠 자리 개수나 줄 번호는 박지 않는다. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const raw = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
const src = raw;
// 잘라 낸 몸통에서만 주석을 걷는다 — 파일 통째로 걷으면 글자열 속 '/*' 에 함수가 통째 먹힌다
function noComments(s) { return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); }
function cutFn(h) { const i = src.indexOf(h); assert.ok(i >= 0, h + ' 를 못 찾음'); let j = src.indexOf('{', i), d = 0;
  for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) break; } return noComments(src.slice(i, j + 1)); }

// 휴지통이 있는 업무 표
const TRASH_STORES = ['cases', 'consultings', 'funds', 'other_projects'];
const RAW_READ = new RegExp("dbGet\\(\\s*['\"](" + TRASH_STORES.join('|') + ")['\"]");

function box() {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(cutFn('function erpLiveRows(') + cutFn('function dbGetLive('), ctx);
  return ctx;
}

test('erpLiveRows 는 휴지통 딱지 줄만 뺀다', () => {
  const ctx = box();
  const out = ctx.erpLiveRows([{ id: 'a' }, { id: 'b', _deleted: true }, null, { id: 'c', _deleted: false }]);
  const ids = Array.from(out).filter(Boolean).map(x => x.id);
  assert.ok(ids.includes('a') && ids.includes('c'), '살아 있는 줄은 남는다');
  assert.ok(!ids.includes('b'), '휴지통 줄은 빠진다');
});

test('딱지 줄이 없으면 «같은 배열»을 그대로 준다 — === 비교를 깨지 않게', () => {
  const ctx = box();
  const arr = [{ id: 'a' }, { id: 'b' }];
  vm.runInContext('var __a = ' + JSON.stringify(arr) + ';', ctx);
  assert.equal(vm.runInContext('erpLiveRows(__a) === __a', ctx), true);
  assert.equal(ctx.erpLiveRows(null), null, '배열이 아니면 그대로');
});

test('dbGetLive 는 dbGet 을 읽어 휴지통 줄을 뺀다', () => {
  const ctx = box();
  ctx.dbGet = function (k, def) { return k === 'other_projects' ? [{ id: 'x', _deleted: true }, { id: 'y' }] : def; };
  const out = ctx.dbGetLive('other_projects');
  assert.ok(Array.from(out).every(r => r._deleted !== true));
  assert.ok(Array.isArray(ctx.dbGetLive('없는표')), '없는 표도 빈 배열');
});

test('★ 돈·알림·검색·업체 찾기 화면은 휴지통 표를 dbGet 으로 바로 읽지 않는다', () => {
  // 미수금 알림 · 미수금관리 · 입금 대기 · 전체 검색 · 업체 찾기 · 업체 상세 · 넘길 일
  ['function NotificationCenter(', 'function FinanceReceivable(', 'function FinanceTxn(',
   'function GlobalSearch(', 'function searchPastCompanies(', 'function _pastCoRecord(',
   'function CompanyDetailModal(', 'function rtHeld('].forEach(function (h) {
    const body = cutFn(h);
    assert.doesNotMatch(body, RAW_READ, h + ' 이 휴지통 표를 dbGet 으로 바로 읽는다 → dbGetLive 를 쓸 것');
  });
});

test('★ 휴지통 화면(TrashBin)은 그대로 dbGet — 휴지통 줄을 봐야 한다', () => {
  const tb = noComments(src.slice(src.indexOf('var TrashBin = {'), src.indexOf('function erpLiveRows(')));
  assert.match(tb, /list:\s*function\(storageKey\)\{[\s\S]*?dbGet\(storageKey/, 'TrashBin.list 는 날것을 읽는다');
  assert.doesNotMatch(tb, /dbGetLive/, '휴지통 쪽에서 dbGetLive 를 쓰면 휴지통이 빈다');
});

test('★ 휴지통 표를 _FB_HIDE_DELETED 에 넣지 않는다 — 넣으면 휴지통 화면이 텅 빈다', () => {
  const m = src.match(/var _FB_HIDE_DELETED = \{([^}]*)\}/);
  assert.ok(m, '_FB_HIDE_DELETED 를 못 찾음');
  TRASH_STORES.concat(['contracts', 'companies']).forEach(function (k) {
    assert.doesNotMatch(m[1], new RegExp('\\b' + k + '\\s*:'), k + ' 가 _FB_HIDE_DELETED 에 들어갔다');
  });
});

test('★ 중복 제거는 휴지통 줄과 «겨루지» 않는다 — 살아 있는 줄을 지우지 않게', () => {
  const body = cutFn('function removeDuplicates(');
  assert.match(body, /_deleted === true\)\{ bestIdx\[[^\]]+\] = idx; return; \}/,
    '휴지통 줄은 따로 남기고 그룹 겨루기에서 빠져야 한다');
});
