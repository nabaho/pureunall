/* ══════ 📅 계약 갱신은 «스스로 말 걸지 않는다» (대표 지시 2026-09-17) ═══════════
   「계약갱신은 특별한 문제가 없으면 자동으로 갱신한다 — 일부러 표시할 필요없다」

   ■ 두 번에 걸쳐 좁히다가, 결국 «없애는 것»이 답이었다
     2026-09-12 «만들었다» — 계약 기간은 회사 상세를 열어야만 보였다. 목록 위 띠와
       창을 만들어 「어디를 챙길 것인가」를 한자리에 모았다.
     2026-09-15 «좁혔다» — 「종료일 지났어도 특별한 상황이 없으면 표시 안 되게 해라」.
       91곳이던 것을 30일 창으로 줄여 5곳으로 만들었다.
     2026-09-17 «없앴다» — 그 5곳도 대표 화면에 떴다. 보시니 「종료 16일 지남」 셋과
       「D-14」 하나 — 모두 그냥 자동 연장될 곳이었다.
       숫자를 줄인 것이지 **띄울 까닭을 만든 것이 아니었다.**

   ★★ 이 일의 참뜻: 계약 갱신에는 «특별한 문제»라는 신호가 데이터에 없다.
     날짜가 지났다는 것은 사실일 뿐 문제가 아니다. 진짜 문제인 곳은 이미 다른 이름으로
     서 있다 — 계약해지(🚪)는 종료 탭에, 폐업·휴업은 국세청 딱지에.

   ★ 그래서 이 검사가 지키는 것은 둘이다
     ㉠ 목록 위에 계약 갱신 띠가 **없다**(그리고 다시 생기지 않는다)
     ㉡ 그렇다고 «기능이 사라진 것은 아니다» — 🔎 거르개 › 📅 계약 갱신 으로
        대표가 «골라서» 보실 수 있고, 그 잣대는 예전과 똑같다

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
const 기준시각 = new Date(2026, 8, 12, 15, 30).getTime();
class 고정날짜 extends Date {
  constructor(...args){ super(...(args.length ? args : [기준시각])); }
  static now(){ return 기준시각; }
}

/* 잣대와 목록을 통째로 떠서 «돌린다» — 글자만 찾으면 조건이 뒤집혀도 통과한다 */
function load(list) {
  const ctx = { Object, Array, String, Number, Math, Date:고정날짜, JSON, isNaN, console,
    esc: s => String(s == null ? '' : s),
    coList: () => list || [],
    todayYmd: () => 오늘 };
  vm.createContext(ctx);
  vm.runInContext([
    /* ⚠ 진짜를 싣는다 — erpContractPeriod 를 대역으로 바꾸면 「종료일 지남」 판정이
       틀려도 이 검사가 모른다. coSmeDays 도 마찬가지(날짜 세기를 여기서 베끼면 두 벌이 된다). */
    cutFn(SRC, 'function erpContractPeriod('), cutFn(SRC, 'function coSmeDays('),
    cutFn(SRC, 'function coCtState('), cutFn(SRC, 'function coCtClosed('),
    SRC.match(/^const CT_RECENT_DAYS = [^\n]*$/m)[0].replace('const ', 'var '),
    cutFn(SRC, 'function coCtInWindow('), cutFn(SRC, 'function coCtNeeds('),
    cutFn(SRC, 'function coCtList('), cutFn(SRC, 'function coCtCount(')
  ].join('\n'), ctx);
  return ctx;
}
/* 회사 하나 — 계약 기간은 업체관리(erp)가 가진 값이다 */
const 회사 = (name, to, extra) => ({ key:name, name:name,
  erp: Object.assign({ type:'자문', ctFrom:'2025-01-01', ctTo:to }, extra || {}) });

/* ══ ㉠ 목록 위에 계약 갱신 띠가 «없다» ══════════════════════════════════ */

test('★★★ 목록 위 띠 줄에 계약 갱신이 «안» 낀다 — 실제로 그려서 본다', () => {
  /* ⚠ 「coCtBarHtml 글자가 없다」로 보지 «않는다». 띠 줄을 실제로 그려, 나온 것이
     넷뿐인지 본다 — 이름을 바꿔 도로 끼워 넣어도 이 검사가 잡는다. */
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext([
    "function coOrphanBarHtml(){ return '<ORPHAN>'; }",
    "function coClashBarHtml(){ return '<CLASH>'; }",
    "function coSmeBarHtml(){ return '<SME>'; }",
    "function coNtsBarHtml(){ return '<NTS>'; }",
    cutFn(SRC, 'function coBarsHtml(')
  ].join('\n'), ctx);
  const h = ctx.coBarsHtml();
  assert.equal(h, '<ORPHAN><CLASH><SME><NTS>',
    '★★★ 계약 갱신 띠가 도로 끼었습니다 — 자동 갱신될 곳을 띄우면 늘 뜨는 띠가 된다: ' + h);
  assert.ok(h.indexOf('계약') < 0, '★★★ 띠 줄에 계약 이야기가 남아 있다: ' + h);
});

test('★★★ 띠와 창을 그리던 함수가 «아예 없다» — 남겨 두면 언젠가 다시 불린다', () => {
  ['function coCtBarHtml(', 'function coCtHtml(', 'function openCoCt(',
   'function coCtOldCount(', 'function coCtClosedCount('].forEach(function (f) {
    assert.ok(SRC.indexOf(f) < 0,
      '★★★ ' + f + ' 가 되살아났습니다 — 두 번 겪고 지운 길입니다');
  });
  assert.ok(SRC.indexOf('.coctbar{') < 0, '★★ 띠 모양(.coctbar)이 도로 생겼습니다');
});

