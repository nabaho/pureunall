'use strict';
/* 메일함 📁 에서 온 «이 한 건을 열어 달라» (대표 지시 2026-09-30 「1번」)
   pu-erp.html?open=consulting:<id>#menu=biz/consulting

   지키는 것
   ① 주소에서 갈래·번호를 읽는다 — 사건·컨설팅만, 모르는 갈래는 버린다
   ② 읽자마자 주소에서 지운다 — 새로고침할 때마다 그 건이 다시 뜨지 않게, 다른 값은 그대로
   ③ 그 갈래 화면에서만 연다 · 목록이 늦게 와도 연다 · 지운 건은 안 연다 · 한 번만 연다
   ④ 끝내 못 찾으면 알린다 — 「눌렀는데 아무 일도 없다」를 만들지 않는다
   ⑤ 사건관리·컨설팅관리 «둘 다»에 걸려 있다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const erp = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const strip = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, ' ');

function box() {
  const ctx = { String, Number, Date, RegExp, decodeURIComponent, JSON };
  vm.createContext(ctx);
  ['erpOpenRecFromUrl', 'erpStripOpenParam', 'erpFindOpenRec']
    .forEach((n) => vm.runInContext(sliceFn(erp, 'function ' + n + '('), ctx));
  return ctx;
}

test('★★★ 주소에서 갈래·번호를 읽는다', () => {
  const c = box();
  const r = c.erpOpenRecFromUrl('?open=consulting:cons%207%2F%EA%B0%80&opent=123', 5);
  assert.equal(r.kind, 'consulting');
  assert.equal(r.id, 'cons 7/가', '★★ 번호를 풀지 않습니다(한글·빗금이 섞인 번호가 안 맞습니다)');
  assert.equal(r.at, 5);
  assert.equal(c.erpOpenRecFromUrl('?sso=1&open=case:s9', 1).kind, 'case');
});

test('★★★ 모르는 갈래·빈 번호·깨진 글자는 버린다', () => {
  const c = box();
  assert.equal(c.erpOpenRecFromUrl('?open=fund:f1', 1), null, '★★★ 기금을 받아 엉뚱한 화면에서 창을 엽니다');
  assert.equal(c.erpOpenRecFromUrl('?open=consulting:', 1), null);
  assert.equal(c.erpOpenRecFromUrl('?open=consulting:%E0%A4%A', 1), null);
  assert.equal(c.erpOpenRecFromUrl('', 1), null);
  assert.equal(c.erpOpenRecFromUrl('?fixsync=1', 1), null);
});

test('★★★ 읽은 뒤 주소에서 지운다 — 다른 값(sso 등)은 그대로 둔다', () => {
  const c = box();
  assert.equal(c.erpStripOpenParam('?open=case:s9&opent=12'), '');
  assert.equal(c.erpStripOpenParam('?sso=1&open=case:s9&opent=12'), '?sso=1', '★★ 포털 로그인 표시까지 지웁니다');
  assert.equal(c.erpStripOpenParam('?open=case:s9&tab=memo'), '?tab=memo');
  assert.equal(c.erpStripOpenParam(''), '');
  /* 읽는 자리 — 읽고 나서 replaceState 로 지운다 */
  const boot = strip(erp.slice(erp.indexOf('var ERP_OPEN_REC = null;'), erp.indexOf('function erpFindOpenRec(')));
  assert.match(boot, /ERP_OPEN_REC = erpOpenRecFromUrl\(location\.search/);
  assert.match(boot, /replaceState\([^)]*erpStripOpenParam\(location\.search\)[^)]*location\.hash/,
    '★★★ 주소에 남겨 둡니다 — 새로고침할 때마다 그 건이 다시 뜹니다');
});

test('★★ 지운 건은 안 연다 · 번호가 글자든 숫자든 맞춘다', () => {
  const c = box();
  const list = [{ id: 7, title: '가' }, { id: 'x', _deleted: true }];
  assert.equal(c.erpFindOpenRec(list, { id: '7' }).title, '가');
  assert.equal(c.erpFindOpenRec(list, { id: 'x' }), null, '★★ 휴지통의 건을 엽니다');
  assert.equal(c.erpFindOpenRec(list, null), null);
});

