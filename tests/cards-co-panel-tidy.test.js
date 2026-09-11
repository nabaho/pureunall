/* ══════ 기업 상세 — 「한눈 요약 + 접기」 (대표 결정 2026-09-11, 목업 4번) ══════════
   대표 지시: 「캡쳐 3 영역 너무 정신없다. 한줄씩 간단히 정리하고 싶다. 일부 정보는
     접었다 펴서 확인할 수 있게 하고, 부족한 정보는 간단히 부족하다는 정보만 관리할 수
     있게 해달라. 이미 수행했던 사업들은 연도별로 정리해서 볼 수 있게. 최종적으로는
     사업장 정보를 아주 보기 쉽고 직관적으로 관리할 수 있어야 한다」
   네 안을 통째로 만들어 보여 드리고 «4번»으로 정하셨다
   — docs/mockups/2026-09-11-co-detail-pick.html

   ★ 못 박는 것
     ① 숫자 세 칸이 회사를 한눈에 말한다. 이알피 기록이 «오기 전»에는 지어내지 않는다.
     ② 「확인 필요」는 «있을 때만» 뜬다 — 멀쩡한 4,000곳에 「0」이 붙으면 급한 곳이 묻힌다.
     ③ 확정된 업체도 «풀거나 바꿀 길»이 살아 있다. 이것이 없으면 잘못 확정했을 때
        되돌릴 방법이 통째로 사라진다.
     ④ 사업은 «가장 최근 해»만 펴진다 — 오늘 날짜가 아니라 그 회사에 있는 해로 잰다.
     ⑤ 접어 둔 자리는 회사를 옮겨도 기억한다(⑥㉮). 다만 «센 값»은 회사마다 다시 센다.

   node --test tests/cards-co-panel-tidy.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { cutFn } = require('./cut-fn');
const { panelDeps } = require('./lib-co-hist');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8')
  .split('\r\n').join('\n');

/* 패널을 통째로 떠서 «돌린다» — 글자만 찾는 검사는 기능을 꺼 버려도 통과한다 */
function load(opt) {
  const o = opt || {};
  const panelAt = SRC.indexOf('function coDetailPanelHtml');
  const panelEnd = SRC.indexOf('function coDocsSummary(');
  assert.ok(panelAt > 0 && panelEnd > panelAt, '패널 함수를 찾지 못했습니다');
  const ctx = {
    Object, Array, String, Number, Math, Date, JSON, console,
    esc: s => String(s == null ? '' : s),
    _coFolders: o.folders || {},
    ErpMatch: { ready: true, byId: o.byId || {} },
    _coHist: { o: null, data: null, pick: null },
    _coHistSum: o.sum === undefined ? null : o.sum,
    _coLeftDocsN: o.left === undefined ? null : o.left,
    coDisplayName: x => (x && x.name) || '',
    /* 이 검사는 «어디에 놓이는가»를 본다 — 연결 줄의 «안»은 cards-co-erp-key 가 본다 */
    coErpPinHtml: () => '<div class="coerppin">연결줄</div>',
    coInfoBoxHtml: () => '<!--info-->',
    coConflictHtml: () => '<!--clash-->',
    coDocsHtml: () => '<!--docs-->',
    erpContractPeriod: () => o.period || null,
    todayYmd: () => '2026-09-11',
    $: () => null
  };
  vm.createContext(ctx);
  vm.runInContext(panelDeps(SRC) + '\n' + SRC.slice(panelAt, panelEnd)
    + '\n' + cutFn(SRC, 'function coDocsSummary('), ctx);
  return ctx;
}
/* 손볼 것이 있는 회사 / 없는 회사 */
const 회사 = (x) => Object.assign({ key:'1348605772', name:'다라컨트롤', cards:[], folder:'',
  erp:{ type:'자문' }, extra:{} }, x || {});
const 문제있음 = () => 회사({ extra:{
  conflicts:{ address:{had:'가',got:'나'}, ceo:{had:'다',got:'라'} },
  docs:{ d1:{name:'등록증'}, d2:{name:'신청서'} } } });
const 확정됨 = () => 회사({ extra:{ erpCoId:'E1' } });

/* ── ① 숫자 세 칸 ─────────────────────────────────────────────────────── */

test('★★★ 숫자 세 칸이 한 일·확인 필요·서류를 말한다', () => {
  const c = load({ sum:{ n:5, fee:10900000, years:3 }, left:2 });
  c._coHist.o = null;
  const o = 문제있음();
  c._coHist.o = o;
  const h = c.coTilesHtml(o);
  assert.match(h, />5</, '★★ 한 일 건수가 없다');
  assert.match(h, /1,090만원/, '★ 얼마인지 없으면 「5건」만으로는 크기를 모른다');
  assert.match(h, />3</, '★★ 확인 필요 수가 틀리다 — 연결·값·서류 셋이다');
  assert.match(h, /안 붙음 2/, '★ 안 붙은 서류가 몇인지 안 말한다');
});

