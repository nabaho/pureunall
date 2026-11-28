'use strict';
/* 컨설팅 유형을 «하는 일»로 맞추고, 어긋나면 알린다 (대표 지시 2026-11-28)
   「위험성평가, 작업중지 운영, 해제 대응이며 안전보건 컨설팅인데 왜 현장클리닉이라고 돼 있냐?
    이런 걸 좀 정확하게 확인하게 해달라. 기본적으로 유사한 것들 체크를 다 하고 거기에 맞게 매칭을 해라.」
   실행: node --test tests/cons-type-family-match.test.js

   ■ 못 박는 규칙 (값이 아니라 «규칙»)
   ① 비슷한 말을 한 갈래로 묶는다 — 위험성평가·작업중지·안전보건·중대재해·산업안전은 모두 «산업안전» 갈래다.
   ② 고르기는 «딱 하나»일 때만 — 글에 갈래가 하나, 그 갈래 유형이 하나. 목록 순서와 상관없다(첫 번째를 찍지 않는다).
   ③ 확인: 지금 유형의 갈래가 글에 없으면 알리고, 갈래가 함께 나오면(클리닉+위험성평가) 그대로 맞다.
      «이대로 맞음»은 그 유형에만 듣는다. 숨긴 유형은 권하지 않는다. 이름이 바뀌어도 갈래는 따라간다.
   ④ 글은 업무 요약 → 견적 범위 → 메모 차례, 갈래가 나온 첫 자리에서 멈춘다. 유형을 바로잡은 기록 줄(🔧 유형)은 근거가 아니다.
   ⑤ 컨설팅 유형이 비면 «첫 번째»로 채우지 않는다 — 계약창 저장 보완(fixTypeCodes)·중복 판정(contractFormSubtypeFill) 모두.
      이관은 유형이 비면 막는다(erpXferConsTypeMissing).
   ⑥ 점검(erpConsTypeAudit)은 진행 중인 건만 — 이관·종료·취소된 건은 안 본다(종료·삭제·되돌림 불변).
   소스 글자가 아니라 함수를 떠서 «돌려» 본다(STATUS.md 「되풀이된 실수」 ②).
   ⚠ 이 저장소는 공개다 — 업체 이름은 지어낸 것이다. 유형 이름은 서비스 이름이라 그대로(2026-09-18 운영 유형 목록과 같은 이름). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const { CONS_FAMILY_FNS } = require('./helpers/cons-family.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const out = (v) => JSON.parse(JSON.stringify(v));

function load(extra) {
  const FN = CONS_FAMILY_FNS.concat(['function erpGuessContractFromFields(', 'function erpTypeNameTidy(', 'function erpNameRun(',
    'function erpConsTypeByDocName(', 'function erpXferConsTypeMissing(', 'function contractFormSubtypeFill('])
    .map((d) => cutFn(SRC, d)).join('\n');
  const ctx = Object.assign({ console }, extra || {});
  vm.createContext(ctx);
  vm.runInContext(FN + '\nthis.api={erpConsFamilyOfType,erpConsFamiliesInText,erpConsTypeByCues,erpConsWorkTexts,erpConsTypeGuessForRec,'
    + 'erpConsTypeCheck,erpContractConsTypeCheck,erpConsTypeCheckMsg,erpConsTypeAudit,erpGuessContractFromFields,erpXferConsTypeMissing,contractFormSubtypeFill};', ctx);
  return ctx.api;
}
const A = load();

/* 운영에 있는 컨설팅 유형 이름 17가지(2026-09-18, tests/contract-type-guess.test.js 와 같은 이름) — 코드는 지어낸 것 */
const NAMES = ['현장클리닉', '일터상생혁신컨설팅', '통합기술보호지원단', '산업일자리전환컨설팅충남', '산업일자리전환컨설팅능률',
  '일터혁신상생컨설팅', '기초컨설팅푸른법인', '인사노무컨설팅충남북부상의', '인사노무컨설팅서산', '사회적기업컨설팅',
  '사내,공동근로복지기금설립컨설팅', '임단협노사교섭위원참석', '산업안전컨설팅', '혁신바우처컨설팅', '출산육아휴직우수기업컨설팅',
  '삼성협력업체컨설팅', '통상변화대응기술경영혁신지원컨설팅'];
