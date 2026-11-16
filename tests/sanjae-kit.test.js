/* 🧰 산재 묶음 — 급여·서류·기한·계산·유족·소식 (대표 「모든 단계 한번에 진행해라」 2026-11-15)

   ★ 못 박는 것 (값이 아니라 규칙 — 법이 정한 숫자만 `검사고정-허용` 과 까닭을 달고 박는다)
     ① 법이 정한 숫자: 장해급여표(별표 2)·상병보상연금표(별표 4)·유족급여(별표 3)·휴업 70%(제52조)·장례비 120일(제71조)
     ② 기한: 안 날 + 90일(제103조③·제106조③·행정소송법 제20조), 말일이 토·공휴일이면 다음 날(민법 제161조),
        판정위원회를 거친 결정만 «심사 없이 재심사» 줄이 나온다(제106조① 단서)
     ③ 시효: 3년, 장해·유족·장례비 5년(제112조①) · 연 단위는 민법 제157·160조
     ④ 계산: 최고·최저 보상기준(제36조⑦) — 장례비는 조정 안 함, 휴업·상병에는 최저를 안 씀 · 저소득 휴업(제54조) ·
        3일 이내 휴업은 0(제52조 단서) · 장해 1~3급 연금만, 8~14급 일시금만(제57조③·별표 2) · 유족 가산 최대 20%
     ⑤ 여러 장해 등급 조정(시행령 제53조②)
     ⑥ 유족: 연금 수급자격(제63조①)·순서(제63조③), 없으면 일시금 순위(제65조①)
     ⑦ 서류: 고른 급여·재해 갈래·불복에 맞춰 나오고, 줄마다 근거가 «보인다»
     ⑧ 저장하는 것은 «기록»뿐 — 임금(계산 칸)·가족(유족 표)은 save 로 안 간다. 이 모듈은 저장소를 모른다
     ⑨ 끝난 사건은 보기만 — save 를 안 부른다
     ⑩ 이알피: 산재 사건에만 단추 · 동기화 표·건별 저장·보안규칙·온톨로지에 등록 · 한 사건 한 줄
   node --test tests/sanjae-kit.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
const MOD = read('js/pu-sanjae-kit.js');
const ERP = read('pu-erp.html');
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const J = (o) => JSON.parse(JSON.stringify(o));

function load(extra) {
  const ctx = Object.assign({ console, Object, Array, String, Number, JSON, Math, Date, isFinite }, extra || {});
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(MOD, ctx);
  return ctx.PuSanjaeKit;
}

test('★★★ ① 법이 정한 숫자', () => {
  const K = load();
  assert.deepEqual(J(K.JANGHAE_PENSION), [329, 291, 257, 224, 193, 164, 138]); // 검사고정-허용: 산재보험법 별표 2 장해보상연금 일수(법률)
  assert.deepEqual(J(K.JANGHAE_LUMP), [1474, 1309, 1155, 1012, 869, 737, 616, 495, 385, 297, 220, 154, 99, 55]); // 검사고정-허용: 별표 2 장해보상일시금 일수(법률)
  assert.deepEqual(J(K.SANGBYEONG), [329, 291, 257]); // 검사고정-허용: 별표 4 상병보상연금 일수(법률)
  const r = (k, rows) => (rows.find((x) => x.k === k) || {}).v;
  const c = K.calc({ avg: '100000', restDays: '10', grade: '5', yujokN: '1', funeral: true });
  assert.equal(r('hyueop', c.rows), 70000); // 검사고정-허용: 제52조 평균임금 × 70%
  assert.equal(r('jangrye', c.rows), 12000000); // 검사고정-허용: 제71조① 평균임금 × 120일
  assert.equal(r('yujokP', c.rows), 100000 * 365 * 52 / 100); // 검사고정-허용: 별표 3 기본 47% + 1명 5%
  assert.equal(r('yujokL', K.calc({ avg: '100000', yujokN: '0' }).rows), 130000000); // 검사고정-허용: 별표 3 일시금 1,300일
  // 시효 — 제112조①: 장해·유족·장례비만 5년
  const five = J(K.BENEFITS.filter((b) => b.sozo === 5).map((b) => b.k).sort());
  assert.deepEqual(five, ['janghae', 'jangrye', 'yujok']);
  assert.ok(K.BENEFITS.filter((b) => b.sozo !== 5).every((b) => b.sozo === 3), '나머지는 3년');
  assert.equal(K.BENEFITS.length, 8, '제36조① 보험급여는 여덟 가지'); // 검사고정-허용: 산재보험법 제36조① 각 호
});

test('★★★ ② 기한 — 안 날 + 90일, 토·공휴일이면 다음 날', () => {
  const K = load();
  assert.equal(K.addDays('2026-01-01', 90), '2026-04-01');
  assert.equal(K.rollHoliday('2026-11-14', []), '2026-11-16', '토요일 → 월요일');
  assert.equal(K.rollHoliday('2026-11-13', ['2026-11-13']), '2026-11-16', '공휴일(금) → 토·일 건너 월요일');
  assert.equal(K.rollHoliday('2026-11-13', [{ date: '2026-11-13' }]), '2026-11-16', '이알피 공휴일 꼴({date})도 받는다');
  const rec = { dates: { known: '2026-09-01', reviewKnown: '2026-10-02', reServed: '2026-08-16' } };
  const rows = K.deadlines(rec, [], '2026-11-15');
  const by = Object.fromEntries(rows.map((x) => [x.k, x]));
  assert.equal(by.review.due, '2026-11-30');
  assert.match(by.review.law, /제103조③/);
  assert.equal(by.rereview.due, '2026-12-31');
  assert.match(by.rereview.law, /제106조③/);
  assert.equal(by.suitAfter.raw, '2026-11-14');
  assert.equal(by.suitAfter.due, '2026-11-16', '★ 말일이 토요일 → 다음 월요일(민법 제161조)');
  assert.ok(by.suitAfter.rolled);
  assert.ok(!by.rereviewDirect, '★★ 판정위원회를 안 거친 결정에 «심사 없이 재심사» 줄이 나왔습니다');
  const via = K.deadlines({ dates: { known: '2026-09-01', viaBoard: true } }, [], '2026-11-15');
  assert.ok(via.some((x) => x.k === 'rereviewDirect' && /제106조① 단서/.test(x.law)), '판정위를 거쳤으면 바로 재심사 줄');
  assert.deepEqual(rows.map((x) => x.due), rows.map((x) => x.due).slice().sort(), '마감이 이른 것부터');
  assert.equal(K.deadlines({ dates: {} }, [], '2026-11-15').length, 0, '날짜가 없으면 줄도 없다');
});

test('★★ ③ 소멸시효 — 3년·5년, 연 단위 계산(민법 제157·160조)', () => {
  const K = load();
  assert.equal(K.addYearsCivil('2026-01-01', 3), '2029-01-01');
  assert.equal(K.addYearsCivil('2023-02-28', 1), '2024-02-29', '기산일(3/1)의 해당일 전날');
  assert.equal(K.addYearsCivil('2024-02-28', 1), '2025-02-28', '해당일이 없으면 그 달 말일(제160조③)');
  const rows = K.sozoRows({ benefits: ['hyueop', 'yujok'], sozo: { hyueop: '2026-01-01', yujok: '2026-01-01' } }, [], '2026-11-15');
  const by = Object.fromEntries(rows.map((x) => [x.k, x]));
  assert.equal(by.hyueop.years, 3); assert.equal(by.yujok.years, 5);
  assert.equal(by.hyueop.raw, '2029-01-01'); assert.equal(by.yujok.raw, '2031-01-01');
  assert.match(by.yujok.law, /제112조① 단서/);
  assert.equal(K.sozoRows({ benefits: ['janghae'] }, [], '2026-11-15')[0].due, '', '기준일이 없으면 만료도 없다');
});

test('★★★ ④ 계산 — 보상기준·저소득·장해 선택·유족 가산', () => {
  const K = load();
  const v = (rows, k) => (rows.find((x) => x.k === k) || {}).v;
  // 최고 보상기준 — 장례비는 조정 안 함(제36조⑦ 괄호)
  const hi = K.calc({ avg: '400000', maxStd: '300000', grade: '10', funeral: true }).rows;
  assert.equal(v(hi, 'janghaeL'), 300000 * 297, '★★ 장해는 최고 보상기준 금액으로');
  assert.equal(v(hi, 'jangrye'), 400000 * 120, '★★ 장례비에 최고 보상기준을 씌웠습니다(제36조⑦ 괄호 — 장례비 제외)');
  // 최저 보상기준 — 휴업·상병에는 안 씀(단서), 장해에는 씀
  const lo = K.calc({ avg: '50000', minStd: '70000', grade: '14', sbGrade: '3' }).rows;
  assert.equal(v(lo, 'janghaeL'), 70000 * 55, '장해는 최저 보상기준 금액으로 올린다');
  assert.equal(v(lo, 'sangbyeong'), 50000 * 257, '★★ 상병보상연금에 최저 보상기준을 씌웠습니다(제36조⑦ 단서)');
  // 저소득 휴업(제54조): 70%가 최저 보상기준의 80% 이하면 90%, 그것이 80%를 넘으면 80%
  assert.equal(v(K.calc({ avg: '60000', minStd: '80000' }).rows, 'hyueop'), 60000 * 0.9);
  assert.equal(v(K.calc({ avg: '75000', minStd: '80000' }).rows, 'hyueop'), 80000 * 0.8);
  // 최저임금액(시간급 × 8)보다 적으면 최저임금액(제54조②) — 최저 보상기준이 최저임금액보다 적으면 최저임금액이 최저 보상기준(제36조⑦)
  assert.equal(v(K.calc({ avg: '60000', minStd: '70000', minWageHour: '10000' }).rows, 'hyueop'), 80000);
  // 3일 이내는 지급 안 함(제52조 단서)
  assert.equal(v(K.calc({ avg: '100000', restDays: '3' }).rows, 'hyueopSum'), 0);
  assert.equal(v(K.calc({ avg: '100000', restDays: '4' }).rows, 'hyueopSum'), 280000);
  // 장해 선택 — 1~3급 연금만, 4~7급 둘 다, 8~14급 일시금만
  const ks = (g) => J(K.calc({ avg: '100000', grade: String(g) }).rows.map((x) => x.k).filter((k) => /^janghae/.test(k)).sort());
  assert.deepEqual(ks(2), ['janghaeP'], '★★ 1~3급에 일시금이 나왔습니다(제57조③ 단서)');
  assert.deepEqual(ks(6), ['janghaeL', 'janghaeP']);
  assert.deepEqual(ks(9), ['janghaeL'], '8급 아래는 연금이 없다(별표 2)');
  // 유족 가산 최대 20%
  assert.equal(v(K.calc({ avg: '100000', yujokN: '6' }).rows, 'yujokP'), 100000 * 365 * 67 / 100);
  const half = K.calc({ avg: '100000', yujokN: '1', yujokHalf: true }).rows;
  assert.equal(v(half, 'yujokHalfL'), 100000 * 650, '절반 일시금(제62조③)');
  assert.equal(v(half, 'yujokHalfP'), 100000 * 365 * 52 / 100 / 2);
  // 넣은 것이 없으면 계산하지 않는다 — 0 으로 메우지 않는다
  assert.equal(K.calc({}).rows.length, 0);
  assert.ok(K.calc({ avg: '100000' }).notes.some((t) => /최고·최저 보상기준/.test(t)), '고시 금액을 비우면 그렇다고 적는다');
});

test('★★ ⑤ 여러 장해 등급 조정 — 시행령 제53조②', () => {
  const K = load();
  assert.equal(K.gradeAdjust([4, 5]).grade, 1, '5급 이상 둘 → 3개 올림');
  assert.equal(K.gradeAdjust([7, 8]).grade, 5, '8급 이상 둘 → 2개 올림');
  assert.equal(K.gradeAdjust([7, 9]).grade, 6, '13급 이상 둘(8급 이상은 하나) → 1개 올림');
  assert.equal(K.gradeAdjust([13, 14]).grade, 13, '13급 이상이 하나뿐이면 가장 심한 등급');
  assert.equal(K.gradeAdjust([2, 3]).grade, 1, '1급을 넘으면 1급');
  assert.equal(K.gradeAdjust([9]).grade, 9);
  assert.equal(K.gradeAdjust(['', 'x', 20]), null, '등급 밖 값은 버린다');
});

test('★★ ⑥ 유족 — 연금 수급자격·순서, 없으면 일시금 순위', () => {
  const K = load();
  const e = (m) => K.pensionEligible(m).ok;
  assert.equal(e({ rel: 'spouse', together: true }), true);
  assert.equal(e({ rel: 'spouse', together: false }), false, '생계를 같이 하지 않으면 연금 자격 없음');
  assert.equal(e({ rel: 'parent', age: 60, together: true }), true);
  assert.equal(e({ rel: 'parent', age: 59, together: true }), false);
  assert.equal(e({ rel: 'child', age: 24, together: true }), true);
  assert.equal(e({ rel: 'child', age: 25, together: true }), false);
  assert.equal(e({ rel: 'sibling', age: 18, together: true }), true);
  assert.equal(e({ rel: 'sibling', age: 30, together: true }), false);
  assert.equal(e({ rel: 'sibling', age: 30, together: true, disabled: true }), true, '장애 정도 해당(4호)');
  assert.equal(e({ rel: 'spouse', together: true, abroad: true }), false, '외국 거주 비국민 제외');
  assert.equal(e({ rel: 'child', age: '', together: true }), null, '나이를 모르면 확정하지 않는다');
  const a = K.familyJudge([{ rel: 'parent', age: 70, together: true }, { rel: 'child', age: 10, together: true }]);
  assert.equal(a.mode, 'pension'); assert.equal(a.holder, '자녀', '자녀가 부모보다 앞선다(제63조③)'); assert.equal(a.n, 2);
  const b = K.familyJudge([{ rel: 'sibling', age: 40, together: false }, { rel: 'parent', age: 50, together: false }]);
  assert.equal(b.mode, 'lump'); assert.equal(b.rank, 2, '생계를 같이 하지 않은 부모는 2순위(제65조①2호)'); assert.equal(b.holder, '부모');
  const c = K.familyJudge([{ rel: 'sibling', age: 40, together: true }, { rel: 'child', age: 30, together: true }, { rel: 'child', age: 33, together: true }]);
  assert.equal(c.rank, 1); assert.match(c.text, /자녀 2명이 똑같이 나눔/);
});

test('★★ ⑦ 서류 — 고른 갈래대로, 줄마다 근거', () => {
  const K = load();
  const keys = (r) => K.docsFor(r).map((d) => d.k);
  const base = keys({ benefits: ['yoyang'] });
  assert.ok(base.length >= 2 && base.every((k) => /^y/.test(k)));
  assert.ok(keys({ benefits: ['yoyang', 'yujok'] }).some((k) => /^u/.test(k)), '유족을 고르면 유족 서류');
  assert.ok(keys({ benefits: [], kind: 'commute' }).some((k) => /^c/.test(k)), '출퇴근 재해 서류');
  assert.ok(!keys({ benefits: ['yoyang'] }).some((k) => /^a/.test(k)) && keys({ benefits: [], appeal: true }).some((k) => /^a/.test(k)), '불복을 켜야 심사·재심사 서류');
  const dz = K.docsFor({ benefits: ['yoyang'], kind: 'disease', disease: 'd2' }).find((d) => d.k === 'dz');
  assert.ok(dz && /별표3 2호/.test(dz.law), '질병 갈래의 업무 관련성 자료와 그 근거');
  assert.ok(K.DOCS.every((d) => String(d.law || '').trim()), '★★ 근거 없는 서류 줄이 있습니다');
  assert.ok(K.DOCS.filter((d) => !/제\d+조/.test(d.law)).every((d) => /확인 필요/.test(d.law)), '★★ 법 조문이 없는 줄은 [확인 필요]를 달아야 합니다');
  // 숨기기·표시
  let r = K.bulk({ benefits: ['yoyang'] }, ['y1', 'y2'], 'sent', '2026-11-15');
  assert.equal(r.docs.y1.got, '2026-11-15', '제출하면 받은 것으로도 본다');
  r = K.bulk(r, ['y1'], 'unsent');
  assert.equal(r.docs.y1.sent, undefined); assert.equal(r.docs.y1.got, '2026-11-15');
  r = K.bulk(r, ['y2'], 'hide');
  assert.ok(!K.docsFor(r).some((d) => d.k === 'y2') && K.docsFor(r, true).some((d) => d.k === 'y2' && d.hidden), '숨긴 줄은 «숨긴 서류 보기»에서만');
  assert.equal(K.progress(r).n, K.docsFor(r).length);
  r = K.bulk(r, ['y2'], 'unhide');
  assert.ok(K.docsFor(r).some((d) => d.k === 'y2'));
});

/* ── 가짜 화면 — «보이는 글자»만 모은다(말풍선 title 은 세지 않는다) ── */
function fakeDom() {
  const mk = (tag) => ({ tag, kids: [], attrs: {}, on: {}, style: {}, _t: null, value: '', checked: false, selected: false, className: '',
    setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(k, f) { this.on[k] = f; },
    appendChild(c) { this.kids.push(c); c.parent = this; return c; },
    remove() { if (this.parent) this.parent.kids = this.parent.kids.filter((k) => k !== this); },
    querySelector() { return null; },
    set innerHTML(v) { this.kids = []; }, get innerHTML() { return ''; },
    set textContent(v) { this._t = String(v); this.kids = []; }, get textContent() { return this._t; } });
  const body = mk('body'), head = mk('head');
  const all = (n, out) => { out.push(n); (n.kids || []).forEach((k) => all(k, out)); return out; };
  const text = (n) => (n.text != null ? n.text : (n._t != null ? n._t : (n.kids || []).map(text).join(' ')));
  return { body, text, all: () => all(body, []),
    document: { body, head, createElement: mk, createTextNode: (t) => ({ text: String(t) }), addEventListener() {},
      getElementById: (id) => all(body, []).concat(all(head, [])).find((n) => n.attrs && n.attrs.id === id) || null } };
}
function screen(opts) {
  const D = fakeDom(), saves = [], memos = [], toasts = [];
  const K = load({ document: D.document, confirm: () => true, showToast: (m) => toasts.push(m) });
  K.open(Object.assign({ caseId: 'case-1', title: '뇌출혈 산재', load: () => null,
    save: (r) => { saves.push(JSON.parse(JSON.stringify(r))); return true; }, onMemo: (t) => { memos.push(t); return true; } }, opts || {}));
  const btn = (label) => D.all().find((n) => n.tag === 'button' && D.text(n).includes(label));
  const click = (label) => { const b = btn(label); assert.ok(b, '단추 「' + label + '」 가 안 보입니다'); b.on.click({ target: b }); };
  const tab = (label) => click(label);
  return { D, K, saves, memos, toasts, btn, click, tab, seen: () => D.text(D.body) };
}

