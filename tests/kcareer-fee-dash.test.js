'use strict';
/* 회의·비용관리 — 📊 한눈에 · 🧾 비용 목록 · 💰 정산 (대표 지시 2026-10-03 「회의비용관리도 대시보드 탭 메인등을
   만들어라」 → 목업 A+C 승인)
   못 박는 것:
     ① 메뉴: 한눈에가 «첫 자리»(상위를 누르면 열린다) · 비용 목록·정산이 같은 묶음 안에
     ② 새 통을 만들지 않는다 — meetfee·etcfee 두 통을 읽기만
     ③ 빠진 것: 금액·지출처 · 입금계좌는 «회의»만(식대·교통은 가게에 낸 돈)
     ④ 정산: 지출처별로 묶고 합계 큰 차례 · 지출처 없는 건도 한 줄로 드러난다 · 기간 거르기
     ⑤ 숫자를 누르면 비용 목록의 «고르개»를 움직여 거른다 — 따로 거르지 않는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리);
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}
function 세상(통) {
  const ctx = { get: (k) => 통[k] || [], Date, Number, isFinite, String, Object, Math };
  vm.createContext(ctx);
  vm.runInContext(['function feeAll(', 'function _feeAmt(', 'function _feeYear(', 'function _feeMon(', 'function feeMissing(',
    'function _feeInWhen(', 'function feeSettleGroups('].map(떼기).join('\n'), ctx);
  return ctx;
}
const 올해 = String(new Date().getFullYear());

test('① 메뉴 — 한눈에가 첫 자리 · 셋이 한 묶음', () => {
  const m = SRC.match(/\{g:'회의·비용관리', items:\[([^\n]*)\]\},/);
  assert.ok(m);
  const ids = [...m[1].matchAll(/\['(page-[a-z]+)'/g)].map((x) => x[1]);
  assert.equal(ids[0], 'page-feedash', '상위를 누르면 첫 화면이 열린다 — 한눈에가 메인');
  assert.ok(ids.includes('page-meetfee') && ids.includes('page-feesettle'));
  assert.ok(SRC.indexOf('id="page-feedash"') > 0 && SRC.indexOf('id="page-feesettle"') > 0);
  assert.match(SRC, /if\(id==='page-feedash'\) _safe\(renderFeeDash\)/);
  assert.match(SRC, /if\(id==='page-feesettle'\) _safe\(renderFeeSettle\)/);
});

test('② 두 통을 읽기만 — 어느 통에서 왔는지 들고 다닌다', () => {
  const c = 세상({ meetfee: [{ id: 'm1' }], etcfee: [{ id: 'e1' }] });
  const a = vm.runInContext('feeAll()', c);
  assert.equal(a.map((r) => r._st + ':' + r.id).join(','), 'meetfee:m1,etcfee:e1');
  const 몸 = 떼기('function renderFeeDash(') + 떼기('function renderFeeSettle(');
  assert.doesNotMatch(몸, /\bset\(/, '★ 그리기만 하는 화면이 기록을 쓰면 안 된다');
});

test('③ 빠진 것 — 금액·지출처 · 입금계좌는 회의만', () => {
  const c = 세상({});
  const f = (r) => Array.from(vm.runInContext('feeMissing(' + JSON.stringify(r) + ')', c));
  assert.deepEqual(f({ type: '회의', amt: '', org: '' }), ['금액 없음', '지출처 없음', '입금계좌 없음']);
  assert.deepEqual(f({ type: '식대', amt: '45,000', org: '○○식당' }), [], '식대는 계좌가 없어도 된다');
  assert.deepEqual(f({ type: '회의', amt: 150000, org: '김위원', acct: 'AC1' }), []);
});

test('④ 정산 — 지출처별 · 합계 큰 차례 · 지출처 없는 건도 드러난다 · 기간', () => {
  const c = 세상({ meetfee: [
    { id: 'a', org: '김위원', amt: 100000, date: 올해 + '-01-05', consentAt: '2026-01-06T00:00:00Z' },
    { id: 'b', org: '김위원', amt: '50,000', date: 올해 + '-02-01', acct: 'AC1' },
    { id: 'c', org: '노사협의회', amt: 300000, date: 올해 + '-03-01' },
    { id: 'd', org: '', amt: 7000, date: 올해 + '-03-02' },
    { id: 'e', org: '김위원', amt: 999999, date: '2001-01-01' },
  ] });
  const g = vm.runInContext("feeSettleGroups(feeAll(),'year')", c);
  assert.deepEqual(Array.from(g, (x) => x.who + ':' + x.sum), ['노사협의회:300000', '김위원:150000', '(지출처 없음):7000']);
  const 김 = g.find((x) => x.who === '김위원');
  assert.equal(김.n, 2);
  assert.equal(김.acct, true, '한 건이라도 계좌가 있으면 있음');
  assert.ok(김.consent, '동의서 만든 날을 읽는다');
  const 전체 = vm.runInContext("feeSettleGroups(feeAll(),'all')", c);
  assert.equal(전체.find((x) => x.who === '김위원').sum, 1149999, '전체는 지난 해까지');
});

test('⑤ 누르면 비용 목록의 고르개를 움직인다 — 따로 거르지 않는다', () => {
  const f = 떼기('function feeGo(');
  assert.match(f, /navTile\('page-meetfee'\)/);
  assert.match(f, /\[data-f="'\+f\+'"\]/);
  assert.match(f, /renderCareer\('meetfee'\)/);
  assert.doesNotMatch(f, /\.filter\(/);
});

test('동의서를 만들면 그 건에 만든 날을 남긴다 — 정산이 읽는다', () => {
  assert.match(떼기('function feeConsentDoc('), /consentAt=new Date\(\)\.toISOString\(\)/);
});
