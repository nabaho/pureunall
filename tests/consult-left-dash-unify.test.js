'use strict';
/* 컨설팅 12개 앱 — 화면 틀 하나 · 왼쪽 대시보드 공통 (대표 지시 2026-11-28)
 * 「상공회의소처럼 기관이 여러 개 나뉘거나 비슷한 컨설팅을 몇 회 나눠 한 경우는 왼쪽 대시보드를 만들어 정리하고,
 *   나머지는 기술보호컨설팅 고친 걸 기준으로 다 일치하게」.
 * 규칙: ① 12개 HTML 은 앱 이름·아이콘·키만 다르고 틀은 하나다 ② 왼쪽 대시보드는 «자료»로 켠다(사업이 든 세부 트랙 둘 이상)
 *       ③ 켜지면 위쪽 트랙·연도 알약줄은 숨긴다(같은 고르기 두 군데 금지) ④ «새 지역 추가»는 regionManageable:true 만
 *       ⑤ 보고서 일반 원고 접기는 기관 서식이 컨설팅보고서에 있는 앱만.
 * 자세히: docs/규칙/컨설팅-앱-공통-화면.md */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const Cats = require(path.join(ROOT, 'js', 'pu-consult-catalogs.js'));
const ALL = Cats.NEW_APP_KEYS.slice();

function loadView() {
  const ctx = { console, Date, Math, Object, Array, String, Number, JSON, Promise, RegExp, Error, isFinite, parseInt, setTimeout, clearTimeout, URL, URLSearchParams };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.document = { getElementById: () => null, querySelectorAll: () => [], addEventListener() {}, createElement: () => ({}) };
  ctx.PuConsultCatalogs = Cats;
  ctx.PuConsultIntake = require(path.join(ROOT, 'js', 'pu-consult-intake.js'));
  vm.createContext(ctx);
  vm.runInContext(read('js/pu-consult-view.js'), ctx);
  return ctx.PuConsultView.__test;
}
const proj = (id, trackId) => ({ id, trackId, year: 2026, companyName: '(합성)' + id, status: 'active' });

