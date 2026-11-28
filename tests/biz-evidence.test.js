'use strict';
/* 🧾 사업자번호·담당 «근거로 채우기» — 규칙을 못 박는다 (대표 지시 2026-11-28)
   ═══════════════════════════════════════════════════════════════════════════
   ■ 지키는 것(값이 아니라 «규칙»)
     ① 서로 다른 근거 둘 이상 + 그 가운데 바깥 자료(공문서·재무 장부)가 있을 때만 자동 채움
     ② 한 곳뿐이거나 안쪽 기록(업체관리·다른 업무 건)끼리만 짝이면 «제안»(사람이 고른다)
     ③ 같은 이름에 다른 번호가 나오면 충돌 — 채우지 않는다. 대표자가 서로 다르면 충돌.
     ④ 이름이 «닮기만» 한 것(부분 일치)·법인 표기만 다른 것: 부분 일치는 안 채우고, 표기만 다른 꼭 같은 이름은 같은 이름으로 본다
     ⑤ 이미 있는 값은 덮지 않는다 — 다르면 «확인 필요»만. 표기만 다른 같은 번호는 자동 정리.
     ⑥ 끝난 건(종결·취소·이관·보관)·삭제 건은 건드리지 않는다. 계약 표는 제안만(쓰지 않는다).
     ⑦ 자동으로 채운 값(bizAuto)은 다시 근거가 되지 않는다. 검증숫자가 틀린 번호는 근거가 아니다.
     ⑧ 주담당·거래처 담당자는 «제안만» — 같은 업체(번호표·검증된 번호)의 다른 건에서 일관될 때만, 끝난 건·퇴사자·충돌은 제외.
     ⑨ 저장은 번호 칸 하나(bizNo + bizAuto 표시)뿐 — companyId·주담당·담당자는 이 창이 쓰지 않는다. 쓰는 지금 다시 고르고 «서버의 지금 값»도 다시 읽는다(못 읽으면 쓰지 않는다). 되돌리기는 «채울 때 남긴 표시와 똑같고 값이 그대로일 때만».
     ⑩ 번호표(companyId) 길도 «바깥 자료의 다른 번호·대표자 충돌»을 먼저 본다. 자동으로 채운 업체 번호는 다시 퍼뜨리지 않는다. 대표자는 근거 «줄마다» 견준다.
     ⑫ 이 건을 만든 «원본 계약»(sourceContractId·sourceContractNo)의 번호는 번호표 연결이다 — 충돌·대표자·자동 값 전파를 똑같이 먼저 본다.
     ⑬ 이름 «일부» + 금액 + 날짜(90일)를 한꺼번에 맞추는 세금계산서 한 줄이 «하나»일 때만 «제안»(자동 아님). 하나라도 어긋나거나 후보가 둘 이상이면 아무것도 안 낸다.
     ⑭ 자동 연결은 «총괄관리자 PC · 하루 한 번 · 자동 채움 등급만». 제안·확인 필요·충돌은 저절로 쓰지 않는다. 끄는 칸이 있다.
     ⑪ 모두 같은 숫자(0000000000)는 번호가 아니다 · 법인 표기는 이름 «앞·뒤»에서만 걷는다 · 일반 객체의 상속 속성(constructor 등)이 근거로 읽히지 않는다.
   ⚠ 저장소는 공개다 — 검사는 지어낸 이름과 «123-» 으로 시작하는 가짜 번호만 쓴다(번호는 실행 때 만든다).
   실행: node --test tests/biz-evidence.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');

const R = path.join(__dirname, '..');
const P = require(path.join(R, 'js', 'pu-biz-evidence.js'));
const ERP = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');

/* 아홉 자리 → 검증숫자를 붙인 열 자리(가짜). 소스에 번호 글자를 적지 않는다. */
function mk(nine) {
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let s = 0;
  for (let i = 0; i < 9; i++) s += (+nine[i]) * w[i];
  s += Math.floor((+nine[8]) * 5 / 10);
  return nine + ((10 - (s % 10)) % 10);
}
const N1 = mk('123456781'), N2 = mk('123450002'), N3 = mk('123450003');
const F = P.fmtDigits;
const BAD = N1.slice(0, 9) + String((+N1[9] + 1) % 10);       // 검증숫자만 틀린 열 자리

const hometax = (name, num, id, date) => ({ kind: 'hometax', name, bizNo: num, ref: id, date: date || '2026-03-01' });
const cms = (name, num, id) => ({ kind: 'cms', name, bizNo: num, ref: id });
const master = (name, num, id) => ({ kind: 'master', name, bizNo: num, ref: id });
const record = (name, num, id) => ({ kind: 'record', name, bizNo: num, ref: id });
const decide = (rec, rows, extra) => P.decideBiz(rec, Object.assign({ idx: P.buildIndex(rows), companyById: {} }, extra || {}));

/* ══════ 번호 칸 상태 · 이름 열쇠 ══════ */
test('① 번호 칸 상태 — 꼴·검증숫자·길이로 가른다', () => {
  assert.equal(P.bizStatus('').kind, 'empty');
  assert.equal(P.bizStatus('  ').kind, 'empty');
  assert.equal(P.bizStatus(F(N1)).kind, 'ok');
  assert.equal(P.bizStatus(N1).kind, 'format', '하이픈이 없는 열 자리(검증 통과) = 표기만 다름');
  assert.equal(P.bizStatus(N1.slice(0, 3) + ' ' + N1.slice(3, 5) + ' ' + N1.slice(5)).kind, 'format');
  assert.equal(P.bizStatus('사업자 ' + F(N1)).kind, 'text', '글자가 섞인 값은 표기 정리 대상이 아니다');
  assert.equal(P.bizStatus(F(BAD)).kind, 'badsum');
  assert.equal(P.bizStatus('123-45').kind, 'short');
  assert.equal(P.bizStatus('abc').kind, 'nodigit');
  assert.equal(P.bizStatus(N1 + '123').kind, 'long');
  assert.equal(P.bizStatus(N1 + '123').headOk, true, '앞 열 자리가 검증을 통과하면 종사업장 번호가 붙은 꼴');
});

test('② 이름 열쇠는 erpNormName 과 «글자까지 같다» (두 벌이 어긋나지 않게)', () => {
  const ctx = { String };
  vm.createContext(ctx);
  vm.runInContext(cutFn(ERP, 'function erpNormName('), ctx);
  ['(주)가나상사', '가나상사 주식회사', '㈜ 가나-상사', '가나상사(서울점)', '재단법인 다라 복지재단', '  마바  건설, 유한회사 ', 'ABC Corp.', '', null, undefined]
    .forEach(s => assert.equal(P.nameKey(s), ctx.erpNormName(s), '「' + s + '」'));
  /* 법인 표기가 이름 «가운데»에 끼면 erpNormName 은 걷지만, 이쪽은 걷지 않는다 — 서로 다른 상호가 같아지지 않게 */
  assert.notEqual(P.nameKey('가나주식회사다라'), P.nameKey('가나다라'));
  assert.notEqual(P.nameKey('가나(주)다라'), P.nameKey('가나다라'));
  assert.equal(P.nameKey('주식회사 (주) 가나'), P.nameKey('가나'), '앞에 겹친 표기는 모두 걷는다');
  assert.equal(P.nameKey('가나 (주)'), P.nameKey('가나'), '뒤에 붙은 표기');
  assert.notEqual(P.nameKey('가나상사(서울점)'), P.nameKey('가나상사'), '괄호 안의 지점 이름은 남긴다 — 다른 곳일 수 있다');
});

/* ══════ 자동 채움 기준 ══════ */
test('③ 서로 다른 근거 둘 이상(바깥 자료 포함)이 같은 번호 → 자동 채움', () => {
  const d = decide({ name: '가나상사', bizNo: '' }, [hometax('(주)가나상사', F(N1), 'h1'), cms('가나상사', N1, 'c1')]);
  assert.equal(d.action, 'fill'); assert.equal(d.level, 'auto'); assert.equal(d.to, F(N1));
  assert.deepEqual(d.evidence.kinds.sort(), ['cms', 'hometax']);
  const d2 = decide({ name: '가나상사', bizNo: '' }, [hometax('가나상사', F(N1), 'h1'), master('가나상사', F(N1), 'm1')]);
  assert.equal(d2.level, 'auto', '공문서 + 업체관리');
  const d3 = decide({ name: '가나상사', bizNo: '' }, [cms('가나상사', F(N1), 'c1'), master('가나상사', F(N1), 'm1')]);
  assert.equal(d3.level, 'auto', '재무 장부 + 업체관리');
});

test('④ 근거가 한 곳뿐이면 자동이 아니다 — 같은 곳에서 여러 줄이어도 «제안»', () => {
  const rows = ['h1', 'h2', 'h3', 'h4'].map((id, i) => hometax('가나상사', F(N1), id, '2026-0' + (i + 1) + '-01'));
  const d = decide({ name: '가나상사', bizNo: '' }, rows);
  assert.equal(d.level, 'ask'); assert.equal(d.action, 'suggest'); assert.equal(d.evidence.rows, 4);
});

test('⑤ 안쪽 기록(업체관리·다른 업무 건)끼리만 짝이면 «독립된 두 곳»이 아니다 → 제안', () => {
  const d = decide({ name: '가나상사', bizNo: '' }, [master('가나상사', F(N1), 'm1'), record('가나상사', F(N1), 'consultings:k1')]);
  assert.equal(d.level, 'ask');
});

test('⑥ 같은 이름에 다른 번호가 하나라도 나오면 충돌 — 채우지 않는다', () => {
  const d = decide({ name: '가나상사', bizNo: '' }, [hometax('가나상사', F(N1), 'h1'), cms('가나상사', F(N1), 'c1'), cms('가나상사', F(N2), 'c2')]);
  assert.equal(d.action, 'conflict'); assert.equal(d.level, 'conflict'); assert.equal(d.to, '');
  assert.equal(d.cands.length, 2);
});

