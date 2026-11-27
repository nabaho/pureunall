'use strict';
/* 계약서를 «빠짐없이» 읽어 카드에 넣기 — 이알피 쪽 (대표 지시 2026-11-27)
 * ⚠ 이 저장소는 공개다 — 업체·유형 이름·금액은 전부 지어낸 것이다(유형 이름은 서비스 이름이라 그대로).
 *
 * ■ 못 박는 규칙 (값이 아니라 «규칙»)
 *   ① 유형은 서류 이름 → 파일 이름 → 업무 범위 순으로 «이름에 든 사업 이름»을 찾는다.
 *      제목이 «위임계약서» 뿐이어도 파일 이름의 «산업안전컨설팅»이 이기고, 범위 문장의 낱말(위험성평가)이 그 앞을 가로채지 않는다.
 *      서류 이름이 엉뚱해도(통장사본) 파일 이름·범위에서 찾고, 그래도 못 찾으면 비워 둔다(목록 첫 번째를 찍지 않는다).
 *   ② 컨설팅·사건 구분: «위임계약서» 제목에 컨설팅 말이 파일 이름에만 있어도 사건이 아니라 컨설팅이다.
 *   ③ 자동으로 들어온 카드(새 카드·기존 카드에 합치기)는 금액·유형이 «비어 있으면» 확인 필요(checkReq)를 달고,
 *      채워졌으면 안 단다. 기존 카드에 이미 금액·유형이 있으면 비었다고 하지 않는다. 확정(signed)은 건드리지 않는다.
 * 소스 글자가 아니라 함수를 떠서 «돌려» 본다(STATUS.md 「되풀이된 실수」 ②). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const out = (v) => JSON.parse(JSON.stringify(v));

/* ── ① ② 유형 짐작 ── */
function guesser() {
  const FN = ['function erpGuessContractFromFields(', 'function erpTypeNameTidy(', 'function erpNameRun(', 'function erpConsTypeByDocName(']
    .map((d) => cutFn(SRC, d)).join('\n');
  const ctx = { console, Date, Object, Array, String, Number, JSON, Math, parseInt, parseFloat };
  vm.createContext(ctx);
  vm.runInContext(FN + '\nthis.api={erpGuessContractFromFields,erpConsTypeByDocName};', ctx);
  return ctx.api;
}
const G = guesser();

const CLINIC = { code: 'cons-clinic', name: '현장클리닉' };
const SAFETY = { code: 'cons-safety', name: '산업안전컨설팅' };
const RISK = { code: 'cons-risk', name: '위험성평가' };
const HRLOCAL = { code: 'cons-hr-local', name: '인사노무컨설팅지역상의' };
const TYPES = [CLINIC, SAFETY, RISK, HRLOCAL];
const guess = (cf, list) => out(G.erpGuessContractFromFields(cf, list || TYPES, [], [], []));
const SCOPE_LONG = '위험성평가 및 작업중지명령 해제 대응 컨설팅 위임계약서 송부의 건';

function permutations(a) {
  if (a.length <= 1) return [a];
  const r = [];
  a.forEach((x, i) => permutations(a.slice(0, i).concat(a.slice(i + 1))).forEach((p) => r.push([x].concat(p))));
  return r;
}

test('① 서류 이름이 엉뚱해도 파일 이름의 사업 이름으로 유형을 고른다 — 목록 순서와 상관없다', () => {
  permutations(TYPES).forEach((list) => {
    const g = guess({ docName: '통장사본_푸른노무법인_230925.pdf', fileName: '위임계약서_산업안전컨설팅_가나상사_261125', scope: SCOPE_LONG }, list);
    assert.equal(g.kind, 'consulting');
    assert.equal(g.typeCode, SAFETY.code, '첫 번째(' + list[0].name + ')를 찍지 않고 파일 이름의 산업안전컨설팅');
  });
});

test('① 제목이 «위임계약서» 뿐이면 파일 이름이 범위 문장보다 먼저다 — 범위의 «위험성평가» 가 가로채지 않는다', () => {
  permutations(TYPES).forEach((list) => {
    assert.equal(guess({ docName: '위임계약서', fileName: '위임계약서_산업안전컨설팅_가나상사_261125', scope: SCOPE_LONG }, list).typeCode, SAFETY.code);
    assert.equal(guess({ docName: '위임계약서', scope: SCOPE_LONG }, list).typeCode, RISK.code, '파일 이름이 없으면 범위에서 찾는다(하나뿐일 때)');
  });
});