test('★★★ 이알피 기록이 «오기 전»에는 숫자를 지어내지 않는다', () => {
  const c = load({ sum: undefined });           /* 아직 안 왔다 */
  const o = 회사();
  c._coHist.o = o;
  const h = c.coTilesHtml(o);
  assert.match(h, /…/, '★★★ 안 온 값을 0 으로 적으면 「한 일이 없는 회사」로 읽힌다');
  assert.match(h, /읽는 중/, '★ 왜 비어 있는지 말해야 한다');
});

test('★★ 한 일이 «정말 0건»이면 0 이라고 말한다 — 「읽는 중」에 머물면 안 된다', () => {
  const c = load({ sum:{ n:0, fee:0, years:0 } });
  const o = 회사();
  c._coHist.o = o;
  assert.ok(!/읽는 중/.test(c.coTilesHtml(o)), '★★ 0건인데 영영 「읽는 중」이다');
});

/* ── ② 부족한 것 ──────────────────────────────────────────────────────── */

test('★★★ 손볼 것이 없으면 「확인 필요」 칸이 «아예 안 뜬다»', () => {
  const c = load({ left:0, byId:{ E1:{ company:'가나(주)' } } });
  assert.equal(c.coNeedHtml(확정됨()), '',
    '★★★ 멀쩡한 회사에 「확인 필요 0」이 붙으면 4,000곳이 모두 노래져 급한 곳이 묻힌다');
});

test('★★★ 손볼 것이 있으면 «몇 가지인지»와 «무엇인지»를 한 줄로 말한다', () => {
  const c = load({ left:2 });
  const h = c.coNeedHtml(문제있음());
  assert.match(h, /확인 필요 3가지/, '★★ 몇 가지인지 없으면 펴 봐야 안다');
  assert.match(h, /연결 · 값 2 · 서류 2/,
    '★★★ 접힌 줄에 무엇이 부족한지 없으면 「부족하다는 정보만 관리」가 안 된다');
});

test('★★ 값이 다른 «내용»은 접어 둔다 — 부족하다는 사실만 먼저 말한다', () => {
  const c = load({ left:0 });
  const h = c.coNeedHtml(문제있음());
  const clash = h.indexOf('<!--clash-->');
  assert.ok(clash > 0, '★ 어긋난 칸을 볼 길이 아예 없다');
  assert.match(h, /class="cofold" id="coNeedClash"/,
    '★★ 어긋난 값 내용이 늘 펼쳐져 있으면 예전과 같아진다(대표: 「정신없다」)');
});

/* ── ③ 확정된 업체도 되돌릴 수 있다 ──────────────────────────────────── */

test('★★★ 확정된 회사는 머리줄에 «누를 수 있는» 🔗 확정이 뜬다', () => {
  const c = load({ byId:{ E1:{ company:'가나(주)' } } });
  const h = c.coDetailPanelHtml(확정됨());
  assert.match(h, /🔗 확정/, '★ 이어져 있다는 것을 안 말한다');
  assert.match(h, /coPinRowToggle\(\)/,
    '★★★ 글자만 적어 두면 확정을 풀 길이 사라진다 — 잘못 확정하면 되돌릴 수 없다');
});

test('★★★ 그 줄 안에 «풀기»가 살아 있고, 평소엔 접혀 있다', () => {
  const c = load({ byId:{ E1:{ company:'가나(주)' } } });
  c.coErpPinHtml = () => '<div class="coerppin on">확정됨 <button>풀기</button></div>';
  const h = c.coDetailPanelHtml(확정됨());
  assert.match(h, /id="coPinRow"/, '★★ 풀기 줄 자리가 없다');
  assert.ok(/class="cofold" id="coPinRow"/.test(h),
    '★★ 늘 펼쳐져 있으면 한 줄로 줄인 뜻이 없다');
  assert.match(h, /풀기/, '★★★ 풀기 단추가 어디에도 없다');
});

test('★★ 확정 «전»에는 그 줄이 「확인 필요」 안에 있다 — 두 곳에 두지 않는다', () => {
  const c = load({ left:0 });
  c.coErpPinHtml = () => '<div class="coerppin">안 이어져 있습니다</div>';
  const 안됨 = 회사();
  assert.match(c.coNeedHtml(안됨), /안 이어져 있습니다/, '★★ 확정할 길이 없다');
  assert.ok(!/id="coPinRow"/.test(c.coDetailPanelHtml(안됨)),
    '★ 확정도 안 됐는데 「확정 줄」이 뜬다 — 같은 줄이 두 곳에 있으면 어느 쪽인지 모른다');
});

