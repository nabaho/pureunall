'use strict';
/* 퇴직연금(DC) 자동 정리 (2026-10-11 대표 「한꺼번에 입력하면 자동으로 모든내용 정리 … 자동입금내역과 년말에 정산내역을 검토」)
   실행: node --test tests/dc-auto.test.js */
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
function env(store){
  const ctx = { Math, Number, String, Date, Array, Object, JSON, parseInt, isNaN, USERS_SEED: [], dbGet: (k, d) => (k in (store || {}) ? store[k] : d) };
  vm.createContext(ctx);
  vm.runInContext(['_dcCell', '_dcNum', '_dcDate', '_dcYm', 'dcSheetKind', 'dcParseBank', 'dcParseProvider', 'dcNameToSid', 'dcNameInText', 'dcLineKey', 'dcNewLines', 'dcYearEnd', 'getDCContributions', 'getDCBalance'].map(fnSrc).join('\n') +
    '\nthis.X = { kind:dcSheetKind, bank:dcParseBank, prov:dcParseProvider, n2s:dcNameToSid, nit:dcNameInText, fresh:dcNewLines, ye:dcYearEnd, bal:getDCBalance };', ctx);
  return ctx.X;
}
const J = v => JSON.stringify(v);

test('통장 거래내역 — 머리줄을 찾아 «퇴직연금» 출금만 고른다 (입금·다른 출금은 뺀다)', () => {
  const X = env();
  const rows = [['거래내역'], [''], ['거래일시', '적요', '의뢰인/수취인', '입금', '출금', '거래후잔액', '구분', '거래점', '거래특이사항'],
    ['2026-06-25 04:54:20', '퇴직연금부담금', '', '', '2,939,330', '1', '', '', ''],
    ['2026-06-05 10:43:23', '교보06-052', '', '', '636000', '1', '보험료', '', ''],
    ['2026-07-03 14:36:45', '푸른노무법인', '푸른노무법인', '', '295275', '1', '타행송금', '', '홍길동 노무사 퇴직연금 불입액'],
    ['2026-07-04 09:00:00', '이자', '', '1000', '', '1', '', '', '']];
  const k = X.kind(rows);
  assert.equal(k.kind, 'bank'); assert.equal(k.head, 2);
  const l = X.bank(rows, k);
  assert.equal(J(l.map(x => [x.date, x.amount])), J([['2026-06-25', 2939330], ['2026-07-03', 295275]]));
});

test('사업자 납입내역 — 사람별 줄 · 합계 줄은 뺀다 · 귀속월이 없으면 납입일의 달', () => {
  const X = env();
  const rows = [['부담금 납입내역'], ['성명', '납입일', '부담금'], ['홍길동', '2026.07.25', '310,000'], ['이영희', '2026-07-25', 280000], ['합계', '', '590,000']];
  const k = X.kind(rows);
  assert.equal(k.kind, 'provider');
  const l = X.prov(rows, k);
  assert.equal(J(l.map(x => [x.name, x.ym, x.amount])), J([['홍길동', '2026-07', 310000], ['이영희', '2026-07', 280000]]));
});

test('★ 이름 → 사번은 «딱 한 명»일 때만 제안 — 동명이인·없음은 빈칸(사람이 고른다)', () => {
  const X = env();
  const users = [{ sid: 'A', name: '홍길동' }, { sid: 'B', name: '이영희' }, { sid: 'C', name: '이영희' }];
  assert.equal(X.n2s('홍 길동', users), 'A');
  assert.equal(X.n2s('이영희', users), '', '동명이인은 제안하지 않는다');
  assert.equal(X.n2s('김없음', users), '');
  assert.equal(X.nit('홍길동 노무사 퇴직연금 불입액', users), 'A');
  assert.equal(X.nit('퇴직연금부담금', users), '');
});

