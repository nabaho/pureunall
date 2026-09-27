'use strict';
/* 결산 둘(감사보고서·협의회 회의록 결산 승인)의 원본 한글 틀 값 — _hwpAuditValues·_hwpCloseValues (2026-09-27 「계속」).
 * 대표 선택 «예전 제출본 모양» — 감사보고서는 한 장에 감사 모두(「본인 등은」), 서명 줄은 감사 수만큼.
 * 값은 HTML(_auditSheet·ops_minutes_close)이 쓰던 같은 곳에서. 틀은 저장소에 없다. 이름·금액은 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
const gF = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };
const gV = (n) => { const i = SRC.indexOf('var ' + n + '='); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('=', i); k < SRC.length; k++) { const c = SRC[k]; if (c === '{' || c === '[') d++; else if (c === '}' || c === ']') { d--; if (!d) return SRC.slice(i, SRC.indexOf(';', k) + 1); } } };

const A = (() => {
  const box = {};
  new Function([
    'var S={year:2026, formFund:"X", f15Close:null, f15For:null};',
    'function num(v){ if(v===""||v==null) return ""; var n=Number(String(v).replace(/,/g,"")); return isFinite(n)?n:""; }',
    gF('_officersOf'), gF('_boss'), gF('_auditorsOf'), gF('_fyRange'), gV('AUDIT_OP'),
    gF('_hwpKoDate'), gF('_hwpTodayIso'), gF('_closeFigVals'), gF('_hwpAuditValues'), gF('_hwpCloseValues'),
    'this.audit=_hwpAuditValues; this.close=_hwpCloseValues; this.S=S;',
  ].join('\n')).call(box);
  return box;
})();

const F = { _id: 'X', name: '가나다공동근로복지기금', fund_type: '공동', chairman: '홍길동',
  address: '서울특별시 종로구 세종대로 1길 11', inka_date: '2026-04-01',
  officers: [{ role: '이사장', name: '홍길동' }, { role: '근로자측 이사', name: '박노측' }, { role: '사용자측 이사', name: '최사측' },
    { role: '근로자측 감사', name: '김감사' }, { role: '사용자측 감사', name: '이감사' }] };

test('두 서식이 한글 틀 목록에 있고 값 함수가 이어져 있다', () => {
  const K = gV('HWP_TPL_KINDS'), VAL = gV('HWP_TPL_VALUES');
  assert.match(K, /ops_audit:'공동'/); assert.match(K, /ops_minutes_close:'공동'/);
  assert.match(VAL, /ops_audit:_hwpAuditValues/); assert.match(VAL, /ops_minutes_close:_hwpCloseValues/);
});

test('★ 감사보고서 — 한 장에 감사 모두(본인 등은), 설립한 해는 인가일부터, 의견은 HTML 과 같은 문구', () => {
  const v = A.audit(F);
  assert.equal(v.본인, '본인 등은');
  assert.deepEqual(v.감사.map((a) => a.감사명), ['김감사', '이감사']);
  assert.equal(v.시작일, '2026. 04. 01.'); assert.equal(v.종료일, '2026. 12. 31.');
  assert.match(v.감사의견, /회계처리는 적정하였습니다/);
  assert.equal(v.대표자, '홍길동'); assert.equal(v._note, '');
  const one = A.audit(Object.assign({}, F, { officers: [{ role: '근로자측 감사', name: '김감사' }] }));
  assert.equal(one.본인, '본인은', '감사가 한 사람이면 「본인은」');
});

test('감사보고서 — 명부에 감사가 없으면 원본처럼 빈 서명 줄 둘 + 안내(이름을 지어내지 않는다)', () => {
  const v = A.audit(Object.assign({}, F, { officers: [{ role: '이사장', name: '홍길동' }] }));
  assert.equal(v.감사, 2); assert.match(v._note, /감사가 없어/);
});

test('★ 결산 회의록 — 참석위원은 명부의 근로자·사용자 쪽, 이사장은 칸에 넣지 않고 알린다', () => {
  const v = A.close(F);
  assert.deepEqual(v.근위원.map((x) => x.이름), ['박노측', '김감사']);
  assert.deepEqual(v.사위원.map((x) => x.이름), ['최사측', '이감사']);
  assert.match(v._note, /이사장\(홍길동\)/);
  assert.equal(v.회의장소, F.address); assert.equal(v.연도, '2026');
  assert.equal(v.결산, 0, '확정 전 숫자는 넣지 않는다 — 결산 줄째 지운다');
  const none = A.close({ name: '가' });
  assert.equal(none.근위원[0].이름, ' ', '사람이 없으면 칸은 빈 칸 그대로(밑줄 아님)');
  assert.equal(none.회의장소, '회사 내 회의실', '주소를 모르면 원본 문구');
});

test('★★ 결산 수치는 «확정한 해», «이 기금»의 것만 — 결산 탭에서 본 다른 기금 숫자가 새지 않는다', () => {
  A.S.f15Close = { locked: true, fin: { f15_src_total: 52000, f15_total: 12000.4, f15_rest: 40000 } };
  A.S.f15For = 'X/2026';
  assert.deepEqual(A.close(F).결산, [{ 재원: '52,000', 집행: '12,000', 잔액: '40,000' }]);
  A.S.f15For = 'Y/2026';
  assert.equal(A.close(F).결산, 0);
  A.S.f15For = 'X/2026'; A.S.f15Close.locked = false;
  assert.equal(A.close(F).결산, 0);
  A.S.f15Close = null; A.S.f15For = null;
});

test('HTML 회의록도 같은 결산 값(_closeFigVals)을 쓴다 — 한쪽만 고치는 사고 막기', () => {
  assert.match(gF('_closeFigures'), /_closeFigVals\(\)/);
});