test('⑦ 대표자가 양쪽에 있는데 겹치지 않으면 충돌, 겹치면 통과, 한쪽이 비면 판단 안 함', () => {
  const rows = ceo => [Object.assign(hometax('가나상사', F(N1), 'h1'), { ceo }), cms('가나상사', F(N1), 'c1')];
  assert.equal(decide({ name: '가나상사', bizNo: '', ceo: '홍길동' }, rows('김철수')).reason, 'ceo-differs');
  assert.equal(decide({ name: '가나상사', bizNo: '', ceo: '홍길동 외 1명' }, rows('홍길동, 김철수')).level, 'auto');
  assert.equal(decide({ name: '가나상사', bizNo: '', ceo: '' }, rows('김철수')).level, 'auto');
});

test('⑧ 이름이 «닮기만» 한 것은 후보로도 안 올린다 — 꼭 같은 이름만', () => {
  const rows = [hometax('가나상사', F(N1), 'h1'), cms('가나상사', F(N1), 'c1')];
  for (const nm of ['가나상사 서울점', '가나', '가나상사(서울점)', '가나상사산업', '다라상사']) {
    assert.equal(decide({ name: nm, bizNo: '' }, rows).action, 'none', '「' + nm + '」');
  }
  assert.equal(decide({ name: '가나상사㈜', bizNo: '' }, rows).level, 'auto', '법인 표기만 다른 꼭 같은 이름은 같은 이름');
  assert.equal(decide({ name: 'ㄱ', bizNo: '' }, [hometax('ㄱ', F(N1), 'h1'), cms('ㄱ', F(N1), 'c1')]).action, 'none', '한 글자 이름은 근거로 삼지 않는다');
  /* 색인에 넣는 쪽과 찾는 쪽이 «각각» 막는다 — 한쪽이 풀려도 다른 쪽이 잡아야 한다 */
  assert.equal(Object.keys(P.buildIndex([hometax('ㄱ', F(N1), 'h1'), cms('ㄱ', F(N1), 'c1')]).byName).length, 0, '색인에 안 넣는다');
  const hand = { byName: { 'ㄱ': { name: 'ㄱ', nums: { [N1]: { rows: 2, kinds: { hometax: 1, cms: 1 }, refs: [], last: '', ceos: {} } } } } };
  assert.equal(P.decideBiz({ name: 'ㄱ', bizNo: '' }, { idx: hand, companyById: {} }).action, 'none', '색인에 있어도 한 글자 이름은 찾지 않는다');
});

test('⑨ 이미 값이 있으면 덮지 않는다 — 근거가 달라도 «확인 필요»만, 표기만 다르면 자동 정리', () => {
  const ev = [hometax('가나상사', F(N2), 'h1'), cms('가나상사', F(N2), 'c1')];
  const ok = decide({ name: '가나상사', bizNo: F(N1) }, ev);
  assert.equal(ok.action, 'check'); assert.equal(ok.reason, 'evidence-differs'); assert.equal(ok.level, 'check');
  assert.equal(decide({ name: '가나상사', bizNo: F(N2) }, ev).action, 'ok');
  const fmt = decide({ name: '가나상사', bizNo: N2 }, ev);
  assert.equal(fmt.action, 'format'); assert.equal(fmt.level, 'auto'); assert.equal(fmt.to, F(N2));
  /* 값이 이상한 칸(검증숫자 틀림·글자 섞임·모자람)은 근거가 있어도 «후보를 보여 줄 뿐» 쓰지 않는다 */
  for (const raw of [F(BAD), '123-45', '번호 ' + F(N2)]) {
    const d = decide({ name: '가나상사', bizNo: raw }, ev);
    assert.equal(d.action, 'check', raw); assert.equal(d.to, F(N2)); assert.equal(d.level, 'check');
  }
});

test('⑩ 열한 자리 이상 — 앞 열 자리가 검증을 통과하면 종사업장 번호가 붙은 정상 꼴, 못 넘으면 확인 필요', () => {
  const a = decide({ name: '가나상사', bizNo: N1 + '123' }, []);
  assert.equal(a.action, 'ok'); assert.equal(a.reason, 'has-suffix');
  const b = decide({ name: '가나상사', bizNo: BAD + '12' }, []);
  assert.equal(b.action, 'check'); assert.equal(b.reason, 'long');
});

test('⑪ 끝난 건·삭제 건은 건드리지 않는다', () => {
  const ev = [hometax('가나상사', F(N1), 'h1'), cms('가나상사', F(N1), 'c1')];
  assert.equal(decide({ name: '가나상사', bizNo: '', terminal: true }, ev).reason, 'terminal');
  assert.equal(decide({ name: '가나상사', bizNo: N1, terminal: true }, ev).level, 'skip', '표기 정리도 끝난 건에는 안 한다');
  assert.equal(decide({ name: '가나상사', bizNo: '', deleted: true }, ev).reason, 'deleted');
  for (const st of ['closed', 'cancelled', 'transferred']) assert.equal(P.isTerminal({ status: st }), true, st);
  assert.equal(P.isTerminal({ closedAt: '2026-01-01' }), true);
  assert.equal(P.isTerminal({ transferredTo: 'x' }), true);
  assert.equal(P.isTerminal({ status: 'progress' }), false);
});

test('⑫ 근거로 못 쓰는 줄 — 검증숫자 틀림·자동으로 채운 값·취소된 계산서', () => {
  const idx = P.buildIndex([hometax('가나상사', F(BAD), 'h1'), cms('가나상사', F(BAD), 'c1')]);
  assert.equal(Object.keys(idx.byName).length, 0, '검증숫자가 틀린 번호는 색인에 들어가지 않는다');
  const idx2 = P.buildIndex([hometax('가나상사', F(N1), 'h1'), Object.assign(cms('가나상사', F(N1), 'c1'), { auto: true })]);
  assert.equal(idx2.stat.skippedAuto, 1);
  assert.equal(decide({ name: '가나상사', bizNo: '' }, [hometax('가나상사', F(N1), 'h1'), Object.assign(record('가나상사', F(N1), 'x'), { auto: true })]).level, 'ask',
    '자동으로 채운 줄이 «두 번째 근거»가 되면 짐작이 짐작을 낳는다');
  const plan = P.buildPlan({ companies: [], stores: { consultings: [{ id: 'k', companyName: '가나상사', bizNo: '' }] },
    evidence: { invoices: [{ companyName: '가나상사', bizNo: F(N1), id: 'i1', status: '취소' }], cms: [{ name: '가나상사', bizNo: F(N1), _k: 'c1' }] } });
  assert.equal(plan.rows.filter(r => r.field === 'bizNo' && r.level === 'auto').length, 0, '취소된 계산서는 근거가 아니다 → 근거가 CMS 한 곳뿐');
  assert.equal(plan.rows.filter(r => r.field === 'bizNo' && r.level === 'ask').length, 1);
});

test('⑬ 업체 번호(companyId)로 이어진 업체의 번호는 근거 하나로 충분 — 업체가 다른 번호면 확인 필요', () => {
  const ctx = { companyById: { c1: { bizNo: F(N1), deleted: false }, c2: { bizNo: '', deleted: false }, c3: { bizNo: F(N1), deleted: true } } };
  const d = P.decideBiz({ name: '이름이 달라도', bizNo: '', companyId: 'c1' }, Object.assign({ idx: P.buildIndex([]) }, ctx));
  assert.equal(d.action, 'fill'); assert.equal(d.via, 'link'); assert.equal(d.to, F(N1));
  assert.equal(P.decideBiz({ name: 'x1', bizNo: '', companyId: 'c2' }, Object.assign({ idx: P.buildIndex([]) }, ctx)).action, 'none');
  assert.equal(P.decideBiz({ name: 'x1', bizNo: '', companyId: 'c3' }, Object.assign({ idx: P.buildIndex([]) }, ctx)).action, 'none', '지워진 업체는 근거가 아니다');
  const diff = P.decideBiz({ name: 'x1', bizNo: F(N2), companyId: 'c1' }, Object.assign({ idx: P.buildIndex([]) }, ctx));
  assert.equal(diff.reason, 'differs-from-company'); assert.equal(diff.level, 'check');
});

test('⑭ 프로토타입 열쇠 이름(__proto__ 등)이 이름·번호표로 들어와도 터지지 않는다', () => {
  assert.doesNotThrow(() => P.buildPlan({ companies: [{ id: '__proto__', name: 'constructor', bizNo: '' }],
    stores: { funds: [{ id: 'f1', companyName: '__proto__', companyId: '__proto__', bizNo: '' }] }, evidence: { cms: [{ name: '__proto__', bizNo: F(N1), _k: '1' }] } }));
  assert.equal(decide({ name: 'constructor', bizNo: '' }, []).action, 'none');
});

test('⑭-2 모두 같은 숫자(자리표시자)는 검증숫자를 통과해도 번호가 아니다 — 근거로도 채움으로도 쓰지 않는다', () => {
  for (const d of ['0000000000', '1111111111', '9999999999']) {
    assert.equal(P.checksumOk(d), false, d);
    assert.equal(P.bizStatus(d).kind, 'badsum', d);
  }
  assert.equal(Object.keys(P.buildIndex([hometax('가나상사', '0000000000', 'h1'), cms('가나상사', '0000000000', 'c1')]).byName).length, 0);
});

test('⑭-3 번호표(companyId) 길도 먼저 본다 — 바깥 자료가 다른 번호를 말하면 충돌, 대표자가 다르면 충돌, 자동으로 채운 업체 번호는 제안', () => {
  const ctx = (extra) => ({ idx: P.buildIndex((extra && extra.rows) || []), companyById: { c1: Object.assign({ bizNo: F(N1), deleted: false, ceo: '홍길동', auto: false }, (extra && extra.co) || {}) } });
  const rec = { name: '가나상사', bizNo: '', companyId: 'c1', ceo: '홍길동' };
  assert.equal(P.decideBiz(rec, ctx()).level, 'auto', '기본: 번호표로 이어진 업체의 번호');
  const conf = P.decideBiz(rec, ctx({ rows: [hometax('가나상사', F(N2), 'h1')] }));
  assert.equal(conf.action, 'conflict'); assert.equal(conf.reason, 'link-vs-evidence');
  assert.equal(P.decideBiz(rec, ctx({ rows: [master('가나상사', F(N2), 'm1'), record('가나상사', F(N2), 'r1')] })).level, 'auto', '안쪽 기록의 다른 번호는 충돌로 치지 않는다(바깥 자료만)');
  assert.equal(P.decideBiz(Object.assign({}, rec, { ceo: '김철수' }), ctx()).reason, 'ceo-differs');
  const auto = P.decideBiz(rec, ctx({ co: { auto: true } }));
  assert.equal(auto.level, 'ask'); assert.equal(auto.reason, 'company-auto');
});