/* 훅을 가짜 useEffect 로 돌린다 — 넘긴 값이 바뀔 때만 다시 돈다 */
function hookBox(want) {
  const ctx = { String, Number, Date, RegExp, JSON, setTimeout: (f) => { ctx._timer = f; return 1; }, clearTimeout: () => {} };
  ctx.showToast = (t) => { ctx._toast = t; };
  const effects = [];
  ctx.useEffect = (fn, deps) => { effects.push({ fn, deps }); };
  vm.createContext(ctx);
  vm.runInContext('var ERP_OPEN_TTL = 60000; var ERP_OPEN_REC = null;', ctx);
  ['erpFindOpenRec', 'useErpOpenRec'].forEach((n) => vm.runInContext(sliceFn(erp, 'function ' + n + '('), ctx));
  vm.runInContext('ERP_OPEN_REC = ' + JSON.stringify(want) + ';', ctx);
  ctx.run = (kind, list) => {
    const opened = [];
    effects.length = 0;
    ctx.useErpOpenRec(kind, list, (r) => opened.push(r.title));
    effects.forEach((e) => e.fn());
    return opened;
  };
  ctx.left = () => vm.runInContext('ERP_OPEN_REC', ctx);
  return ctx;
}
const NOW = () => Date.now();

test('★★★ 그 갈래 화면에서 그 건을 연다 — 한 번만', () => {
  const c = hookBox({ kind: 'consulting', id: 'c1', at: NOW() });
  assert.deepEqual(c.run('consulting', [{ id: 'c1', title: '성과급' }]).slice(), ['성과급'], '★★★ 상세 창을 안 엽니다');
  assert.equal(c.left(), null, '★★ 연 뒤에도 쪽지를 들고 있습니다');
  assert.deepEqual(c.run('consulting', [{ id: 'c1', title: '성과급' }]).slice(), [], '★★ 목록이 바뀔 때마다 또 엽니다');
});

test('★★★ 다른 갈래 화면에서는 안 연다 — 기금관리가 컨설팅 번호로 창을 띄우지 않는다', () => {
  const c = hookBox({ kind: 'consulting', id: 'c1', at: NOW() });
  assert.deepEqual(c.run('fund', [{ id: 'c1', title: '기금' }]).slice(), []);
  assert.ok(c.left(), '★★ 남의 화면이 쪽지를 버립니다 — 컨설팅관리로 가도 안 열립니다');
});

test('★★★ 목록이 늦게 와도 연다 — 처음엔 비어 있다가 받은 뒤에', () => {
  const c = hookBox({ kind: 'case', id: 's9', at: NOW() });
  assert.deepEqual(c.run('case', []).slice(), []);
  assert.ok(c.left(), '★★★ 목록이 비었다고 쪽지를 버립니다');
  assert.deepEqual(c.run('case', [{ id: 's9', title: '부당해고' }]).slice(), ['부당해고']);
});

test('★★ 오래된 쪽지는 안 연다', () => {
  const c = hookBox({ kind: 'case', id: 's9', at: NOW() - 10 * 60 * 1000 });
  assert.deepEqual(c.run('case', [{ id: 's9', title: '부당해고' }]).slice(), []);
});

test('★★★ 끝내 못 찾으면 알리고 버린다', () => {
  const c = hookBox({ kind: 'case', id: 'gone', at: NOW() });
  c.run('case', [{ id: 's9', title: '부당해고' }]);
  assert.equal(typeof c._timer, 'function', '★★ 못 찾을 때를 대비하지 않습니다');
  c._timer();
  assert.match(String(c._toast || ''), /찾지 못했습니다/, '★★★ 눌렀는데 아무 일도 없습니다');
  assert.equal(c.left(), null);
});

test('★★★ 사건관리·컨설팅관리 «둘 다»에 걸려 있다 — 상세 창을 여는 그 손잡이로', () => {
  /* 두 화면은 수천 줄이라 몸통 «앞머리»만 본다 — 훅은 맨 위에서 부른다(훅 규칙) */
  const head = (n) => { const i = erp.indexOf(n); assert.ok(i >= 0, n); return strip(erp.slice(i, i + 12000)); };
  const cs = head('function CaseManagement(');
  assert.match(cs, /useErpOpenRec\('case',\s*cases,\s*setDetailModal\)/, '★★★ 사건관리가 안 받습니다');
  const pj = head('function ProjectManagementShared(');
  assert.match(pj, /useErpOpenRec\(props\.sourceKind,\s*items,\s*setDetailModal\)/, '★★★ 컨설팅관리가 안 받습니다');
  assert.match(strip(sliceFn(erp, 'function ConsultingManagement(')), /sourceKind:\s*'consulting'/);
});
