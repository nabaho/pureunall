'use strict';
/* 사전에 없는 유형(고아) 정리 — 업무유형 정리 4단계 (대표 2026-10-07 「4단계」 · ②「지금 유형으로 잇기」 ③「숨긴 옛 유형으로 이름표만」)

   못 박는 것(규칙):
   ① 계약이 이관되어 생긴 기록이 «지금 쓰는 유형»이 있으면 그 유형으로 잇는다
   ② 같은 약어 · 대표가 확인한 짝(BIZ_TYPE_ORPHAN_ALIAS)만 잇는다 — 이름이 비슷하다고 잇지 않는다
   ③ 이을 유형이 없으면 숨긴 옛 유형으로 이름표만 — 기록은 안 바꾼다 · 다시 눌러도 두 번 안 더한다
   ④ 잇기는 유형 표시만(관리번호 그대로) · 한 건씩(dbPatch) · 표 통째 저장(dbSet) 없음
   ⑤ 화면: 계약까지 훑은 계획 · ☐ 로 푼 줄은 안 한다 · 옛 「복구」 단추도 한 건씩 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
function strip(s) { return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); }
function body(s, head) {
  const i = s.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = s.indexOf('{', i); k < s.length; k++) {
    if (s[k] === '{') d++;
    else if (s[k] === '}') { d--; if (!d) return s.slice(i, k + 1); }
  }
  throw new Error('괄호가 안 닫힘: ' + head);
}
const HEAD = src.slice(src.indexOf('var BIZ_TYPE_STORE ='), src.indexOf('function bizTypeLastHist('));
const plain = (x) => JSON.parse(JSON.stringify(x));

/* 홍길동·가나상사 예시 세상 — 실측 모양을 줄였다 */
function data() {
  return {
    biz_case_types: [
      { code: 'case-wage', short: '임금체불', name: '임금체불대리' },
      { code: 'case-ind', short: '산재등', name: '산재등사건대리' },
      { code: 'case-sub', short: '대지급금', name: '간이대지급금대리' },
      { code: 'case-bully', short: '직괴대리', name: '직장내괴롭힘조사대리' },
    ],
    cases: [
      { id: 'c1', typeCode: 'old-wage', caseNo: '임금등체-2025-001', status: 'closed' },
      { id: 'c2', typeCode: 'old-ind', caseNo: '산재등-2026-001', status: 'closed' },
      { id: 'c3', typeCode: 'old-near', caseNo: '산재-2026-001', status: 'closed' },
      { id: 'c4', typeCode: 'case-bully', caseNo: '직괴대리-2026-002', sourceContractNo: '계약-2026-032' },
    ],
    biz_fund_types: [{ code: 'fund-single', short: '사내근복', name: '사내근로복지기금' }],
    funds: [
      { id: 'f1', typeCode: 'old-gd', no: '공단지금-2026-001', status: 'closed' },
      { id: 'f2', typeCode: 'old-gd', no: '공단지금-2026-002', status: 'closed' },
      { id: 'f3', typeCode: 'fund-single', no: '사내-2026-001', sourceContractNo: '계약-2026-042' },
    ],
    contracts: [
      { id: 'k31', contractNo: '계약-2026-031', kinds: ['case'], typeCodes: { case: 'case-subsidy' } },
      { id: 'k32', contractNo: '계약-2026-032', kinds: ['case'], typeCodes: { case: 'old-x' } },
      { id: 'k42', contractNo: '계약-2026-042', kinds: ['fund'], typeCodes: { fund: 'old-y' } },
      { id: 'k33', contractNo: '계약-2026-033', kinds: ['fund'], typeCodes: { fund: 'old-gd' } },
    ],
  };
}
function world(d, opt) {
  opt = opt || {};
  const calls = { patch: [], set: [] };
  const c = {
    Object, String, Array, Math, Date, JSON, parseInt,
    BIZ_CASE_SEED: [{ code: 'case-subsidy', short: '체당', name: '체당금' }],
    dbGet: (k, def) => (k in d ? d[k] : def),
    dbSet: (k, v) => { calls.set.push(k); d[k] = v; return true; },
    dbPatch: (k, id, f) => {
      if (opt.failOn === id) return false;
      calls.patch.push([k, id]);
      d[k] = d[k].map((r) => (r && r.id === id ? Object.assign({}, r, f) : r));
      return true;
    },
  };
  vm.createContext(c);
  vm.runInContext(HEAD, c);
  c.__calls = calls;
  return c;
}
function byRef(plan) { const o = {}; plan.forEach((p) => { o[p.ref.id] = p; }); return o; }

