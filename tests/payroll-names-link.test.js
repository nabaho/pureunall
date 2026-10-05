'use strict';
/* 🏷 이름표 맞추기 + 도착 알림 읽기 — 대표 지시 2026-10-05 「1단계 진행, 이름표 맞추기는 내가」
 *
 * ■ 무엇이 끊겨 있었나 (실측)
 *   ① 급여관리는 payroll_os/inbox(데이터함이 보내는 도착 알림)를 **시작할 때 아예 안 읽었다.**
 *      「얇은 것만 읽는다」로 바꿀 때 목록에서 빠졌다. 넘긴 알림이 0건이라 아무도 몰랐다.
 *   ② 읽었더라도 이름 글자로 견줘 44곳 중 20곳이 안 붙었다(폴더 이름 ↔ 업체 정식 이름).
 *   ③ 이름 짐작이 남의 회사·다른 지점을 고른 곳이 실제로 있었다.
 *
 * ■ 못 박는 것 — 함수를 잘라 와 «실제로 돌린다»(글자 찾기 검사는 기능을 꺼도 통과한다)
 *   · 시작할 때 inbox 를 구독하고, 나중에 온 알림도 화면 자료에 들어간다
 *   · 이름표 화면은 못 찾음 → 꼭 볼 것 → 이름 같음 → 확정 차례로 세운다
 *   · 「한꺼번에 확정」은 이름 알맹이가 똑같은 것만 넣는다 (이름 다른 짐작은 한 곳씩)
 *   · 고르면 «업체번호»로 적힌다 · 「업체 아님」은 업체 이름 없이 none 으로 적힌다
 *   · 관리자가 아니면 단추가 없다
 *
 * 실행: node --test tests/payroll-names-link.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const R = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(R, 'payroll-os.html'), 'utf8');
const STAFF = fs.readFileSync(path.join(R, 'js', 'pu-site-staff.js'), 'utf8');

function cut(name) {
  const m = HTML.match(new RegExp('function ' + name + '\\s*\\([\\s\\S]*?\\n\\}'));
  assert.ok(m, name + ' 함수를 찾을 수 없습니다 — 화면에서 사라졌다면 이 검사를 함께 고치십시오');
  return m[0];
}

/* 가짜 업체 — 「두레」는 급여 명단에 없고 「두레가축약품」만 있다(짐작이 남의 회사를 고르는 꼴) */
const COS = [
  { id: 'c1', name: '다온원', typeCode: '급여', status: 'active', managerMain: 'A-004' },
  { id: 'c2', name: '두레가축약품', typeCode: '급여', status: 'active', managerMain: 'A-002' },
  { id: 'c3', name: '새별반찬(배방점)', typeCode: '급여', status: 'active', managerMain: 'A-005' },
];
const DIR = { v: [{ sid: 'A-002', name: '나사람' }, { sid: 'A-004', name: '다사람' }, { sid: 'A-005', name: '라사람' }] };
const SITES = ['새별반찬', '다온원_급여자료10일', '두레', '이전 파일'];

function loadNames(opts) {
  const o = opts || {};
  const sandbox = { console, Date, JSON, Object, String, Number, Array, Math };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  new vm.Script([
    STAFF,
    'var PuSiteStaff = globalThis.PuSiteStaff;',
    'var App = {screen:"names"};',
    'var me = {email:"p001@pureun.kr"};',
    'var isAdminUser = ' + JSON.stringify(o.isAdmin !== false) + ';',
    'var coData = ' + JSON.stringify({ companies: COS, dir: DIR }) + ';',
    'var coErr = "";',
    'var LINKS = ' + JSON.stringify(o.links || { '새별반찬': { coId: 'c3', coName: '새별반찬(배방점)' } }) + ';',
    'var WRITES = [];',
    'function ensureCo(){}',
    'function render(){}',
    'function confirm(){ return true; }',
    'function siteCardsList(){ return ' + JSON.stringify(SITES) + '; }',
    'function payRecs(){ return [{월:"8월"}]; }',
    'function lmap(k){ return k === "site_co_link" ? LINKS : {}; }',
    'function dbSet(k, v){ WRITES.push(k); if (k === "site_co_link") LINKS = v; }',
    'function esc(s){ return String(s==null?"":s).replace(/\'/g,"").replace(/"/g,""); }',
    cut('staffOf'), cut('linkVal'), cut('saveLink'), cut('nameState'), cut('linkStats'),
    cut('screenNames'), cut('namesCandHtml'), cut('pickCo'), cut('markNotCo'),
    cut('unlinkSite'), cut('linkAllSame'), cut('linkCo'),
    'globalThis.links = function(){ return LINKS; };'
  ].join('\n')).runInContext(sandbox);
  return sandbox;
}

