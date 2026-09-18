'use strict';
/* 회사 한 장(허브) 화면을 «실제로 그려 본다» — 대표 지시 2026-09-13
 *
 * ■ 왜 글자 찾기로는 부족한가
 *   화면 코드가 문법만 맞고 «돌리면 터지는» 일을 여러 번 겪었다(없는 함수 부르기,
 *   따옴표 어긋남). 그래서 이 검사는 함수를 잘라 와 **진짜로 돌려** 나온 HTML 을 본다.
 *
 * ■ 못 박는 것
 *   ① 회사 한 장에 일곱 칸이 모두 있다(자료·급여·근태·연차·퇴직·명세서·신고)
 *   ② 담당자별로 묶여 나오고, 담당을 못 찾은 곳도 «사라지지 않는다»
 *   ③ 짐작일 때는 짐작이라 밝히고 확정 단추를 준다
 *   ④ ★ 목록을 그리는 동안 «직원 표»를 받지 않는다 — 110곳에서 표를 받으면 화면이
 *      안 열린다(이미 겪은 자리). siteEmployees·ensureEmps 를 부르면 실패한다.
 *
 * 실행: node --test tests/payroll-hub-screen.test.js */
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

const COS = [
  { name: '㈜나라앤드씨', typeCode: '급여', status: 'active', managerMain: 'A-004' },
  { name: '두레', typeCode: '급여', status: 'active', managerMain: 'A-003' },
];
const DIR = { v: [{ sid: 'A-003', name: '김보람' }, { sid: 'A-004', name: '주민정' }] };

/* 화면을 돌릴 최소한의 둘레만 세운다 — DB·DOM 없이 */
function load(opts) {
  const o = opts || {};
  const sandbox = { console, Date, JSON, Object, String, Number, Array, Math };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const 몰래부르면터진다 = (n) => 'function ' + n + '(){ throw new Error("★ 목록에서 ' + n + ' 을 불렀습니다 — 직원 표를 받으면 화면이 안 열립니다"); }';
  new vm.Script([
    STAFF,
    'var App = ' + JSON.stringify(o.App || { screen: 'hub', site: null }) + ';',
    'var SIG = {green:"#166534"};',
    'var me = {email:"p001@pureun.kr"};',
    'var coData = ' + JSON.stringify(o.coData === undefined ? { companies: COS, dir: DIR } : o.coData) + ';',
    'var coErr = ' + JSON.stringify(o.coErr || '') + ';',
    'var SITES = ' + JSON.stringify(o.sites || ['나라앤드씨', '두레', '세창ENG']) + ';',
    'var RECS = ' + JSON.stringify(o.recs || {}) + ';',
    'var LOCK = ' + JSON.stringify(o.lock || {}) + ';',
    'var LINKS = ' + JSON.stringify(o.links || {}) + ';',
    'var ARRIVED = ' + JSON.stringify(!!o.arrived) + ';',
    'function ensureCo(){}',
    'function siteCardsList(){ return SITES; }',
    'function payRecs(s){ return RECS[s] || []; }',
    'function isLocked(s,m){ return !!LOCK[s+"|"+m]; }',
    'function effSig(r){ return r.신호 || "green"; }',
    'function lmap(k){ return k==="site_co_link" ? LINKS : {}; }',
    'function esc(s){ return String(s==null?"":s).replace(/\'/g,"").replace(/"/g,""); }',
    'function cardsView(){ return ' + JSON.stringify(o.cards || []) + '; }',
    'function arrivalFor(){ return ARRIVED; }',
    /* ④ 목록이 직원 표를 건드리면 여기서 터진다 */
    몰래부르면터진다('siteEmployees'),
    몰래부르면터진다('ensureEmps'),
    cut('staffOf'), cut('hubCounts'), cut('hubRow'), cut('screenHub'), cut('hubPickHtml'),
    'globalThis.screenHub = screenHub; globalThis.hubPickHtml = hubPickHtml; globalThis.hubCounts = hubCounts;'
  ].join('\n')).runInContext(sandbox);
  return sandbox;
}

test('★ 회사 한 장에 일곱 칸이 모두 있다', () => {
  const s = load({ App: { screen: 'hub', site: '나라앤드씨' }, recs: { '나라앤드씨': [{ 월: '8월', 신호: 'green' }] } });
  const h = s.screenHub();
  ['자료 도착', '급여 처리', '근태', '연차', '퇴직', '명세서', '신고'].forEach((칸) => {
    assert.ok(h.indexOf(칸) >= 0, '「' + 칸 + '」 칸이 없습니다');
  });
});

test('회사 한 장이 업체관리에서 읽은 담당을 보여 준다', () => {
  const s = load({ App: { screen: 'hub', site: '나라앤드씨' } });
  const h = s.screenHub();
  assert.ok(h.indexOf('담당 주민정') >= 0, '담당이 안 보입니다: ' + h.slice(0, 300));
  assert.ok(h.indexOf('㈜나라앤드씨') >= 0, '이어 붙인 업체 이름이 안 보입니다');
});

test('★ 짐작일 때는 짐작이라 밝히고 «확정» 단추를 준다', () => {
  const s = load({ App: { screen: 'hub', site: '나라앤드씨' } });
  const h = s.screenHub();
  assert.ok(h.indexOf('(짐작)') >= 0, '짐작을 짐작이라 말하지 않습니다');
  assert.ok(h.indexOf('linkCo(') >= 0, '사람이 확정할 단추가 없습니다');
});

test('사람이 확정한 뒤에는 짐작 표시도 단추도 사라진다', () => {
  const s = load({
    App: { screen: 'hub', site: '나라앤드씨' },
    links: { '나라앤드씨': { coName: '㈜나라앤드씨', by: 'p001@pureun.kr', at: 1 } }
  });
  const h = s.screenHub();
  assert.equal(h.indexOf('(짐작)'), -1, '확정했는데 아직 짐작이라 합니다');
  assert.equal(h.indexOf('linkCo('), -1, '확정했는데 또 확정하라고 합니다');
});

test('★ 회사 목록이 담당자별로 묶이고, 담당 미확인도 사라지지 않는다', () => {
  const s = load({});
  const h = s.hubPickHtml();
  assert.ok(h.indexOf('주민정') >= 0 && h.indexOf('김보람') >= 0, '담당자 묶음이 없습니다');
  assert.ok(h.indexOf('담당 미확인') >= 0, '담당 미확인 묶음이 없습니다');
  assert.ok(h.indexOf('세창ENG') >= 0, '담당을 못 찾은 사업장이 목록에서 사라졌습니다');
});

test('업체 명단을 못 읽어도 목록은 열린다 — 묶기만 없어진다', () => {
  const s = load({ coData: null, coErr: 'PERMISSION_DENIED' });
  const h = s.hubPickHtml();
  assert.ok(h.indexOf('PERMISSION_DENIED') >= 0, '왜 못 읽었는지 안 알려 줍니다');
  assert.ok(h.indexOf('나라앤드씨') >= 0, '명단을 못 읽었다고 사업장까지 감췄습니다');
});

test('★ 목록을 그리는 동안 직원 표를 받지 않는다 (110곳에서 화면이 안 열린다)', () => {
  const s = load({ recs: { '나라앤드씨': [{ 월: '8월', 신호: 'green' }, { 월: '9월', 신호: 'orange' }] } });
  assert.doesNotThrow(() => s.hubPickHtml());          // siteEmployees 를 부르면 터지도록 세워 뒀다
  const c = s.hubCounts('나라앤드씨');
  assert.equal(c.months, 2);
  assert.equal(c.review, 1);                           // 초록 아닌 달 = 검토할 것
});