const TYPES = NAMES.map((n, i) => ({ code: 'c' + i, name: n }));
const byName = (n, list) => (list || TYPES).find((t) => t.name === n);
const CLINIC = byName('현장클리닉');
const SAFETY = byName('산업안전컨설팅');
/* 목록 순서를 여러 가지로 — 17개는 모든 순서를 다 볼 수 없어 돌림·뒤집기·섞기로 본다 */
function orders(list) {
  const r = [list.slice(), list.slice().reverse()];
  for (let k = 1; k < list.length; k += 3) r.push(list.slice(k).concat(list.slice(0, k)));
  r.push(list.filter((_, i) => i % 2).concat(list.filter((_, i) => !(i % 2))));
  return r;
}
/* 대표님이 짚은 그 계약의 모양 — 업체는 지어냈다 */
const BRIEF = '[푸른노무법인] 위험성평가 및 작업중지명령 해제 대응 컨설팅';
const CT = { id: 'ct-1', contractNo: '계약-2026-001', companyName: '가나상사', kinds: ['consulting'], status: 'review',
  typeCodes: { consulting: CLINIC.code }, briefs: { consulting: BRIEF }, note: '' };

/* ══════ ① 비슷한 말은 한 갈래 ══════ */
test('① 위험성평가·작업중지·안전보건·중대재해·산업안전은 모두 산업안전 갈래다 — 띄어 써도 같다', () => {
  ['위험성평가', '위험성 평가', '작업중지명령 해제', '작업 중지', '안전보건 컨설팅', '안전보건관리체계 구축', '중대재해 예방', '산업안전 진단']
    .forEach((s) => {
      const f = A.erpConsFamiliesInText(s);
      assert.equal(f.length, 1, s + ' → 갈래 ' + f.length + '개');
      assert.equal(f[0].key, A.erpConsFamilyOfType(SAFETY), s + ' 이 산업안전컨설팅과 같은 갈래가 아닙니다');
    });
  assert.deepEqual(out(A.erpConsFamiliesInText('인사노무 진단 및 취업규칙 정비')), [], '두루 쓰는 말(인사노무)은 갈래로 치지 않는다');
});

test('① 유형도 이름·역할로 갈래가 갈린다 — 이름을 바꿔도, 새 이름으로 생겨도 따라간다', () => {
  const fSafety = A.erpConsFamilyOfType(SAFETY);
  assert.ok(fSafety, '산업안전컨설팅은 갈래가 있어야 합니다');
  assert.equal(A.erpConsFamilyOfType({ code: 'x', name: '안전보건컨설팅' }), fSafety, '이름이 안전보건컨설팅으로 바뀌어도 같은 갈래');
  assert.equal(A.erpConsFamilyOfType({ code: 'x', name: '위험성평가' }), fSafety, '«위험성평가» 라는 유형도 같은 갈래');
  assert.equal(A.erpConsFamilyOfType({ code: 'x', name: '찾아가는 노무상담', role: 'clinic' }), A.erpConsFamilyOfType(CLINIC),
    '역할 칸이 현장클리닉이면 이름이 달라도 현장클리닉 갈래');
  assert.equal(A.erpConsFamilyOfType(byName('인사노무컨설팅서산')), '', '두루 쓰는 유형은 갈래가 없다');
});

/* ══════ ② 고르기 — 딱 하나일 때만, 순서와 상관없이 ══════ */
test('② ★ 대표님이 짚은 계약: «위험성평가 및 작업중지명령 해제 대응 컨설팅» 은 산업안전컨설팅 — 첫 번째(현장클리닉)가 아니다', () => {
  orders(TYPES).forEach((list) => {
    const g = out(A.erpGuessContractFromFields({ docName: '위임계약서', scope: BRIEF }, list, [], [], []));
    assert.equal(g.kind, 'consulting');
    assert.equal(g.typeCode, SAFETY.code, '첫 줄이 ' + list[0].name + ' 일 때 ' + g.typeCode);
  });
  /* «컨설팅»이라는 말 없이 하는 일만 적혀도 컨설팅이다 */
  assert.deepEqual(out(A.erpGuessContractFromFields({ docName: '위험성평가 지원 계약서' }, TYPES, [], [], [])),
    { kind: 'consulting', typeCode: SAFETY.code });
});

