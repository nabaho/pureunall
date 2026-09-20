'use strict';
/* 🏥 하루 단위로 셈하는 컨설팅 — 일수 × 1일 단가 → 잔금 (대표 지시 2026-09-18)

   「현장클리닉은 1일 출장 35만원이고 3일이면 105만원이다. 3일을 넣으면 잔금에
    부가세 10만5천원까지 붙은 1,155,000원이 들어갔으면 좋겠다」
   대표 확인: 부가세 «별도» · 전액 «잔금» · 3일 = 정부사업일정 3회차.

   ★ 이 검사가 못 박는 것은 «규칙»이지 지금 값이 아니다 —
     단가 350,000 은 대표가 설정에서 고칠 수 있어야 하므로 «씨앗의 값»만 확인하고,
     셈은 임의의 단가·일수로 돌려 본다.
   ⚠ 350,000 · 1,155,000 을 박아 두는 줄은 «건의 그대로»를 지키는 자리 하나뿐이다
     (검사고정-허용 — 대표가 글로 못 박은 숫자다). */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const ERP = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
const GOV = fs.readFileSync(path.join(ROOT, 'gov-consulting.html'), 'utf8');
const ERP_C = stripJs(ERP);
const GOV_C = stripJs(GOV);

/* 셈하는 함수 셋을 가짜 창에 올려 «실제로» 돌린다 */
function loadCalc(typeList) {
  const ctx = {
    BIZ_CONS_SEED: [{ code: 'cons-clinic', name: '현장클리닉', dayFee: 350000 },
                    { code: 'cons-ilteo', name: '일터상생혁신' }],
    dbGet: function (k, d) { return (k === 'biz_cons_types') ? (typeList || null) || d : d; },
    Math: Math, parseInt: parseInt, Number: Number
  };
  vm.createContext(ctx);
  vm.runInContext(
    cutFn(ERP, 'function consTypeDayFee(') + '\n' +
    cutFn(ERP, 'function consNameKey(') + '\n' +
    cutFn(ERP, 'function consDayAmount(') + '\n' +
    cutFn(ERP, 'function consDayMayFill('), ctx);
  return ctx;
}

test('① 건의 그대로 — 3일이면 잔금 1,155,000원 (검사고정-허용: 대표가 글로 못 박은 숫자)', () => {
  const c = loadCalc();
  const r = c.consDayAmount(350000, 3);
  assert.equal(r.net, 1050000, '3일 공급가는 105만원');
  assert.equal(r.vat, 105000, '부가세는 10만5천원');
  assert.equal(r.total, 1155000, '잔금에 들어갈 금액');
});

test('② 1일·2일도 날짜만큼 따라 오른다 (건의: 「날짜만큼 자동으로」)', () => {
  const c = loadCalc();
  assert.equal(c.consDayAmount(350000, 1).total, 385000);
  assert.equal(c.consDayAmount(350000, 2).total, 770000);
  assert.equal(c.consDayAmount(350000, 5).total, 1925000);
});

test('③ 부가세는 원 미만을 «버린다» — 세금계산서와 같은 셈법', () => {
  const c = loadCalc();
  /* 33,333 × 1일 → 부가세 3,333.3 → 3,333 (올림이면 3,334 가 되어 계산서와 어긋난다) */
  const r = c.consDayAmount(33333, 1);
  assert.equal(r.vat, 3333, '원 미만 버림');
  assert.equal(r.total, 36666);
  assert.equal(r.net + r.vat, r.total, '합계는 늘 공급가+부가세');
});

test('④ 단가나 일수가 없으면 아무것도 셈하지 않는다 (0원 띠를 띄우지 않는다)', () => {
  const c = loadCalc();
  assert.equal(c.consDayAmount(350000, 0), null, '일수 0');
  assert.equal(c.consDayAmount(0, 3), null, '단가 없음');
  assert.equal(c.consDayAmount(350000, -2), null, '음수 일수');
  assert.equal(c.consDayAmount('', ''), null, '빈 값');
});

test('⑤ 단가는 «유형»에서 온다 — 저장된 값이 씨앗을 이긴다 (대표가 고칠 수 있어야 한다)', () => {
  const edited = loadCalc([{ code: 'cons-clinic', dayFee: 400000 }]);
  assert.equal(edited.consTypeDayFee('cons-clinic'), 400000, '설정에서 고친 값이 이긴다');
  const blank = loadCalc([{ code: 'cons-clinic' }]);
  assert.equal(blank.consTypeDayFee('cons-clinic'), 350000,
    '유형표에 그 칸이 아직 없으면 씨앗에서 찾는다 — 서버를 고쳐 넣지 않아도 듣는다');
  assert.equal(blank.consTypeDayFee('cons-ilteo'), 0, '단가 없는 유형은 0');
  assert.equal(blank.consTypeDayFee(''), 0);
});