test('겹친 줄은 한 번만 — 이미 넣은 줄(originKey)과 한 파일 안의 같은 줄', () => {
  const X = env();
  const a = { source: 'bank', date: '2026-06-25', amount: 2939330, memo: '퇴직연금부담금', name: '' };
  const b = Object.assign({}, a, { date: '2026-05-26' });
  const fresh = X.fresh([a, a, b], [{ originKey: 'bank|2026-05-26|2939330|퇴직연금부담금' }]);
  assert.equal(fresh.length, 1); assert.equal(fresh[0].date, '2026-06-25');
});

test('★ 연말 정산 — 임금총액÷12 와 낸 돈 · 사업자 내역이 없는 사람은 통장 합을 임금 비율로 «추정»', () => {
  const X = env();
  const users = [{ sid: 'A', name: '가', pensionType: 'DC' }, { sid: 'B', name: '나', pensionType: 'DC' }, { sid: 'C', name: '다', pensionType: 'DC', status: 'retired', lastWorkDate: '2026-08-31' }, { sid: 'D', name: '라', pensionType: 'NONE' }];
  const wage = { A: 36000000, B: 24000000, C: 12000000, D: 50000000 };
  const contribs = [
    { kind: 'paid', sid: 'A', ym: '2026-07', amount: 3100000 },          // 사람별 실제
    { kind: 'paid', sid: '', ym: '2026-06', amount: 6000000 },           // 통장(회사 몫) — A 실제분 포함
    { kind: 'paid', sid: '', ym: '2026-07', amount: 1100000 },
    { kind: 'auto', sid: 'B', ym: '2026-07', amount: 999 }];             // 자동 적립(계산값)은 낸 돈이 아니다
  const r = X.ye('2026', users, (sid) => wage[sid], contribs);
  const by = s => r.rows.find(x => x.sid === s);
  assert.equal(r.rows.length, 3, 'DC 가 아닌 사람은 빠진다');
  assert.equal(by('A').need, 3000000); assert.equal(by('A').paid, 3100000); assert.equal(by('A').short, 0); assert.equal(by('A').actual, true);
  // 통장 합 7,100,000 − 실제 확인 3,100,000 = 4,000,000 을 B:C = 24:12 로
  assert.equal(by('B').paid, 2666667); assert.equal(by('B').estimated, true); assert.equal(by('B').short, 0);
  assert.equal(by('C').paid, 1333333); assert.equal(by('C').short, 0); assert.equal(by('C').retiredThisYear, true);
});

test('적립금 잔액 — 실제 납입이 있으면 그것만, 없으면 자동 적립 (둘을 더하지 않는다)', () => {
  const X = env({ dc_contributions: [{ sid: 'A', kind: 'paid', amount: 100 }, { sid: 'A', auto: true, amount: 90 }, { sid: 'B', auto: true, amount: 50 }] });
  assert.equal(X.bal('A'), 100);
  assert.equal(X.bal('B'), 50);
});

test('퇴직정산에 «🏦 자동 정리» 탭이 붙는다', () => {
  assert.match(SRC, /\{ v:'auto',\s+label:'🏦 자동 정리' \}/);
  assert.match(SRC, /tab === 'auto' && h\(DcAutoTab, \{ year:selYear \}\)/);
});

test('★ 연말 정산의 회사 몫 합은 재무 통장까지 모은 값(companyTotal)을 쓴다 — 자동 정리로 넣은 줄만 세면 «낸 돈 0»', () => {
  const X = env();
  const users = [{ sid: 'A', name: '가', pensionType: 'DC' }, { sid: 'B', name: '나', pensionType: 'DC' }];
  const r = X.ye('2026', users, (sid) => (sid === 'A' ? 24000000 : 12000000), [], 3000000);
  assert.equal(r.company, 3000000);
  assert.equal(r.rows.find(x => x.sid === 'A').paid, 2000000);
  assert.match(SRC, /dcYearEnd\(year, [\s\S]{0,160}, wageOf, paidList, bankYear\)/);
});