test('①★ 이관되어 생긴 기록이 지금 쓰는 유형으로 잇는다', () => {
  const p = byRef(world(data()).bizTypeOrphanPlan());
  assert.equal(p.k32.action, 'link'); assert.equal(p.k32.to, 'case-bully');
  assert.equal(p.k42.action, 'link'); assert.equal(p.k42.to, 'fund-single');
});
test('②★ 같은 약어 · 대표가 확인한 짝(씨앗 이름 포함)으로 잇는다', () => {
  const p = byRef(world(data()).bizTypeOrphanPlan());
  assert.equal(p.c2.to, 'case-ind', '같은 약어 산재등');
  assert.equal(p.c1.to, 'case-wage', '대표 확인 짝 임금등체 → 임금체불');
  assert.equal(p.k31.to, 'case-sub', '씨앗의 체당 → 대지급금');
});
test('②★ 이름이 비슷할 뿐이면 잇지 않는다 — 산재 ≠ 산재등', () => {
  const p = byRef(world(data()).bizTypeOrphanPlan());
  assert.equal(p.c3.action, 'restore', '사업이 다르면 절대 합치지 않는다 — 짝 표와 같은 약어만');
});
test('③ 이을 유형이 없으면 옛 유형 이름표 — 번호 머리를 약어로, 계약도 같은 이름표', () => {
  const p = byRef(world(data()).bizTypeOrphanPlan());
  assert.equal(p.f1.action, 'restore');
  assert.equal(p.f1.entry.short, '공단지금');
  assert.equal(p.k33.action, 'restore');
  assert.equal(p.k33.entry.code, 'old-gd');
});

test('④★ 잇기는 유형 표시만 · 한 건씩 · 관리번호는 그대로 · 표 통째 저장 없음', () => {
  const d = data();
  const w = world(d);
  const r = w.bizTypeOrphanRun(w.bizTypeOrphanPlan(), '홍길동');
  assert.equal(r.failed, null);
  const c1 = d.cases.find((x) => x.id === 'c1');
  assert.equal(c1.typeCode, 'case-wage');
  assert.equal(c1.caseNo, '임금등체-2025-001', '종료된 건의 번호는 안 바꾼다');
  assert.equal(d.contracts.find((x) => x.id === 'k32').typeCodes.case, 'case-bully');
  assert.ok(!w.__calls.set.includes('cases') && !w.__calls.set.includes('contracts') && !w.__calls.set.includes('funds'),
    '기록 표를 통째로 저장하면 낡은 사본 PC 의 줄을 지운다');
});
test('③★ 옛 유형은 숨긴 채 사전에 더한다 · 기록은 안 바뀐다 · 다시 눌러도 두 번 안 더한다', () => {
  const d = data();
  const w = world(d);
  w.bizTypeOrphanRun(w.bizTypeOrphanPlan(), '홍길동');
  const gd = d.biz_fund_types.filter((t) => t.code === 'old-gd');
  assert.equal(gd.length, 1);
  assert.equal(gd[0].hidden, true, '새 건 고르는 목록에 옛 유형이 섞이면 안 된다');
  assert.equal(gd[0].oldType, true);
  assert.equal(gd[0].hist[gd[0].hist.length - 1].by, '홍길동');
  assert.equal(d.funds.find((x) => x.id === 'f1').typeCode, 'old-gd', '이름표만 — 기록은 그대로');
  const w2 = world(d);
  assert.equal(plain(w2.bizTypeOrphanPlan()).length, 0, '정리한 뒤에는 고아가 없다');
  w2.bizTypeOrphanRun([{ kind: 'fund', code: 'old-gd', ref: { store: 'funds', id: 'f1' }, action: 'restore', entry: { code: 'old-gd', short: '공단지금', name: 'x' } }], '홍길동');
  assert.equal(d.biz_fund_types.filter((t) => t.code === 'old-gd').length, 1, '같은 옛 유형을 두 번 더하지 않는다');
});
test('④ 중간에 실패하면 멈춘다 — 다시 누르면 남은 것만', () => {
  const d = data();
  const w = world(d, { failOn: 'k31' });
  const r = w.bizTypeOrphanRun(w.bizTypeOrphanPlan(), '홍길동');
  assert.ok(r.failed);
  const left = world(d).bizTypeOrphanPlan().map((p) => p.ref.id);
  assert.ok(left.includes('k31'));
  assert.ok(left.includes('k32'), '실패한 자리 뒤의 일은 하지 않는다 — 반쯤 하다 건너뛰면 무엇이 됐는지 모른다');
  assert.ok(!left.includes('c1'), '이미 이은 것은 다시 안 나온다');
});

test('⑤ 화면 — 미설정 찾기가 계획을 세우고, ☐ 로 푼 줄은 안 하며, 옛 「복구」도 한 건씩', () => {
  const bm = strip(body(src, 'function BizMasters('));
  assert.match(body(bm, 'function runTypeDiag('), /setOrphanPlan\(bizTypeOrphanPlan\(\)\)/);
  const tidy = body(bm, 'async function runOrphanTidy(');
  assert.match(tidy, /filter\(function\(p, i\)\{ return !orphanOff\[i\]; \}\)/, '☐ 로 푼 줄까지 하면 고르기 칸이 거짓말이 된다');
  assert.match(tidy, /showConfirm\(/);
  assert.match(tidy, /bizTypeOrphanRun\(/);
  const fix = body(bm, 'function fixOrphan(');
  assert.match(fix, /dbPatch\(/);
  assert.doesNotMatch(fix, /dbSet\(/, '옛 「복구」 단추가 표를 통째로 저장하면 안 된다');
  assert.match(bm, /type:'checkbox'/, '목록 맨 왼쪽 ☐ (대표 지시 2026-10-05)');
});