test('② 애매하면 안 고른다 — 갈래가 둘, 같은 갈래 유형이 둘, 맞는 유형이 없음', () => {
  assert.equal(A.erpConsTypeByCues('현장클리닉 연계 위험성평가', TYPES), null, '갈래 둘(클리닉+산업안전)');
  assert.equal(A.erpConsTypeByCues('일터혁신 컨설팅', TYPES), null, '일터 유형이 둘(일터상생혁신·일터혁신상생)');
  assert.equal(A.erpConsTypeByCues('위험성평가 컨설팅', TYPES.filter((t) => t !== SAFETY)), null, '산업안전 유형이 없으면 첫 번째로 대신하지 않는다');
  assert.equal(A.erpConsTypeByCues('위험성평가 컨설팅', TYPES.concat([{ code: 'z', name: '안전보건컨설팅' }])), null, '산업안전 유형이 둘');
  assert.equal(A.erpConsTypeByCues('위험성평가 컨설팅', TYPES.map((t) => t === SAFETY ? Object.assign({}, t, { hidden: true }) : t)), null,
    '숨긴 유형은 고르지 않는다');
  assert.deepEqual(out(A.erpGuessContractFromFields({ docName: '인사노무 컨설팅 위임계약서' }, TYPES, [], [], [])),
    { kind: 'consulting', typeCode: '' }, '하는 일 낱말이 없으면 비운다');
});

/* ══════ ③ 확인 — 어긋나면 알리고, 맞으면 조용하다 ══════ */
test('③ ★ 현장클리닉으로 찍힌 그 계약은 «확인»이 뜨고, 산업안전컨설팅을 권한다', () => {
  const ck = A.erpContractConsTypeCheck(CT, TYPES);
  assert.ok(ck, '어긋났는데 확인이 안 뜹니다');
  assert.equal(ck.cur.code, CLINIC.code);
  assert.equal(ck.want && ck.want.code, SAFETY.code);
  assert.ok(ck.words.length >= 2, '찾은 말(위험성평가·작업중지)을 함께 보여 줘야 합니다');
  const msg = A.erpConsTypeCheckMsg(ck);
  assert.ok(msg.includes(CLINIC.name) && msg.includes(SAFETY.name), '알림 한 줄에 지금 유형과 권하는 유형이 함께 있어야 합니다: ' + msg);
});

test('③ 맞으면 조용하다 — 같은 갈래, 갈래가 함께 나옴, 낱말 없음, 컨설팅이 아님', () => {
  const ok = (patch) => A.erpContractConsTypeCheck(Object.assign({}, CT, patch), TYPES);
  assert.equal(ok({ typeCodes: { consulting: SAFETY.code } }), null, '산업안전컨설팅이면 맞다');
  assert.equal(ok({ briefs: { consulting: '현장클리닉 — 위험성평가 대응' } }), null, '클리닉과 위험성평가가 함께면 현장클리닉도 맞다');
  assert.equal(ok({ briefs: { consulting: '인사노무 관리 개선' } }), null, '하는 일 낱말이 없으면 판단하지 않는다');
  assert.equal(ok({ kinds: ['case'] }), null, '컨설팅이 아니면 보지 않는다');
  assert.equal(ok({ typeCodes: { consulting: 'gone-code' } }), null, '목록에 없는 옛 코드는 판단하지 않는다');
});

test('③ «이대로 맞음»은 그 유형에만 듣는다 — 유형을 바꾸면 다시 본다', () => {
  assert.equal(A.erpContractConsTypeCheck(Object.assign({}, CT, { typeCheckOk: CLINIC.code }), TYPES), null);
  const other = byName('기초컨설팅푸른법인');
  assert.ok(A.erpContractConsTypeCheck(Object.assign({}, CT, { typeCheckOk: CLINIC.code, typeCodes: { consulting: other.code } }), TYPES),
    '다른 유형으로 바꾸면 옛 «맞음»이 그대로 듣지 않아야 합니다');
});

test('③ 유형이 비었어도 글로 고를 거리가 있으면 알린다 · 권할 유형이 없으면 묻지 않는다', () => {
  const empty = Object.assign({}, CT, { typeCodes: {} });
  const ck = A.erpContractConsTypeCheck(empty, TYPES);
  assert.ok(ck && !ck.cur && ck.want && ck.want.code === SAFETY.code, '비었으면 «비었음» + 산업안전컨설팅');
  assert.equal(A.erpContractConsTypeCheck(empty, TYPES.filter((t) => t !== SAFETY)), null, '바꿀 데가 없는 경고는 띄우지 않는다');
  const amb = A.erpContractConsTypeCheck(Object.assign({}, CT, { briefs: { consulting: '일터혁신 상생 컨설팅' } }), TYPES);
  assert.ok(amb && !amb.want && amb.wants.length >= 2, '갈래 유형이 둘이면 하나를 찍지 않고 후보를 다 낸다');
});

