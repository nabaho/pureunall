'use strict';
/* 급여관리 3칸 화면 — «실제로 그려» 본다 (대표 승인 2026-10-05)
 *
 * ■ 무엇인가
 *   대표: 「형태나 유형 등을 일치시켜서 연결성이 강하게」 → 급여데이터함과 같은 뼈대.
 *   ① 보기(내 일·전체·담당자·도구) ② 사업장 목록(업체관리 급여 업체 «전부») ③ 회사 한 장(탭).
 *   예전 「🏢 회사」 화면(screenHub)을 이것이 대신한다.
 *
 * ■ 못 박는 것 — 함수를 잘라 와 진짜로 돌리고 나온 HTML 을 본다
 *   ① 업체관리 급여 업체는 급여관리에 자료가 없어도 목록에 «자료 없음»으로 남는다
 *   ② 내 담당이 없는 관리자(대표)는 「전체 사업장」부터 본다
 *   ③ 부담당도 「내 담당」이다 — 데이터함과 같은 규칙
 *   ④ 그 달 상태: 다 확정이면 확정 ✔ · 초록 아닌 달이 남으면 검토 n · 기록은 없고 알림만 오면 자료 도착
 *      ★ 알림에 업체번호가 실려 오면 급여관리 자료가 없어도 도착이 잡힌다
 *   ⑤ 회사를 고르면 오른쪽 탭이 «원래 화면»을 그 회사로 연다 / 자료가 없으면 원래 화면을 부르지 않는다
 *      (부르면 「사업장 고르기」가 떠 버린다)
 *   ⑥ 업체관리 계약 종료 업체에 이어진 자료는 「지난 업체·못 이은 자료」로 간다
 *   ⑦ ★ 목록을 그리는 동안 직원 표를 받지 않는다
 *
 * 실행: node --test tests/payroll-shell.test.js */
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
function cutVar(name) {
  const m = HTML.match(new RegExp('var ' + name + '=[\\s\\S]*?;\\n'));
  assert.ok(m, name + ' 가 없습니다');
  return m[0];
}

/* 가짜 업체관리 — 「나루상사」는 급여 업체인데 급여관리 자료가 없다. 「가온기술」은 계약 종료. */
const COS = {
  c1: { id: 'c1', name: '다온원', typeCode: '급여', status: 'active', managerMain: 'A-004' },
  c2: { id: 'c2', name: '두레가축약품', typeCode: '급여', status: 'active', managerMain: 'A-003', managerSubs: ['A-004'] },
  c3: { id: 'c3', name: '나루상사', typeCode: '급여', status: 'active', managerMain: 'A-003' },
  c4: { id: 'c4', name: '가온기술', typeCode: '급여', status: 'closed', managerMain: 'A-005' },
  c5: { id: 'c5', name: '새별반찬', typeCode: '급여', status: 'active' },
};
const DIR = { v: [{ sid: 'A-003', name: '나사람' }, { sid: 'A-004', name: '다사람' }, { sid: 'A-005', name: '라사람' }] };
/* 급여관리 쪽 — 이름표로 번호를 잇는다 */
const RECS = {
  '다온원_급여자료': [
    { id: 'r1', 월: '8월', 파일: '2026년 8월 급여대장_다온원.xlsx', 신호: 'green', 직원수: 2 },
    { id: 'r1b', 월: '8월', 파일: '2026년 8월 일용직 급여대장_다온원.xlsx', 신호: 'green', 직원수: 2 },
    { id: 'r2', 월: '9월', 파일: '2026년 9월 급여대장_다온원.xlsx', 신호: 'orange', 직원수: 2 },
  ],
  '두레가축약품': [{ 월: '8월', 파일: '2026년 8월 급여대장_두레가축약품.xlsx', 신호: 'green' }],
  '가온기술': [{ 월: '1월', 파일: '2025년 1월 급여대장_가온기술.xlsx', 신호: 'green' }],
};
const LINKS = {
  '다온원_급여자료': { coId: 'c1', coName: '다온원' },
  '두레가축약품': { coId: 'c2', coName: '두레가축약품' },
  '가온기술': { coId: 'c4', coName: '가온기술' },
};

