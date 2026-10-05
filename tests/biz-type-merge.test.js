'use strict';
/* 유형 합치기 화면 (업무유형 정리 3단계, 대표 2026-10-05 「순서대로」 · 일터 → 일터혁신)

   못 박는 것(규칙):
   ① 미리보기와 실행이 같은 계획(bizTypeMergePlan)이다 — 옮길 기록·바뀌는 번호·계약을 빠짐없이 보여 준다
   ② 컨설팅 번호는 저장 때 도는 재정렬(시작일 순)과 «같은 규칙»으로 매긴다 — 합친 뒤 번호가 또 바뀌지 않게
   ③ 사건·기금·기타는 순번을 지키고, 겹치면 그 해 다음 빈 번호
   ④ 실행은 한 건씩(dbPatch) — 표를 통째로 저장(dbSet)하지 않는다
   ⑤ 옛 유형은 지우지 않고 숨기며 mergedInto 를 남긴다 · 남긴 유형에 mergeLog(번호 전→후)
   ⑥ 중간에 실패하면 멈추고, 옛 유형을 «합쳐짐»으로 바꾸지 않는다(다시 누르면 남은 것만)
   ⑦ 합쳐진 유형은 다시 띄우지 못한다 · 남길 유형으로 고를 수도 없다 */
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
/* 상자(vm) 안에서 만든 배열은 deepEqual 이 «다른 세상 것»이라 튕긴다 — 겉모양만 견준다 */
const plain = (x) => JSON.parse(JSON.stringify(x));
const HEAD = src.slice(src.indexOf('var BIZ_TYPE_STORE ='), src.indexOf('function bizTypeLastHist('));

function world(data, opt) {
  opt = opt || {};
  const calls = { patch: [], set: [] };
  const c = {
    Object, String, Array, Math, Date, JSON, parseInt,
    dbGet: (k, d) => (k in data ? data[k] : d),
    dbSet: (k, v) => { calls.set.push(k); data[k] = v; return true; },
    dbPatch: (k, id, f) => {
      if (opt.failOn && opt.failOn === id) return false;
      calls.patch.push([k, id, JSON.parse(JSON.stringify(f))]);
      data[k] = (data[k] || []).map((r) => (r && r.id === id ? Object.assign({}, r, f) : r));
      return true;
    },
  };
  vm.createContext(c);
  vm.runInContext(HEAD, c);
  c.__calls = calls;
  return c;
}
const A = 'consulting-A', B = 'consulting-B';   /* A=일터(합칠) · B=일터혁신(남길) — 홍길동·가나상사 예시 */
function consData() {
  return {
    biz_cons_types: [{ code: A, short: '일터', name: '일터상생혁신컨설팅' }, { code: B, short: '일터혁신', name: '일터혁신상생컨설팅' }],
    consultings: [
      { id: 'a2', typeCode: A, no: '일터-2026-002', startDate: '2026-05-12', companyName: '가나상사' },
      { id: 'a1', typeCode: A, no: '일터-2026-001', startDate: '2026-04-06', companyName: '다라상사' },
      { id: 'a3', typeCode: A, no: '일터-2026-003', startDate: '2026-08-03', companyName: '마바상사' },
      { id: 'b1', typeCode: B, no: '일터혁신-2026-001', startDate: '2026-07-27', companyName: '사아상사' },
      { id: 'x1', typeCode: 'other', no: '현클-2026-001', startDate: '2026-01-01', companyName: '자차상사' },
    ],
    contracts: [{ id: 'k1', contractNo: '계약-2026-001', kinds: ['consulting'], typeCodes: { consulting: A } },
      { id: 'k2', contractNo: '계약-2026-002', kinds: ['consulting'], typeCodes: { consulting: 'other' } }],
    consultations: [],
  };
}

