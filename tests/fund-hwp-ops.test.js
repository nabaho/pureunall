'use strict';
/* ④ 운영 셋(재산변동상황보고서·협의회 회의록 사용범위/사용내용)의 원본 한글 틀 값 — _hwpOpsValues (2026-09-27 「계속」).
 * 대표 선택 «예전 제출본 모양». 재산변동 숫자는 HTML 과 같은 장부(S._docBf — bfDays)에서, 변경일마다 한 장.
 * 틀은 저장소에 없다. 이름·금액은 가짜. */
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
    'var S={year:2026, formFund:"X", _docBf:null};',
    'function num(v){ if(v===""||v==null) return ""; var n=Number(String(v).replace(/,/g,"")); return isFinite(n)?n:""; }',
    'function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;"); }',
    gF('_officersOf'), gF('_boss'), gF('estabSites'), gF('estabLiveSites'), gF('siteContribOf'), gF('foundContribOf'), gF('foundContrib'), gF('foundContribLive'),
    gF('_hwpKoDate2'), gF('_hwpTodayIso'), gF('_dashPhone'), gV('BF_KINDS'), gF('bfDays'), gF('bfReason'), gF('_hwpOpsValues'),
    gV('HWP_TPL_KINDS'),
    'this.ops=_hwpOpsValues; this.S=S; this.bfDays=bfDays; this.bfReason=bfReason; this.K=HWP_TPL_KINDS;',
  ].join('\n')).call(box);
  return box;
})();

const F = { _id: 'X', name: '가나다공동근로복지기금', fund_type: '공동', chairman: '홍길동', phone: '02-123-4567',
  address: '서울특별시 종로구 세종대로 1길 11', labor_office: '서울지방고용노동청', inka_no: '7210-2026-1',
  officers: [{ role: '이사장', name: '홍길동' }] };
const SITES = [{ _id: 's1', name: '가나기계 주식회사', contrib: 100000000, status: 'active' }];
const MOVES = [
  { date: '2026-03-10', dir: '증가', amount: 24000000, kind: 'employer', memo: '출연금 20% 편입 & 이월' },
  { date: '2026-07-01', dir: '감소', amount: 4000000, kind: 'use', memo: '대부' },
];

test('셋 다 한글 틀 목록에 있고 값 함수는 _hwpOpsValues', () => {
  const VAL = gV('HWP_TPL_VALUES');
  ['ops_asset_change', 'ops_minutes_scope', 'ops_minutes_use'].forEach((k) => {
    assert.equal(A.K[k], '공동', k); assert.match(VAL, new RegExp(k + ':_hwpOpsValues[,}]'), k);
  });
});

test('★ 재산변동 — 장부의 기본재산 변동을 «변경일마다 한 장», 줄어든 것은 △', () => {
  A.S._docBf = { fid: 'X', yr: 2026, open: 20000000, days: A.bfDays(20000000, MOVES) };
  const v = A.ops(F, SITES);
  assert.equal(v.변경.length, 2);
  assert.deepEqual([v.변경[0].변경일, v.변경[0].변경전, v.변경[0].변경후, v.변경[0].변경금액],
    ['2026. 03. 10.', '20,000,000', '44,000,000', '24,000,000']);
  assert.equal(v.변경[1].변경금액, '△ 4,000,000');
  assert.equal(v.목록일, '2026. 07. 01.', '재산목록 기준일 = 마지막 변경일');
  assert.match(v._note, /2건/);
  assert.equal(v.노동청, '서울지방고용노동청'); assert.equal(v.인가번호, '7210-2026-1');
});

test('변경 사유는 한글용 «글자 그대로» — HTML 이스케이프·<br> 가 섞이지 않는다', () => {
  A.S._docBf = { fid: 'X', yr: 2026, open: 0, days: A.bfDays(0, MOVES) };
  const r = A.ops(F, SITES).변경[0].변경사유;
  assert.ok(r.includes('& 이월') && !/&amp;|<br>/.test(r), r);
  assert.ok(A.bfReason(A.S._docBf.days[0].items).includes('&amp;'), 'HTML 쪽은 그대로 이스케이프한다');
});

test('★ 남의 기금·다른 해 장부는 쓰지 않는다 — 비우고 안내', () => {
  A.S._docBf = { fid: 'OTHER', yr: 2026, open: 0, days: A.bfDays(0, MOVES) };
  const v = A.ops(F, SITES);
  assert.deepEqual(v.변경, []); assert.match(v._note, /못 읽어/);
  A.S._docBf = { fid: 'X', yr: 2026, open: 5, days: [] };
  assert.match(A.ops(F, SITES)._note, /변동이 없습니다/);
});

test('사용범위 회의록 — 연도·기금명·출연금(설립 출연금)', () => {
  const v = A.ops(F, SITES);
  assert.equal(v.연도, '2026'); assert.equal(v.출연금, '100,000,000'); assert.equal(v.기금명, F.name);
  assert.equal(A.ops(Object.assign({}, F, { labor_office: '' }), []).노동청, '고용노동부  00지청', '모르면 원본 자리표');
});
