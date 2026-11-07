// 자문료 입금확인(js/pu-adv-check.js) — 「확인이 필요한 칸」과 엑셀 양식 (2026-11-07)
// 값이 아니라 «판단의 규칙»을 본다: 어떤 칸을 사람에게 보여 주고, 어떤 칸은 조용히 넘기는가.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const A = require(path.join(__dirname, '..', 'js', 'pu-adv-check.js'));

const NOW = { year: 2026, nowYear: 2026, nowMonth: 10, nowDay: 20 };
const co = (over) => Object.assign({ id: 'c1', name: '예시상회', fee: 110000, payDay: '5', contractStartDate: '', mainName: '담당' }, over);
const base = (list, paidMap, extra) => Object.assign({}, NOW, {
  list,
  feeFor: (c) => c.fee,
  stopped: () => false,
  paid: (c, ym) => paidMap[c.id + '|' + ym] || { cnt: 0, got: 0 },
  paidDates: () => []
}, extra || {});
const full = (c, from, to) => { const m = {}; for (let i = from; i <= to; i++) m[c.id + '|2026-' + (i < 10 ? '0' : '') + i] = { cnt: 1, got: c.fee }; return m; };

test('다 받았으면 확인할 칸이 없다', () => {
  const c = co();
  assert.deepStrictEqual(A.checkList(base([c], full(c, 1, 10))), []);
});

test('입금이 없는 달은 «입금 없음», 일부만 받으면 «금액 부족», 더 받으면 «금액 초과»', () => {
  const c = co();
  const paid = full(c, 1, 10);
  delete paid['c1|2026-03'];
  paid['c1|2026-04'] = { cnt: 1, got: 50000 };
  paid['c1|2026-05'] = { cnt: 2, got: 220000 };
  const r = A.checkList(base([c], paid));
  assert.deepStrictEqual(r.map((x) => x.ym + ':' + x.reason), ['2026-03:none', '2026-04:partial', '2026-05:over']);
  assert.deepStrictEqual(A.summarize(r), { none: 1, partial: 1, over: 1 });
});

test('★ 앞으로 올 달·계약 전·중단 뒤는 «입금 없음»으로 보지 않는다', () => {
  const c = co({ contractStartDate: '2026-04-01' });
  const r = A.checkList(base([c], {}, { stopped: (x, ym) => ym >= '2026-09' }));
  // 4~8월만 후보(1~3월 계약 전, 9·10월 중단 뒤)
  assert.deepStrictEqual(r.map((x) => x.ym), ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08']);
  // 다음 달 이후는 아예 안 본다
  const future = A.checkList(base([co()], {}, { nowMonth: 3, nowDay: 31 }));
  assert.ok(future.every((x) => x.ym <= '2026-03'));
});

test('이번 달은 지정일 + 여유 5일이 지나야 «입금 없음» — 지정일을 모르면 건너뛴다', () => {
  const c = co({ payDay: '10' });
  const paid = full(c, 1, 9);
  const early = A.checkList(base([c], paid, { nowDay: 15 }));      // 10일+5일=15일 → 아직
  assert.strictEqual(early.length, 0, '여유 안에서는 알리지 않는다');
  const late = A.checkList(base([c], paid, { nowDay: 16 }));
  assert.deepStrictEqual(late.map((x) => x.ym + ':' + x.reason), ['2026-10:none']);
  const unknown = A.checkList(base([co({ payDay: '', cmsPayDay: 0 })], full(co(), 1, 9), { nowDay: 28 }));
  assert.strictEqual(unknown.length, 0, '지정일을 모르면 이번 달은 건너뛴다(틀린 경고보다 낫다)');
});

test('약정액이 0원이면 보지 않는다 · 그 달 약정액(이력)을 쓴다', () => {
  const c = co({ fee: 0 });
  assert.deepStrictEqual(A.checkList(base([c], {})), []);
  const d = co({ id: 'c2', fee: 440000 });
  const r = A.checkList(base([d], { 'c2|2026-01': { cnt: 1, got: 275000 } }, { feeFor: (x, ym) => (ym < '2026-02' ? 275000 : 440000), nowMonth: 2, nowDay: 28 }));
  assert.deepStrictEqual(r.map((x) => x.ym + ':' + x.reason), ['2026-02:none'], '1월은 그 달 약정액(275,000)과 같아 정상');
});

test('업체 지정일: cmsPayDay 가 payDay 보다 먼저', () => {
  assert.strictEqual(A.dueDayOf({ cmsPayDay: 25, payDay: '5' }), 25);
  assert.strictEqual(A.dueDayOf({ cmsPayDay: 0, payDay: '10일' }), 10);
  assert.strictEqual(A.dueDayOf({}), 0);
});

test('엑셀 양식: 머리·사업장·공급대가·지정일·1~12월 날짜·비고(부분입금)', () => {
  const c = co();
  const dates = { 'c1|2026-01': ['2026-01-05'], 'c1|2026-02': ['2026-02-07', '2026-02-20'] };
  const rows = A.excelRows(Object.assign(base([c], { 'c1|2026-02': { cnt: 2, got: 110000 }, 'c1|2026-01': { cnt: 1, got: 50000 } }), { paidDates: (x, ym) => dates[x.id + '|' + ym] || [] }));
  assert.deepStrictEqual(rows[0], ['사업장명', '공급대가', '입금일', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월', '비고']);
  assert.strictEqual(rows[1][0], '예시상회');
  assert.strictEqual(rows[1][1], 110000);
  assert.strictEqual(rows[1][2], '5일');
  assert.strictEqual(rows[1][3], '2026-01-05');
  assert.strictEqual(rows[1][4], '2026-02-07', '두 번 들어왔으면 앞선 날짜');
  assert.strictEqual(rows[1][5], '');
  assert.match(rows[1][15], /1월 부분입금 50,000\/110,000/);
  assert.match(rows[1][15], /2월 2번 입금/);
});

test('이 파일은 입금표시를 «만들지» 않는다 — 저장 함수를 부르지 않는다', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-adv-check.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(src, /dbUpsert|dbSet|dbPatch|dbRemove|localStorage|fetch\(/);
});
