'use strict';
/* 🗓 홈 KPI → 연도별 보기 창 (대표 지시 2026-10-07 「kpi 너무 크다 · 클릭하면 팝업창으로 년도별 볼수 있게 · 각각마다 년도별로」)
   못 박는 것:
     ① 셈은 목록 화면과 같은 통·거르기 — 자격·수료(cert 통)·표창(위촉장 통)이 0 이 되거나 두 번 세지지 않는다
     ② 연도 없는 기록은 버리지 않고 «연도 모름» 줄로 · 연도 내림차순
     ③ KPI 칸은 누르면 창이 뜨고, 금액을 싣지 않는다
     ④ 창의 숫자를 누르면 그 목록이 «그 해»로 걸러져 열린다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const bare = SRC.replace(/\/\*[\s\S]*?\*\//g, '');
function 떼기(머리) {
  const i = bare.indexOf(머리); assert.ok(i >= 0, 머리 + ' 없음');
  let d = 0, s = false;
  for (let p = i; p < bare.length; p++) { if (bare[p] === '{') { d++; s = true; } else if (bare[p] === '}') { d--; if (s && !d) return bare.slice(i, p + 1); } }
}
function 상자(통) {
  const 거르기 = {
    wiccok: { store: 'wiccok', filter: (r) => !/표창|포상/.test(r.type || '') },
    award: { store: 'wiccok', filter: (r) => /표창|포상/.test(r.type || '') },
    license: { store: 'cert', filter: (r) => !/수료|이수/.test(r.title || '') },
    complete: { store: 'cert', filter: (r) => /수료|이수/.test(r.title || '') },
    edu: { store: 'edu' },
    case: { store: 'case', filter: (r) => !r.excluded }, consult: { store: 'consult', filter: (r) => !r.excluded },
    fund: { store: 'fund' }, lecture: { store: 'lecture' }, etc: { store: 'etc' }
  };
  const ctx = { CAREER_CFG: 거르기, get: (k) => 통[k] || [] };
  vm.createContext(ctx);
  const 셈 = bare.match(/var HOME_YR_COLS=\{[\s\S]*?\n\};/)[0] + '\n'
    + 떼기('function _homeYrKey(') + '\n' + 떼기('function _homeYrRows(') + '\n'
    + 떼기('function homeYrCols(') + '\n' + 떼기('function homeYrCount(') + '\nthis.homeYrCount=homeYrCount;';
  vm.runInContext(셈, ctx);
  return ctx;
}

test('① 목록과 같은 통·거르기로 센다 — 자격·수료·표창이 0 이 되거나 두 번 세지지 않는다', () => {
  const ctx = 상자({
    wiccok: [{ type: '위촉장', issueDate: '2024-03-01' }, { type: '표창', issueDate: '2023-12-01' }],
    cert: [{ title: '공인노무사', date: '2010-05-01' }, { title: '가나 과정 수료', date: '2024-07-01' }],
    consult: [{ year: '2024' }, { year: '2024', excluded: true }]
  });
  const C = JSON.parse(JSON.stringify(ctx.homeYrCount('all')));
  assert.equal(C.tot.wiccok, 1, '위촉장 통의 표창은 위촉에 안 센다');
  assert.equal(C.tot.award, 1);
  assert.equal(C.tot.license, 1, '자격은 cert 통에서 센다');
  assert.equal(C.tot.complete, 1);
  assert.equal(C.tot.consult, 1, '목록에서 뺀 것(excluded)은 안 센다');
  assert.equal(C.n, 5);
  assert.equal(C.cell['2024'].wiccok, 1);
  assert.equal(C.cell['2024'].consult, 1);
});

test('② 연도 없는 기록은 «연도 모름» 줄로 맨 끝에 · 연도는 내림차순 · 탭마다 열이 다르다', () => {
  const ctx = 상자({ lecture: [{ year: '2023' }, { year: '2025' }, {}, { year: '이상한값' }], etc: [{ date: '2024-01-02' }] });
  const C = JSON.parse(JSON.stringify(ctx.homeYrCount('perf')));
  assert.deepEqual(C.years, ['2025', '2024', '2023', '']);
  assert.equal(C.cell[''].lecture, 2, '연도 없는 것도 버리지 않는다');
  assert.equal(C.n, 5);
  const 열 = (t) => JSON.parse(JSON.stringify(ctx.homeYrCount(t))).cols.map((c) => c[0]);
  assert.ok(!열('perf').includes('wiccok') && 열('career').includes('wiccok') && !열('career').includes('case'));
  assert.ok(열('all').length >= 열('perf').length + 열('career').length);
});

test('③ KPI 칸은 누르면 창이 뜨고 금액을 싣지 않는다 · 한 줄 칸', () => {
  const 그림 = 떼기('function renderHome(');
  assert.match(그림, /onclick="homeYrOpen\('\$\{g\}'\)"/, 'KPI 칸이 창을 연다');
  const kpi = 그림.slice(그림.indexOf('kpi.innerHTML'), 그림.indexOf("join('')", 그림.indexOf('kpi.innerHTML')));
  assert.doesNotMatch(kpi, /fmtKRW|\.a\b/, '홈 KPI 에 금액을 싣지 않는다');
  assert.doesNotMatch(그림, /get\(k\)\.forEach\(r=>\{ if\(inMonth/, '통 이름으로 세지 않는다(_homeYrRows)');
  assert.match(SRC, /\.kpi\.kpi-btn\{[^}]*display:flex[^}]*white-space:nowrap/, '이름·숫자를 한 줄에');
  assert.match(SRC, /id="modalHomeYr"/);
});

test('④ 창의 숫자를 누르면 그 목록이 «그 해»로 걸러져 열린다', () => {
  const 그림 = 떼기('function homeYrDraw(');
  assert.match(그림, /homeYrGo\(/);
  const 감 = 떼기('function homeYrGo(');
  assert.match(감, /navTile\('page-'\+page\)/);
  assert.match(감, /querySelector\('\[data-f="year"\]'\)/, '목록의 연도 고르개를 맞춘다');
  assert.match(감, /sel\.value=y/);
  assert.match(감, /renderCareer\(page\)/);
  /* 목록의 연도 열쇠와 창의 열쇠가 같아야 줄 수가 같다 */
  assert.match(bare, /if\(yr&&\(r\.year\|\|\(r\.issueDate\|\|r\.date\|\|''\)\.slice\(0,4\)\)!==yr\)/);
  assert.match(떼기('function _homeYrKey('), /r\.year\|\|String\(r\.issueDate\|\|r\.date\|\|''\)\.slice\(0,4\)/);
});