function load(o) {
  o = o || {};
  const sandbox = { console, Date, JSON, Object, String, Number, Array, Math, parseInt };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const 터진다 = n => 'function ' + n + '(){ throw new Error("★ 목록을 그리다 ' + n + ' 을 불렀습니다 — 직원 표를 받으면 화면이 안 열립니다"); }';
  new vm.Script([
    STAFF,
    'var PuSiteStaff = globalThis.PuSiteStaff;',
    'var App = ' + JSON.stringify(Object.assign({ screen: 'shell', site: null, month: null, emp: null, day: null, view: null, coId: null, loose: null, tab: 'sum', ym: '2026-08', q: '' }, o.App || {})) + ';',
    'var me = ' + JSON.stringify({ email: o.email || 'p001@pureun.kr' }) + ';',
    'var isAdminUser = ' + JSON.stringify(o.isAdmin !== false) + ';',
    'var coData = { companies: PuSiteStaff.list(' + JSON.stringify(COS) + '), dir: ' + JSON.stringify(DIR) + ' };',
    'var coErr = "";',
    'var SIG = {green:"#166534"};',
    'var RECS = ' + JSON.stringify(o.recs || RECS) + ';',
    'var LOCK = ' + JSON.stringify(o.lock || {}) + ';',
    'var INBOX = ' + JSON.stringify(o.inbox || {}) + ';',
    'var LINKS = ' + JSON.stringify(o.links || LINKS) + ';',
    'var CALLS = [];',
    'function paySites(){ return Object.keys(RECS); }',
    'function siteCardsList(){ return Object.keys(RECS); }',
    'function payRecs(s){ return RECS[s] || []; }',
    'function isLocked(s, m){ return !!LOCK[s + "|" + m]; }',
    'function effSig(r){ return r.신호 || "green"; }',
    'function lmap(k){ return k === "site_co_link" ? LINKS : {}; }',
    'function inboxLog(){ return INBOX; }',
    'function cardsView(){ return []; }',
    'function esc(s){ return String(s == null ? "" : s).replace(/\'/g, "").replace(/"/g, ""); }',
    /* 원래 화면 — 불렸는지, 어느 사업장으로 불렸는지 적는다 */
    ['screenPayroll', 'screenAttend', 'screenLeave', 'screenSever', 'screenSlip', 'screenReport'].map(n =>
      'function ' + n + '(){ CALLS.push(["' + n + '", App.site]); return "<!--' + n + ':" + App.site + "-->"; }').join('\n'),
    터진다('siteEmployees'),
    'var EMPS = ' + JSON.stringify(o.emps || {}) + '; var EMP_CALLS = [];',
    'function empsOf(r){ return EMPS[r.id] || null; }',
    'function ensureEmps(r){ EMP_CALLS.push(r.id); }',
    'function won(n){ return (n==null)?"-":Number(n).toLocaleString(); }',
    cutVar('DED_KEYS_'), cut('dedupeEmps'), cut('empScore'), cut('slipRows'),
    cut('monthNum'), cut('guessMonth'), cut('ymOf'), cut('hubCounts'), cut('nameState'), cut('linkStats'), cut('staffOf'),
    cutVar('TABS'), cutVar('TOOLS'), cutVar('TAB_FN'),
    ['ymNow', 'ymParts', 'ymText', 'inboxYm', 'coArrivals', 'coState', 'sitesHaveSever', 'byKoName', 'shellModel', 'curView',
      'viewbarHtml', 'toolRow', 'colistHtml', 'colRowsHtml', 'coSites', 'shellCtx', 'sumCounts', 'monthRecsFor', 'coMoney', 'manwon', 'shellMainHtml', 'coBarHtml', 'tabBodyHtml', 'shellSummary'].map(cut).join('\n'),
    'globalThis.M = function(){ return shellModel(); };',
    'globalThis.peek = function(){ return { App: App, CALLS: CALLS, EMP_CALLS: EMP_CALLS }; };',
  ].join('\n')).runInContext(sandbox);
  return sandbox;
}
const rowOf = (h, name) => { const i = h.indexOf('<b>' + name + '</b>'); return i < 0 ? '' : h.slice(i, h.indexOf('</div>', i)); };

test('★ 업체관리 급여 업체는 자료가 없어도 목록에 «자료 없음»으로 남는다', () => {
  const s = load();
  const m = s.M();
  const h = s.colistHtml(m);
  assert.ok(h.indexOf('<b>나루상사</b>') > 0, '자료 없는 급여 업체가 목록에서 빠졌습니다');
  assert.match(rowOf(h, '나루상사'), /자료 없음/);
  assert.equal(h.indexOf('<b>가온기술</b>'), -1, '계약 종료 업체가 지금 업체 목록에 섞였습니다');
});