test('① 어디서도 못 찾으면 비워 둔다 — 목록 첫 번째(현장클리닉)를 찍지 않는다', () => {
  permutations(TYPES).forEach((list) => {
    const g = guess({ docName: '통장사본_푸른노무법인_230925.pdf', fileName: '통장사본_푸른노무법인_230925', scope: '컨설팅 계약서 송부의 건' }, list);
    assert.equal(g.kind, 'consulting');
    assert.equal(g.typeCode, '', '못 골랐으면 안 고른다');
  });
  assert.equal(guess({ docName: '위임계약서', fileName: '', scope: '컨설팅' }, []).typeCode, '', '유형 목록이 비어도 비워 둔다');
});

test('② «위임계약서» 제목에 컨설팅 말이 파일 이름에만 있어도 사건이 아니라 컨설팅이다', () => {
  assert.equal(guess({ docName: '위임계약서', fileName: '위임계약서_산업안전컨설팅_가나상사', scope: '' }).kind, 'consulting');
  assert.equal(guess({ docName: '위임계약서', fileName: '위임계약서_가나상사', scope: '' }).kind, 'case', '컨설팅 말이 어디에도 없으면 종전대로 사건 위임');
});

/* ── ③ 계약서 길 — 금액·유형이 비면 확인 필요 ── */
const MONEY = ['function erpParseContractMoney(', 'function erpParseSuccessFee(', 'function erpVatTextToFlag('].map((d) => cutFn(SRC, d)).join('\n');
const moneyCtx = vm.createContext({ console, Date, Object, Array, String, Number, JSON, Math, parseInt, parseFloat, RegExp });
vm.runInContext(MONEY + '\nthis.api={erpParseContractMoney,erpParseSuccessFee,erpVatTextToFlag};', moneyCtx);
const M = moneyCtx.api;

const LANE_START = SRC.indexOf('  async function processPhotoContractRequest(key, req){');
const LANE_END = SRC.indexOf('  async function processOneContractRequest(key, req){', LANE_START);
assert.ok(LANE_START > 0 && LANE_END > LANE_START, '계약서 길 함수를 못 찾음');
const LANE_SRC = SRC.slice(LANE_START, LANE_END);

function laneRun(req, opt) {
  const o = opt || {};
  const saved = [];
  const stubs = {
    fbDb: { ref: () => ({ remove: async () => {}, update: async () => {} }) },
    dbGet: (k) => (k === 'contracts' ? (o.contracts || []) : k === 'companies' ? (o.companies || []) : []),
    getActiveUsers: () => [{ sid: 'S1', name: '담당A' }],
    erpGuessContractFromFields: G.erpGuessContractFromFields,
    erpConsTypeByDocName: G.erpConsTypeByDocName,
    getKindTypes: (k) => (k === 'consulting' ? TYPES : []),
    erpParseContractMoney: M.erpParseContractMoney, erpParseSuccessFee: M.erpParseSuccessFee, erpVatTextToFlag: M.erpVatTextToFlag,
    erpCmsFromDoc: () => ({ isCMS: false, payDay: '' }),
    erpCoNameKey: (s) => String(s || '').replace(/\s/g, ''),
    erpSameCompany: (a, c) => String(a.company.name) === String(c.companyName),
    erpDeferCoLinkIfNew: () => null,
    erpBiznoClash: () => null,
    isContractLocked: () => false,
    genContractNo: () => '계약-2026-900',
    persistOne: (c) => { saved.push(c); return true; },
    erpBlankContractForm: vm.runInContext('(' + cutFn(SRC, 'function erpBlankContractForm(') + ')', vm.createContext({ todayYMD: () => '2026-11-26', Date })),
    erpStageMarksMerge: () => null, erpStagePartsFromContract: () => [],
    window: {},
    PuDocRead: { bizNoValid: () => true }, CURRENT_USER: { sid: 'S1' },
    Date, Object, Array, String, JSON, Number, Promise, Math, parseInt, parseFloat, RegExp, console,
  };
  const names = Object.keys(stubs);
  const fn = new Function(...names, 'return (' + LANE_SRC.trim().replace(/^async function processPhotoContractRequest/, 'async function') + ')');
  return fn(...names.map((k) => stubs[k]))('ctphoto-1', req).then((r) => ({ r, saved }));
}
/* 우리가 보낸 메일에서 온 요청 + 열린 카드에 합치기 허용(서버 자동검토 요청이 실제로 달고 오는 값) */
const MERGE = { company: { name: '가나상사', bizNo: '1234567890' }, mergeEmptyOpen: true,
  mailMeta: { dir: 'sent', srcKey: '메일함|177', senderVerified: true, subject: '계약서 송부의 건', companyName: '가나상사' } };