test('★★★ ⑧ 화면 — 저장하는 것은 기록뿐, 임금·가족은 save 로 안 간다', () => {
  const s = screen();
  assert.match(s.seen(), /챙길 서류/);
  assert.match(s.seen(), /법 제41조①/, '★★ 서류 줄의 근거가 화면 글자로 안 보입니다');
  // 계산 칸에 임금을 넣는다
  s.tab('🧮 계산');
  const avgIn = s.D.all().find((n) => n.tag === 'input' && n.attrs.placeholder === '예: 98000');
  assert.ok(avgIn, '1일 평균임금 칸이 없습니다');
  avgIn.value = '123457'; avgIn.on.input({ target: avgIn }); avgIn.on.change({ target: avgIn });
  assert.match(s.seen(), /86,419/, '휴업급여 1일(123457 × 70% = 86,419.9 → 원 미만 버림)이 안 보입니다');
  // 유족 탭에 가족을 넣는다
  s.tab('👪 유족');
  s.click('＋ 가족 더하기');
  assert.match(s.seen(), /유족보상연금/);
  // 서류 탭에서 급여를 고르면 저장된다
  s.tab('📋 서류');
  s.click('휴업급여');
  assert.ok(s.saves.length >= 1, '고르기가 저장되지 않았습니다');
  const last = s.saves[s.saves.length - 1];
  assert.ok(last.benefits.includes('hyueop'));
  const txt = JSON.stringify(s.saves);
  assert.ok(!/123457/.test(txt), '★★★ 계산 칸의 임금이 저장으로 갔습니다');
  assert.ok(!/spouse|"age"/.test(txt), '★★★ 유족 표(가족)가 저장으로 갔습니다');
  assert.ok(!('calc' in last) && !('fam' in last));
  // 받음 표시 — 보이는 줄의 단추
  const before = s.saves.length;
  const got = s.D.all().find((n) => n.tag === 'button' && n.attrs.title === '받음으로 표시');
  got.on.click({ target: got });
  assert.equal(s.saves.length, before + 1);
  assert.ok(Object.values(s.saves[s.saves.length - 1].docs).some((d) => d.got));
});