test('⑭-4 대표자는 근거 «줄마다» 견준다 — 서로 다른 대표자 근거가 섞이면 한 이름만 맞아도 충돌', () => {
  const rows = [Object.assign(hometax('가나상사', F(N1), 'h1'), { ceo: '홍길동' }), Object.assign(cms('가나상사', F(N1), 'c1'), { ceo: '김철수' })];
  assert.equal(decide({ name: '가나상사', bizNo: '', ceo: '홍길동' }, rows).reason, 'ceo-differs');
  assert.equal(decide({ name: '가나상사', bizNo: '', ceo: '김철수' }, rows).reason, 'ceo-differs');
  const same = [Object.assign(hometax('가나상사', F(N1), 'h1'), { ceo: '홍길동' }), Object.assign(cms('가나상사', F(N1), 'c1'), { ceo: '홍길동 외 1명' })];
  assert.equal(decide({ name: '가나상사', bizNo: '', ceo: '홍길동' }, same).level, 'auto');
  /* 대표자 이름이 constructor 같은 상속 속성 이름이어도 «있는 것처럼» 읽히지 않는다 */
  const odd = [Object.assign(hometax('가나상사', F(N1), 'h1'), { ceo: '홍길동' }), cms('가나상사', F(N1), 'c1')];
  assert.equal(decide({ name: '가나상사', bizNo: '', ceo: 'constructor' }, odd).reason, 'ceo-differs');
});

test('⑭-5 계산서 근거 — 「발행」이 분명한 줄만, 지운 줄은 어느 갈래든 근거가 아니다', () => {
  const mkPlan = (ev) => P.buildPlan({ companies: [], stores: { consultings: [{ id: 'k', companyName: '가나상사', bizNo: '' }] }, evidence: ev });
  const base = { cms: [{ name: '가나상사', bizNo: F(N1), _k: 'c1' }] };
  const auto = (p) => p.rows.filter(r => r.field === 'bizNo' && r.level === 'auto').length;
  assert.equal(auto(mkPlan(Object.assign({ invoices: [{ companyName: '가나상사', bizNo: F(N1), id: 'i1', status: '발행' }] }, base))), 1);
  assert.equal(auto(mkPlan(Object.assign({ invoices: [{ companyName: '가나상사', bizNo: F(N1), id: 'i1' }] }, base))), 0, '상태가 없는 줄은 근거가 아니다');
  assert.equal(auto(mkPlan(Object.assign({ invoices: [{ companyName: '가나상사', bizNo: F(N1), id: 'i1', status: '발행', _deleted: true }] }, base))), 0, '지운 줄');
  assert.equal(auto(mkPlan({ hometax: [{ company: '가나상사', biznum: F(N1), _id: 'h1', _deleted: true }], cms: base.cms })), 0, '지운 홈택스 줄');
  assert.equal(auto(mkPlan({ regcerts: [{ name: '가나상사', bz: F(N1), id: 'r1', _deleted: true }], cms: base.cms })), 0, '지운 등록증 줄');
});

test('⑭-6 대표자 근거가 너무 많아 다 못 견주면 «모른다» — 충돌로 쳐서 채우지 않는다 · 번호표 길도 바깥 자료의 대표자와 견준다', () => {
  const many = [];
  for (let i = 0; i < 205; i++) many.push(Object.assign(hometax('가나상사', F(N1), 'h' + i), { ceo: '대표' + i }));
  many.push(cms('가나상사', F(N1), 'c1'));
  assert.equal(decide({ name: '가나상사', bizNo: '', ceo: '대표0' }, many).reason, 'ceo-differs', '200 종을 넘는 서로 다른 대표자 근거');
  /* 번호표 길: 연결 업체의 대표자는 같아도, 이 번호를 말하는 바깥 자료의 대표자가 다르면 충돌 */
  const ctx = { idx: P.buildIndex([Object.assign(hometax('다른이름', F(N1), 'h1'), { ceo: '김철수' })]), companyById: { c1: { bizNo: F(N1), deleted: false, ceo: '홍길동', auto: false } } };
  const rec = { name: '다른이름', bizNo: '', companyId: 'c1', ceo: '홍길동' };
  assert.equal(P.decideBiz(rec, ctx).reason, 'ceo-differs');
});

test('⑭-7 상속 키 이름(constructor)이 근거 갈래로 읽히지 않는다 — 안쪽(record)으로 센다', () => {
  const idx = P.buildIndex([{ kind: 'constructor', name: '가나상사', bizNo: F(N1), ref: 'x1' }, { kind: 'toString', name: '가나상사', bizNo: F(N1), ref: 'x2' }]);
  assert.deepEqual(Object.keys(idx.byName['가나상사'].nums[N1].kinds), ['record']);
  assert.equal(P.decideBiz({ name: '가나상사', bizNo: '' }, { idx, companyById: {} }).level, 'ask', '이상한 갈래 둘이 «바깥 자료 둘»로 읽히면 안 된다');
});

test('⑭-8 이 건을 만든 원본 계약의 번호 — 번호표 연결이라 근거 하나로 채운다. 충돌·대표자·자동 값은 먼저 본다', () => {
  const idx = (rows) => P.buildIndex(rows || []);
  const rec = (src) => ({ name: '가나상사', bizNo: '', ceo: '홍길동', srcBiz: src });
  const src = (extra) => Object.assign({ digits: N1, ceo: '홍길동', auto: false }, extra || {});
  const go = (r, rows) => P.decideBiz(r, { idx: idx(rows), companyById: {} });
  const ok = go(rec(src()));
  assert.equal(ok.action, 'fill'); assert.equal(ok.level, 'auto'); assert.equal(ok.via, 'source-contract'); assert.equal(ok.to, F(N1));
  assert.equal(go(rec(src()), [hometax('가나상사', F(N2), 'h1')]).reason, 'link-vs-evidence', '바깥 자료가 이 이름에 다른 번호를 말하면 충돌');
  assert.equal(go(rec(src({ ceo: '김철수' }))).reason, 'ceo-differs');
  const auto = go(rec(src({ auto: true })));
  assert.equal(auto.level, 'ask'); assert.equal(auto.reason, 'source-auto', '자동으로 채운 번호는 다시 퍼뜨리지 않는다');
  assert.equal(go(rec({ digits: BAD, ceo: '', auto: false })).action, 'none', '검증숫자가 틀린 원본 번호는 쓰지 않는다');
  assert.equal(go(rec(null)).action, 'none');
});

test('⑭-9 원본 계약은 «id·번호»로만 이어진다 — 이름이 같은 다른 계약은 이어지지 않는다 · 지운 계약·계약 표 자신은 제외', () => {
  const ct = (extra) => Object.assign({ id: 'ct1', contractNo: '계약-1', companyName: '가나상사', bizNo: F(N1), company: { ceo: '홍길동' } }, extra || {});
  const plan = (cts, rec) => P.buildPlan({ companies: [], stores: { contracts: cts, consultings: [rec] }, evidence: {} })
    .rows.filter(r => r.store === 'consultings' && r.field === 'bizNo');
  const base = { id: 'k1', companyName: '다른이름', bizNo: '' };
  const hit = plan([ct()], Object.assign({ sourceContractId: 'ct1' }, base));
  assert.equal(hit.length, 1); assert.equal(hit[0].via, 'source-contract'); assert.equal(hit[0].level, 'auto');
  assert.equal(plan([ct()], Object.assign({ sourceContractNo: '계약-1' }, base)).length, 0, '번호로 찾은 계약은 «같은 업체»(이름·업체 번호표)가 아니면 이어지지 않는다');
  const viaNo = plan([ct()], Object.assign({ sourceContractNo: '계약-1' }, base, { companyName: '가나상사 주식회사' }));
  assert.equal(viaNo.length, 1); assert.equal(viaNo[0].via, 'source-contract', '번호 + 꼭 같은 이름(법인 표기만 다름)');
  assert.equal(plan([ct({ companyId: 'c7' })], Object.assign({ sourceContractNo: '계약-1', companyId: 'c7' }, base)).length, 1, '번호 + 같은 업체 번호표');
  assert.equal(plan([ct(), ct({ id: 'ct2' })], Object.assign({ sourceContractNo: '계약-1' }, base, { companyName: '가나상사' })).filter(r => r.via === 'source-contract').length, 0, '같은 번호의 계약이 둘이면 모른다 — 마지막 것이 이기지 않는다');
  assert.equal(plan([ct()], Object.assign({ sourceKind: 'contract', sourceId: 'ct1' }, base)).length, 1);
  const byName = plan([ct()], Object.assign({}, base, { companyName: '가나상사' }));
  assert.ok(byName.every(r => r.via !== 'source-contract' && r.level !== 'auto'), '이름만 같은 계약은 «원본 계약»으로 이어지지 않는다(꼭 같은 이름은 근거 한 곳짜리 제안일 뿐)');
  assert.equal(plan([ct({ _deleted: true })], Object.assign({ sourceContractId: 'ct1' }, base)).length, 0, '지운 계약');
  /* 자동으로 채운 번호를 계약이 «베껴 오면» 그것도 자동 값이다 — 계약 표에는 표시가 안 남아도 다시 퍼뜨리지 않는다 */
  const copied = P.buildPlan({ companies: [], stores: {
    contracts: [ct()], consultings: [Object.assign({ id: 'k0', companyName: '다른이름0', bizNo: F(N1), bizAuto: { via: 'evidence', at: 'x' } }), Object.assign({ sourceContractId: 'ct1' }, base)] }, evidence: {} })
    .rows.filter(r => r.id === 'k1' && r.field === 'bizNo');
  assert.equal(copied.length, 1); assert.equal(copied[0].level, 'ask'); assert.equal(copied[0].reason, 'source-auto');
  assert.equal(plan([ct({ bizNo: '', company: {} })], Object.assign({ sourceContractId: 'ct1' }, base)).length, 0, '원본 계약에도 번호가 없다');
  assert.equal(plan([ct({ status: 'transferred' })], Object.assign({ sourceContractId: 'ct1' }, base)).length, 1, '이관된(끝난) 원본 계약의 번호도 읽을 수 있다 — 읽기만');
  assert.equal(plan([ct({ bizAuto: { via: 'evidence', at: 'x' } })], Object.assign({ sourceContractId: 'ct1' }, base))[0].level, 'ask', '자동으로 채운 원본 번호');
});

