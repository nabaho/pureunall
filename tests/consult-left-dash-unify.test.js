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

test('⑤ 대시보드가 켜지면 위쪽 트랙·연도 알약줄을 숨기고, 목록 화면(사업 현황·미등록 후보)에서만 보인다', () => {
  const v = read('js/pu-consult-view.js');
  assert.ok(/trackBar\.style\.display = \(\(oneTrackSlim && !TRACK_FILTER\) \|\| ldSlim\)/.test(v), '트랙 알약줄 숨김');
  assert.ok(/\$\('projYrBar'\)\.style\.display = ldSlim \? 'none' : ''/.test(v), '연도 알약줄 숨김');
  assert.ok(/CUR_TAB === 'projects' \|\| CUR_TAB === 'inbox'/.test(v), '진행·체크·보고서 작업실은 넓게');
  assert.ok(/classList\.toggle\('no-left'/.test(v), '꺼질 때 한 단으로');
});

test('⑥ 가벼운 화면은 12개 앱 공통, 보고서 일반 원고 접기는 기관 서식이 컨설팅보고서에 있는 앱만', () => {
  const V = loadView();
  for (const k of ALL) { V.use(k, {}); assert.equal(V.isSlim(), true, k + ': 가벼운 화면'); }
  const folded = ALL.filter((k) => { V.use(k, {}); return V.reportFolded(); });
  assert.ok(folded.indexOf('techprotect') >= 0 && folded.indexOf('clinic') >= 0, '기술보호·현장클리닉 서식은 컨설팅보고서에 있다');
  for (const k of ['hrconsult', 'evalcomp', 'unionneg']) assert.ok(folded.indexOf(k) < 0, k + ': 기관 서식이 없어 원고가 곧 산출물 — 접지 않는다');
});