test('★★ ⑧ 고르기 칸 — N건 선택 뒤 한 번에, 저장은 한 번', () => {
  const s = screen({ load: () => ({ caseId: 'case-1', benefits: ['yoyang'] }) });
  const boxes = s.D.all().filter((n) => n.tag === 'input' && n.attrs.type === 'checkbox');
  const headBox = boxes.find((n) => n.attrs.title === '지금 보이는 줄 모두 고르기');
  assert.ok(headBox, '머리줄 고르기 칸이 없습니다');
  headBox.on.change({ target: { checked: true } });
  assert.match(s.seen(), /\d+건 선택/, '「N건 선택」이 안 뜹니다');
  const n0 = s.saves.length;
  s.click('받음 표시');
  assert.equal(s.saves.length, n0 + 1, '★★ 한꺼번에 표시는 저장을 한 번만');
  const r = s.saves[s.saves.length - 1];
  assert.ok(s.K.docsFor(r).every((d) => d.got), '보이는 줄 모두 받음');
  assert.doesNotMatch(s.seen(), /\d+건 선택/, '저장 뒤 고른 것을 비운다');
});

test('★★★ ⑨ 끝난 사건은 보기만 — save 를 안 부른다', () => {
  const s = screen({ readOnly: true, load: () => ({ caseId: 'case-1', benefits: ['yoyang'] }) });
  assert.match(s.seen(), /끝난 사건 — 보기만/);
  const chip = s.btn('휴업급여');
  assert.ok(chip.attrs.disabled !== undefined, '끝난 사건의 단추가 눌립니다');
  chip.on.click({ target: chip });
  assert.equal(s.saves.length, 0, '★★★ 끝난 사건을 저장했습니다(종료·삭제·되돌림 불변)');
});