test('★ 이름표 화면은 못 찾음 → 꼭 볼 것 → 이름 같음 → 확정 차례로 세운다', () => {
  const s = loadNames();
  const h = s.screenNames();
  const at = n => h.indexOf('<b>' + n + '</b>');
  ['이전 파일', '두레', '다온원_급여자료10일', '새별반찬'].forEach(n => assert.ok(at(n) > 0, n + ' 줄이 없습니다'));
  assert.ok(at('이전 파일') < at('두레'), '못 찾은 곳이 맨 위가 아닙니다');
  assert.ok(at('두레') < at('다온원_급여자료10일'), '이름이 다른 짐작이 이름 같은 것보다 아래에 있습니다');
  assert.ok(at('다온원_급여자료10일') < at('새별반찬'), '확정된 곳이 아래로 안 내려갔습니다');
  assert.ok(h.indexOf('이름 다름') > 0, '이름이 다른 짐작에 「꼭 확인」 표시가 없습니다');
});

test('★★ 「한꺼번에 확정」은 이름 알맹이가 똑같은 것만 — 남의 회사를 고른 짐작은 빼놓는다', () => {
  const s = loadNames();
  s.linkAllSame();
  const L = s.links();
  assert.equal(L['다온원_급여자료10일'].coId, 'c1');
  assert.equal(L['두레'], undefined, '이름이 다른 짐작(두레→두레가축약품)까지 한꺼번에 확정했습니다');
  assert.equal(L['이전 파일'], undefined);
  assert.equal(L['새별반찬'].coId, 'c3', '이미 확정한 것을 건드렸습니다');
});

test('★ 고르면 «업체번호»로 적힌다', () => {
  const s = loadNames();
  s.pickCo('두레', 'c9', '두레');
  const L = s.links();
  assert.equal(L['두레'].coId, 'c9');
  assert.equal(L['두레'].by, 'p001@pureun.kr');
  assert.ok(L['두레'].at > 0);
});

test('「맞음」도 번호로 적힌다 — 이름만 적던 예전 꼴이 아니다', () => {
  const s = loadNames();
  s.linkCo('다온원_급여자료10일');
  assert.equal(s.links()['다온원_급여자료10일'].coId, 'c1');
});

test('「업체 아님」은 업체 이름 없이 none 으로 적힌다', () => {
  const s = loadNames();
  s.markNotCo('이전 파일');
  const v = s.links()['이전 파일'];
  assert.equal(v.none, true);
  assert.equal(v.coName, undefined);
  assert.equal(v.coId, undefined);
});

test('이름표를 풀면 다시 짐작으로 돌아간다', () => {
  const s = loadNames();
  s.unlinkSite('새별반찬');
  assert.equal(s.links()['새별반찬'], undefined);
});

test('관리자가 아니면 보기만 — 단추가 없다', () => {
  const s = loadNames({ isAdmin: false });
  const h = s.screenNames();
  assert.ok(h.indexOf('보기만') > 0);
  ['linkCo(', 'markNotCo(', 'namesEdit(', 'linkAllSame('].forEach(f =>
    assert.equal(h.indexOf(f), -1, f + ' 단추가 관리자 아닌 사람에게 보입니다'));
});

/* ══════ 도착 알림을 «읽는가» ══════ */

test('★★ 시작할 때 도착 알림을 구독한다 — 나중에 온 알림도 들어간다', async () => {
  const sandbox = { console, Date, JSON, Object, Promise, String };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  new vm.Script([
    'var ROOT = "payroll_os";',
    'var cache = {}, ready = false, isAdminUser = false, payIdx = null, payOld = null;',
    'var me = {uid:"u1", email:"p001@pureun.kr"};',
    'var SUBS = {}, RENDERS = 0;',
    'var DATA = {"payroll_os/inbox": {"hd_c1_2026-10": {사업장:"다온원", companyId:"c1", 월:"2026-10"}}};',
    'var document = { getElementById: function(){ return { style:{}, textContent:"", innerHTML:"" }; } };',
    'var fbDb = { ref: function(p){ return {',
    '  once: function(){ return Promise.resolve({ val: function(){ return DATA[p] || null; } }); },',
    '  on: function(ev, cb){ SUBS[p] = cb; cb({ val: function(){ return DATA[p] || null; } }); }',
    '}; } };',
    'function navSeed(){} function render(){ RENDERS++; }',
    cut('afterLogin'),
    'globalThis.go = afterLogin;',
    'globalThis.peek = function(){ return { cache: cache, subs: Object.keys(SUBS), push: SUBS["payroll_os/inbox"] }; };'
  ].join('\n')).runInContext(sandbox);
  sandbox.go();
  await new Promise(r => setImmediate(r));
  const p = sandbox.peek();
  assert.ok(p.subs.indexOf('payroll_os/inbox') >= 0, '★ 도착 알림을 구독하지 않습니다 — 데이터함이 넘겨도 영영 미도착입니다');
  assert.equal(p.cache.inbox['hd_c1_2026-10'].companyId, 'c1');
  p.push({ val: () => ({ 'hd_c2_2026-10': { 사업장: '두레', 월: '2026-10' } }) });
  assert.ok(sandbox.peek().cache.inbox['hd_c2_2026-10'], '열어 둔 사이에 온 알림이 화면 자료에 안 들어갑니다');
});