const REQ = (cf, o) => Object.assign({
  source: 'photo_contract', state: 'pending', targetStatus: 'review', senderVerified: true, managerMain: 'S1', companyId: '', srcMails: ['메일함|177'],
  company: { name: '가나상사', bizNo: '' },
  contractFields: Object.assign({ docName: '위임계약서', fileName: '위임계약서_산업안전컨설팅_가나상사_261125', scope: '위험성평가 및 작업중지명령 해제 대응 컨설팅', signDate: '2026-11-25' }, cf || {}),
}, o || {});

test('③ 새 카드 — 금액·유형을 읽었으면 그대로 넣고 확인 필요를 달지 않는다', async () => {
  const { r, saved } = await laneRun(REQ({ fee: '3,300,000원 (부가세 포함)' }));
  assert.ok(r.made, JSON.stringify(r));
  const c = saved[0];
  assert.equal(c.typeCodes.consulting, SAFETY.code);
  assert.equal(c.amounts.consulting, 3300000);
  assert.equal(c.checkReq, undefined, '충분히 읽었으면 표시가 없다');
});

test('③ 새 카드 — 금액이 비면 «금액», 유형도 못 골랐으면 «금액·유형» 확인 필요를 단다(카드는 만든다)', async () => {
  const noAmt = await laneRun(REQ({ fee: '' }));
  assert.ok(noAmt.r.made);
  assert.equal(noAmt.saved[0].typeCodes.consulting, SAFETY.code);
  assert.ok(noAmt.saved[0].checkReq && /금액이\(가\) 비어/.test(noAmt.saved[0].checkReq.note), JSON.stringify(noAmt.saved[0].checkReq));
  assert.doesNotMatch(noAmt.saved[0].checkReq.note, /유형/);
  const bad = await laneRun(REQ({ docName: '통장사본_푸른노무법인_230925.pdf', fileName: '통장사본_푸른노무법인_230925', scope: '컨설팅 계약서 송부의 건', fee: '' }));
  assert.ok(bad.r.made);
  assert.equal(bad.saved[0].typeCodes.consulting, '', '유형을 지어내지 않는다');
  assert.equal(bad.saved[0].amounts.consulting, 0, '금액을 지어내지 않는다');
  assert.match(bad.saved[0].checkReq.note, /금액·유형/);
});

test('③ 새 카드 — 서버가 단 확인 문구는 지우지 않고 그 뒤에 잇는다', async () => {
  const { saved } = await laneRun(REQ({ fee: '' }, { checkReq: { at: '2026-11-26T00:00:00.000Z', by: '시스템(메일 자동검토)', note: '서버 문구' } }));
  assert.match(saved[0].checkReq.note, /^서버 문구 \/ 계약서 자동 읽기: 금액/);
  assert.equal(saved[0].checkReq.by, '시스템(메일 자동검토)');
});

test('③ 확정(signed)으로 만든 카드는 확인 표시를 달지 않는다 — 확정 흐름을 건드리지 않는다', async () => {
  const co = { id: 'co1', name: '가나상사', bizNo: '1234567890' };
  const signedReq = REQ({ fee: '' }, { targetStatus: 'signed', companyId: 'co1', company: { name: '가나상사', bizNo: '1234567890' }, bizNoOk: true,
    mailMeta: { dir: 'sent', srcKey: '메일함|177', senderVerified: true, subject: '계약서 송부의 건', companyName: '가나상사', companyId: 'co1' } });
  const { r, saved } = await laneRun(signedReq, { companies: [co] });
  assert.ok(r.made, JSON.stringify(r));
  assert.equal(saved[0].status, 'signed', '이 입력은 확정으로 만들어진다(시험 전제)');
  assert.equal(saved[0].checkReq, undefined, '확정 카드에는 확인 필요를 달지 않는다');
});