test('★★ 기한·메모 — 화면에 마감이 보이고, 메모로 붙는다', () => {
  const s = screen({ load: () => ({ caseId: 'case-1', benefits: ['yoyang'], dates: { known: '2026-09-01' } }) });
  s.tab('⏰ 기한');
  assert.match(s.seen(), /심사청구 마감/);
  assert.match(s.seen(), /제103조③/);
  s.click('기한을 업무 메모에 붙이기');
  assert.equal(s.memos.length, 1);
  assert.match(s.memos[0], /심사청구 마감: 2026-11-30/);
  s.tab('📰 소식');
  assert.match(s.seen(), /산업재해보상보험법/);
  assert.match(s.seen(), /시행 예정/);
});

test('★★ 모듈 — 저장소를 모르고, 바깥 글은 글자로만', () => {
  const code = noComments(MOD);
  ['firebase', 'localStorage', 'sessionStorage', 'dbSet', 'dbGet', 'indexedDB'].forEach((w) =>
    assert.ok(!code.includes(w), '★★ 모듈이 ' + w + ' 에 손댑니다 — 저장은 이알피가 건넨 save 하나로'));
  assert.doesNotMatch(code, /innerHTML\s*=\s*(?!''|"")\S/, '바깥 글을 innerHTML 로 넣습니다(비우기만 허용)');
  assert.match(code, /font-size:16px/, '입력칸 글씨 16px — 폰에서 확대되지 않게');
  assert.match(code, /@media \(max-width:\d+px\)/, '폰 구간이 없습니다');
});

