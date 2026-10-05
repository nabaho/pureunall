/* 🏢 사업장 목록 — 담당자로 거르기 (rules-v2-sites 가 남긴 일 · 대표 「다음」 2026-10-05). 이름은 가짜만.
   거래처마다 업체관리의 주담당(managerMain)·부담당(managerSubs)이 «사번»으로 있다(377곳 중 352곳).
   ★ 지키는 규칙
     ① 담당은 사번으로 거른다 — 이름으로 맞추지 않는다(같은 이름이 둘이면 섞인다)
     ② 부담당도 내 담당이다 — 주담당만 보면 같이 맡은 곳이 빠진다
     ③ 「내 담당」은 로그인한 사람의 사번 — 사번을 모르면(명부에 없음) 그 고르개를 안 보인다
     ④ 담당이 비어 있는 거래처(25곳)는 「담당 없음」으로 따로 고른다 — 빠지면 아무도 안 본다
     ⑤ 표에 담당 이름 칸 — 이름은 명부(data/user_dir)에서, 명부에 없으면 사번 그대로 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
global.PuRulesV2Order = require('../js/rules-v2/lib-order.js');
const L = require('../js/rules-v2/lib-sites.js');
global.PuRulesV2Sites = L;
global.PuRulesV2Lib = require('../js/rules-v2/view-library.js');
const V = require('../js/rules-v2/view-sites.js');

const CO = [
  { id: 'c1', name: '가나상사', status: 'active', managerMain: 'P-001', managerSubs: ['A-002'] },
  { id: 'c2', name: '나다물산', status: 'active', managerMain: 'A-002' },
  { id: 'c3', name: '라마전자', status: 'active', managerMain: '' },
  { id: 'c4', name: '바사식품', status: 'active', managerMain: 'P-003' },
];
const DATA = { docs: {}, human: {}, rounds: {} };
const STAFF = { 'P-001': '홍길동', 'A-002': '김철수', 'P-003': '이영희' };

test('① 줄에 담당 사번 — 주·부', () => {
  const rows = L.model(DATA, CO);
  const c1 = rows.find((r) => r.id === 'c1');
  assert.equal(c1.mgr, 'P-001');
  assert.deepEqual(c1.subs, ['A-002']);
});

test('②④ 담당으로 거르기 — 부담당도 들고, 「담당 없음」은 따로', () => {
  const rows = L.model(DATA, CO);
  const ids = (who) => L.filter(rows, 'all', '', who).map((r) => r.id).sort();
  assert.deepEqual(ids('A-002'), ['c1', 'c2'], '★ 부담당으로 맡은 곳이 빠졌다');
  assert.deepEqual(ids('P-001'), ['c1']);
  assert.deepEqual(ids('-'), ['c3'], '담당 없는 거래처를 못 고른다');
  assert.equal(ids('').length, 4, '「모두」인데 걸렀다');
});

test('담당 셈 — 고르개에 곳 수', () => {
  const c = L.ownerCounts(L.model(DATA, CO));
  assert.equal(c['A-002'], 2);
  assert.equal(c['P-001'], 1);
  assert.equal(c['-'], 1);
});

test('③ 「내 담당」은 사번을 알 때만 · 담당자 이름은 명부에서', () => {
  const st = (o) => Object.assign({ data: DATA, companies: CO, sites: { f: 'all', q: '', sel: '', who: '' }, staff: STAFF }, o);
  const rows = L.model(DATA, CO);
  const h = V.filterHtml(st({ me: 'A-002' }), L.counts(rows), L.ownerCounts(rows));
  assert.match(h, /data-role="sm"/);
  assert.match(h, /<option value="A-002"[^>]*>내 담당/);
  assert.match(h, /<option value="P-003"[^>]*>이영희/);
  assert.match(h, /<option value="-"[^>]*>담당 없음/);
  const h2 = V.filterHtml(st({ me: '' }), L.counts(rows), L.ownerCounts(rows));
  assert.doesNotMatch(h2, /내 담당/, '사번을 모르는데 「내 담당」을 보인다');
});

test('⑤ 표에 담당 칸 — 명부 이름, 없으면 사번', () => {
  const rows = L.model(DATA, CO);
  const st = { data: DATA, companies: CO, sites: { f: 'all' }, staff: { 'P-001': '홍길동' } };
  const h = V.listHtml(st, rows);
  assert.match(h, /<th>담당<\/th>/);
  assert.match(h, /홍길동/);
  assert.match(h, /A-002/, '명부에 없는 사번을 지웠다');
});

test('화면이 명부를 읽고, 로그인한 사람의 사번을 넘기고, 고르개를 받는다', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'rules-v2.html'), 'utf8');
  assert.match(html, /data\/user_dir/);
  assert.match(html, /ST\.me\s*=/);
  assert.match(html, /\bsm:\s*function/);
});
