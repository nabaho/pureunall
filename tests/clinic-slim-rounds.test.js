'use strict';
/* 현장클리닉·기술보호 — 이중 표시를 걷고(연도별 자료함 탭·연도/상태/트랙 드롭다운·변경점 띠 등) 회차를 다시 보여 준다
 * (대표 지시 2026-11-28 「3회차도 2회차도 있다 — 회차 정리한 것도 다시 다 표시 · 중복 정리 · 보고서·RAG 코치 범위 검토」).
 * 규칙: ① 가벼운 화면은 두 앱만(나머지 10개 앱은 그대로) ② 회차는 «번호»로만 이어 읽기만 한다 ③ 성과추적은 합계에서 따로. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const Cats = require(path.join(ROOT, 'js', 'pu-consult-catalogs.js'));
const SLIM = ['clinic', 'techprotect'];
const ALL = ['techprotect', 'clinic', 'chamber', 'hrconsult', 'evalcomp', 'pubconsult', 'familywork', 'socialent', 'sixthind', 'laboraudit', 'unionneg', 'specialcons'];
const OTHERS = ALL.filter((k) => SLIM.indexOf(k) < 0);

/* 화면 없이 회차 셈만 돌려 보는 틀 — 실제 화면 코드를 그대로 읽어 들인다 */
function loadView() {
  const ctx = {
    console, Date, Math, Object, Array, String, Number, JSON, Promise, RegExp, Error, isFinite, parseInt, setTimeout, clearTimeout,
    URL, URLSearchParams
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.document = { getElementById: () => null, querySelectorAll: () => [], addEventListener() {}, createElement: () => ({}) };
  ctx.PuConsultCatalogs = Cats;
  vm.createContext(ctx);
  vm.runInContext(read('js/pu-consult-view.js'), ctx);
  return ctx.PuConsultView.__test;
}
const PAST_YR = 2020;   // 오늘보다 확실히 지난 해
const FUTURE_YR = 2099; // 오늘보다 확실히 뒤인 해

const types = { t3: { id: 't3', name: '현장클리닉', rounds: 3 }, t9: { id: 't9', name: '일터혁신 상생', rounds: 5 } };
const cos = {
  c1: { id: 'c1', name: '(합성)가', erpId: 'e1' },
  c2: { id: 'c2', name: '(합성)나', co_id: 'co2' },
  c3: { id: 'c3', name: '(합성)이름만같다' } // 번호가 없다 — 이름이 같아도 이어 붙이지 않는다
};
const s = (id, coId, typeId, round, date) => ({ id, coId, typeId, round, date, isField: true });
const scheds = {
  a1: s('a1', 'c1', 't3', 1, PAST_YR + '-03-10'),
  a2: s('a2', 'c1', 't3', 2, PAST_YR + '-04-14'),
  a3: s('a3', 'c1', 't9', 1, PAST_YR + '-05-01'),       // 다른 사업(일터혁신) 일정 — 섞이면 안 된다
  a4: s('a4', 'c1', 't3', 1, (PAST_YR - 1) + '-02-02'), // 다른 해 일정 — 그 해 사업장에 안 들어온다
  b1: s('b1', 'c2', 't3', 1, FUTURE_YR + '-06-01'),
  b2: s('b2', 'c2', 't3', 2, FUTURE_YR + '-07-01'),
  z1: s('z1', 'c3', 't3', 1, PAST_YR + '-08-08')
};
const consultings = [
  { id: 'e1', no: 'CL-1', consultDays: 3, status: 'progress' },
  { id: 'e2', no: 'CL-2', dayCalc: { days: 2 }, perfTrack: true, status: 'closed', companyId: 'co2' },
  { id: 'e3', no: 'CL-3', consultDays: 3, status: 'cancelled' },
  { id: 'e4', no: 'CL-4', status: 'progress' }
];
const data = { consultings, govCos: cos, govScheds: scheds, govTypes: types };
const P = (no, year, extra) => Object.assign({ id: 'p_' + no, caseNo: no, year, companyName: '(합성)' + no }, extra || {});

test('① 가벼운 화면은 현장클리닉·기술보호 두 앱만이고, 회차 단위(일/회)·정부사업일정 종류 글자가 있다', () => {
  for (const k of SLIM) {
    const c = Cats.get(k);
    assert.equal(c.slimUi, true, k + ': slimUi');
    assert.ok(c.roundUnit, k + ': roundUnit');
    assert.ok(Array.isArray(c.govTypeKeywords) && c.govTypeKeywords.length >= 1, k + ': govTypeKeywords');
  }
  assert.equal(Cats.get('clinic').roundUnit, '일', '현장클리닉은 3일 = 3회차');
  assert.equal(Cats.get('techprotect').roundUnit, '회', '기술보호는 3회 = 3회차');
  for (const k of OTHERS) assert.ok(!Cats.get(k).slimUi, k + ': 다른 앱은 그대로(slimUi 없음)');
});

test('② 두 앱 화면에서 이중으로 있던 것이 걷혔고, 나머지 10개 앱은 그대로다', () => {
  for (const k of SLIM) {
    const h = read(k + '.html');
    for (const id of ['p-yearly', 'yrPillsBar', 'projSt', 'projYrSel', 'projTrackSel', 'openCoachQuickBtn', 'scanAllBtn']) {
      assert.ok(h.indexOf('id="' + id + '"') < 0, k + ': ' + id + ' 이 아직 남아 있다');
    }
    assert.ok(!/data-tab="yearly"/.test(h), k + ': 연도별 자료함 탭이 남아 있다');
    assert.ok(/id="allCsvBtn"/.test(h), k + ': 옛 연도별 자료함 CSV(후보 포함 전체)는 도구 메뉴에 남는다');
    assert.ok(/id="projYrBar"/.test(h) && /id="kpiBox"/.test(h), k + ': 연도 알약·KPI 는 그대로(진짜 한 벌)');
    for (const keep of ['projQ', 'projMgr', 'newProjBtn', 'projCsvBtn', 'syncAllBtn']) assert.ok(h.indexOf('id="' + keep + '"') >= 0, k + ': ' + keep + ' 는 남아야 한다');
  }
  for (const k of OTHERS) {
    const h = read(k + '.html');
    assert.ok(/id="p-yearly"/.test(h) && /id="projSt"/.test(h) && /id="projYrSel"/.test(h), k + ': 이 앱은 건드리지 않는다');
  }
});

test('③ 회차는 «번호»로만 이어 읽는다 — 사건번호 → 이알피 컨설팅 → 정부사업일정(erpId·co_id). 이름이 같아도 안 잇는다', () => {
  const V = loadView(); V.use('clinic', data);
  const r1 = V.roundsOf(P('CL-1', PAST_YR));
  assert.equal(r1.planned, 3, '이알피 계약 일수 3 = 3회차');
  assert.equal(r1.erpNo, 'CL-1');
  assert.equal(r1.items.length, 2, '그 해·현장클리닉 일정만(다른 사업·다른 해 제외)');
  assert.deepEqual(Array.from(r1.items, (i) => i.round), [1, 2]);
  assert.equal(r1.visited, 2); assert.equal(r1.upcoming, 0);
  // 이름만 같은 사업장(c3)에는 이어지지 않는다
  const rn = V.roundsOf(P('CL-4', PAST_YR, { companyName: '(합성)이름만같다' }));
  assert.equal(rn.planned, 0); assert.equal(rn.items.length, 0, '이름으로 회사 잇기 금지(온톨로지)');
  // 사건번호가 없는 사업은 이알피에 못 이어진다
  const rx = V.roundsOf(P('', PAST_YR, { caseNo: '' }));
  assert.equal(rx.linked, false); assert.equal(rx.planned, 0);
});

test('④ 일수는 사람이 적은 consultDays → dayCalc.days 순, 취소 건은 세지 않고, 방문 일정은 «참고»(예정은 따로)', () => {
  const V = loadView(); V.use('clinic', data);
  const r2 = V.roundsOf(P('CL-2', FUTURE_YR, { companyId: 'co2' }));
  assert.equal(r2.planned, 2, 'dayCalc.days 로 물러선다');
  assert.equal(r2.perf, true);
  assert.equal(r2.items.length, 2, '회사 번호(co_id)로도 이어진다 — erpId 가 없을 때');
  assert.equal(r2.visited, 0); assert.equal(r2.upcoming, 2, '앞날 일정은 예정으로 센다');
  const r3 = V.roundsOf(P('CL-3', PAST_YR));
  assert.equal(r3.planned, 0, '취소 건의 일수는 회차로 세지 않는다');
  assert.equal(r3.linked, false);
  // 방문 일정만 있고 일수가 없어도 «일정 N건»은 보인다(계획 회차를 지어내지 않는다)
  const html = V.roundChipsHtml(P('CL-4', PAST_YR));
  assert.ok(/-/.test(html) && !/회차<\/span>/.test(html), '자료가 없으면 «-» 한 글자 — 숫자를 지어내지 않는다');
});

test('⑤ 합계: 성과추적관리는 연간 셈에서 빠지므로 «계획 회차» 합계에 안 넣고 따로 센다 · 일수 모르는 건은 «미확인»', () => {
  const V = loadView(); V.use('clinic', data);
  const html = V.roundKpiHtml([P('CL-1', PAST_YR), P('CL-2', FUTURE_YR), P('CL-4', PAST_YR)]);
  assert.ok(/계획 회차<\/span><b>3회차</.test(html), '3(CL-1)만 합계 — 성과추적 2는 뺀다');
  assert.ok(/성과추적<\/span><b>1건</.test(html));
  assert.ok(/회차 미확인<\/span><b>1건</.test(html));
});

test('⑥ 회차 현황 표: 계획 회차만큼 줄을 놓고 방문일이 없으면 «일정 미정», 앞날이면 «예정»', () => {
  const V = loadView(); V.use('clinic', data);
  const p = V.roundsPanelHtml(P('CL-1', PAST_YR));
  assert.equal((p.match(/<td class="n">/g) || []).length, 3, '3회차 = 세 줄');
  assert.ok(/일정 미정/.test(p) && /방문 완료/.test(p));
  assert.ok(/저장 안 함/.test(p), '읽기만 한다는 말이 화면에 있다');
});

test('⑦ 가벼운 화면이 아닌 앱(상공회의소 등)은 회차 열·합계를 그리지 않는다', () => {
  const V = loadView(); V.use('chamber', data);
  assert.equal(V.roundsOf(P('CL-1', PAST_YR)), null);
  assert.equal(V.roundChipsHtml(P('CL-1', PAST_YR)), '');
  assert.equal(V.roundKpiHtml([P('CL-1', PAST_YR)]), '');
});

test('⑧ 자동으로 만들어진 메모는 번호 칩·자료 칸과 같은 말이라 비워 보이고, 사람이 쓴 메모는 그대로다 (가벼운 화면만)', () => {
  const V = loadView(); V.use('clinic', data);
  assert.equal(V.memoShown({ summaryNote: '[ERP] ERP 수임(현장클리-2026-011)' }), '');
  assert.equal(V.memoShown({ summaryNote: '[메일] 메일 2통 자동분류' }), '');
  assert.equal(V.memoShown({ summaryNote: '[메일] 메일 1통 연결' }), '');
  assert.equal(V.memoShown({ summaryNote: '성과추적 건 — 사후 점검 기록' }), '성과추적 건 — 사후 점검 기록');
  assert.equal(V.memoShown({ summaryNote: '[메일] 대표님 요청으로 따로 적은 메모' }), '[메일] 대표님 요청으로 따로 적은 메모');
  V.use('chamber', data);
  assert.equal(V.memoShown({ summaryNote: '[ERP] ERP 수임(번호)' }), '[ERP] ERP 수임(번호)', '다른 앱 메모는 건드리지 않는다');
});

test('⑨ 화면 코드: 변경점 띠는 가벼운 화면에서 비우고, 연도별 옛 주소는 사업 현황으로, 보고서 탭은 기관 서식 안내 + 일반 원고 접기', () => {
  const v = read('js/pu-consult-view.js');
  assert.ok(/if \(cat\.slimUi\) \{ el\.innerHTML = ''; return; \}/.test(v), '변경점 띠를 가벼운 화면에서 비운다');
  assert.ok(/t === 'yearly' && !\$\('p-yearly'\)\) return 'projects'/.test(v), '?tab=yearly 옛 주소가 빈 화면이 되지 않는다');
  assert.ok(/govReportNote/.test(v) && /genRptFold/.test(v) && /gov-report\.html/.test(v), '기관 서식은 컨설팅보고서로 안내하고 일반 원고는 접는다(지우지 않는다)');
  assert.ok(/safeVal\('scal_cos'\)/.test(v) && !/scal_cos'\)\.(set|update|remove)|ref\('scal_(cos|scheds|types)'\)\.(set|update|remove|push)/.test(v), '정부사업일정은 읽기만 한다');
  // 지우지 않는다 — 일반 보고서 원고·RAG 코치 코드는 그대로 있다
  for (const keep of ['generateHwpxBytes', 'coachSearchLocalBtn', 'saveReportSections']) assert.ok(v.indexOf(keep) >= 0, keep + ' 는 남아 있어야 한다');
});
