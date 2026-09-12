/* ══════ 📅 계약이 «끝났거나 곧 끝나는» 곳만 한자리에 (대표 지시 2026-09-12) ═══════
   대표: 「추천대로 해라」 — 기능 검토 보고의 ①

   ■ 무엇이 없었나
   앱은 **이미** 계약 기간을 읽어 「종료일 지남」까지 판정하고 있었다(erpContractPeriod).
   그런데 그 값이 «회사 상세를 열어야» 보였다 — 4,000곳 가운데 어디가 지났는지 알려면
   한 곳씩 열어 보는 수밖에 없었다. 중소기업 확인서와 똑같은 자리였다.

   ★ 못 박는 것
     ① 잣대는 erpContractPeriod «한 곳»이다 — 상세 줄과 목록이 다른 말을 하면 안 된다.
     ②⚠⚠ **「종료일 지남」과 「계약해지(🚪)」는 다른 말이다.** 자동 연장으로 계속 가는
        곳이 있다. 해지로 «표시된» 곳은 이미 끝낸 일이라 안 담는다 — 담으면 정작
        챙길 곳이 묻힌다. 그리고 **뺀 곳은 세어서 말한다**(조용히 빼면 화면이 거짓말을 한다).
     ③ 날짜로 «못 읽은» 종료일과 «아예 없는» 종료일은 안 담는다 — 기간을 안 적은 것이지
        끝난 것이 아니다.
     ④ 급한 순이다 — 지난 것이 먼저, 더 오래 지난 것이 더 앞.
     ⑤ 0곳이면 띠를 «아예 안 띄운다».
     ⑥ 켤 수 있는 거르개는 이름표가 있어야 한다.

   node --test tests/cards-co-contract-due.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { cutFn } = require('./cut-fn');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8')
  .split('\r\n').join('\n');

const 오늘 = '2026-09-12';

/* 잣대·목록·띠·창을 통째로 떠서 «돌린다» — 글자만 찾으면 조건이 뒤집혀도 통과한다 */
function load(list) {
  const ctx = { Object, Array, String, Number, Math, Date, JSON, isNaN, console,
    esc: s => String(s == null ? '' : s),
    coList: () => list || [],
    todayYmd: () => 오늘,
    _closeBtn: () => '<x>',
    _panelShown: null,
    showPanel(h){ ctx._panelShown = h; } };
  vm.createContext(ctx);
  vm.runInContext([
    /* ⚠ 진짜를 싣는다 — erpContractPeriod 를 대역으로 바꾸면 「종료일 지남」 판정이
       틀려도 이 검사가 모른다. coSmeDays 도 마찬가지(날짜 세기를 여기서 베끼면 두 벌이 된다). */
    cutFn(SRC, 'function erpContractPeriod('), cutFn(SRC, 'function coSmeDays('),
    cutFn(SRC, 'function coCtState('), cutFn(SRC, 'function coCtClosed('),
    cutFn(SRC, 'function coCtNeeds('), cutFn(SRC, 'function coCtList('),
    cutFn(SRC, 'function coCtCount('), cutFn(SRC, 'function coCtClosedCount('),
    cutFn(SRC, 'function coCtBarHtml('), cutFn(SRC, 'function coCtHtml(')
  ].join('\n'), ctx);
  return ctx;
}
/* 회사 하나 — 계약 기간은 업체관리(erp)가 가진 값이다 */
const 회사 = (name, to, extra) => ({ key:name, name:name,
  erp: Object.assign({ type:'자문', ctFrom:'2025-01-01', ctTo:to }, extra || {}) });

/* ── ①③ 무엇을 담는가 ────────────────────────────────────────────────── */

test('★★★ 끝난 곳과 곧 끝나는 곳만 담는다', () => {
  const c = load([ 회사('지남','2026-03-31'), 회사('임박','2026-10-01'),
                   회사('아직멀다','2027-03-31') ]);
  assert.deepEqual(c.coCtList().map(x => x.name), ['지남','임박'],
    '★★★ 살아 있는 계약까지 담으면 「전체 목록」이 되어 챙길 곳이 묻힌다');
});