// 앱마다 달라도 되는 줄(이름·아이콘·키가 든 줄)을 빼고 남은 «틀»
const IDENTITY = /<title>|rel="icon"|<h1>|<h2>|id="syncAllBtn"|role="tablist"|id="leftDash"|pu-coach\.html\?app=|PuConsultView\.boot\(/;
function frame(html) { return html.split(/\r?\n/).filter((x) => !IDENTITY.test(x)).join('\n'); }

test('① 12개 컨설팅 앱 HTML 은 앱 이름·아이콘·키만 다르고 틀이 하나다', () => {
  assert.ok(ALL.length >= 12, '컨설팅 앱 목록');
  const base = frame(read(ALL[0] + '.html'));
  for (const k of ALL.slice(1)) {
    const f = frame(read(k + '.html'));
    if (f !== base) {
      const a = base.split('\n'), b = f.split('\n');
      let i = 0; while (i < a.length && a[i] === b[i]) i++;
      assert.fail(k + '.html 의 틀이 ' + ALL[0] + '.html 과 다르다 — 첫 차이: «' + (b[i] || '').trim().slice(0, 90) + '»');
    }
  }
});

test('② 모든 앱에 왼쪽 대시보드 틀이 있고, 이중 표시(연도별 자료함 탭·선택칸·RAG 단추·재스캔)는 없다', () => {
  for (const k of ALL) {
    const h = read(k + '.html');
    assert.ok(/class="dash-shell"/.test(h) && /id="leftDash"/.test(h) && /class="dash-main"/.test(h), k + ': 대시보드 틀');
    assert.ok(/\.dash-shell\.no-left\{display:block\}/.test(h), k + ': 대시보드가 꺼질 때 한 단으로 접는 CSS');
    for (const id of ['p-yearly', 'projTrackSel', 'projSt', 'projYrSel', 'openCoachQuickBtn', 'scanAllBtn']) {
      assert.ok(h.indexOf('id="' + id + '"') < 0, k + ': ' + id + ' 가 남아 있다');
    }
    assert.ok(!/data-tab="yearly"/.test(h), k + ': 연도별 자료함 탭');
    for (const keep of ['projYrBar', 'projTrackBar', 'kpiBox', 'projQ', 'projMgr', 'newProjBtn', 'projCsvBtn', 'allCsvBtn', 'syncAllBtn']) {
      assert.ok(h.indexOf('id="' + keep + '"') >= 0, k + ': ' + keep + ' 는 남아야 한다');
    }
  }
});

test('③ 왼쪽 대시보드는 «자료»로 켠다 — 사업이 든 세부 트랙이 둘 이상이면 켜고, 하나면 접는다', () => {
  const V = loadView();
  V.use('pubconsult', {});
  const [t1, t2] = Cats.get('pubconsult').tracks;
  V.setProjects({ a: proj('a', t1.id), b: proj('b', t1.id) });
  assert.equal(V.leftDashWanted(), false, '한 트랙뿐이면 왼쪽 칸을 접는다(기술보호처럼 한 단)');
  V.setProjects({ a: proj('a', t1.id), b: proj('b', t2.id) });
  assert.equal(V.leftDashWanted(), true, '기관이 둘로 나뉘면 왼쪽 대시보드');
  V.setProjects({ a: proj('a', t1.id), b: proj('b', '') });
  assert.equal(V.leftDashWanted(), false, '트랙이 비어 있는 사업은 «다른 기관»으로 세지 않는다');
  // 늘 켜는 앱(상공회의소·6차산업)은 한 지역뿐이어도 켠다 — «새 지역 추가» 단추 자리
  V.use('chamber', {});
  V.setProjects({ a: proj('a', Cats.get('chamber').tracks[0].id) });
  assert.equal(V.leftDashWanted(), true);
});

test('④ 대시보드 문구는 카탈로그에서 오고, «새 지역 추가»는 regionManageable:true 앱만', () => {
  const V = loadView();
  V.use('pubconsult', {});
  const L = V.leftDashLabels();
  assert.ok(/기관/.test(L.head) && /기관/.test(L.all), '공공기관컨설팅은 «기관별»');
  assert.ok(!/상공회의소/.test(L.head + L.all + L.scopeAll), '다른 앱에 상공회의소 문구가 새지 않는다');
  V.use('chamber', {});
  assert.ok(/상공회의소/.test(V.leftDashLabels().all));
  const v = read('js/pu-consult-view.js');
  assert.ok(/cat\.regionManageable === true \?/.test(v), '추가 단추는 regionManageable 이 true 일 때만');
  assert.equal(Cats.get('chamber').regionManageable, true);
  for (const k of ALL.filter((x) => x !== 'chamber')) assert.notEqual(Cats.get(k).regionManageable, true, k + ': 지역 추가 단추가 생긴다');
});

test('⑤ 왼쪽 대시보드는 «이름만»(건수는 title) — 연도는 위쪽 알약 한 곳, 위쪽 트랙 알약은 숨김, 목록 화면에서만', () => {
  // 대표 지시 2026-11-28 상공회의소 «왼쪽 대시보드에는 지역 상공회의소 이름만 있으면 된다»
  const v = read('js/pu-consult-view.js');
  const s = v.indexOf('function renderLeftDash()');
  const ld = v.slice(s, v.indexOf('\n  }\n', s) > 0 ? v.indexOf('\n  }\n', s) : v.indexOf('\r\n  }\r\n', s));
  assert.ok(!/ld-yr-btn|ld-year-box|ld-sub/.test(ld), '왼쪽에 연도 단추·연도 상자·숫자 줄이 남아 있다');
  assert.ok(/title="' \+ esc\(title\)/.test(ld), '건수는 이름에 마우스를 올리면(title) 보인다');
  assert.ok(/trackBar\.style\.display = \(\(oneTrackSlim && !TRACK_FILTER\) \|\| ldSlim/.test(v), '위쪽 트랙 알약줄 숨김(같은 고르기 두 곳 금지)');
  assert.ok(!/\$\('projYrBar'\)\.style\.display = ldSlim/.test(v), '연도 알약은 대시보드가 켜져도 위쪽 한 곳에 남아야 한다');
  assert.ok(/CUR_TAB === 'projects' \|\| CUR_TAB === 'inbox'/.test(v), '진행·체크·보고서 작업실은 넓게');
  assert.ok(/classList\.toggle\('no-left'/.test(v), '꺼질 때 한 단으로');
  for (const k of ALL) assert.ok(!/\.ld-year-box\{|\.ld-yr-btn\{/.test(read(k + '.html')), k + ': 안 쓰는 연도 상자 CSS');
});

test('⑦ 표는 12개 앱 공통 «독립 열» — 연도·사업장명·ERP 번호·진행상태가 각자 열이고, 사업장명 옆에 연도·번호 칩을 붙이지 않는다', () => {
  const v = read('js/pu-consult-view.js');
  assert.ok(/'<td class="yr" title="' \+ esc\(yr\)/.test(v), '연도 독립 열');
  assert.ok(/'<td class="ti" title="' \+ esc\(p\.companyName\) \+ '">' \+ esc\(p\.companyName\) \+ '<\/td>'/.test(v), '사업장명 칸에는 이름만');
  assert.ok(/<td data-k="erp">' \+ erpCellHtml\(p, audit\)/.test(v), 'ERP 번호 독립 열');
  assert.ok(/var clsList = \['split-row'\]/.test(v), '폰 카드도 모든 앱이 같은 독립 열 배치(split-row)');
  assert.ok(/<th data-k="erp">ERP 번호<\/th>/.test(v));
});

test('⑧ ERP 사건번호 연결 점검 — 이름만 닮았다고 붙이지 않고, 후보가 정확히 하나일 때만 사람이 [연결]', () => {
  const I = require(path.join(ROOT, 'js', 'pu-consult-intake.js'));
  const typeName = Cats.get('chamber').erpTypeKeywords[0];
  const consultings = [
    { id: 'e1', no: 'CH-2026-001', companyName: '(합성)가나산업', consultingType: typeName, year: 2026, status: 'progress' },
    { id: 'e2', no: 'CH-2026-002', companyName: '(합성)다라정밀', consultingType: typeName, year: 2026, status: 'progress' },
    { id: 'e3', no: 'CH-2026-003', companyName: '(합성)다라정밀', consultingType: typeName, year: 2026, status: 'progress' },
    { id: 'e9', no: 'CH-2026-009', companyName: '(합성)취소건', consultingType: typeName, year: 2026, status: 'cancelled' }
  ];
  const projects = [
    { id: 'p1', companyName: '(합성)가나산업', year: 2026, trackId: 't' },              // 후보 1건
    { id: 'p2', companyName: '(합성)다라정밀', year: 2026, trackId: 't' },              // 후보 여럿
    { id: 'p3', companyName: '(합성)마바물산', year: 2026, trackId: 't' },              // 못 찾음
    { id: 'p4', companyName: '(합성)사아상사', year: 2021, trackId: 't' },              // 원장에 그 연도 없음
    { id: 'p5', companyName: '(합성)지역상공회의소', year: 2026, trackId: 't' },        // 기관명
    { id: 'p6', companyName: '(합성)가나산업', year: 2026, trackId: 't', caseNo: 'CH-2026-001' } // 같은 사업장이 번호를 가진 줄로 이미 있다
  ];
  const a = I.auditErpLinks('chamber', projects, { consultings });
  assert.equal(a.byPid.p6.state, 'linked');
  assert.equal(a.byPid.p1.reason, 'twin', '번호가 이미 다른 줄에 붙었으면(같은 이름) 중복으로 본다 — 자동 연결하지 않는다');
  assert.equal(a.byPid.p2.reason, 'ambiguous', '후보가 여럿이면 고르지 않는다');
  assert.equal(a.byPid.p3.reason, 'none');
  assert.equal(a.byPid.p4.reason, 'noyear');
  assert.equal(a.byPid.p5.reason, 'agency');
  const a2 = I.auditErpLinks('chamber', projects.filter((p) => p.id !== 'p6'), { consultings });
  assert.equal(a2.byPid.p1.reason, 'candidate', '쓰이지 않은 번호가 정확히 하나면 «후보 1건»');
  assert.ok(!a2.byPid.p1.cands.some((c) => c.no === 'CH-2026-009'), '취소 건은 후보가 아니다');
  const v = read('js/pu-consult-view.js');
  assert.ok(/a\.reason === 'candidate' && a\.cands && a\.cands\[0\]/.test(v), '[연결] 단추는 후보 1건일 때만');
  assert.ok(/global\.confirm\(p\.companyName \+ ' 에 ERP 사건번호 '/.test(v), '연결은 사람이 확인한 뒤에만 저장');
  assert.ok(/saveProjectPatch\(pid, \{ caseNo: no \}\)/.test(v), '저장은 caseNo 한 칸만');
});

test('⑥ 가벼운 화면은 12개 앱 공통, 보고서 일반 원고 접기는 기관 서식이 컨설팅보고서에 있는 앱만', () => {
  const V = loadView();
  for (const k of ALL) { V.use(k, {}); assert.equal(V.isSlim(), true, k + ': 가벼운 화면'); }
  const folded = ALL.filter((k) => { V.use(k, {}); return V.reportFolded(); });
  assert.ok(folded.indexOf('techprotect') >= 0 && folded.indexOf('clinic') >= 0, '기술보호·현장클리닉 서식은 컨설팅보고서에 있다');
  for (const k of ['hrconsult', 'evalcomp', 'unionneg']) assert.ok(folded.indexOf(k) < 0, k + ': 기관 서식이 없어 원고가 곧 산출물 — 접지 않는다');
});

test('⑨ 사업장 단위 묶어 보기(기초인사노무만) — 같은 사업장의 연도별 건이 한 줄, 저장된 건은 그대로', () => {
  const V = loadView();
  for (const k of ALL) { V.use(k, {}); assert.equal(V.isGrouped(), k === 'hrconsult', k + ': 묶어 보기는 기초인사노무만(카탈로그 groupByCompany)'); }
  V.use('hrconsult', {});
  const rows = [
    { id: 'a1', companyId: 'co1', companyName: '(합성)가', year: 2024, status: 'done' },
    { id: 'a2', companyId: 'co1', companyName: '(합성)가', year: 2026, status: 'active' },
    { id: 'b1', companyName: '(합성)나', year: 2025, status: 'done' },
    { id: 'b2', companyName: '(합성)나', year: 2023, status: 'done' }
  ];
  const g = V.groupProjects(rows);
  assert.equal(g.length, 2, '사업장 둘');
  const ga = g.find((x) => x.key === 'c:co1');
  assert.equal(ga.rows.length, 2);
  assert.equal(ga.head.id, 'a2', '대표는 가장 최근 연도 건');
  assert.equal(ga.active, true, '진행 중 연도가 하나라도 있으면 진행중');
  assert.equal(g.find((x) => x.key !== 'c:co1').active, false, '모두 끝났으면 완료');
  const v = read('js/pu-consult-view.js');
  assert.ok(/<td class="yr g"/.test(v) && /data-pick-yr=/.test(v), '연도 칸에 연도 칩(누르면 그 해 건)');
  assert.ok(/function confirmGroupedBulk\(list, verb\)/.test(v) && /if \(!confirmGroupedBulk\(list, '보관삭제'\)\) return;/.test(v), '여러 연도 건을 한꺼번에 지울 때는 건수를 말하고 다시 묻는다');
  assert.ok(!/groupProjects[\s\S]{0,400}saveRecord/.test(v.slice(v.indexOf('function groupProjects'), v.indexOf('function groupProjects') + 900)), '묶음은 보기 전용 — 저장하지 않는다');
});

test('⑩ 출산육아·유연근무 — 사업별 다섯 갈래 · 근거 분류 · 저장은 사람이 «분류 바꾸기»를 누를 때만', () => {
  // 대표 지시 2026-11-28 «출산·육아휴직 우수기업, 가족친화인증, 일생활균형, 근로시간 단축, 재택근무 — 왼쪽 대시보드로 사업별로 나누고 정확하게 다시 분류,
  // 전혀 상관없는 컨설팅 확인»
  const fw = Cats.get('familywork');
  assert.deepEqual(fw.tracks.map((t) => t.id).sort(), ['fw_balance', 'fw_cert', 'fw_cut', 'fw_maternity', 'fw_remote'].sort());
  assert.equal(fw.hasLeftDashboard, true);
  assert.ok(fw.trackAudit && fw.legacyTrackIds.indexOf('fw_flex') >= 0, '옛 갈래는 자료를 지우지 않고 근거로 다시 놓는다');
  const I = require(path.join(ROOT, 'js', 'pu-consult-intake.js'));
  const C = (t) => (I.classifyFamilywork(t) || {}).id;
  assert.equal(C('(합성) 노동시간 단축 컨설팅 결과보고'), 'fw_cut', '«노동시간 단축»(노무사회 사업명)을 안다');
  assert.equal(C('육아기 근로시간 단축 규정 정비'), 'fw_maternity', '육아기 단축은 출산·육아 제도');
  assert.equal(C('가족친화인증 심사 대비'), 'fw_cert');
  assert.equal(C('재택근무 도입'), 'fw_remote');
  assert.equal(C('근무혁신 유연근무'), 'fw_balance');
  assert.equal(C('산업일자리전환 컨설팅 착수'), 'fw_offtopic', '다른 사업 글만 있으면 «관련 없음»');
  assert.equal(I.classifyFamilywork('사규 송부'), null, '근거가 없으면 분류를 지어내지 않는다');
  assert.equal(C('가족친화 재택'), 'fw_check', '비기면 사람이 정할 «분류 확인»');
  // 화면: 읽을 때만 사본에 얹고, 저장 관문이 원래 갈래로 되돌린다
  const V = loadView();
  V.use('familywork', {});
  V.setProjects({
    a: { companyName: '(합성)가', year: 2023, trackId: 'fw_maternity', summaryNote: '노동시간 단축 컨설팅' },
    b: { companyName: '(합성)나', year: 2026, trackId: 'fw_flex', summaryNote: '재택근무 컨설팅' },
    c: { companyName: '(합성)다', year: 2026, trackId: 'fw_maternity', summaryNote: '산업일자리전환 착수' },
    d: { companyName: '(합성)라', year: 2026, trackId: 'fw_cert', summaryNote: '가족친화인증' }
  });
  const au = V.trackAuditMap();
  assert.equal(au.a.to, 'fw_cut');
  assert.equal(au.b.to, 'fw_remote', '옛 갈래(fw_flex)는 근거로 다섯 갈래에');
  assert.equal(au.c.to, 'fw_offtopic');
  assert.equal(au.d.changed, false, '맞게 들어간 건은 그대로');
  const v = read('js/pu-consult-view.js');
  assert.ok(/if \(!Object\.prototype\.hasOwnProperty\.call\(pt, 'trackId'\)\) \{ rec\.trackId = rec\._storedTrackId;/.test(v), '저장 관문이 화면 보정 갈래를 서버로 보내지 않는다');
  assert.ok(/saveProjectPatch\(r\.pid, \{ trackId: r\.to, trackName:/.test(v), '«분류 바꾸기»는 갈래 두 칸만 patch');
  assert.ok(/global\.confirm\(list\.length \+ '건의 사업 갈래를 권장 갈래로 바꿀까요\?'/.test(v), '건수를 묻는다');
  assert.ok(/var rawDone = projectById\(p\.id\) \|\| p;/.test(v) && /\{ patch: \{ status: 'done' \} \}/.test(v), '일괄 완료도 원본에 «바꾼 칸만»');
});