test('⑭-9b 번호표가 둘(업체·원본 계약)인데 서로 다르면 충돌 · 원본 계약의 이름으로도 근거를 견준다 · 이 건의 이름이 없으면 제안', () => {
  const idx = (rows) => P.buildIndex(rows || []);
  const co = { c1: { bizNo: F(N1), deleted: false, ceo: '', auto: false } };
  const both = P.decideBiz({ name: '가나상사', bizNo: '', companyId: 'c1', srcBiz: { digits: N2, name: '가나상사', ceo: '', auto: false } }, { idx: idx(), companyById: co });
  assert.equal(both.action, 'conflict'); assert.equal(both.reason, 'link-sources-differ');
  assert.equal(P.decideBiz({ name: '가나상사', bizNo: '', companyId: 'c1', srcBiz: { digits: N1, name: '가나상사', ceo: '', auto: false } }, { idx: idx(), companyById: co }).level, 'auto', '둘이 같은 번호면 통과');
  /* 이 건의 이름과 원본 계약의 이름이 다르게 적혔다 — 원본 계약 이름에 걸린 바깥 자료의 다른 번호도 충돌로 본다 */
  const rec = { name: '다른이름', bizNo: '', srcBiz: { digits: N1, name: '가나상사', ceo: '', auto: false } };
  assert.equal(P.decideBiz(rec, { idx: idx([hometax('가나상사', F(N2), 'h1')]), companyById: {} }).reason, 'link-vs-evidence');
  assert.equal(P.decideBiz(rec, { idx: idx([Object.assign(hometax('가나상사', F(N1), 'h1'), { ceo: '김철수' })]), companyById: {} }).level, 'auto', '대표자를 모르면 견주지 않는다');
  assert.equal(P.decideBiz(Object.assign({}, rec, { ceo: '홍길동' }), { idx: idx([Object.assign(hometax('가나상사', F(N1), 'h1'), { ceo: '김철수' })]), companyById: {} }).reason, 'ceo-differs');
  /* 이 건의 이름이 없다 — 이름 근거를 견줄 수 없으니 눈으로 확인할 제안으로만 */
  const nameless = P.decideBiz({ name: '', bizNo: '', srcBiz: { digits: N1, name: '', ceo: '', auto: false } }, { idx: idx(), companyById: {} });
  assert.equal(nameless.level, 'ask'); assert.equal(nameless.reason, 'link-no-name');
});

test('⑭-10 복합 신호 — 이름 일부 + 금액 + 날짜가 «모두» 맞고 후보가 «하나»일 때만 제안(자동 아님)', () => {
  const row = (extra) => Object.assign({ company: '가나다라마바상사', biznum: F(N1), supply: 1000000, date: '2026-09-20', _id: 'h1' }, extra || {});
  const rec = (extra) => Object.assign({ name: '가나다라마바 사업단', fees: [1100000], date: '2026-09-15' }, extra || {});
  const sg = P.signalBiz(rec(), [row()]);
  assert.ok(sg); assert.equal(sg.to, F(N1)); assert.deepEqual(sg.evidence.kinds, ['hometax']); assert.ok(sg.evidence.signals.length === 3);
  /* 하나라도 어긋나면 아무것도 안 낸다 */
  assert.equal(P.signalBiz(rec(), [row({ supply: 777000 })]), null, '금액 불일치');
  assert.equal(P.signalBiz(rec(), [row({ date: '2027-03-01' })]), null, '날짜가 90일 밖');
  assert.equal(P.signalBiz(rec(), [row({ company: '가나다상사' })]), null, '이름이 이어서 5글자 미만 겹침');
  assert.equal(P.signalBiz(rec({ name: '가나다' }), [row()]), null, '이름이 너무 짧다(4글자 미만)');
  assert.equal(P.signalBiz(rec({ fees: [] }), [row()]), null, '비교할 금액이 없다');
  assert.equal(P.signalBiz(rec({ date: '' }), [row()]), null, '기준 날짜가 없다');
  assert.equal(P.signalBiz(rec(), [row({ biznum: F(BAD) })]), null, '검증숫자 틀린 번호');
  assert.equal(P.signalBiz(rec(), [row({ _deleted: true })]), null, '지운 줄');
  /* 후보 번호가 둘이면 고르지 않는다 */
  assert.equal(P.signalBiz(rec(), [row(), row({ biznum: F(N2), _id: 'h2' })]), null);
  /* 홈택스 줄이 상한을 넘으면 «오래된 줄»부터 빠진다 — 최근 계산서를 남긴다 */
  const many = [];
  for (let i = 0; i < 20001; i++) many.push({ company: '다른회사' + i, biznum: F(N3), supply: 5, date: '2000-01-01', _id: 'o' + i });
  many.push(row({ date: '2026-09-18', _id: 'new' }));          // 최근 줄이 «맨 끝»에 있어도 상한에 잘리지 않는다(날짜 내림차순으로 정렬한 뒤 자른다)
  assert.equal(P.signalBiz(rec(), many).to, F(N1), '2만 줄을 넘어도 최근 계산서는 남는다');
  assert.equal(P.prepSignalRows(many).length, 20000);
  /* 같은 번호가 여러 줄이면 하나로 센다 */
  assert.equal(P.signalBiz(rec(), [row(), row({ _id: 'h2', date: '2026-10-01' })]).evidence.rows, 2);
  /* 금액은 공급가·부가세 포함·역산 모두 인정 */
  assert.ok(P.signalBiz(rec({ fees: [1000000] }), [row()]) && P.signalBiz(rec({ fees: [1100000] }), [row({ supply: 1100000 })]));
});

test('⑭-11 복합 신호는 «꼭 같은 이름 근거가 없을 때만», 계획에서 ask 로만 올라온다 — 자동 채움·업체·계약 표에는 안 쓴다', () => {
  const ev = { hometax: [{ company: '가나다라마바상사', biznum: F(N1), supply: 1000000, date: '2026-09-20', _id: 'h1' }] };
  const mkRec = (extra) => Object.assign({ id: 'k1', companyName: '가나다라마바 사업단', bizNo: '', contractFee: 1100000, startDate: '2026-09-15' }, extra || {});
  const plan = (stores, evidence) => P.buildPlan({ companies: [], stores, evidence: evidence || ev }).rows.filter(r => r.field === 'bizNo');
  const hit = plan({ consultings: [mkRec()] });
  assert.equal(hit.length, 1); assert.equal(hit[0].level, 'ask'); assert.equal(hit[0].via, 'signals'); assert.equal(hit[0].reason, 'multi-signal');
  assert.ok(plan({ consultings: [mkRec()] }).every(r => r.level !== 'auto'), '복합 신호는 자동 채움이 아니다');
  assert.equal(plan({ consultings: [mkRec({ status: 'closed' })] }).length, 0, '끝난 건');
  assert.equal(plan({ consultings: [mkRec({ _deleted: true })] }).length, 0, '지운 건');
  assert.equal(plan({ consultings: [mkRec({ bizNo: F(N2) })] }).filter(r => r.via === 'signals').length, 0, '이미 번호가 있으면 덮지 않는다');
  assert.equal(plan({ contracts: [Object.assign(mkRec(), { company: { bizNo: '' } })] }).filter(r => r.via === 'signals').length, 0, '계약 표는 제외');
  /* 꼭 같은 이름의 근거(CMS)가 따로 있으면 복합 신호가 끼어들지 않는다 */
  const same = plan({ consultings: [mkRec({ companyName: '가나다라마바상사' })] }, Object.assign({ cms: [{ name: '가나다라마바상사', bizNo: F(N1), _k: 'c1' }] }, ev));
  assert.equal(same.length, 1); assert.equal(same[0].via, 'evidence');
});

/* ══════ 담당 — 제안만 ══════ */
const active = () => true;
const peer = (main, extra) => Object.assign({ main, kind: 'record', terminal: false, deleted: false }, extra || {});
test('⑮ 주담당 — 업체관리 주담당 하나 또는 다른 건 둘 이상이 같은 사람일 때만 «제안»', () => {
  const d1 = P.decideManager({ managerMain: '' }, [peer('u1', { kind: 'master' })], active);
  assert.equal(d1.action, 'suggest'); assert.equal(d1.level, 'ask'); assert.equal(d1.sid, 'u1');
  assert.equal(P.decideManager({ managerMain: '' }, [peer('u1'), peer('u1')], active).level, 'ask');
  assert.equal(P.decideManager({ managerMain: '' }, [peer('u1')], active).level, 'none', '다른 건 하나뿐이면 약하다');
  assert.equal(P.decideManager({ managerMain: '' }, [peer('u1', { kind: 'master' }), peer('u2')], active).action, 'conflict');
  assert.equal(P.decideManager({ managerMain: '' }, [peer('u1', { kind: 'master' })], () => false).level, 'none', '퇴사·휴직·담당배제는 제안하지 않는다');
  assert.equal(P.decideManager({ managerMain: '' }, [peer('u1', { kind: 'master', terminal: true }), peer('u1', { deleted: true })], active).level, 'none', '끝난·지운 건의 담당은 근거가 아니다');
  assert.equal(P.decideManager({ managerMain: 'u9' }, [peer('u1', { kind: 'master' })], active).action, 'ok', '이미 있는 담당은 덮지 않는다');
  assert.equal(P.decideManager({ managerMain: '', terminal: true }, [peer('u1', { kind: 'master' })], active).level, 'skip');
});