test('★ 내 담당이 없는 관리자(대표)는 「전체 사업장」부터 본다', () => {
  const s = load();
  assert.equal(s.M().view.key, 'all');
});

test('★ 부담당도 「내 담당」이다 — 데이터함과 같은 규칙', () => {
  const s = load({ email: 'a004@pureun.kr', isAdmin: false });
  const m = s.M();
  assert.equal(m.view.key, 'mine');
  assert.deepEqual(Array.from(m.view.list, c => c.id).sort(), ['c1', 'c2'], '부담당으로 맡은 회사가 내 담당에서 빠졌습니다');
  const vb = s.viewbarHtml(m);
  assert.equal(vb.indexOf('전체 사업장'), -1, '관리자가 아닌데 「전체」가 보입니다');
});

test('담당자 줄은 사번 순 · 확정/전체를 센다', () => {
  const s = load({ lock: { '두레가축약품|8월': 1 } });
  const vb = s.viewbarHtml(s.M());
  const a = vb.indexOf('<b>나사람</b>'), b = vb.indexOf('<b>다사람</b>');
  assert.ok(a > 0 && b > a, '사번 순(A-003 → A-004)이 아닙니다');
  assert.match(vb.slice(a, vb.indexOf('</div>', a)), /1\/2/, '나사람: 두레가축약품 확정 1 / 맡은 곳 2');
});

test('★ 그 달 상태 — 확정 ✔ · 검토 n · 처리 전 · 자료 도착(번호로)', () => {
  const s8 = load({ lock: { '두레가축약품|8월': 1 } });
  const h8 = s8.colistHtml(s8.M());
  assert.match(rowOf(h8, '두레가축약품'), /확정/);
  assert.match(rowOf(h8, '다온원'), /처리 전/);
  const s9 = load({ App: { ym: '2026-09' } });
  assert.match(rowOf(s9.colistHtml(s9.M()), '다온원'), /검토 1/);
  /* ★ 자료가 하나도 없는 회사에도 번호가 실린 알림이면 도착이 잡힌다 */
  const sa = load({ inbox: { x: { 사업장: '주식회사 나루상사', companyId: 'c3', 월: '2026-08' } } });
  assert.match(rowOf(sa.colistHtml(sa.M()), '나루상사'), /자료 도착/);
  const sb = load({ inbox: { x: { 사업장: '주식회사 나루상사', companyId: 'c3', 월: '2025-08' } } });
  assert.doesNotMatch(rowOf(sb.colistHtml(sb.M()), '나루상사'), /자료 도착/, '작년 같은 달 알림을 올해 것으로 셌습니다');
});

test('★ 회사를 고르면 탭이 «원래 화면»을 그 회사 자료로 연다', () => {
  const s = load({ App: { coId: 'c1', tab: 'attend' } });
  const h = s.shellMainHtml(s.M());
  ['한눈에', '급여', '근태', '연차', '퇴직', '명세서', '신고'].forEach(t => assert.ok(h.indexOf(t) > 0, t + ' 탭이 없습니다'));
  assert.ok(h.indexOf('<!--screenAttend:다온원_급여자료-->') > 0, '근태 탭이 그 회사 자료로 열리지 않았습니다');
  assert.equal(s.peek().App.site, '다온원_급여자료');
});

test('★ 자료가 없는 회사는 원래 화면을 부르지 않는다 — 「사업장 고르기」가 뜨지 않게', () => {
  const s = load({ App: { coId: 'c3', tab: 'payroll' } });
  const h = s.shellMainHtml(s.M());
  assert.match(h, /자료가 아직 없습니다/);
  assert.equal(s.peek().CALLS.length, 0, '자료 없는 회사로 원래 화면을 불렀습니다');
});

test('계약 종료 업체에 이어진 자료는 「지난 업체·못 이은 자료」로 간다', () => {
  const s = load({ App: { view: 'loose' } });
  const m = s.M();
  assert.deepEqual(Array.from(m.view.sites), ['가온기술']);
  assert.match(s.colistHtml(m), /지난 업체/);
  assert.match(s.viewbarHtml(m), /지난·못 이은 자료/);
});

