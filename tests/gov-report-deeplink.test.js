'use strict';
/* 정부사업일정 — 컨설팅보고서 앱에서 건너오기 (#rpt=업체|사업 · #forms) (2026-10-10)
 * ★ 지키는 것: 자료가 늦게 와도 기다렸다 연다(#sc= 와 같은 15초) · 클라우드가 붙기 전에는 열지 않는다
 *   (저장본을 못 읽은 채 열면 빈 초안으로 덮을 수 있다) · 못 찾으면 그렇게 말한다 · 한 번 열면 주소에서 지운다 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'gov-consulting.html'), 'utf8');
function grab(n) {
  const i = SRC.search(new RegExp('(?:async\\s+)?function ' + n + '\\('));
  assert.ok(i >= 0, n + ' 을(를) 못 찾았다');
  let d = 0, st = false;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') { d++; st = true; }
    else if (SRC[j] === '}') { d--; if (st && !d) return SRC.slice(i, j + 1); }
  }
}

function world(o) {
  o = o || {};
  let calls = 0;
  const ctx = {
    console, String, RegExp, decodeURIComponent,
    location: { hash: o.hash || '', pathname: '/pureunall/gov-consulting.html', search: '' },
    history: { replaceState: () => { ctx.__cleared++; } }, __cleared: 0,
    FB_READY: o.ready !== false,
    getCos: () => { calls++; return calls > (o.lateBy || 0) ? [{ id: 'c1', name: '가나상사' }] : []; },
    getTypes: () => [{ id: 't1', name: '기술보호' }],
    getSession: () => (o.noSession ? null : { id: 'a1', name: '홍길동', isAdmin: true }),
    grpOpenReport: (co, t) => { ctx.__opened.push(co + '|' + t); return Promise.resolve(true); }, __opened: [],
    grpOpenForms: () => { ctx.__forms++; return Promise.resolve(true); }, __forms: 0,
    toast: (m, k) => { ctx.__toasts.push(String(m) + '#' + (k || '')); }, __toasts: [],
    setTimeout: (fn) => fn()
  };
  vm.createContext(ctx);
  const consts = SRC.match(/const LINK_TRIES=\d+, LINK_WAIT=\d+;/)[0];
  vm.runInContext(consts + '\n' + ['linkClear', 'linkRpt', 'openFromReportLink', 'openFormsFromLink'].map(grab).join('\n'), ctx);
  return ctx;
}

test('linkRpt — 업체|사업을 읽는다(인코딩·%7C 도), 꼴이 틀리면 null', () => {
  assert.deepEqual({ ...world({ hash: '#rpt=c1|t1' }).linkRpt() }, { coId: 'c1', typeId: 't1' });
  assert.deepEqual({ ...world({ hash: '#rpt=a%20b%7Ct%2F1' }).linkRpt() }, { coId: 'a b', typeId: 't/1' });
  assert.equal(world({ hash: '#rpt=c1' }).linkRpt(), null);
  assert.equal(world({ hash: '#sc=s1' }).linkRpt(), null);
});

test('openFromReportLink — 자료가 늦게 와도 기다렸다 그 보고서 창을 열고 주소를 지운다', () => {
  const w = world({ hash: '#rpt=c1|t1', lateBy: 3 });
  w.openFromReportLink();
  assert.deepEqual(w.__opened, ['c1|t1']);
  assert.equal(w.__cleared, 1);
  assert.equal(w.__toasts.length, 0);
});

test('openFromReportLink — 클라우드가 붙기 전에는 열지 않는다, 15초 지나면 「찾지 못했습니다」', () => {
  const w = world({ hash: '#rpt=c1|t1', ready: false });
  w.openFromReportLink();
  assert.deepEqual(w.__opened, []);
  assert.ok(w.__toasts.some((t) => t.startsWith('그 보고서를 찾지 못했습니다') && t.endsWith('#err')));
  const g = world({ hash: '#rpt=c9|t1' });
  g.openFromReportLink();
  assert.deepEqual(g.__opened, []);
  assert.equal(g.__cleared, 1);
});

test('openFormsFromLink — #forms 면 로그인을 기다렸다 양식 서고를 연다', () => {
  const w = world({ hash: '#forms' });
  w.openFormsFromLink();
  assert.equal(w.__forms, 1);
  assert.equal(w.__cleared, 1);
  const n = world({ hash: '#forms', noSession: true });
  n.openFormsFromLink();
  assert.equal(n.__forms, 0);
  assert.ok(n.__toasts.some((t) => t.includes('양식 서고')));
  const x = world({ hash: '#formsx' });
  x.openFormsFromLink();
  assert.equal(x.__forms, 0);
});

test('시작할 때 #sc= 와 나란히 부른다', () => {
  assert.match(SRC, /setTimeout\(openFromLink,300\);\r?\n\s*setTimeout\(openFromReportLink,300\);\r?\n\s*setTimeout\(openFormsFromLink,300\);/);
});

test('기존 #sc= 건너오기는 그대로 — linkSid 는 #sc= 만 읽고 #rpt= 에는 반응하지 않는다', () => {
  const ctx = { decodeURIComponent, location: { hash: '#sc=s1' } };
  vm.createContext(ctx);
  vm.runInContext(grab('linkSid'), ctx);
  assert.equal(ctx.linkSid(), 's1');
  ctx.location.hash = '#rpt=c1|t1';
  assert.equal(ctx.linkSid(), '');
  assert.match(grab('openFromLink'), /openEditModal\(sid\)/);
});