test('③ 기존 카드에 잘못 찍힌 유형(옛 «첫 번째 찍기»)도 서류가 사업 이름을 분명히 말하면 바로잡는다 — 파일 이름까지 본다', async () => {
  const cur = { id: 'ct-3', contractNo: '계약-2026-102', status: 'review', kinds: ['consulting'], companyName: '가나상사', bizNo: '1234567890',
    company: { name: '가나상사', bizNo: '1234567890' }, amounts: { consulting: 0 }, typeCodes: { consulting: CLINIC.code }, briefs: {}, srcMails: ['메일함|100'] };
  const { r, saved } = await laneRun(REQ({ docName: '위임계약서', scope: '', fee: '3,300,000원' }, MERGE), { contracts: [cur] });
  assert.ok(r.made, JSON.stringify(r));
  assert.equal(saved[0].id, 'ct-3');
  assert.equal(saved[0].typeCodes.consulting, SAFETY.code, '서류 제목은 «위임계약서» 뿐이어도 파일 이름의 사업 이름으로');
});

test('③ 기존 카드에 합치기 — 견적으로 만든 빈 카드에 읽은 유형·금액을 채우고, 못 읽었으면 확인 필요를 단다', async () => {
  const cur = { id: 'ct-1', contractNo: '계약-2026-100', status: 'review', kinds: ['consulting'], companyName: '가나상사', bizNo: '1234567890',
    company: { name: '가나상사', bizNo: '1234567890' }, amounts: { consulting: 0 }, typeCodes: { consulting: '' }, briefs: {}, srcMails: ['메일함|100'] };
  const withBiz = (cf) => REQ(cf, MERGE);

  const ok = await laneRun(withBiz({ fee: '3,300,000원 (부가세 포함)' }), { contracts: [cur] });
  assert.ok(ok.r.made, JSON.stringify(ok.r));
  assert.equal(ok.saved[0].id, 'ct-1', '새 카드가 아니라 기존 카드');
  assert.equal(ok.saved[0].typeCodes.consulting, SAFETY.code);
  assert.equal(ok.saved[0].amounts.consulting, 3300000);
  assert.equal(ok.saved[0].checkReq, undefined);

  const empty = await laneRun(withBiz({ fee: '' }), { contracts: [cur] });
  assert.equal(empty.saved[0].id, 'ct-1');
  assert.match(empty.saved[0].checkReq.note, /금액이\(가\) 비어/);
  assert.equal(empty.saved[0].amounts.consulting, 0);
});

test('③ 기존 카드에 이미 금액·유형이 있으면 «비었다» 하지 않고, 담당자가 단 확인 표시도 덮지 않는다', async () => {
  const cur = { id: 'ct-2', contractNo: '계약-2026-101', status: 'review', kinds: ['consulting'], companyName: '가나상사', bizNo: '1234567890',
    company: { name: '가나상사', bizNo: '1234567890' }, amounts: { consulting: 1200000 }, typeCodes: { consulting: SAFETY.code }, briefs: {}, srcMails: ['메일함|100'] };
  const withBiz = (cf) => REQ(cf, MERGE);
  const r1 = await laneRun(withBiz({ fee: '' }), { contracts: [cur] });
  assert.equal(r1.saved[0].id, 'ct-2');
  assert.equal(r1.saved[0].amounts.consulting, 1200000, '이미 있는 금액은 그대로');
  assert.equal(r1.saved[0].checkReq, undefined, '금액·유형이 이미 있으니 비었다고 하지 않는다');

  const mine = Object.assign({}, cur, { checkReq: { at: '2026-11-20T00:00:00.000Z', by: '담당A', note: '담당자 문구' } });
  const r2 = await laneRun(withBiz({ fee: '' }), { contracts: [Object.assign({}, mine, { amounts: { consulting: 0 } })] });
  assert.equal(r2.saved[0].checkReq.note, '담당자 문구', '담당자가 단 확인 표시는 덮지 않는다');
});