test('⑯ 거래처 담당자 — 같은 사람이 일관될 때만 «제안», 다른 사람이 섞이면 충돌', () => {
  const pc = (name, kind) => ({ kind: kind || 'record', contact: { name, phone: '010-0000-0000', email: 'a@example.com', role: '' } });
  const d = P.decideContact({ hasContact: false }, [pc('홍길동', 'master')]);
  assert.equal(d.action, 'suggest'); assert.equal(d.contact.name, '홍길동');
  assert.equal(P.decideContact({ hasContact: false }, [pc('홍길동'), pc('홍길동')]).level, 'ask');
  assert.equal(P.decideContact({ hasContact: false }, [pc('홍길동')]).level, 'none');
  assert.equal(P.decideContact({ hasContact: false }, [pc('홍길동', 'master'), pc('김철수')]).action, 'conflict');
  assert.equal(P.decideContact({ hasContact: true }, [pc('홍길동', 'master')]).action, 'ok', '이미 담당자가 있으면 덮지 않는다');
  const ended = (name, kind) => Object.assign(pc(name, kind), { terminal: true });
  assert.equal(P.decideContact({ hasContact: false }, [ended('홍길동', 'master')]).level, 'none', '끝난 건의 옛 담당자는 근거가 아니다');
  assert.equal(P.decideContact({ hasContact: false }, [pc('홍길동', 'master'), ended('김철수')]).action, 'suggest', '끝난 건의 다른 사람이 충돌을 만들지 않는다');
});

test('⑰ 같은 업체의 다른 건은 «번호표 또는 검증된 사업자번호»로만 잇는다 — 이름으로 잇지 않는다', () => {
  const base = { companies: [{ id: 'c1', name: '가나상사', bizNo: F(N1), status: 'active', managerMain: 'u1' }], evidence: {} };
  const plan = (rec) => P.buildPlan(Object.assign({ stores: { consultings: [rec] } }, base), { isActiveSid: active }).rows.filter(r => r.field === 'managerMain');
  assert.equal(plan({ id: 'k1', companyName: '가나상사', bizNo: '', managerMain: '' }).length, 0, '이름만 같은 건은 이어지지 않는다');
  assert.equal(plan({ id: 'k1', companyName: '다른이름', companyId: 'c1', bizNo: '', managerMain: '' }).length, 1, '번호표로 이어진 건');
  assert.equal(plan({ id: 'k1', companyName: '다른이름', bizNo: F(N1), managerMain: '' }).length, 1, '검증된 번호로 이어진 건');
  assert.equal(plan({ id: 'k1', companyName: '다른이름', bizNo: F(BAD), managerMain: '' }).length, 0, '검증숫자가 틀린 번호로는 잇지 않는다');
});

test('⑰-2 자동으로 채운 번호로는 «같은 업체의 다른 건»을 잇지 않는다 — 담당 추정이 자동 값 위에 쌓이지 않게(번호표 연결은 그대로)', () => {
  const co = { id: 'c1', name: '가나상사', bizNo: F(N1), status: 'active', managerMain: 'u1' };
  const run = (rec) => P.buildPlan({ companies: [co], stores: { consultings: [rec] }, evidence: {} }, { isActiveSid: active }).rows.filter(r => r.field === 'managerMain');
  const rec = { id: 'k1', companyName: '다른이름', bizNo: F(N1), managerMain: '' };
  assert.equal(run(rec).length, 1, '사람이 적은 번호로는 이어진다');
  assert.equal(run(Object.assign({}, rec, { bizAuto: { via: 'evidence', at: 'x' } })).length, 0, '자동으로 채운 번호로는 안 이어진다');
  assert.equal(run(Object.assign({}, rec, { bizAuto: { via: 'format', at: 'x' } })).length, 1, '표기만 고친 번호는 사람이 적은 번호다');
  assert.equal(run(Object.assign({}, rec, { bizNo: '', companyId: 'c1', bizAuto: { via: 'evidence', at: 'x' } })).length, 1, '번호표(companyId)로는 이어진다');
  /* «남이» 자동으로 채운 번호로 이 건에 담당을 붙이지 않는다 — 자동 번호를 가진 건들의 담당이 근거가 되지 않는다 */
  const autoPeer = (id, main) => ({ id, companyName: '다른이름' + id, bizNo: F(N1), managerMain: main, bizAuto: { via: 'evidence', at: 'x' } });
  const noMaster = (rec2, others) => P.buildPlan({ companies: [], stores: { consultings: [rec2].concat(others) }, evidence: {} }, { isActiveSid: active }).rows.filter(r => r.field === 'managerMain' && r.id === rec2.id);
  const human = { id: 'k9', companyName: '또다른이름', bizNo: F(N1), managerMain: '' };
  assert.equal(noMaster(human, [autoPeer('a1', 'u2'), autoPeer('a2', 'u2')]).length, 0, '자동 번호를 가진 건 둘이 같은 담당이어도 근거가 아니다');
  assert.equal(noMaster(human, [Object.assign(autoPeer('a1', 'u2'), { bizAuto: undefined }), Object.assign(autoPeer('a2', 'u2'), { bizAuto: undefined })]).length, 1, '사람이 적은 번호면 근거다');
});

test('⑱ 계획 — 계약 표는 제안만(쓰기 대상 아님), 근거 없음·이미 정상은 건수로만 센다', () => {
  const ev = { hometax: [{ company: '가나상사', biznum: F(N1), _id: 'h1', date: '2026-01-01' }], cms: [{ name: '가나상사', bizNo: F(N1), _k: 'c1' }] };
  const plan = P.buildPlan({ companies: [], stores: {
    contracts: [{ id: 'ct1', companyName: '가나상사', company: { bizNo: '' }, status: 'consult' }],
    consultings: [{ id: 'k1', companyName: '가나상사', bizNo: '' }, { id: 'k2', companyName: '없는회사', bizNo: '' }, { id: 'k3', companyName: '다라상사', bizNo: F(N3) }] }, evidence: ev });
  const ct = plan.rows.filter(r => r.store === 'contracts' && r.field === 'bizNo')[0];
  assert.ok(ct && ct.readOnlyStore === true && ct.level === 'auto', '계약은 판정은 하되 쓰기 대상이 아니라고 표시한다');
  assert.equal(plan.noEvidence, 1); assert.equal(plan.alreadyOk, 1);
  assert.ok(plan.rows.every(r => r.id !== 'k2' && r.id !== 'k3'));
});

/* ══════ ERP 쪽 — 저장·되돌리기 ══════ */
function loadGlue(db, over) {
  const patches = [];
  const ctx0 = { toasts: [] };
  const ctx = Object.assign({
    console, Object, Array, String, Number, Boolean, Math, Date, JSON, RegExp, Promise, PuBizEvidence: P,
    dbGet: (k, def) => (db[k] === undefined ? def : db[k]),
    dbPatch: (k, id, fields) => {
      const it = (db[k] || []).filter(x => x && x.id === id)[0];
      if (!it) return false;
      patches.push({ k, id, fields: JSON.parse(JSON.stringify(fields)) });
      Object.keys(fields).forEach(f => { if (fields[f] === null) delete it[f]; else it[f] = fields[f]; });
      return true;
    },
    erpCmsLedgerGet: () => (db.__cms ? { rows: db.__cms } : null),
    ensurePucardsIdx: () => db.__pc || {},
    getUserAssignStatus: sid => ({ assignable: sid !== 'gone' }),
    CURRENT_USER: { name: '검사', isAdmin: true, isOwner: true },
    window: {}, setTimeout, localStorage: (function () { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; })(),
    _pcIdx: { x: 1 }, erpInvArcPull: () => Promise.resolve(0), idbGetAll: () => Promise.resolve(db.__hometax || []),
    toasts: [], showToast: function (m) { ctx0.toasts.push(m); },
    /* 서버 흉내 — 기본은 이 PC 사본과 같다. srv 를 바꿔 «다른 PC 에서 그사이 고친 것»을 흉내 낸다. 서버를 못 읽는 경우는 fbDb:null */
    fbDb: {
      ref: (pth) => {
        const m = /^data\/(\w+)\/v\/(.+)$/.exec(pth);
        const rec = ((over && over.srv ? over.srv[m[1]] : db[m[1]]) || []).filter(x => x && x.id === m[2])[0] || {};
        return { child: (k) => ({ once: () => Promise.resolve({ val: () => (rec[k] === undefined ? null : rec[k]) }) }) };
      },
    },
  }, over || {});
  delete ctx.srv;
  ctx.toasts = ctx0.toasts;
  ctx.showToast = function (m) { ctx0.toasts.push(m); };
  vm.createContext(ctx);
  const src = [ERP.match(/var BF_APPLY_STORES = \{[^}]*\};/)[0], ERP.match(/var BF_ALL_STORES = \[[^\]]*\];/)[0],
    ERP.match(/var BF_SERVER_KEYS = \[[^\]]*\];/)[0], cutFn(ERP, 'function bfServerRec('), cutFn(ERP, 'function bfServerEnded('),
    ERP.match(/var BF_AUTO_AT = [^;]*;/)[0], cutFn(ERP, 'function bfAutoOn('), cutFn(ERP, 'function bfAutoSet('), cutFn(ERP, 'function bfWaitPcIdx('),
    cutFn(ERP, 'function bfLoadHometax('), cutFn(ERP, 'async function bfAutoRun('),
    cutFn(ERP, 'function bfEvidenceBase('), cutFn(ERP, 'function bfPlanNow('), cutFn(ERP, 'function bfRowKey('), cutFn(ERP, 'async function bfApply('),
    cutFn(ERP, 'function bfDoneList('), cutFn(ERP, 'async function bfUndo(')].join('\n');
  vm.runInContext(src, ctx);
  ctx.__patches = patches;
  return ctx;
}
const ht = (company, num, id) => ({ company, biznum: num, _id: id, date: '2026-04-01' });
function mkDb() {
  return {
    companies: [], contracts: [{ id: 'ct1', companyName: '가나상사', company: { bizNo: '' }, status: 'consult' }],
    consultings: [{ id: 'k1', no: '컨-001', companyName: '가나상사', bizNo: '' }, { id: 'k2', no: '컨-002', companyName: '다라상사', bizNo: N2 },
      { id: 'k3', no: '컨-003', companyName: '가나상사', bizNo: '', status: 'closed' }],
    funds: [], other_projects: [], cases: [],
    __cms: [{ name: '가나상사', bizNo: F(N1), _k: 'c1' }, { name: '다라상사', bizNo: F(N2), _k: 'c2' }],
  };
}