test('찾기는 목록만 거른다', () => {
  const s = load({ App: { q: '두레' } });
  const h = s.colistHtml(s.M());
  assert.ok(h.indexOf('<b>두레가축약품</b>') > 0);
  assert.equal(h.indexOf('<b>다온원</b>'), -1);
});

test('★ 세 칸을 다 그리는 동안 직원 표를 받지 않는다', () => {
  const s = load({ App: { coId: 'c1', tab: 'sum' } });
  assert.doesNotThrow(() => { const m = s.M(); s.viewbarHtml(m); s.colistHtml(m); s.shellMainHtml(m); });
  assert.equal(s.peek().EMP_CALLS.length, 0, '목록·본문을 그리다 직원 표를 받았습니다');
});

test('이름순은 법인 표기를 빼고 — ㈜가 붙은 곳이 맨 위로 몰리지 않는다', () => {
  const s = load();
  const names = [{ name: '㈜하늘상사' }, { name: '가람' }, { name: '주식회사 나무' }, { name: '(주)다리' }]
    .sort(s.byKoName).map(c => c.name);
  assert.deepEqual(Array.from(names), ['가람', '주식회사 나무', '(주)다리', '㈜하늘상사']);
});

/* ══════ 머리줄 회사 칸 — 대표 지시 2026-10-05 「회사 관련 KPI 는 맨 위 파란 줄에, 탭은 위로」 ══════ */

test('★ 회사를 고르면 맨 위 줄에 이름·담당·기준 달·지표가 뜬다', () => {
  const s = load({ App: { coId: 'c2' }, lock: { '두레가축약품|8월': 1 } });
  const b = s.coBarHtml(s.M());
  assert.match(b, /두레가축약품/);
  assert.match(b, /담당 나사람/);
  assert.match(b, /부 다사람/, '부담당이 안 보입니다');
  assert.match(b, /2026년 8월/);
  ['확정', '급여 1개월', '근태 0명', '연차 0명', '퇴사 0명', '명세서 1개월'].forEach(k =>
    assert.ok(b.indexOf(k) >= 0, '「' + k + '」 지표가 맨 위 줄에 없습니다'));
});

test('★ 지표를 누르면 그 탭으로 간다', () => {
  const s = load({ App: { coId: 'c1' } });
  const b = s.coBarHtml(s.M());
  ['payroll', 'attend', 'leave', 'sever', 'slip'].forEach(t =>
    assert.ok(b.indexOf("pickTab('" + t + "')") >= 0, t + ' 지표가 그 탭으로 안 갑니다'));
});

test('★ 본문은 탭부터 시작한다 — 회사 이름 칸이 본문 위에 다시 생기지 않는다', () => {
  const s = load({ App: { coId: 'c1' } });
  const h = s.shellMainHtml(s.M());
  assert.ok(h.indexOf('<div class="tabs"') === 0, '본문 첫머리가 탭이 아닙니다: ' + h.slice(0, 80));
  assert.equal(h.indexOf('cohead'), -1, '예전 회사 칸이 남아 있습니다');
});

test('짐작으로 이은 회사는 맨 위 줄에 「짐작 연결」 + 관리자에게만 확정 단추', () => {
  const noLink = { '두레가축약품': LINKS['두레가축약품'], '가온기술': LINKS['가온기술'] };   // 다온원은 이름표 없음 → 짐작
  const a = load({ App: { coId: 'c1' }, links: noLink });
  const b = a.coBarHtml(a.M());
  assert.match(b, /짐작 연결/);
  assert.ok(b.indexOf("linkCo('다온원_급여자료')") >= 0, '관리자에게 확정 단추가 없습니다');
  const n = load({ App: { coId: 'c1' }, links: noLink, isAdmin: false, email: 'a004@pureun.kr' });
  assert.equal(n.coBarHtml(n.M()).indexOf('linkCo('), -1, '관리자가 아닌데 확정 단추가 보입니다');
  const ok = load({ App: { coId: 'c1' } });
  assert.equal(ok.coBarHtml(ok.M()).indexOf('짐작 연결'), -1, '확정한 이름표인데 짐작이라 합니다');
});