/* ── 이알피 ── */
test('★★★ ⑩ 이알피 — 산재 사건에만 단추, 표·규칙·온톨로지 등록', () => {
  assert.match(ERP, /<script src="js\/pu-sanjae-kit\.js\?v=\d+"><\/script>/, '모듈을 안 싣거나 캐시 번호가 없습니다');
  const a = ERP.indexOf('\nfunction CaseDetailModal(');
  const cd = ERP.slice(a, ERP.indexOf('\nfunction UnifiedDetailModal(', a));
  assert.match(cd, /erpIsInjuryCase\(c, t\) && window\.PuSanjaeKit/, '★★ 산재 사건만 거르지 않습니다');
  assert.match(cd, /erpSanjaeKitOpen\(c\)/);
  const list = (name) => {
    const m = ERP.match(new RegExp('var ' + name + ' = \\[([\\s\\S]*?)\\];'));
    return (m[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').match(/'([^']+)'/g) || []).map((s) => s.slice(1, -1));
  };
  assert.ok(list('FB_ALL_SYNC_KEYS').includes('case_sanjae'), '★★ 동기화 목록에 없습니다 — 다른 PC 에서 안 보입니다');
  assert.ok(list('DIFF_KEYS').includes('case_sanjae'), '★★ 건별 저장 표가 아닙니다 — 두 사람이 같이 고치면 서로 지웁니다');
  const RULES = read('scripts/make-firebase-rules.js');
  const rule = (k) => (RULES.match(new RegExp('\\n\\s*' + k + ':\\s*(\\{[^\\n]*\\})')) || [])[1];
  assert.ok(rule('case_sanjae'), '보안규칙에 이름이 없습니다');
  assert.equal(rule('case_sanjae'), rule('case_memos'), '★ 권한은 사건 업무 메모와 같아야 합니다(더 넓히지 않는다)');
  const O = load().constructor; void O;
  const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(read('js/pu-ontology.js'), ctx);
  const ON = ctx.PuOntology;
  assert.ok(ON.TERMS.entityTypes.SanjaeKit, '온톨로지 사전에 SanjaeKit 이 없습니다');
  assert.ok(ON.PROGRAMS.erp.entityTypes.includes('SanjaeKit'), '이알피 개체 목록에 SanjaeKit 이 없습니다');
});

test('★★★ ⑩ 이알피 저장 길 — 한 사건 한 줄, 원본 가리킴, 끝난 사건 거절', () => {
  const store = { case_sanjae: [] }; const toasts = [];
  const ctx = { console, Object, Array, String, JSON, Date, CURRENT_USER: { sid: 'S01' },
    dbGet: (k, d) => (k in store ? store[k] : d), dbSet: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); return true; },
    uid: (p) => p + '-' + Math.random().toString(36).slice(2, 8), showToast: (m) => toasts.push(m), CustomEvent: function () {} };
  ctx.window = { dispatchEvent() {} };
  vm.createContext(ctx);
  vm.runInContext("var SANJAE_KIT_KEY = 'case_sanjae';\n" + cutFn(ERP, 'function erpIsTerminalRecord(') + '\n' + cutFn(ERP, 'function erpSanjaeKitGet(') + '\n' + cutFn(ERP, 'function erpSanjaeKitPut('), ctx);
  assert.equal(ctx.erpSanjaeKitPut({ caseId: 'c1', benefits: ['yoyang'] }, { id: 'c1', status: 'progress' }), true);
  assert.equal(ctx.erpSanjaeKitPut({ caseId: 'c1', benefits: ['yoyang', 'hyueop'] }, { id: 'c1' }), true);
  assert.equal(store.case_sanjae.length, 1, '★★ 같은 사건이 두 줄이 됐습니다');
  const r = store.case_sanjae[0];
  assert.equal(r.entityType, 'SanjaeKit'); assert.equal(r.sourceKind, 'case'); assert.equal(r.sourceId, 'c1');
  assert.ok(r.id && r.createdAt && r.updatedAt, '영구 id·시각');
  assert.equal(r.revision, 2); assert.equal(r.updatedBy, 'S01');
  assert.deepEqual(r.benefits, ['yoyang', 'hyueop']);
  assert.equal(ctx.erpSanjaeKitGet('c1').id, r.id);
  assert.equal(ctx.erpSanjaeKitPut({ caseId: 'c1', benefits: [] }, { id: 'c1', status: 'closed' }), false, '★★★ 끝난 사건을 저장했습니다');
  assert.deepEqual(store.case_sanjae[0].benefits, ['yoyang', 'hyueop']);
  // 지운 줄은 되살리지 않고 새 줄로
  store.case_sanjae[0]._deleted = true;
  ctx.erpSanjaeKitPut({ caseId: 'c1', benefits: ['yujok'] }, { id: 'c1' });
  assert.equal(store.case_sanjae.filter((x) => !x._deleted).length, 1);
  assert.ok(store.case_sanjae.some((x) => x._deleted), '★★ 지운 줄을 덮어 되살렸습니다');
});