test('⑲ 적용 — 번호 칸만 쓰고 근거·이전 값을 남긴다(companyId·담당은 쓰지 않는다)', async () => {
  const db = mkDb(), g = loadGlue(db);
  const hometax = [ht('가나상사', F(N1), 'h1'), ht('다라상사', F(N2), 'h2')];
  const plan = g.bfPlanNow(hometax);
  const rows = plan.rows.filter(r => r.field === 'bizNo' && r.level === 'auto');
  const res = await g.bfApply(rows, hometax);
  const k1 = db.consultings[0], k2 = db.consultings[1];
  assert.equal(k1.bizNo, F(N1)); assert.equal(k1.bizAuto.before, ''); assert.equal(k1.bizAuto.after, F(N1)); assert.equal(k1.bizAuto.via, 'evidence');
  assert.ok(k1.bizAuto.kinds.indexOf('hometax') >= 0 && k1.bizAuto.at && k1.bizAuto.by === '검사');
  assert.equal(k2.bizNo, F(N2)); assert.equal(k2.bizAuto.via, 'format'); assert.equal(k2.bizAuto.before, N2, '표기만 고친 줄도 이전 값을 남긴다');
  assert.equal(db.consultings[2].bizNo, '', '끝난 건은 건드리지 않는다');
  assert.equal(db.contracts[0].company.bizNo, '', '계약은 쓰지 않는다');
  assert.equal(res.n, 2);
  g.__patches.forEach(p => assert.deepEqual(Object.keys(p.fields).sort(), ['bizAuto', 'bizNo'], '쓰는 칸은 번호 칸과 표시뿐'));
  const src = cutFn(ERP, 'async function bfApply(');
  assert.ok(!/companyId|managerMain|managerSubs|contacts/.test(src), 'bfApply 는 업체 번호표·담당을 쓰지 않는다');
});

test('⑳ 쓰는 «지금» 다시 고른다 — 그사이 번호가 들어오거나 답이 바뀌었으면 건너뛴다, 덮어쓰지 않는다', async () => {
  const db = mkDb(), g = loadGlue(db);
  const hometax = [ht('가나상사', F(N1), 'h1')];
  const rows = g.bfPlanNow(hometax).rows.filter(r => r.field === 'bizNo' && r.level === 'auto' && r.id === 'k1');
  assert.equal(rows.length, 1);
  db.consultings[0].bizNo = F(N3);                       // 그사이 사람이 다른 번호를 적었다
  let res = await g.bfApply(rows, hometax);
  assert.equal(res.n, 0); assert.equal(db.consultings[0].bizNo, F(N3), '이미 있는 번호는 덮지 않는다');
  db.consultings[0].bizNo = '';
  db.cms = null; db.__cms = [];                          // 그사이 CMS 근거가 사라져 «한 곳뿐»이 됐다
  res = await g.bfApply(rows, hometax);
  assert.equal(res.n, 0, '근거가 약해졌으면 쓰지 않는다'); assert.equal(db.consultings[0].bizNo, '');
  db.__cms = [{ name: '가나상사', bizNo: F(N1), _k: 'c1' }]; db.consultings[0].status = 'closed';
  assert.equal((await g.bfApply(rows, hometax)).n, 0, '그사이 끝난 건이면 쓰지 않는다');
});

test('⑳-2 확인 필요·충돌·근거 없는 줄을 넘겨도 쓰지 않는다 — 이미 있는 값(틀린 값 포함)은 덮지 않는다', async () => {
  const db = mkDb(), g = loadGlue(db);
  db.consultings[0].bizNo = F(BAD);                       // 검증숫자가 틀린 값 — 근거가 후보를 말하지만 덮으면 안 된다
  db.consultings.push({ id: 'k5', no: '컨-005', companyName: '마바건설', bizNo: '' });
  db.__cms.push({ name: '마바건설', bizNo: F(N2), _k: 'c9' }, { name: '마바건설', bizNo: F(N3), _k: 'c10' });   // 같은 이름에 다른 번호 → 충돌
  const hometax = [ht('가나상사', F(N1), 'h1')];
  const plan = g.bfPlanNow(hometax);
  const chk = plan.rows.filter(r => r.id === 'k1' && r.field === 'bizNo')[0];
  const conf = plan.rows.filter(r => r.id === 'k5' && r.field === 'bizNo')[0];
  assert.ok(chk && chk.level === 'check' && chk.to === F(N1), '확인 필요 줄은 후보를 보여 준다');
  assert.ok(conf && conf.level === 'conflict');
  const res = await g.bfApply([chk, conf], hometax);
  assert.equal(res.n, 0); assert.equal(db.consultings[0].bizNo, F(BAD)); assert.equal(db.consultings.filter(x => x.id === 'k5')[0].bizNo, '');
  assert.equal(g.__patches.length, 0, '아무것도 쓰지 않았다');
});

test('㉑ 근거 한 곳뿐인 «제안»은 사람이 골라 넘겼을 때만 쓴다 — 자동 일괄 채움에 섞이지 않는다', async () => {
  const db = mkDb(), g = loadGlue(db);
  db.__cms = [];
  const hometax = [ht('가나상사', F(N1), 'h1')];
  const plan = g.bfPlanNow(hometax);
  assert.equal(plan.rows.filter(r => r.field === 'bizNo' && r.level === 'auto' && r.id === 'k1').length, 0);
  const ask = plan.rows.filter(r => r.field === 'bizNo' && r.level === 'ask' && r.id === 'k1');
  assert.equal(ask.length, 1);
  assert.equal((await g.bfApply(ask, hometax)).n, 1);
  assert.equal(db.consultings[0].bizAuto.pick, 'person', '사람이 고른 것은 그렇게 표시한다');
});

test('㉒ 채운 것은 되돌릴 수 있다 — 값이 그대로일 때만(그 뒤 사람이 고친 값은 건드리지 않는다)', async () => {
  const db = mkDb(), g = loadGlue(db);
  const hometax = [ht('가나상사', F(N1), 'h1')];
  await g.bfApply(g.bfPlanNow(hometax).rows.filter(r => r.field === 'bizNo' && r.level === 'auto'), hometax);
  const list = g.bfDoneList();
  assert.ok(list.length >= 1 && list[0].canUndo === true && list[0].from === '' && list[0].to === F(N1));
  const u = await g.bfUndo(list.filter(r => r.id === 'k1'));
  assert.equal(u.n, 1); assert.equal(db.consultings[0].bizNo, ''); assert.equal(db.consultings[0].bizAuto, undefined, '되돌리면 표시도 지운다');
  /* 사람이 그 뒤에 값을 고쳤으면 되돌리지 않는다 */
  await g.bfApply(g.bfPlanNow(hometax).rows.filter(r => r.field === 'bizNo' && r.id === 'k1' && r.level === 'auto'), hometax);
  db.consultings[0].bizNo = F(N3);
  const l2 = g.bfDoneList().filter(r => r.id === 'k1');
  assert.equal(l2[0].canUndo, false);
  const u2 = await g.bfUndo(l2); assert.equal(u2.n, 0); assert.equal(db.consultings[0].bizNo, F(N3));
});

test('㉓ 표시가 남은 값은 다음 계획에서 근거가 되지 않는다(되먹임 방지)', async () => {
  const db = mkDb(), g = loadGlue(db);
  db.__cms = [];                                   // 근거는 홈택스 한 곳 → 제안 → 사람이 골라 채움
  const hometax = [ht('가나상사', F(N1), 'h1')];
  await g.bfApply(g.bfPlanNow(hometax).rows.filter(r => r.field === 'bizNo' && r.level === 'ask' && r.id === 'k1'), hometax);
  db.consultings.push({ id: 'k9', no: '컨-009', companyName: '가나상사', bizNo: '' });
  const again = g.bfPlanNow(hometax).rows.filter(r => r.id === 'k9' && r.field === 'bizNo');
  assert.equal(again.length, 1); assert.equal(again[0].level, 'ask', '방금 채운 k1 이 둘째 근거가 되어 k9 가 자동으로 채워지면 안 된다');
});

test('㉓-2 서버의 «지금» 값을 다시 읽는다 — 서버에 이미 번호가 있거나 끝났거나 못 읽으면 쓰지 않는다(이 PC 사본이 낡았을 때)', async () => {
  const hometax = [ht('가나상사', F(N1), 'h1')];
  const pick = (g) => g.bfPlanNow(hometax).rows.filter(r => r.field === 'bizNo' && r.level === 'auto' && r.id === 'k1');
  const clone = (db) => JSON.parse(JSON.stringify(db.consultings));
  /* ① 서버에 다른 PC 가 이미 번호를 적었다 */
  let db = mkDb(), srv = { consultings: clone(db) }; srv.consultings[0].bizNo = F(N3);
  let g = loadGlue(db, { srv });
  let r = await g.bfApply(pick(g), hometax);
  assert.equal(r.n, 0); assert.equal(db.consultings[0].bizNo, '');
  /* ② 서버에서는 그 건이 끝났다 */
  db = mkDb(); srv = { consultings: clone(db) }; srv.consultings[0].status = 'closed';
  g = loadGlue(db, { srv });
  assert.equal((await g.bfApply(pick(g), hometax)).n, 0);
  db = mkDb(); srv = { consultings: clone(db) }; srv.consultings[0]._deleted = true;
  g = loadGlue(db, { srv });
  assert.equal((await g.bfApply(pick(g), hometax)).n, 0, '서버에서 지운 건');
  /* ③ 서버를 못 읽는다 — 못 읽으면 쓰지 않는다 */
  db = mkDb(); g = loadGlue(db, { fbDb: null });
  r = await g.bfApply(pick(g), hometax);
  assert.equal(r.n, 0); assert.ok(Object.keys(r.why).some(k => k.indexOf('서버에서 지금 값을 못 읽음') === 0));
  /* ④ 서버도 그대로면 쓴다 */
  db = mkDb(); g = loadGlue(db);
  assert.equal((await g.bfApply(pick(g), hometax)).n, 1);
});