/* ══════ ④ 글의 차례 ══════ */
test('④ 업무 요약이 메모를 이긴다 · 요약에 낱말이 없을 때만 메모를 본다 · 🔧 유형 기록 줄은 근거가 아니다', () => {
  const rec = Object.assign({}, CT, { typeCodes: { consulting: SAFETY.code }, note: '작년에는 현장클리닉으로 진행' });
  assert.equal(A.erpContractConsTypeCheck(rec, TYPES), null, '요약(위험성평가)이 먼저라 메모의 클리닉은 안 본다');
  const memoOnly = Object.assign({}, CT, { briefs: {}, note: '위험성평가 대응 요청' });
  assert.equal(A.erpContractConsTypeCheck(memoOnly, TYPES).where, '메모');
  /* 산업안전컨설팅 → 기초컨설팅푸른법인 으로 바로잡은 기록 — 그 줄의 «산업안전» 이 다시 근거가 되면 방금 고친 것을 또 묻는다 */
  const stamped = Object.assign({}, CT, { briefs: {}, typeCodes: { consulting: byName('기초컨설팅푸른법인').code },
    note: '🔧 유형 바로잡음(유형 점검) — 산업안전컨설팅 → 기초컨설팅푸른법인 · 2026-11-28' });
  assert.equal(A.erpContractConsTypeCheck(stamped, TYPES), null, '바로잡은 기록 줄이 다시 근거가 되면 안 됩니다');
  const quoted = Object.assign({}, CT, { briefs: {}, quoteLogs: [{ scope: '중대재해 대응 안전보건관리체계 구축' }] });
  assert.equal(A.erpContractConsTypeCheck(quoted, TYPES).where, '견적 범위');
});

/* ══════ ⑤ 첫 번째로 채우지 않는다 ══════ */
test('⑤ 중복 판정용 채움도 컨설팅은 첫 번째를 쓰지 않는다 — 글로 정해질 때만', () => {
  const B = load({ getKindTypes: () => TYPES });
  assert.ok(!B.contractFormSubtypeFill({ kinds: ['consulting'], typeCodes: {} }).typeCodes.consulting, '글이 없으면 비운다');
  assert.equal(B.contractFormSubtypeFill({ kinds: ['consulting'], typeCodes: {}, briefs: { consulting: BRIEF } }).typeCodes.consulting, SAFETY.code);
  assert.equal(B.contractFormSubtypeFill({ kinds: ['consulting'], typeCodes: { consulting: CLINIC.code }, briefs: { consulting: BRIEF } }).typeCodes.consulting,
    CLINIC.code, '사람이 고른 값은 안 덮는다');
});

test('⑤ 계약창 저장 보완(fixTypeCodes)은 컨설팅을 첫 번째로 안 채우고, 글로 정해지면 그 유형', () => {
  const i = SRC.indexOf('(function fixTypeCodes(){');
  assert.ok(i > 0, 'fixTypeCodes 를 찾지 못했습니다');
  const body = cutFn(SRC.slice(i + 1), 'function fixTypeCodes(');
  const run = (saveData, list) => {
    const ctx = { saveData, BIZ_CONS_SEED: list || TYPES, BIZ_FUND_SEED: [{ code: 'f1' }], BIZ_OTHER_SEED: [{ code: 'o1' }], BIZ_CASE_SEED: [{ code: 'k1' }],
      COMPANY_TYPE_SEED: [{ code: '자문' }], dbGet: (k, seed) => seed, erpConsTypeGuessForRec: A.erpConsTypeGuessForRec };
    vm.createContext(ctx);
    vm.runInContext('(' + body + ')();', ctx);
    return ctx.saveData.typeCodes;
  };
  orders(TYPES).forEach((list) => {
    assert.ok(!run({ kinds: ['consulting'], typeCodes: {} }, list).consulting, '첫 번째(' + list[0].name + ')로 채우면 안 됩니다');
    assert.equal(run({ kinds: ['consulting'], typeCodes: {}, briefs: { consulting: BRIEF } }, list).consulting, SAFETY.code);
  });
  assert.equal(run({ kinds: ['consulting'], typeCodes: {}, briefs: { consulting: BRIEF } }).consulting, SAFETY.code);
  assert.equal(run({ kinds: ['fund'], typeCodes: {} }).fund, 'f1', '다른 갈래는 예전처럼 채운다');
});