/* ── ④ 브라우저 쪽 메일 당겨오기 — 통장사본이 «계약서»로 읽히지 않는다 ── */
function docFileApi() {
  const DOCREAD_SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-doc-read.js'), 'utf8');
  const DOCFILE_SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-doc-file.js'), 'utf8');
  const ctx = { console, Date, Object, Array, String, Number, JSON, Math, Promise, RegExp, Error, parseInt, parseFloat, setTimeout };
  ctx.window = ctx; ctx.global = ctx;
  vm.createContext(ctx);
  vm.runInContext(DOCREAD_SRC, ctx);
  vm.runInContext(DOCFILE_SRC, ctx);
  return ctx.PuDocFile;
}
const PDF = docFileApi();
const A = (...names) => names.map((name, i) => ({ name, part: String(i + 1) }));

test('④ 메일 첨부 고르기 — 통장사본·사업자등록증·견적서는 건너뛰고, 계약서 이름이 뒤에 있어도 그것을 고른다', () => {
  assert.equal(typeof PDF.pickContractAttIndex, 'function');
  const atts = A('통장사본_푸른노무법인_230925.pdf', '사업자등록증_푸른노무법인.pdf', '위임계약서_산업안전컨설팅_가나상사_261125.pdf');
  assert.equal(PDF.pickContractAttIndex(atts), 2);
  assert.equal(PDF.pickContractAttIndex(A('통장사본_푸른노무법인.pdf', '사업자등록증_푸른노무법인.pdf')), -1, '계약서가 아닌 것뿐이면 못 고른다(첫 번째로 때우지 않는다)');
  assert.equal(PDF.pickContractAttIndex(A('견적서_컨설팅_가나상사.pdf', '서류 한 장.pdf')), 1, '이름에 계약 말이 없으면 읽을 수 있는 첫 «계약서 아닌 것 아닌» 서류');
  assert.equal(PDF.pickContractAttIndex(A('메모.txt', '자문계약서_가나상사.hwp', '계약서_가나상사.pdf')), 2, '읽을 수 없는 확장자(txt·hwp)는 건너뛴다');
  assert.equal(PDF.pickContractAttIndex(null), -1);
  assert.equal(PDF.pickContractAttIndex(A('서류.pdf', '위임약정서_가나.pdf')), 1, '계약·약정·위임 말이 있는 것이 먼저');
});

/* ── 독립 검토 지적(2026-11-27) 보강 ── */
test('⑤ 사건 위임이 파일 이름의 상호·낱말(컨설팅·규정·진단) 때문에 컨설팅으로 바뀌지 않는다 — 파일 이름이 «유형 이름»을 말할 때만 컨설팅 단서', () => {
  const caseCf = { docName: '위임계약서', scope: '근로자 해고 구제 대리' };
  assert.equal(guess(Object.assign({ fileName: '위임계약서_한빛컨설팅_부당해고' }, caseCf)).kind, 'case', '상호의 «컨설팅» 낱말은 단서가 아니다');
  assert.equal(guess(Object.assign({ fileName: '위임계약서_가나상사_취업규칙' }, caseCf)).kind, 'case', '«규정·취업규칙» 낱말도');
  assert.equal(guess({ docName: '위임계약서', scope: '', fileName: '위임계약서_산업안전컨설팅_가나상사' }).kind, 'consulting', '유형 이름(산업안전컨설팅)을 말하면 컨설팅');
});

test('⑤ 종류만 따라가는 길(inferredKind)에서도 유형을 «목록 첫 번째»로 찍지 않는다 — 파일 이름이 유형을 말하면 그 유형', async () => {
  /* 서류 이름·범위에 단서가 없고 서버가 종류(consulting)만 알려 준 경우 — 옛 길은 목록 첫 번째(현장클리닉)를 찍었다 */
  const noType = await laneRun(REQ({ docName: '위임계약서', fileName: '위임계약서_가나상사', scope: '작업중지명령 해제 대응', fee: '3,300,000원' }, { inferredKind: 'consulting' }));
  assert.ok(noType.r.made, JSON.stringify(noType.r));
  assert.equal(noType.saved[0].kinds[0], 'consulting');
  assert.equal(noType.saved[0].typeCodes.consulting, '', '첫 번째(' + CLINIC.name + ')를 찍지 않는다');
  assert.match(noType.saved[0].checkReq.note, /유형/, '유형이 비었으니 확인 필요가 울린다');
  const named = await laneRun(REQ({ docName: '위임계약서', fileName: '위임계약서_산업안전컨설팅_가나상사', scope: '작업중지명령 해제 대응', fee: '3,300,000원' }, { inferredKind: 'consulting' }));
  assert.equal(named.saved[0].typeCodes.consulting, SAFETY.code, '파일 이름이 유형을 말하면 그 유형');
});