test('①② 컨설팅은 합친 모습에서 시작일 순으로 번호를 매긴다 — 원래 남길 유형의 건도 그 규칙을 따른다', () => {
  const c = world(consData());
  const p = c.bizTypeMergePlan('consulting', A, B);
  assert.equal(p.ok, true);
  const to = {}; p.moves.forEach((m) => { to[m.id] = m.toNo; });
  assert.equal(to.a1, '일터혁신-2026-001');
  assert.equal(to.a2, '일터혁신-2026-002');
  assert.equal(to.b1, undefined, 'b1 은 옮기는 건이 아니다');
  assert.deepEqual(plain(p.renum.map((r) => [r.id, r.toNo])), [['b1', '일터혁신-2026-003']], '번호만 바뀌는 건을 숨기면 합친 뒤 «모르는 번호 변경»이 된다');
  assert.equal(to.a3, '일터혁신-2026-004');
  assert.deepEqual(plain(p.contracts.map((x) => x.id)), ['k1'], '계약의 유형 표시도 함께 바꾼다');
});
test('② 다른 약어의 건은 건드리지 않는다', () => {
  const c = world(consData());
  const p = c.bizTypeMergePlan('consulting', A, B);
  assert.ok(!p.moves.concat(p.renum).some((m) => m.id === 'x1'));
});
test('③ 사건·기금·기타는 순번을 지키고 겹치면 그 해의 다음 빈 번호', () => {
  const data = {
    biz_case_types: [{ code: 'c-old', short: '산재', name: '산재(옛)' }, { code: 'c-new', short: '산재등', name: '산재등사건' }],
    cases: [{ id: 'o1', typeCode: 'c-old', caseNo: '산재-2026-001' }, { id: 'o2', typeCode: 'c-old', caseNo: '산재-2026-005' },
      { id: 'n1', typeCode: 'c-new', caseNo: '산재등-2026-001' }, { id: 'n2', typeCode: 'c-new', caseNo: '산재등-2026-002' }],
  };
  const c = world(data);
  const p = c.bizTypeMergePlan('case', 'c-old', 'c-new');
  const to = {}; p.moves.forEach((m) => { to[m.id] = m.toNo; });
  assert.equal(to.o1, '산재등-2026-003', '001 은 이미 있다 → 그 해 다음 빈 번호');
  assert.equal(to.o2, '산재등-2026-005', '겹치지 않으면 순번 그대로');
  assert.equal(p.renum.length, 0);
});
test('① 같은 유형·이미 합쳐진 유형으로는 계획이 서지 않는다', () => {
  const d = consData();
  d.biz_cons_types[1].mergedInto = 'zzz';
  const c = world(d);
  assert.equal(c.bizTypeMergePlan('consulting', A, A).ok, false);
  assert.equal(c.bizTypeMergePlan('consulting', A, B).ok, false);
});