test('⑥ 단가를 «비우면» 0 이다 — 일수 칸이 사라져야 한다', () => {
  const zero = loadCalc([{ code: 'cons-clinic', dayFee: '' }]);
  assert.equal(zero.consTypeDayFee('cons-clinic'), 350000,
    '빈 문자열은 「안 정했다」이므로 씨앗으로 물러난다');
  const off = loadCalc([{ code: 'cons-clinic', dayFee: 0 }]);
  assert.equal(off.consTypeDayFee('cons-clinic'), 0, '0 은 「쓰지 않는다」는 뜻이라 그대로 0');
});

test('⑥-2 ★★ 쓰고 있는 유형은 코드가 «지어진 값»이다 — 이름으로도 찾아야 한다', () => {
  /* 2026-09-18 실측: 서버의 컨설팅 유형 17개는 화면에서 새로 만든 것이라
     코드가 consulting-mp0w1084 처럼 그때그때 지어졌다 — 씨앗의 cons-clinic 과
     하나도 안 겹친다. 코드로만 찾으면 일수 칸이 «영영 안 뜬다».
     실제로 그렇게 내보냈다가 대표께 「안 나오는데?」를 들었다. */
  const live = loadCalc([{ code: 'consulting-mp0w1084', short: '현클', name: '현장클리닉' }]);
  assert.equal(live.consTypeDayFee('consulting-mp0w1084'), 350000,
    '코드가 안 맞아도 이름이 같으면 씨앗의 기본값을 쓴다');

  const spaced = loadCalc([{ code: 'consulting-zzz', name: '현장 클리닉 컨설팅' }]);
  assert.equal(spaced.consTypeDayFee('consulting-zzz'), 350000,
    '띄어쓰기와 「컨설팅」 꼬리는 견줄 때 뗀다');

  const other = loadCalc([{ code: 'consulting-mozfisq7', name: '일터상생혁신컨설팅' }]);
  assert.equal(other.consTypeDayFee('consulting-mozfisq7'), 0,
    '이름이 맞아도 씨앗에 단가가 없으면 0 — 아무 유형에나 붙지 않는다');

  const shut = loadCalc([{ code: 'consulting-mp0w1084', name: '현장클리닉', dayFee: 0 }]);
  assert.equal(shut.consTypeDayFee('consulting-mp0w1084'), 0,
    '0 을 적어 두었으면 이름 대조까지 가지 않는다 — 「쓰지 않는다」가 이긴다');
});

test('⑦ ★ 사람이 적어 둔 잔금은 절대 안 덮는다 (오늘 CMS 오매칭이 난 바로 그 자리)', () => {
  const c = loadCalc();
  const calc = c.consDayAmount(350000, 3);          // 1,155,000
  assert.equal(c.consDayMayFill(0, null), true, '비어 있으면 넣는다');
  assert.equal(c.consDayMayFill(0, calc), true);
  assert.equal(c.consDayMayFill(1155000, calc), true,
    '직전에 이 셈이 넣어 둔 값 그대로면 일수를 고칠 때 따라온다');
  assert.equal(c.consDayMayFill(900000, calc), false,
    '손으로 적은 다른 금액은 «건드리지 않는다»');
  assert.equal(c.consDayMayFill(900000, null), false, '근거가 없으면 더욱 안 덮는다');
});