test('㉓-3 서버에 그 건이 «없거나» id 가 경로로 쓸 수 없는 글자면 쓰지 않는다 — 예외로 중단되지도 않는다', async () => {
  const hometax = [ht('가나상사', F(N1), 'h1')];
  const pick = (g) => g.bfPlanNow(hometax).rows.filter(r => r.field === 'bizNo' && r.level === 'auto' && r.id === 'k1');
  /* ① 서버에 그 건이 없다 — 모든 칸이 비어 오는 «껍데기»를 있는 것으로 보지 않는다 */
  let db = mkDb(), srv = { consultings: [] };
  let g = loadGlue(db, { srv });
  let r = await g.bfApply(pick(g), hometax);
  assert.equal(r.n, 0); assert.equal(g.__patches.length, 0);
  /* ② id 에 경로 글자가 있다 — 서버 경로를 조립하지 않고, 던지지도 않는다 */
  for (const bad of ['a.b', 'a/b', 'a#b', 'a$b', 'a[0]']) {
    db = mkDb(); db.consultings[0].id = bad;
    g = loadGlue(db);
    const rows = g.bfPlanNow(hometax).rows.filter(x => x.field === 'bizNo' && x.level === 'auto' && x.id === bad);
    assert.equal(rows.length, 1, bad);
    await assert.doesNotReject(() => g.bfApply(rows, hometax));
    assert.equal(db.consultings[0].bizNo, '', '경로로 쓸 수 없는 id 는 쓰지 않는다: ' + bad);
  }
  /* ③ 알 수 없는 표 이름은 읽지 않는다 */
  g = loadGlue(mkDb());
  assert.equal(await g.bfServerRec('constructor', 'k1'), null);
  assert.equal(await g.bfServerRec('contracts', 'ct1'), null, '계약은 쓰기 대상 표가 아니라 (서버에 있어도) 읽지 않는다');
  assert.ok(await g.bfServerRec('consultings', 'k1'), '쓰기 대상 표의 있는 건은 읽힌다');
  /* ④ 되돌리기에 빈 줄이 섞여도 터지지 않는다 */
  db = mkDb(); g = loadGlue(db);
  const u0 = await g.bfUndo([null, undefined]);
  assert.equal(u0.n, 0); assert.equal(u0.skipped, 2);
});

test('㉓-4 서버 읽기는 get()(서버의 가장 새 값)을 먼저 쓴다 — 구독 사본을 주는 once 가 낡았어도 속지 않는다', async () => {
  const hometax = [ht('가나상사', F(N1), 'h1')];
  const db = mkDb();
  const fresh = { id: 'k1', bizNo: F(N3) }, stale = { id: 'k1', bizNo: '' };
  const snap = (rec) => (k) => Promise.resolve({ val: () => (rec[k] === undefined ? null : rec[k]) });
  const fbDb = { ref: () => ({ child: (k) => ({ once: () => snap(stale)(k), get: () => snap(fresh)(k) }) }) };
  const g = loadGlue(db, { fbDb });
  const rows = g.bfPlanNow(hometax).rows.filter(r => r.field === 'bizNo' && r.level === 'auto' && r.id === 'k1');
  assert.equal(rows.length, 1);
  assert.equal((await g.bfApply(rows, hometax)).n, 0, 'once 가 낡은 «빈 칸»을 줘도 get 의 서버 값(번호 있음)을 따른다');
  assert.equal(db.consultings[0].bizNo, '');
  /* get 이 없는 SDK 면 once 로 물러난다 */
  const g2 = loadGlue(mkDb(), { fbDb: { ref: () => ({ child: (k) => ({ once: () => snap({ id: 'k1', bizNo: '' })(k) }) }) } });
  assert.equal((await g2.bfApply(g2.bfPlanNow(hometax).rows.filter(r => r.field === 'bizNo' && r.level === 'auto' && r.id === 'k1'), hometax)).n, 1);
});

test('㉓-5 줄을 하나씩 쓰는 동안 뒷줄 값이 바뀌면 건너뛴다 — 제안은 «빈 칸»일 때만, 표기 정리는 «같은 숫자»일 때만, 계획의 원값과 같을 때만', async () => {
  const hometax = [ht('가나상사', F(N1), 'h1')];
  const mk2 = () => {
    const db = mkDb();
    db.__cms = [];                                                                       // 근거 한 곳(홈택스) → 제안(ask)
    db.consultings.push({ id: 'k6', no: '컨-006', companyName: '가나상사', bizNo: '' });
    db.consultings.push({ id: 'k7', no: '컨-007', companyName: '다라상사', bizNo: N2 });   // 표기만 다름(format) — 근거는 CMS 가 없어도 자동 정리
    return db;
  };
  /* 첫 줄을 쓰는 동안(서버 읽기를 기다리는 사이) 뒷줄을 바꾼다 */
  const racing = (db, mutate) => {
    let first = true;
    const snap = (rec) => (k) => Promise.resolve({ val: () => (rec[k] === undefined ? null : rec[k]) });
    return { ref: (pth) => {
      const id = /\/v\/(.+)$/.exec(pth)[1];
      const rec = (db.consultings.filter(x => x.id === id)[0]) || {};
      return { child: (k) => ({ once: () => { if (first && id === 'k1') { first = false; mutate(); } return snap(rec)(k); } }) };
    } };
  };
  /* ① 제안(suggest) — 뒷줄에 사람이 다른 번호를 적었다 → 덮지 않는다 */
  let db = mk2(), g;
  g = loadGlue(db, { fbDb: racing(db, () => { db.consultings.filter(x => x.id === 'k6')[0].bizNo = F(N3); }) });
  let rows = g.bfPlanNow(hometax).rows.filter(r => r.field === 'bizNo' && r.level === 'ask' && (r.id === 'k1' || r.id === 'k6'));
  assert.equal(rows.length, 2);
  let res = await g.bfApply(rows, hometax);
  assert.equal(res.n, 1); assert.equal(db.consultings.filter(x => x.id === 'k6')[0].bizNo, F(N3), '그사이 적힌 번호를 덮지 않는다');
  /* ② 표기 정리(format) — 뒷줄이 «다른 숫자»의 표기만 다른 값으로 바뀌었다 → 정리하지 않는다 */
  db = mk2();
  g = loadGlue(db, { fbDb: racing(db, () => { db.consultings.filter(x => x.id === 'k7')[0].bizNo = N3; }) });
  rows = g.bfPlanNow(hometax).rows.filter(r => r.field === 'bizNo' && r.id === 'k7' && r.action === 'format');
  const k1row = g.bfPlanNow(hometax).rows.filter(r => r.field === 'bizNo' && r.id === 'k1')[0];
  assert.equal(rows.length, 1); assert.ok(k1row);
  res = await g.bfApply([k1row].concat(rows), hometax);
  assert.equal(db.consultings.filter(x => x.id === 'k7')[0].bizNo, N3, '다른 번호의 하이픈 없는 값을 «계획의 번호»로 바꾸지 않는다');
});

test('㉒-2 되돌리기 — 끝난 건·다른 표시·사람이 고친 값·서버가 다른 건은 건드리지 않는다', async () => {
  const hometax = [ht('가나상사', F(N1), 'h1')];
  const fill = async (db, over) => {
    const g = loadGlue(db, over);
    await g.bfApply(g.bfPlanNow(hometax).rows.filter(r => r.field === 'bizNo' && r.level === 'auto' && r.id === 'k1'), hometax);
    return g;
  };
  /* ① 그 뒤 끝난 건 */
  let db = mkDb(), g = await fill(db);
  let rows = g.bfDoneList().filter(r => r.id === 'k1');
  db.consultings[0].status = 'closed';
  assert.equal(g.bfDoneList().filter(r => r.id === 'k1')[0].canUndo, false, '끝난 건은 되돌리기 칸이 열리지 않는다');
  assert.equal((await g.bfUndo(rows)).n, 0); assert.equal(db.consultings[0].bizNo, F(N1), '끝난 건의 번호는 되돌리지 않는다');
  /* ② 선택한 뒤 표시가 바뀐 줄(같은 번호로 새로 처리됨) */
  db = mkDb(); g = await fill(db);
  rows = g.bfDoneList().filter(r => r.id === 'k1');
  db.consultings[0].bizAuto = Object.assign({}, db.consultings[0].bizAuto, { at: '2099-01-01T00:00:00.000Z' });
  assert.equal((await g.bfUndo(rows)).n, 0, '선택 당시 표시와 다르면 건너뛴다');
  /* ③ 서버에서는 값이 달라졌다 */
  db = mkDb(); g = await fill(db);
  rows = g.bfDoneList().filter(r => r.id === 'k1');
  const srv = { consultings: JSON.parse(JSON.stringify(db.consultings)) }; srv.consultings[0].bizNo = F(N3);
  const g2 = loadGlue(db, { srv });
  assert.equal((await g2.bfUndo(rows)).n, 0);
  assert.equal(db.consultings[0].bizNo, F(N1));
  /* ③-2 서버의 표시가 같은 시각이어도 내용(이전 값·채운 값)이 다르면 건너뛴다 — 서버 이력과 다른 값으로 되돌리지 않는다 */
  db = mkDb(); g = await fill(db);
  rows = g.bfDoneList().filter(r => r.id === 'k1');
  const srv2 = { consultings: JSON.parse(JSON.stringify(db.consultings)) }; srv2.consultings[0].bizAuto.before = F(N3);
  assert.equal((await loadGlue(db, { srv: srv2 }).bfUndo(rows)).n, 0);
  /* ④ 다 그대로면 되돌린다 — 서버에 남은 «이전 값»으로 */
  db = mkDb(); g = await fill(db);
  assert.equal((await g.bfUndo(g.bfDoneList().filter(r => r.id === 'k1'))).n, 1);
});