test('④★ 실행은 한 건씩 고친다 — 기록 표를 통째로 저장하지 않는다', () => {
  const d = consData();
  const c = world(d);
  const r = c.bizTypeMergeRun(c.bizTypeMergePlan('consulting', A, B), '홍길동');
  assert.equal(r.failed, null);
  assert.ok(!c.__calls.set.includes('consultings') && !c.__calls.set.includes('contracts'), '표 통째 저장은 낡은 사본 PC 의 줄을 지운다');
  const a1 = d.consultings.find((x) => x.id === 'a1');
  assert.equal(a1.typeCode, B);
  assert.equal(a1.no, '일터혁신-2026-001');
  assert.equal(d.consultings.find((x) => x.id === 'b1').no, '일터혁신-2026-003');
  assert.equal(d.contracts.find((x) => x.id === 'k1').typeCodes.consulting, B);
  assert.equal(d.contracts.find((x) => x.id === 'k2').typeCodes.consulting, 'other');
});
test('⑤★ 옛 유형은 지우지 않고 숨기며 어디로 합쳐졌는지 남긴다 · 남긴 유형에 번호 전→후 기록', () => {
  const d = consData();
  const c = world(d);
  c.bizTypeMergeRun(c.bizTypeMergePlan('consulting', A, B), '홍길동');
  const old = d.biz_cons_types.find((t) => t.code === A);
  assert.ok(old, '옛 유형을 지우면 못 옮긴 기록이 「미설정」이 된다');
  assert.equal(old.hidden, true);
  assert.equal(old.mergedInto, B);
  const keep = d.biz_cons_types.find((t) => t.code === B);
  const log = keep.mergeLog[keep.mergeLog.length - 1];
  assert.equal(log.by, '홍길동');
  assert.equal(log.from.code, A);
  assert.ok(log.moved.some((m) => m.id === 'a1' && m.no0 === '일터-2026-001' && m.no1 === '일터혁신-2026-001'));
  assert.ok(log.renum.some((m) => m.id === 'b1'));
  assert.deepEqual(plain(log.contracts), ['k1']);
});
test('⑥★ 중간에 실패하면 멈추고, 옛 유형을 합쳐짐으로 바꾸지 않는다 · 다시 누르면 남은 것만', () => {
  const d = consData();
  const c = world(d, { failOn: 'a3' });
  const r = c.bizTypeMergeRun(c.bizTypeMergePlan('consulting', A, B), '홍길동');
  assert.ok(r.failed);
  assert.equal(d.biz_cons_types.find((t) => t.code === A).mergedInto, undefined);
  assert.equal(d.contracts.find((x) => x.id === 'k1').typeCodes.consulting, A, '실패 뒤의 일은 안 했다');
  const log = d.biz_cons_types.find((t) => t.code === B).mergeLog;
  assert.equal(log[log.length - 1].partial, true, '한 데까지는 기록한다');
  const c2 = world(d);
  const p2 = c2.bizTypeMergePlan('consulting', A, B);
  assert.ok(p2.moves.every((m) => m.id !== 'a1' && m.id !== 'a2'), '다시 누르면 이미 옮긴 것은 빠진다');
  assert.ok(p2.moves.some((m) => m.id === 'a3'));
});

test('⑦ 합쳐진 유형은 다시 띄우지 못한다 · 화면이 합치기 단추와 미리보기를 쓴다', () => {
  const card = strip(body(src, 'function BizTypeCard('));
  assert.match(body(card, 'function unhide('), /if\(\s*\w+ && \w+\.mergedInto\s*\)\{[\s\S]*?return;\s*\}[\s\S]*setHidden\(/,
    '합쳐진 유형을 다시 띄우면 같은 사업이 다시 두 유형이 된다');
  const modal = strip(body(src, 'function TypeMergeModal('));
  assert.match(modal, /bizTypeMergePlan\(/, '미리보기는 실행과 같은 계획이다');
  assert.match(modal, /bizTypeMergeRun\(/);
  assert.match(modal, /showConfirm\(/, '합치기 전에 묻는다');
  assert.match(modal, /filter\(function\(t\)\{ return !t\.mergedInto; \}\)/, '합쳐진 유형은 고르는 목록에 없다');
  assert.match(strip(body(src, 'function BizMasters(')), /h\(TypeMergeModal,/);
});
test('⑦ 비슷한 짝은 후보로만 — 0.8 미만(부당해고 ↔ 부당노동행위)은 짝으로 안 짚는다', () => {
  const c = world({});
  vm.runInContext(body(src, 'function bizTypeNearPairs('), c);
  const pairs = c.bizTypeNearPairs([
    { code: 'a', name: '일터상생혁신컨설팅' }, { code: 'b', name: '일터혁신상생컨설팅' },
    { code: 'c', name: '부당해고등노동위원회대리(노사)' }, { code: 'd', name: '부당노동행위노동위원회대리(노사)' },
    { code: 'e', name: '일터상생혁신', mergedInto: 'b' },
  ]);
  assert.deepEqual(plain(pairs.map((p) => p.map((t) => t.code).join('+'))), ['a+b']);
});