/* ══ ㉡ 그렇다고 기능이 사라진 것은 «아니다» ════════════════════════════ */

test('★★★ 🔎 거르개로 «골라서» 보실 수 있다 — 이것이 남은 유일한 길이다', () => {
  assert.match(cutFn(SRC, 'function coFilters('), /k: 'coOnlyCtOld'/,
    '★★★ 띠도 없고 거르개도 없으면 계약 갱신을 볼 길이 통째로 사라진다');
  const filt = cutFn(SRC, 'function coFilteredList(');
  assert.match(filt, /state\.coOnlyCtOld && !skipTodo\) list = list\.filter\(o=>coCtNeeds\(o\)\)/,
    '★★★ 거르개가 제 잣대를 따로 두면 거르개와 셈이 다른 말을 한다');
});

test('★★ 거르개를 켜면 «무엇으로 걸렀는지» 딱지가 말한다', () => {
  const lab = SRC.slice(SRC.indexOf('const CO_TODO_LABEL'), SRC.indexOf('function clearCoTodo'));
  assert.match(lab, /coOnlyCtOld:/, '★★ 걸어 놓고 아무 말이 없으면 되돌릴 길도 안 보인다');
});

test('★★★ 상세의 「종료일 지남」 딱지는 «그대로» 둔다 — 날짜 사실은 알려 줘야 한다', () => {
  const c = load();
  const st = c.coCtState(회사('오래지남','2026-03-31'), 오늘);
  assert.equal(st.cls, 'gone',
    '★★★ 없앤 것은 «목록 알림»뿐이다 — 회사를 연 사람에게는 사실대로 말한다');
  assert.match(cutFn(SRC, 'function coDetailPanelHtml('), /종료일 지남/,
    '★★ 상세에서 그 말이 사라졌다');
});

/* ══ 잣대 — 거르개가 이것을 쓴다 ═══════════════════════════════════════ */

test('★★★ 끝난 곳과 곧 끝나는 곳만 담는다', () => {
  const c = load([ 회사('막지남','2026-08-20'), 회사('곧끝남','2026-10-01'),
                   회사('오래지남','2026-03-31'), 회사('아직멀다','2027-03-31') ]);
  assert.deepEqual(c.coCtList().map(x => x.name), ['막지남','곧끝남'],
    '★★★ 살아 있는 계약까지 담으면 거르개가 「전체 목록」이 된다');
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

test('★★★ 종료일이 «오래» 지난 곳은 안 담는다 — 자동 연장으로 굴러가는 중이다', () => {
  const c = load([ 회사('오래지남','2026-03-31'), 회사('작년에지남','2025-01-31'),
                   회사('막지남','2026-08-20') ]);
  assert.deepEqual(c.coCtList().map(x => x.name), ['막지남'],
    '★★★ 자동 연장으로 굴러가는 곳은 챙길 일이 없다');
});

test('★★ 「막 지남」의 끝은 30일이다 — 딱 30일째까지는 담고, 31일째는 뺀다', () => {
  /* 오늘이 2026-09-12 다 */
  assert.equal(load([ 회사('딱30일','2026-08-13') ]).coCtList().length, 1, '★★ 30일째를 뺐다');
  assert.equal(load([ 회사('31일','2026-08-12') ]).coCtList().length, 0, '★★ 31일째를 담았다');
});

test('★★★ 계약해지(🚪)로 표시된 곳은 «안 담는다» — 이미 끝낸 일이다', () => {
  const c = load([ 회사('해지됨','2026-08-20',{ left:true }),
                   회사('살아있음','2026-08-20') ]);
  assert.deepEqual(c.coCtList().map(x => x.name), ['살아있음'],
    '★★★ 끝낸 곳이 섞이면 정작 챙길 곳이 그 속에 묻힌다');
});

test('★★★ 급한 순으로 선다 — 지난 것이 먼저, 더 오래 지난 것이 더 앞', () => {
  const c = load([ 회사('임박15','2026-09-27'), 회사('더지남','2026-08-20'),
                   회사('막지남','2026-09-01'), 회사('임박3','2026-09-15') ]);
  assert.deepEqual(c.coCtList().map(x => x.name),
    ['더지남','막지남','임박3','임박15'],
    '★★★ 차례가 급한 순이 아니면 맨 위부터 처리할 수가 없다');
});

test('★ 남은 날과 종료일을 «함께» 들고 온다 — 거르개 목록이 그것으로 딱지를 적는다', () => {
  const c = load([ 회사('막지남','2026-09-02'), 회사('임박','2026-09-20') ]);
  const [a, b] = c.coCtList();
  assert.equal(a.days, -10); assert.equal(a.cls, 'gone'); assert.equal(a.to, '2026-09-02');
  assert.equal(b.days, 8);   assert.equal(b.cls, 'soon');
});

test('★★ 세는 곳과 거르는 곳이 «같은 잣대»(coCtNeeds)를 본다', () => {
  const c = load([ 회사('막지남','2026-08-20'), 회사('멀다','2027-03-31') ]);
  assert.equal(c.coCtCount(), 1, '★★ 거르개에 붙는 수가 목록과 다르면 화면이 스스로를 못 설명한다');
  assert.match(cutFn(SRC, 'function coCtList('), /coCtNeeds\(o, now\)/,
    '★★ 목록이 제 잣대를 따로 두면 셈과 어긋난다');
  assert.match(cutFn(SRC, 'function coCtState('), /erpContractPeriod\(/,
    '★★★ 계약 기간을 여기서 다시 읽으면 상세 줄과 목록이 다른 말을 한다');
});