test('㉓-6 자동 연결 — 총괄관리자 PC·하루 한 번·«자동 채움»만. 제안·확인 필요·충돌·계약은 저절로 쓰지 않는다', async () => {
  const ht = [ht0('가나상사', F(N1), 'h1'), ht0('마바건설', F(N2), 'h2')];
  function ht0(c, n, id) { return { company: c, biznum: n, _id: id, date: '2026-04-01' }; }
  const mkAuto = () => {
    const db = mkDb();
    db.__hometax = ht;
    db.consultings.push({ id: 'k8', no: '컨-008', companyName: '마바건설', bizNo: '' });      // 근거 한 곳(홈택스)뿐 → 제안(ask)
    db.consultings.push({ id: 'k9', no: '컨-009', companyName: '사아상사', bizNo: F(BAD) });    // 값이 있는데 믿기 어렵다 → 확인 필요
    return db;
  };
  /* ① 자동 채움만 쓴다 */
  let db = mkAuto(), g = loadGlue(db);
  let r = await g.bfAutoRun(false);
  assert.equal(r.n, 2, '자동 채움: 가나상사 빈 칸(근거 둘) + 다라상사 표기 정리');
  assert.equal(db.consultings.filter(x => x.id === 'k1')[0].bizNo, F(N1));
  assert.equal(db.consultings.filter(x => x.id === 'k8')[0].bizNo, '', '제안(근거 한 곳)은 저절로 쓰지 않는다');
  assert.equal(db.consultings.filter(x => x.id === 'k9')[0].bizNo, F(BAD), '확인 필요는 저절로 쓰지 않는다');
  assert.equal(db.contracts[0].company.bizNo, '', '계약 표는 쓰지 않는다');
  assert.ok(g.toasts.length === 1 && /자동 연결/.test(g.toasts[0]), '채운 건수를 알린다');
  /* ② 하루 한 번 — 곧바로 다시 돌려도 안 돈다(force 는 돈다) */
  assert.equal(await g.bfAutoRun(false), null);
  assert.ok(await g.bfAutoRun(true), '강제로는 돈다(창에서·시험용)');
  /* ③ 총괄관리자가 아니면 안 돈다 */
  db = mkAuto(); g = loadGlue(db, { CURRENT_USER: { name: 'x', isAdmin: false, isOwner: false } });
  assert.equal(await g.bfAutoRun(false), null); assert.equal(g.__patches.length, 0);
  assert.equal(await loadGlue(mkAuto(), { CURRENT_USER: { name: 'x', isSubAdmin: true } }).bfAutoRun(false), null, '부관리자도 아니다');
  assert.equal(await loadGlue(mkAuto(), { CURRENT_USER: { name: 'x', isAdmin: true, isOwner: false } }).bfAutoRun(false), null, '위임관리인(관리자 대행)도 아니다 — 대표(총괄)만');
  /* ④ 끄면 안 돈다 */
  db = mkAuto(); g = loadGlue(db);
  g.bfAutoSet(false);
  assert.equal(g.bfAutoOn(), false);
  assert.equal(await g.bfAutoRun(false), null); assert.equal(g.__patches.length, 0);
  g.bfAutoSet(true); assert.equal(g.bfAutoOn(), true);
  /* ⑤ 서버에 못 닿으면(fbDb 없음) 안 돈다 */
  db = mkAuto(); g = loadGlue(db, { fbDb: null });
  assert.equal(await g.bfAutoRun(false), null); assert.equal(g.__patches.length, 0);
  /* ⑤-2 근거가 다 도착하지 않았으면(기업정보함 색인 0건·홈택스 받기 실패·홈택스 0건) 쓰지 않고 «미룬다» — 근거가 빠지면 충돌이 사라져 보인다 */
  for (const bad of [{ _pcIdx: {} }, { erpInvArcPull: () => Promise.reject(new Error('x')) }, { idbGetAll: () => Promise.resolve([]) }]) {
    db = mkAuto(); g = loadGlue(db, Object.assign({}, bad));
    const dr = await g.bfAutoRun(false);
    assert.ok(dr && dr.deferred, '근거 미도착은 미룬다: ' + Object.keys(bad)[0]);
    assert.equal(g.__patches.length, 0); assert.equal(g.toasts.length, 0);
    assert.equal(g.localStorage.getItem('pu_bf_auto_at'), null, '미룬 날은 «오늘 했다»로 치지 않는다(다음에 다시 시도)');
  }
  /* ⑤-3 자동 실행의 표시에는 «자동 실행»이 남는다 — 사람이 창에서 한 것과 구분된다 */
  db = mkAuto(); g = loadGlue(db);
  await g.bfAutoRun(true);
  assert.equal(db.consultings.filter(x => x.id === 'k1')[0].bizAuto.trigger, 'autorun');
  db = mkAuto(); g = loadGlue(db);
  await g.bfApply(g.bfPlanNow(ht).rows.filter(r => r.field === 'bizNo' && r.level === 'auto' && r.id === 'k1'), ht);
  assert.equal(db.consultings.filter(x => x.id === 'k1')[0].bizAuto.trigger, 'manual');
  /* ⑤-4 autoOnly 로 부르면 제안(ask)은 넘겨도 쓰지 않는다 — 사전 거르기가 깨져도 쓰는 쪽이 한 번 더 막는다 */
  db = mkAuto(); g = loadGlue(db);
  const askRows = g.bfPlanNow(ht).rows.filter(r => r.field === 'bizNo' && r.level === 'ask' && r.id === 'k8');
  assert.equal(askRows.length, 1);
  assert.equal((await g.bfApply(askRows, ht, { autoOnly: true })).n, 0);
  assert.equal(db.consultings.filter(x => x.id === 'k8')[0].bizNo, '');
  /* ⑥ 오류가 나도 앱을 멈추지 않는다 */
  db = mkAuto(); g = loadGlue(db, { idbGetAll: () => Promise.reject(new Error('x')), erpInvArcPull: () => Promise.reject(new Error('y')) });
  await assert.doesNotReject(() => g.bfAutoRun(false));
});

test('㉔-2 창은 오래된 홈택스 근거를 알리고 자동 연결 켬·끔 칸이 있으며, 자동 연결은 첫 동기화 30초 뒤 한 번 건다', () => {
  const fn = cutFn(ERP, 'function BizFillModal(');
  assert.ok(/htStale/.test(fn) && /Date\.now\(\) - Date\.parse\(htLast\)/.test(fn) && />\s*14/.test(fn), '홈택스가 14일 넘게 안 올라왔으면 경고');
  assert.ok(/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$/.test(fn) && /d <= today/.test(fn), '날짜는 YYYY-MM-DD 만, 오늘 이후(미래) 날짜는 빼고 고른다');
  assert.ok(/bfAutoSet\(!autoOn\)/.test(fn) && /자동 연결/.test(fn), '켬·끔 칸');
  assert.match(ERP, /addEventListener\('fb_initial_done', function\(\)\{ setTimeout\(function\(\)\{ bfAutoRun\(false\); \}, 30000\); \}\)/);
  assert.ok(/isOwner !== true/.test(cutFn(ERP, 'async function bfAutoRun(')), '대표(총괄)만');
});

test('㉔ 창은 자료 목록 규칙을 지킨다 — ☐ 고르기 칸 + 번호 맨 왼쪽, 한 칸 한 줄, 고르기만으로는 아무것도 안 바뀐다', () => {
  const fn = cutFn(ERP, 'function BizFillModal(');
  assert.ok(/h\('input', \{ type:'checkbox', checked:picked\.length === pickable\.length/.test(fn), '머리줄 ☐(보이는 줄 모두 고르기)');
  assert.ok((fn.match(/type:'checkbox', checked:!!sel\[k\]/g) || []).length >= 2, '줄마다 ☐(PC·폰)');
  assert.ok(/'№'/.test(fn), '번호 칸이 있다');
  assert.ok(/gridTemplateColumns:'28px 36px/.test(fn), '맨 왼쪽 ☐ 약 28px · 번호 약 36px');
  assert.ok(/tabular-nums/.test(fn), '번호는 tabular-nums');
  assert.ok(/whiteSpace:'nowrap'/.test(fn) && /textOverflow:'ellipsis'/.test(fn), '한 칸 한 줄 + …');
  assert.ok(/건 선택/.test(fn) && /고르기만으로는 아무것도 바뀌지 않습니다/.test(fn), '「N건 선택」과 할 일을 띄운다');
  assert.ok((fn.match(/popConfirm\(/g) || []).length >= 2, '채우기·되돌리기 모두 쓰기 전에 건수를 묻는다');
  assert.ok(/await popConfirm\(msg\)\)\) return;\s*var r = await bfApply\(/.test(fn), '채우기는 확인 «뒤에» 쓴다');
  assert.ok(/window\.innerWidth <= 768/.test(fn), '폰은 줄마다 카드로');
  assert.ok(/var shown = list\.slice\(0, 300\)/.test(fn) && /var pickable = shown\.filter\(canPick\)/.test(fn) && /shown\.map\(function\(r, i\)/.test(fn),
    '화면에 그리는 줄과 머리줄 ☐ 가 고르는 줄이 같은 범위다(안 보이는 줄까지 저장하지 않는다)');
});

test('㉕ 연결 — 스크립트를 싣고, 업체관리·기금·컨설팅·기타 화면에 입구가 있다. 계약 표는 쓰지 않는다', () => {
  assert.match(ERP, /<script src="js\/pu-biz-evidence\.js\?v=\d+"><\/script>/);
  assert.ok((ERP.match(/h\(BizFillModal,/g) || []).length >= 2, '업체관리 + 사업관리 공통 화면');
  assert.ok(/setBfOpen\(true\)/.test(ERP));
  assert.match(ERP, /var BF_APPLY_STORES = \{ companies:1, consultings:1, funds:1, other_projects:1, cases:1 \};/);
  assert.ok(!/contracts:1/.test(ERP.match(/var BF_APPLY_STORES = \{[^}]*\};/)[0]), '계약은 입력 관문(validateCompanyLink)이 따로 있어 이 창이 쓰지 않는다');
});

test('㉖ 이 파일·판정 모듈에 실제 번호·이름을 쓰지 않는다(가짜 번호는 실행 때 만든다)', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  const mod = fs.readFileSync(path.join(R, 'js', 'pu-biz-evidence.js'), 'utf8');
  [self, mod].forEach(s => assert.equal((s.match(/\b[0-9]{3}-[0-9]{2}-[0-9]{5}\b/g) || []).filter(x => !/^000-00-0000[0-9]$/.test(x)).length, 0));
});