test('⑧ 계약창 — 단가가 있을 때만 일수 칸을 그린다', () => {
  assert.match(ERP_C, /var _dayFee\s*=\s*isConsulting \? consTypeDayFee\(_selType\)/,
    '고른 유형의 단가를 본다');
  assert.match(ERP_C, /_dayFee > 0 && h\(NumberInput, \{ value:f\.consultDays/,
    '단가가 있을 때만 일수 칸이 나온다');
  assert.ok(!/isConsulting && h\(NumberInput, \{ value:f\.consultDays/.test(ERP_C),
    '컨설팅이라고 다 뜨면 안 된다 — 단가가 조건이다');
});

/* 격자를 «실제로» 그려 본다 — 칸 하나만 빠져도 라벨과 입력칸이 한 칸씩 밀린다.
   (오른쪽 CMS·업무요약 검사와 같은 길이다 — 거기는 단가 0 인 경우를 본다) */
/* ⚠ 2026-09-19 세부설정 박스가 CSS Grid(6열)에서 flex(.pu-kbox/.pu-krow)로 바뀌었다
   (대표 지시 「한 줄로 넣어라」, 목업 승인 contract-detail-box-v2). 그리드 시절엔
   «칸 개수가 정확히 6의 배수»가 아니면 라벨이 밀리는 깨지기 쉬운 구조라 열 수를
   셌지만, flex 는 그 걱정이 없다 — 대신 「일수 줄(row2)이 늘 같은 자리에 있고,
   단가가 있을 때만 그 안에 일수·셈 칸이 실제로 늘어나는가」를 본다. */
function kboxWithDayFee(dayFee, days) {
  const src = ERP;
  const from = src.indexOf('(f.kinds||[]).map(function(kindV){');
  const to = src.indexOf(',\n        // CMS 자동이체', from);
  const expr = src.slice(from, to > 0 ? to : src.indexOf(',\r\n        // CMS 자동이체', from));
  const ctx = {
    console, Object, JSON, Array, String, Number, parseInt, parseFloat, Math,
    f: { kinds: ['consulting'], typeCodes: {}, amounts: {}, briefs: {},
         successFee: 0, successFeeType: 'amount', consultDays: days, dayCalc: null,
         contractFeeVatIncluded: false, balanceFeeVatIncluded: false, fundVatIncluded: false },
    BRIEF_KINDS: ['case', 'consulting', 'fund', 'other'], BRIEF_MAX: 40, BRIEF_PH: {},
    NumberInput: function NumberInput() {},
    kindInfo() { return { color: '#000', icon: 'X', label: '라벨' }; },
    getKindTypes() { return [{ code: 'cons-clinic', short: '현클', name: '현장클리닉' }]; },
    setTypeCodeFor() { return function () {}; },
    setAmountFor() { return function () {}; },
    setSimple() { return function () {}; },
    setBriefFor() { return function () {}; },
    setF() {}, vatIncludedHint() {}, vatFocusHint() {}, vatAmountHint() {},
    consTypeDayFee() { return dayFee; },
    h(tag, props) { return { tag, props: props || {}, kids: Array.prototype.slice.call(arguments, 2) }; }
  };
  vm.createContext(ctx);
  vm.runInContext(cutFn(ERP, 'function consDayAmount(') + '\n' +
                  cutFn(ERP, 'function consDayMayFill('), ctx);
  vm.runInContext('var __arr = ' + expr + ';', ctx);
  return ctx.__arr[0];
}
function realKids(node) {
  return (node && node.kids || []).filter(x => x !== null && x !== undefined && x !== false);
}

test('⑧-2 ★ 일수 줄(row2)은 컨설팅이면 늘 같은 자리에 있고, 단가가 있을 때만 그 안이 늘어난다', () => {
  const off = kboxWithDayFee(0, 0);
  assert.equal(off.props.className, 'pu-kbox', '컨설팅도 새 박스 모양(pu-kbox)을 쓴다');
  const kidsOff = realKids(off);
  assert.equal(kidsOff.length, 3, '머리·계약금 줄·잔금 줄 — 셋뿐이다(일수 없어도 잔금 줄은 있다)');
  assert.equal(kidsOff[2].props.className, 'pu-krow', '잔금 줄도 pu-krow 다');
  assert.equal(realKids(kidsOff[2]).length, 2, '단가가 없으면 잔금 줄엔 금액칸·부가세알약 둘뿐');

  const on = kboxWithDayFee(350000, 3);
  const kidsOn = realKids(on);
  assert.equal(kidsOn.length, 3, '단가가 있어도 줄 개수(머리·계약금·잔금) 자체는 안 늘어난다');
  const row2 = realKids(kidsOn[2]);
  assert.equal(row2.length, 8, '일수라벨·단가안내·일수칸·「일」·셈 문구·단추·금액칸·부가세알약 = 8');
  assert.match(JSON.stringify(row2), /1,155,000원/, '그 줄에 합계가 적혀 있다');
});

test('⑧-3 ★ 일수 칸에 3을 넣으면 셈 띠가 실제로 뜬다 (그리는 자리까지 이어졌나)', () => {
  const none = realKids(kboxWithDayFee(350000, 0).kids[2]);
  assert.equal(none.length, 6, '일수가 0 이면 셈 문구·단추 두 칸이 아직 없다(일수라벨·안내·일수칸·「일」·금액칸·부가세알약 = 6)');
  assert.ok(!/\d,\d{3},\d{3}원/.test(JSON.stringify(none)), '일수가 0 이면 아직 셈할 금액이 없다');
  const some = realKids(kboxWithDayFee(350000, 2).kids[2]);
  assert.equal(some.length, 8, '일수가 있으면 셈 문구·단추가 붙어 8칸');
  assert.match(JSON.stringify(some), /770,000원/, '2일이면 770,000');
});

test('⑨ 잔금에 넣을 때 「부가세포함」도 함께 켠다 — 안 켜면 뒤에서 또 붙는다', () => {
  const apply = cutFn(ERP, 'function _applyDayCalc(');
  assert.match(apply, /successFee:\s*calc\.total/);
  assert.match(apply, /balanceFeeVatIncluded:\s*true/);
  assert.match(apply, /dayCalc:\s*calc/, '근거를 함께 남긴다');
});

test('⑩ 근거(dayCalc)는 «지금 금액과 맞을 때만» 저장된다 — 안 맞으면 거짓말이 된다', () => {
  const at = ERP_C.indexOf('var saveData = Object.assign({}, f, {');
  assert.ok(at > 0);
  const save = ERP_C.slice(at, at + 900);
  assert.match(save, /dayCalc:\s*\(f\.dayCalc && \(parseInt\(f\.successFee, 10\) \|\| 0\) === parseInt\(f\.dayCalc\.total, 10\)\)/,
    '잔금을 손으로 고쳤으면 근거를 버린다');
  assert.match(save, /\?\s*f\.dayCalc\s*:\s*null/);
});

test('⑪ 이관 — 컨설팅에만 일수가 따라간다 (사건·기타에는 뜻이 없다)', () => {
  const at = ERP_C.indexOf("balanceFee: (kindV === 'consulting' || kindV === 'other')");
  assert.ok(at > 0);
  const mv = ERP_C.slice(at, at + 700);
  assert.match(mv, /consultDays:\s*\(kindV === 'consulting'\)\s*\?\s*\(parseInt\(contract\.consultDays, 10\) \|\| 0\)\s*:\s*0/);
  assert.match(mv, /dayCalc:\s*\(kindV === 'consulting' && contract\.dayCalc\)/);
});

test('⑫ 씨앗 — 현장클리닉에 1일 단가가 들어 있다 (검사고정-허용: 대표가 확인한 값)', () => {
  const seed = ERP_C.slice(ERP_C.indexOf('var BIZ_CONS_SEED = ['),
                           ERP_C.indexOf('var BIZ_FUND_SEED = ['));
  assert.match(seed, /code:'cons-clinic'[^}]*dayFee:350000/, '현장클리닉 1일 350,000원');
  const others = seed.split('\n').filter(l => /dayFee/.test(l));
  assert.equal(others.length, 1, '지금 하루 단위로 받는 사업은 현장클리닉 하나뿐이다');
});

test('⑬ 설정에서 단가를 고칠 수 있다 — 코드에 박아 두지 않았다', () => {
  const ed = stripJs(cutFn(ERP, 'function editType('));
  assert.match(ed, /df = window\.prompt\('1일 단가/, '✏ 에서 «실제로» 묻는다');
  assert.match(ed, /if\(df !== null\) nx\.dayFee = parseInt\(String\(df\)\.replace\(\/\[\^\\d\]\/g, ''\), 10\) \|\| 0;/,
    '비우면 «0 을 적는다» — 칸을 지우면 「안 정했다」가 되어 씨앗 기본값이 다시 올라온다');
  assert.match(ed, /cat\.key === 'consulting'/, '컨설팅 유형에만 묻는다');
});

/* ───────── 정부사업일정 ───────── */

test('⑭ 정부사업일정 — 일수는 «같은 종류»의 이어진 컨설팅에서만 읽는다', () => {
  const fn = cutFn(GOV, 'function erpDaysForCoType(');
  assert.match(fn, /tmap\[code\] !== tid/, '종류가 다르면 건너뛴다');
  assert.match(fn, /if\(d > best\) best = d/, '여러 건이면 가장 큰 일수');
  assert.match(fn, /if\(!ERP\.loaded \|\| !coId \|\| !tid\) return 0/);
});

test('⑮ ★ 회차를 저절로 바꾸지 않는다 — 잡아 둔 날짜가 사라지면 안 된다', () => {
  const note = cutFn(GOV, 'function erpDaysNote(');
  assert.match(note, /if\(!d \|\| d === appliedRounds\) return ''/,
    '같으면 아무것도 안 뜬다');
  assert.match(note, /onclick="co_rounds\['\$\{tid\}'\]=\$\{d\}/,
    '사람이 «눌러야» 바뀐다');
  assert.ok(!/setCos\(|co_rounds\[tid\]\s*=/.test(note),
    '이 함수는 저장하지 않는다 — 그리기만 한다');
});

test('⑯ 정부사업일정 — 새 사업장에는 안 뜬다 (아직 이알피와 이어질 자리가 없다)', () => {
  const note = cutFn(GOV, 'function erpDaysNote(');
  assert.match(note, /erpDaysForCoType\(co_editId, tid\)/,
    '수정 중인 사업장 번호로 찾는다 — 새 사업장이면 빈 값이라 0 이 돌아온다');
});

test('⑰ 회차 칸 밑에 그 줄이 실제로 붙는다 (함수만 만들고 안 부르면 헛일)', () => {
  assert.match(GOV_C, /\$\{erpDaysNote\(tid,appliedRounds\)\}/,
    '사업장 수정 창의 종류별 설정에 붙어 있다');
  assert.match(GOV_C, /\.erp-days-note\{/, '보이게 하는 모양새도 있다');
});