test('★★★ 종료일이 «아예 없는» 곳은 담지 않는다 — 기간을 안 적은 것이지 끝난 것이 아니다', () => {
  const c = load([ 회사('없음',''), { key:'erp없음', name:'erp없음', erp:null },
                   { key:'칸자체없음', name:'칸자체없음' } ]);
  assert.equal(c.coCtList().length, 0,
    '★★★ 기간을 안 적은 곳까지 담으면 4,000곳이 통째로 올라온다');
});

test('★★ 날짜로 «못 읽은» 종료일은 담지 않는다 — 늑대 소년이 되면 안 된다', () => {
  const c = load([ 회사('별도협의','별도 협의시까지') ]);
  assert.equal(c.coCtList().length, 0,
    '★★ 모르는 것을 급하다고 하면, 진짜 급한 것도 안 믿게 된다');
});

/* ── ② 해지와 «다른 말»이다 ───────────────────────────────────────────── */

test('★★★ 계약해지(🚪)로 표시된 곳은 «안 담는다» — 이미 끝낸 일이다', () => {
  const c = load([ 회사('해지됨','2026-03-31',{ left:true }),
                   회사('살아있음','2026-03-31') ]);
  assert.deepEqual(c.coCtList().map(x => x.name), ['살아있음'],
    '★★★ 끝낸 곳이 섞이면 정작 챙길 곳이 그 속에 묻힌다');
});

test('★★★ 그런데 «뺀 곳 수»는 말한다 — 조용히 빼면 화면이 거짓말을 한다', () => {
  const c = load([ 회사('해지1','2026-03-31',{ left:true }),
                   회사('해지2','2026-10-01',{ left:true }),
                   회사('살아있음','2026-03-31') ]);
  assert.equal(c.coCtClosedCount(), 2, '★★ 뺀 곳을 안 세고 있다');
  const h = c.coCtHtml();
  assert.match(h, /2곳<\/b>은 뺐습니다/,
    '★★★ 뺀 사실을 안 적으면 「우리 거래처가 이것뿐인가」로 읽힌다');
});

test('★★ 해지된 곳이어도 «날짜가 멀면» 뺀 곳으로도 안 센다', () => {
  const c = load([ 회사('해지인데멀다','2027-03-31',{ left:true }) ]);
  assert.equal(c.coCtClosedCount(), 0,
    '★★ 애초에 챙길 날짜가 아닌 곳까지 「뺐습니다」에 세면 그 숫자가 뜻을 잃는다');
});

/* ── ④ 급한 순 ────────────────────────────────────────────────────────── */

test('★★★ 급한 순으로 선다 — 지난 것이 먼저, 더 오래 지난 것이 더 앞', () => {
  const c = load([ 회사('임박15','2026-09-27'), 회사('오래지남','2025-01-31'),
                   회사('막지남','2026-09-01'), 회사('임박3','2026-09-15') ]);
  assert.deepEqual(c.coCtList().map(x => x.name),
    ['오래지남','막지남','임박3','임박15'],
    '★★★ 차례가 급한 순이 아니면 맨 위부터 처리할 수가 없다');
});

test('★ 남은 날과 종료일을 «함께» 들고 온다 — 화면이 그것으로 D-날짜를 적는다', () => {
  const c = load([ 회사('지남','2026-09-02'), 회사('임박','2026-09-20') ]);
  const [a, b] = c.coCtList();
  assert.equal(a.days, -10); assert.equal(a.cls, 'gone'); assert.equal(a.to, '2026-09-02');
  assert.equal(b.days, 8);   assert.equal(b.cls, 'soon');
});

/* ── ⑤ 띠 ─────────────────────────────────────────────────────────────── */

test('★★★ 챙길 곳이 없으면 띠를 «아예 안 띄운다»', () => {
  const c = load([ 회사('멀다','2027-03-31'), 회사('해지','2026-01-01',{ left:true }) ]);
  assert.equal(c.coCtBarHtml(), '',
    '★★★ 늘 뜨는 띠는 눈이 배경으로 배운다 — 정작 급할 때 안 읽힌다');
});

test('★★ 띠가 «지남 몇 곳 · 30일 안 몇 곳»을 갈라 말한다', () => {
  const c = load([ 회사('지남1','2026-03-31'), 회사('지남2','2026-08-01'),
                   회사('임박1','2026-10-01') ]);
  const h = c.coCtBarHtml();
  assert.match(h, /종료일 지남 <b>2곳<\/b>/, '★★ 몇 곳이 이미 지났는지가 가장 급한 값이다');
  assert.match(h, /30일 안 <b>1곳<\/b>/);
  assert.match(h, /openCoCt\(\)/, '★ 눌러서 볼 길이 없다');
});

