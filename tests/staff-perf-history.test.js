'use strict';
/* ⭐ 직원 성과 이력 (2026-10-24 대표 「추천대로」·「시안대로»)
   결정: 옛 입금은 사건·컨설팅 카드를 만들지 않고 «항목» 글자로 업무 종류만 가른다 · 실적은 erpPerfCounts 하나로 거른다
   실행: node --test tests/staff-perf-history.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
function fnSrc(name){
  const i = SRC.indexOf('\nfunction ' + name + '(');
  assert.ok(i >= 0, name + ' 함수를 못 찾았습니다');
  const j = SRC.indexOf('\nfunction ', i + 10);
  return SRC.slice(i + 1, j < 0 ? undefined : j);
}
const ctx = { Math, Number, String, Date, Array, Object, JSON };
vm.createContext(ctx);
vm.runInContext(['erpPerfCounts', 'erpPerfWorkGroup', 'erpPerfHistory'].map(fnSrc).join('\n')
  + '\nthis.G = erpPerfWorkGroup; this.H = erpPerfHistory;', ctx);

test('업무 종류 — 입금 항목 글자로 가르고, 글자로 모르면 어디서 온 입금인지로', () => {
  assert.equal(ctx.G({ kind: '체당금 수수료' }), 'wage');
  assert.equal(ctx.G({ kind: '산재수수료(장해급여)' }), 'injury');
  assert.equal(ctx.G({ kind: '인사노무컨설팅(비즈)' }), 'consult');
  assert.equal(ctx.G({ kind: '산업일자리전환컨설팅' }), 'consult', '«일자리»가 들어도 컨설팅이 먼저');
  assert.equal(ctx.G({ kind: '청년일자리도약장려금' }), 'subsidy');
  assert.equal(ctx.G({ kind: '부당해고 재심사건 착수금' }), 'remedy');
  assert.equal(ctx.G({ kind: '운영상황보고서' }), 'fund');
  assert.equal(ctx.G({ kind: '', sourceKind: 'consulting' }), 'consult');
  assert.equal(ctx.G({ kind: '', sourceKind: 'case' }), 'remedy');
  assert.equal(ctx.G({ kind: '추석 명절상여금' }), 'bonus', '업무와 상관없는 상여는 따로');
  assert.equal(ctx.G({ kind: '연말성과급' }), 'bonus');
  assert.equal(ctx.G({ kind: '성공보수(홍길동)' }), 'remedy');
  assert.equal(ctx.G({ kind: '의견서' }), 'etc');
});

test('성과 이력 — 그 사람 몫만, 해·달·종류별로 더하고 실적이 아닌 입금은 뺀다', () => {
  const share = (sid, amount) => ({ sid, amount });
  const inc = [
    { date: '2022-03-02', kind: '체당금 수수료', perfShares: [share('A', 100)] },
    { date: '2022-03-20', kind: '인사노무컨설팅', perfShares: [share('A', 50), share('B', 70)] },
    { date: '2022-11-01', kind: '산재수수료', perfShares: [share('A', 30)], perfHistorical: true },
    { date: '2023-01-05', kind: '컨설팅', perfShares: [share('A', 999)], _deleted: true },
    { date: '2023-01-06', kind: '자문료', sourceKind: 'company', perfShares: [share('A', 999)] },
    { date: '2023-01-07', kind: '컨설팅', isPersonalIncome: true, perfShares: [share('A', 999)] },
    { date: '2023-02-01', kind: '컨설팅', perfShares: [share('B', 999)] }
  ];
  const h = ctx.H('A', inc);
  assert.deepEqual(Object.keys(h), ['2022'], '지운 것·자문료·개인소득·남의 몫은 안 센다');
  assert.equal(h['2022'].n, 3);
  assert.equal(h['2022'].sum, 180, '지난 실적(perfHistorical)도 실적으로는 센다');
  assert.equal(h['2022'].g.wage, 100);
  assert.equal(h['2022'].g.consult, 50, '같이 나눈 입금은 내 몫만');
  assert.equal(h['2022'].m['03'].n, 2);
  assert.equal(h['2022'].m['11'].g.injury, 30);
});

test('화면 — 금액이라 재무 권한자만 «성과 이력» 단추를 본다', () => {
  const d = fnSrc('StaffRosterDetail');
  assert.match(d, /_erpCanFin\(\)\s*&&\s*h\('button'[^]*?'⭐ 성과 이력'/);
  assert.match(d, /h\(StaffPerfHistoryModal,/);
  assert.match(fnSrc('StaffPerfHistoryModal'), /erpPerfHistory\(/);
});