test('고른 회사가 없거나 도구 화면이면 맨 위 줄은 비어 있다', () => {
  const s = load();
  assert.equal(s.coBarHtml(s.M()), '');
  const t = load({ App: { screen: 'cards', coId: 'c1' } });
  assert.equal(t.coBarHtml(t.M()), '');
});

/* ══════ 윗줄 금액 지표 — 대표 지시 2026-10-05 「직원 수·이번 달 총 지급액」 ══════ */
const EMPS = {
  /* 상용 대장 둘 + 일용 대장 — 「갑」은 두 대장에 다 있다(이름으로 한 사람) */
  r1: [{ 성명: '갑', 실수령: 1800000, 공제총액: 200000, 기본급: 2000000 },
       { 성명: '을', 실수령: 2700000, 공제총액: 300000, 기본급: 2800000 }],   // 을: 비과세 20만 → 임금총액 300만(실수령+공제)
  r1b: [{ 성명: '병', 일당: 100000, 근무일수: 5, 실수령: 495500, 공제총액: 4500 },
        { 성명: '갑', 실수령: 1800000, 공제총액: 200000, 기본급: 2000000 }],
  r2: [{ 성명: '갑', 실수령: 1800000, 공제총액: 200000 }],
};

test('★★ 직원 수·지급·실수령 — 명세서와 같은 셈(임금총액 = 실수령 + 공제), 한 사람은 한 번', () => {
  const s = load({ App: { coId: 'c1' }, emps: EMPS });
  const b = s.coBarHtml(s.M());
  assert.match(b, /직원 3명/, '두 대장에 다 있는 사람을 두 번 셌습니다');
  /* 갑 200만 + 을 300만(기본급 280만이 아니라 실수령+공제) + 병 50만 = 550만 */
  assert.match(b, /지급 550만원/);
  assert.match(b, /실수령 500만원/);
  assert.match(b, /지급총액 5,500,000원 · 공제 504,500원 · 실수령 4,995,500원/, '정확한 값이 알약 설명에 없습니다');
});

test('★ 직원 표는 «고른 회사·그 달»만 받는다 — 받는 동안은 그렇다고 보인다', () => {
  const s = load({ App: { coId: 'c1' } });          // 직원 표 아직 없음
  const b = s.coBarHtml(s.M());
  assert.match(b, /지급 불러오는 중/);
  assert.match(b, /직원 약 4명/, '받기 전에는 목록의 직원수로 어림한다');
  assert.deepEqual(Array.from(s.peek().EMP_CALLS).sort(), ['r1', 'r1b'], '그 달(8월) 기록만 받아야 합니다');
});

test('★ 기준 달에 기록이 없으면 앞의 가장 가까운 달로 — 그 달이라고 밝힌다', () => {
  const s = load({ App: { coId: 'c1', ym: '2026-12' }, emps: EMPS });
  const b = s.coBarHtml(s.M());
  assert.match(b, /2026년 9월 기준/);
  assert.match(b, /직원 1명/);
  const f = load({ App: { coId: 'c1', ym: '2026-07' }, emps: EMPS });   // 그보다 앞에는 기록이 없다
  assert.equal(f.coBarHtml(f.M()).indexOf('직원 '), -1, '없는 달을 지어내면 안 됩니다');
});

test('금액을 못 읽은 직원이 있으면 「?」로 표시하고 그 수를 알려 준다', () => {
  const s = load({ App: { coId: 'c1' }, emps: { r1: [{ 성명: '갑', 실수령: 1800000, 공제총액: 200000 }, { 성명: '정' }], r1b: [] } });
  const b = s.coBarHtml(s.M());
  assert.match(b, /지급 200만원 \?/);
  assert.match(b, /금액을 못 읽은 1명은 빠짐/);
});

test('대장에 원 미만 값이 섞이면 원 단위로 반올림해 보이고 그렇다고 밝힌다', () => {
  const s = load({ App: { coId: 'c1' }, emps: { r1: [{ 성명: '갑', 실수령: 436897.14285714284, 공제총액: 63102.857142857145 }], r1b: [] } });
  const b = s.coBarHtml(s.M());
  assert.match(b, /지급총액 500,000원/);
  assert.match(b, /원 미만 값이 있어/);
  const ok = load({ App: { coId: 'c1' }, emps: EMPS });
  assert.equal(ok.coBarHtml(ok.M()).indexOf('원 미만'), -1, '깨끗한 자료에 경고를 붙였습니다');
});