test('★ 한쪽이 0곳이면 그쪽은 «안 적는다»', () => {
  const c = load([ 회사('임박','2026-10-01') ]);
  const h = c.coCtBarHtml();
  assert.ok(!/종료일 지남 <b>/.test(h), '★ 「지남 0곳」이 적혀 있다');
  assert.match(h, /30일 안 <b>1곳<\/b>/);
});

/* ── 창 ───────────────────────────────────────────────────────────────── */

test('★★★ 창이 회사마다 «언제까지»와 «얼마나 급한지»를 말한다', () => {
  const c = load([ 회사('지남회사','2026-09-02'), 회사('임박회사','2026-09-20') ]);
  const h = c.coCtHtml();
  assert.match(h, /챙길 곳 2곳/, '★ 몇 곳인지 없다');
  assert.match(h, /종료 10일 지남/, '★★★ 얼마나 지났는지 없으면 급한 정도를 모른다');
  assert.match(h, /D-8/, '★★ 며칠 남았는지 없다');
  assert.match(h, /2026-09-02까지/, '★★ 언제까지인지 없으면 무엇을 갱신할지 모른다');
});

test('★★★ 창이 «해지가 아니다»라고 밝힌다 — 섞으면 멀쩡한 거래처를 끝난 곳으로 읽는다', () => {
  const c = load([ 회사('지남','2026-09-02') ]);
  assert.match(c.coCtHtml(), /계약해지가 아닙니다/,
    '★★★ 자동 연장으로 계속 가는 곳이 있다 — 그 말이 없으면 해지로 읽고 정리해 버린다');
});

test('★★ 회사를 누르면 «창을 닫고» 그 회사를 연다', () => {
  const c = load([ 회사('가나','2026-09-02') ]);
  const h = c.coCtHtml();
  assert.match(h, /pickCo\('가나'\)/, '★★ 눌러도 그 회사로 못 간다');
  assert.match(h, /dedupBg\.classList\.remove\('open'\)/,
    '★★ 창을 안 닫으면 상세가 창 뒤에 열려 아무 일도 없는 것처럼 보인다');
});

test('★ 챙길 곳이 없으면 창은 «없다»고 말한다 — 빈 목록은 고장으로 읽힌다', () => {
  const c = load([ 회사('멀다','2027-03-31') ]);
  assert.match(c.coCtHtml(), /없습니다/);
});

/* ── ①⑥ 잣대가 «한 곳»인가 · 이름표 ──────────────────────────────────── */

test('★★★ 띠·창·거르개가 모두 «같은 잣대»(coCtNeeds)를 본다', () => {
  assert.match(cutFn(SRC, 'function coCtList('), /coCtNeeds\(o, now\)/,
    '★★ 목록이 제 잣대를 따로 두면 띠와 어긋난다');
  assert.match(cutFn(SRC, 'function coCtState('), /erpContractPeriod\(/,
    '★★★ 계약 기간을 여기서 다시 읽으면 상세 줄과 목록이 다른 말을 한다');
  const filt = cutFn(SRC, 'function coFilteredList(');
  assert.match(filt, /state\.coOnlyCtOld && !skipTodo\) list = list\.filter\(o=>coCtNeeds\(o\)\)/,
    '★★★ 거르개가 제 잣대를 따로 두면 「띠는 3곳인데 목록은 5곳」이 된다');
});

test('★★★ 거르개를 켜면 «무엇으로 걸렀는지» 딱지가 말한다', () => {
  const lab = SRC.slice(SRC.indexOf('const CO_TODO_LABEL'), SRC.indexOf('function clearCoTodo'));
  assert.match(lab, /coOnlyCtOld:/, '★★★ 걸어 놓고 아무 말이 없으면 되돌릴 길도 안 보인다');
  assert.match(cutFn(SRC, 'function coFilters('), /k: 'coOnlyCtOld'/, '★★ 거르개 메뉴에 없다');
});

test('★★ 띠를 목록 위에 «실제로» 내보낸다 — 만들어 놓고 안 붙이면 소용없다', () => {
  assert.match(cutFn(SRC, 'function coListHtml('), /coCtBarHtml\(\)/,
    '★★★ 띠를 그리는 자리가 없다');
});