test('⑤ 기존 카드에 합칠 때 — 사람이 고른 유형을 «업무 범위» 문장이 덮지 않는다(서류 이름·파일 이름이 말할 때만 바로잡는다)', async () => {
  const cur = { id: 'ct-4', contractNo: '계약-2026-103', status: 'review', kinds: ['consulting'], companyName: '가나상사', bizNo: '1234567890',
    company: { name: '가나상사', bizNo: '1234567890' }, amounts: { consulting: 0 }, typeCodes: { consulting: SAFETY.code }, briefs: {}, srcMails: ['메일함|100'] };
  /* 서류 이름 «위임계약서»·파일 이름에 사업 이름 없음 — 범위 문장에만 «위험성평가» (유일하게 겹침) */
  const r = await laneRun(REQ({ docName: '위임계약서', fileName: '위임계약서_가나상사', scope: '위험성평가 컨설팅', fee: '3,300,000원' }, MERGE), { contracts: [cur] });
  assert.equal(r.saved[0].id, 'ct-4');
  assert.equal(r.saved[0].typeCodes.consulting, SAFETY.code, '사람이 고른 유형은 범위 문장 때문에 바뀌지 않는다');
  /* 대조군 — 카드 유형이 비어 있으면 범위에서라도 채운다 */
  const empty = await laneRun(REQ({ docName: '위임계약서', fileName: '위임계약서_가나상사', scope: '위험성평가 컨설팅', fee: '3,300,000원' }, MERGE), { contracts: [Object.assign({}, cur, { typeCodes: { consulting: '' } })] });
  assert.equal(empty.saved[0].typeCodes.consulting, RISK.code);
});

test('⑤ 기존 카드에 합칠 때는 «읽기 품질» 문구(readNote)만 옮기고 담당 확인 문구(checkReq)는 옮기지 않는다', async () => {
  const cur = { id: 'ct-5', contractNo: '계약-2026-104', status: 'review', kinds: ['consulting'], companyName: '가나상사', bizNo: '1234567890',
    company: { name: '가나상사', bizNo: '1234567890' }, amounts: { consulting: 1200000 }, typeCodes: { consulting: SAFETY.code }, briefs: {}, srcMails: ['메일함|100'] };
  const mgrOnly = await laneRun(REQ({ fee: '' }, Object.assign({}, MERGE, { checkReq: { at: '2026-11-26T00:00:00.000Z', by: '시스템(메일 자동검토)', note: '담당 노무사를 확인해 주세요' } })), { contracts: [cur] });
  assert.equal(mgrOnly.saved[0].id, 'ct-5');
  assert.equal(mgrOnly.saved[0].checkReq, undefined, '금액·유형이 이미 찬 카드에 담당 확인 문구만 있으면 새 확인 표시를 달지 않는다(옛 동작 그대로)');
  const withRead = await laneRun(REQ({ fee: '' }, Object.assign({}, MERGE, { readNote: '금액은 AI 가 못 읽어 본문에서 대신 읽었습니다', checkReq: { at: '2026-11-26T00:00:00.000Z', by: '시스템(메일 자동검토)', note: '담당 노무사를 확인해 주세요' } })), { contracts: [cur] });
  assert.match(withRead.saved[0].checkReq.note, /본문에서 대신 읽었습니다/);
  assert.doesNotMatch(withRead.saved[0].checkReq.note, /담당 노무사/);
});

test('④ 첨부 고르기 — «견적서_및_계약서» 같은 진짜 계약서는 건너뛰지 않는다', () => {
  assert.equal(PDF.pickContractAttIndex(A('견적서_및_계약서.pdf')), 0);
  assert.equal(PDF.pickContractAttIndex(A('통장사본.pdf', '계약서_사업자등록증사본포함.pdf')), 1);
  assert.equal(PDF.pickContractAttIndex(A('통장사본_계약금입금용.pdf')), -1, '«계약금» 은 계약서가 아니다');
  assert.equal(PDF.pickContractAttIndex(A('견적서_가나상사.pdf')), -1);
});