test('⑤ 유형이 빈 컨설팅 계약은 이관하지 않는다 — 옛 자료(종류 하나 + typeCode)는 통과', () => {
  assert.ok(A.erpXferConsTypeMissing({ kinds: ['consulting'], typeCodes: {} }), '비었으면 이유 글이 나와야 합니다');
  assert.equal(A.erpXferConsTypeMissing({ kinds: ['consulting'], typeCodes: { consulting: SAFETY.code } }), '');
  assert.equal(A.erpXferConsTypeMissing({ kind: 'consulting', typeCode: SAFETY.code }), '', '옛 자료 한 칸 typeCode');
  assert.equal(A.erpXferConsTypeMissing({ kinds: ['case'], typeCodes: {} }), '', '컨설팅이 아니면 상관없다');
  /* 두 이관 길이 모두 이 막이를 지난다 — 미리 보기(erpTransferBlockReason)와 실제 이관(erpPrepareContractTransfer) */
  ['function erpTransferBlockReason(', 'function erpPrepareContractTransfer('].forEach((d) => {
    assert.ok(cutFn(SRC, d).includes('erpXferConsTypeMissing('), d + ' 에 컨설팅 유형 막이가 없습니다');
  });
});

/* ══════ ⑥ 점검은 진행 중인 건만 ══════ */
test('⑥ 유형 점검은 진행 중인 계약·컨설팅만 훑는다 — 이관·종료·취소·삭제는 안 본다', () => {
  const live = Object.assign({}, CT);
  const recs = [live,
    Object.assign({}, CT, { id: 'ct-2', status: 'transferred' }),
    Object.assign({}, CT, { id: 'ct-3', status: 'closed' }),
    Object.assign({}, CT, { id: 'ct-4', _deleted: true })];
  const cons = [
    { id: 'cs-1', no: '클릭-2026-001', typeCode: CLINIC.code, brief: '중대재해 예방 안전보건관리체계', status: 'progress' },
    { id: 'cs-2', no: '클릭-2026-002', typeCode: CLINIC.code, brief: '중대재해 예방 안전보건관리체계', status: 'closed' },
    { id: 'cs-3', no: '산안-2026-001', typeCode: SAFETY.code, brief: '위험성평가', status: 'progress' }];
  const rows = A.erpConsTypeAudit(recs, cons, TYPES);
  assert.deepEqual(out(rows.map((r) => r.src + ':' + r.rec.id)), ['contract:ct-1', 'consulting:cs-1']);
  const onlyReview = A.erpConsTypeAudit(recs, [], TYPES, (c) => c.status === 'signed');
  assert.equal(onlyReview.length, 0, '진행 중 판정을 넘기면 그것을 따른다');
});

/* ══════ 화면에 이어졌나 (모양이 아니라 «이어졌는지»만) ══════ */
test('화면 배선 — 계약창 경고 줄·카드 꼬리표·점검 창·컨설팅관리 편집창이 같은 판정을 쓴다', () => {
  const nCheck = SRC.split('erpContractConsTypeCheck(').length - 1;
  assert.ok(nCheck >= 3, '계약창·꼬리표에서 판정을 써야 합니다(' + nCheck + '곳)');
  assert.ok(SRC.split('erpConsTypeCkTag(c, openEdit').length - 1 >= 2, '계약 카드에 꼬리표가 붙어야 합니다');
  assert.ok(/h\(ConsTypeAuditModal,/.test(SRC), '점검 창을 그려야 합니다');
  assert.ok(/storageKey === 'consultings'[^\n]*erpConsTypeCheck|storageKey === 'consultings' && f\.status !== 'closed'/.test(SRC),
    '컨설팅관리 편집창에도 확인이 떠야 합니다(종료 건 제외)');
  const modal = cutFn(SRC, 'function ConsTypeAuditModal(');
  assert.ok(/type:'checkbox'/.test(modal) && /tyau-no/.test(modal), '목록 맨 왼쪽은 ☐ 고르기 칸 + 번호');
  assert.ok(/건 선택/.test(modal), '고르면 「N건 선택」 띠가 뜬다');
});