/* ── ④ 해마다 접기 ────────────────────────────────────────────────────── */

function 해() {
  const ctx = { Object, String, Array };
  vm.createContext(ctx);
  vm.runInContext('var _coYearOpen = {};\n'
    + cutFn(SRC, 'function coYearNewest(') + '\n' + cutFn(SRC, 'function coYearIsOpen('), ctx);
  return ctx;
}

test('★★★ 가장 최근 해만 펴진다 — 지난 해는 접힌다', () => {
  const c = 해();
  const rows = [{ year:'2026' }, { year:'2025' }, { year:'2024' }];
  const top = c.coYearNewest(rows);
  assert.equal(top, '2026');
  assert.equal(c.coYearIsOpen('2026', top), true, '★★ 올해가 접혀 있으면 열자마자 빈 화면이다');
  assert.equal(c.coYearIsOpen('2025', top), false, '★★★ 지난 해가 펴져 있으면 예전처럼 끝없이 길어진다');
  assert.equal(c.coYearIsOpen('2024', top), false);
});

test('★★★ 「가장 최근」은 «그 회사에 있는 해»다 — 오늘 날짜로 재지 않는다', () => {
  /* 2024년에 끝난 회사. 오늘(2026)로 재면 펴진 해가 하나도 없어 빈 목록으로 보인다. */
  const c = 해();
  const rows = [{ year:'2024' }, { year:'2023' }];
  const top = c.coYearNewest(rows);
  assert.equal(top, '2024');
  assert.equal(c.coYearIsOpen('2024', top), true,
    '★★★ 끝난 회사를 열면 아무것도 안 펴져 「기록이 없다」로 읽힌다');
});

test('★★ 사람이 누른 뜻이 잣대를 이긴다', () => {
  const c = 해();
  const top = '2026';
  c._coYearOpen['2025'] = true;
  assert.equal(c.coYearIsOpen('2025', top), true, '★★ 펴 둔 해가 다시 접힌다');
  c._coYearOpen['2026'] = false;
  assert.equal(c.coYearIsOpen('2026', top), false, '★★ 접어 둔 해가 다시 펴진다');
});

test('★★ 해를 «모르는» 줄은 펴 둔다 — 접으면 어디 갔는지 못 찾는다', () => {
  const c = 해();
  assert.equal(c.coYearIsOpen('', '2026'), true);
  assert.equal(c.coYearNewest([{ year:'' }, { year:'' }]), null, '★ 해가 없으면 없다고 해야 한다');
});

/* ── ⑤ 접은 자리·센 값 ────────────────────────────────────────────────── */

test('★★★ 접어 둔 자리는 «회사를 옮겨도» 기억한다 (대표 결정 ⑥㉮)', () => {
  const open = cutFn(SRC, 'function openCoDetailPanel(');
  assert.ok(!/_coCardOpen\s*=\s*\{/.test(open),
    '★★★ 회사를 열 때마다 접기를 되돌리면, 스무 곳을 같은 눈으로 훑을 때 매번 눌러야 한다');
  assert.ok(!/_coYearOpen\s*=\s*\{\}/.test(open), '★★ 해 접기도 마찬가지다');
});

test('★★★ «센 값»은 회사마다 다시 센다 — 앞 회사의 숫자가 잠깐이라도 보이면 안 된다', () => {
  const open = cutFn(SRC, 'function openCoDetailPanel(');
  assert.match(open, /_coHistSum = null/,
    '★★★ 앞 회사의 「5건」이 새 회사 숫자 칸에 잠깐 뜬다 — 한눈에 믿고 보는 자리다');
  assert.match(open, /_coLeftDocsN = null/, '★★ 안 붙은 서류 수도 마찬가지다');
  assert.match(open, /_coRowDocsOpen = \{\}/,
    '★ 앞 회사에서 펴 둔 사업의 서류가 새 회사 사업에 펴진 채로 온다');
});

test('★★ 늦게 온 값이 숫자 칸을 다시 그린다 — 안 그리면 영영 「읽는 중」이다', () => {
  const paint = cutFn(SRC, 'function coHistPaint(');
  assert.match(paint, /_coHistSum = sumAll/, '★★ 센 값을 숫자 칸이 읽을 자리에 안 적는다');
  assert.match(paint, /coHeadRepaint\(\)/, '★★★ 다 세고도 숫자 칸을 안 고친다');
  /* ⚠★ 기록이 «하나도 없는» 회사도 0 이라고 알려야 한다 (2026-09-11 이빨 확인에서
     새어 잡은 것). 그 자리는 일찍 돌아나가므로 따로 적어 두지 않으면 숫자 칸이
     「…(읽는 중)」에 영영 머물러, 한 일이 없는 회사인지 아직 안 온 것인지 못 가린다. */
  assert.match(paint, /if\(!recs\.length\)\{[\s\S]{0,120}?_coHistSum = \{ n:0[\s\S]{0,60}?coHeadRepaint\(\)/,
    '★★★ 기록 0건인 회사는 숫자 칸이 영영 「읽는 중」에 머문다');
  const left = cutFn(SRC, 'function coLeftDocsPaint(');
  assert.match(left, /_coLeftDocsN = \(left \|\| \[\]\)\.length/, '★★ 안 붙은 서류 수를 안 적는다');
  assert.match(left, /coHeadRepaint\(\)/, '★★ 서류가 붙은 뒤에도 숫자가 안 바뀐다');
});

/* ── ⑥ 사업에 붙은 서류 ──────────────────────────────────────────────── */

test('★★ 붙은 서류는 «개수를 눌러야» 편다 — 사업 줄은 늘 두 줄로 남는다', () => {
  const paint = cutFn(SRC, 'function coHistPaint(');
  assert.match(paint, /cohist-clip/, '★★ 몇 장 붙었는지 말하는 딱지가 없다');
  assert.match(paint, /coRowDocsToggle\(/, '★★ 펼 손잡이가 없다');
  assert.match(paint, /if\(hits && hits\.length\)\{/,
    '★★ 붙은 서류가 없는 사업에도 「📎 0」이 붙으면 눌러도 아무 일이 없다');
  /* 딱지를 그리는 함수는 그대로다 — 끌어다 놓기·떼기가 그 안에 들어 있다 */
  assert.match(paint, /coCaseDocsHtml\(hits\)/, '★★★ 딱지를 그리는 자리가 사라졌다');
  /* ⚠★ «기본은 접힘»이다 (2026-09-11 이빨 확인에서 새어 잡은 것). 여기를 안 보면
     「늘 펴 둔다」로 되돌려도 검사가 통과한다 — 그러면 이 정리를 한 뜻이 사라진다. */
  assert.match(paint, /const rOpen = !!_coRowDocsOpen\[ck\];/,
    '★★★ 붙은 서류가 «늘» 펴져 있다 — 사업 한 건이 다시 넉 줄이 된다');
});

/* ── 카드 한 장의 약속 ───────────────────────────────────────────────── */

test('★★★ 접힌 줄이 «무엇이 들었는지» 말한다 — 펴지 않아도 알아야 한다', () => {
  const c = load({ left:2 });
  const o = 문제있음();
  const h = c.coDetailPanelHtml(o);
  assert.match(h, /읽어온 2건 · 안 붙음 2/,
    '★★★ 요약이 없으면 카드마다 눌러 봐야 한다 — 접은 뜻이 사라진다');
  assert.ok(/class="s">/.test(h), '★ 요약을 적는 자리가 없다');
});

test('★★ 사람이 없으면 사람 카드를 «안 그린다»', () => {
  const c = load({ left:0 });
  assert.ok(!/coCard_ppl/.test(c.coDetailPanelHtml(회사())), '★★ 0명짜리 카드가 자리를 먹는다');
  const h = c.coDetailPanelHtml(회사({ cards:[{ id:'c1', name:'조성환', title:'대표' }] }));
  assert.match(h, /coCard_ppl/, '★ 사람이 있는데 카드가 없다');
  assert.match(h, /사람 1명/, '★ 몇 명인지 안 말한다');
  assert.match(h, /조성환/, '★★ 접힌 줄에 이름이 없으면 펴 봐야 안다');
});

test('★★ 계약·폴더·연결을 «한 줄»에 모은다 — 넉 줄이 두 줄이 된다', () => {
  const c = load({ period:{ text:'2025-03-01 ~ 2027-02-28', past:false },
                   folders:{ f1:{ name:'1. 업체관리' } } });
  const h = c.coDetailPanelHtml(회사({ folder:'f1' }));
  const subs = h.match(/class="pdsub"/g) || [];
  assert.equal(subs.length, 1, '★★ 줄이 ' + subs.length + '개다 — 한 줄로 모으기로 했다');
  assert.match(h, /계약 2025-03-01 ~ 2027-02-28 · 📁 1\. 업체관리/, '★ 한 줄에 둘 다 없다');
});
