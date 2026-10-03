'use strict';
/* 이알피 계약 → 문서관리 「📦 서류 묶음 채우기」 (설계 2026-10-03-계약서류-표준-기록 §4, 대표 「6 진행」)
   ⓐ 이알피는 계약 «번호(id)»만 들고 문서관리를 연다 — 금액·이름을 주소에 싣지 않는다
   ⓑ 문서관리는 계약을 읽어 «이알피와 같은 한 벌»(PuContractVars)로 값을 만든다
   ⓒ 고르는 양식은 이알피 「계약서 출력」 자동 체크와 같은 규칙(자문·급여 묶음, 사건유형, 제안서 제외)
   ⓓ 채우기 창은 계약 값을 섞되 «계약 칸»은 계약 값이 이기고, 회사 칸은 고른 회사가 먼저(비면 계약 값)
   ⓔ 계약 자료 쓰는 중임을 화면에 보이고 풀 수 있다 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');
const { stripJs } = require('./strip-comments');
const { cutFn } = require('./cut-fn');
const R = path.join(__dirname, '..');
const rd = (f) => fs.readFileSync(path.join(R, f), 'utf8').replace(/\r\n/g, '\n');
const ERP = rd('pu-erp.html'), DOCS = rd('docs-esign.html'), CFJ = rd('js/pu-contract-forms.js');
function loadCF() {
  const box = { console, Date, Math, JSON, Promise, Object, Array, String, Number, Error, setTimeout, clearTimeout };
  box.window = box; vm.createContext(box); vm.runInContext(CFJ, box);
  return box.PuContractForms;
}
const out = (v) => JSON.parse(JSON.stringify(v));

test('ⓐ 이알피 — 계약서 출력 창에 「📦 문서관리에서 묶음 채우기」, id 만 들고 새 탭', () => {
  const s = stripJs(ERP);
  assert.match(s, /📦 문서관리에서 묶음 채우기/);
  assert.match(s, /'docs-esign\.html#forms:contract=' \+ encodeURIComponent\(contract\.id\)/);
});
test('ⓑ 문서관리 — 계약을 읽어 PuContractVars 로, 열쇠를 양식 번호로 착각하지 않는다', () => {
  const f = cutFn(stripJs(DOCS), 'async function formContract(');
  assert.match(f, /PuContractVars\.contractVars\(/);
  assert.match(f, /'data\/contracts'/);
  assert.match(f, /'data\/user_dir'/);
  assert.match(f, /numToKorMoney/);
  assert.match(cutFn(stripJs(DOCS), 'function formFromHash('), /#forms:contract=/);
  assert.match(DOCS, /contract: contractFromHash\(\), contractLoad: formContract/);
});
test('ⓒ contractPick — 이알피 자동 체크와 같은 규칙', () => {
  const P = loadCF();
  const F = [
    { id: 'fm-pr-advisory', kind: 'company' }, { id: 'fm-pr-cms', kind: 'company' }, { id: 'fm-pr-payroll', kind: 'company' },
    { id: 'fm-pr-pension', kind: 'company' }, { id: 'fm-2', kind: 'company' },
    { id: 'c1', kind: 'case', groupName: '체당금' }, { id: 'c2', kind: 'case', groupName: '부해등' },
    { id: 'f1', kind: 'fund' }, { id: 'p1', kind: 'fund', groupName: '제안서·견적서' }, { id: 'off', kind: 'fund', enabled: false }
  ];
  assert.deepStrictEqual(out(P.contractPick(F, { kinds: ['company'], typeCode: '자문' })), ['fm-pr-advisory', 'fm-pr-cms']);
  assert.deepStrictEqual(out(P.contractPick(F, { kinds: ['company'], typeCode: '급여' })), ['fm-pr-cms', 'fm-pr-payroll', 'fm-pr-pension']);
  assert.deepStrictEqual(out(P.contractPick(F, { kinds: ['company'], typeCode: '' })), ['fm-pr-advisory', 'fm-pr-cms', 'fm-pr-payroll', 'fm-pr-pension', 'fm-2']);
  assert.deepStrictEqual(out(P.contractPick(F, { kinds: ['case'], caseName: '체당금' })), ['c1']);
  assert.deepStrictEqual(out(P.contractPick(F, { kinds: ['case'], caseName: '' })), ['c1', 'c2']);
  assert.deepStrictEqual(out(P.contractPick(F, { kinds: ['fund'] })), ['f1'], '제안서·꺼진 양식은 고르지 않는다');
  assert.deepStrictEqual(out(P.contractPick(F, { kinds: ['company', 'fund'], typeCode: '자문' })), ['fm-pr-advisory', 'fm-pr-cms', 'f1']);
});
test('ⓒ 자문·급여 묶음 번호가 이알피와 같은 글자', () => {
  const P = loadCF();
  const a = /var advisorySet = (\[[^\]]*\])/.exec(ERP), b = /var payrollSet = (\[[^\]]*\])/.exec(ERP);
  assert.ok(a && b, '이알피 자동 체크 묶음을 못 찾았습니다');
  assert.deepStrictEqual(out(P.CONTRACT_SETS.advisory), JSON.parse(a[1].replace(/'/g, '"')));
  assert.deepStrictEqual(out(P.CONTRACT_SETS.payroll), JSON.parse(b[1].replace(/'/g, '"')));
});
test('ⓓ 채우기 창 — 계약 값을 섞는다(계약 칸은 계약이, 나머지는 비었을 때만), 고친 값이 마지막', () => {
  const f = cutFn(stripJs(CFJ), 'function openFill(');
  const v = cutFn(f, 'function values(');
  const iC = v.indexOf('host.contractCtx'), iE = v.indexOf('st.edits');
  assert.ok(iC > 0 && iE > iC, '계약 값이 고친 값보다 뒤에 섞입니다');
  assert.match(v, /CONTRACT_WINS\.test\(k\) \|\| !V\[k\]/);
  assert.match(f, /host\.propose \|\| \(host\.contractCtx && host\.contractCtx\.coKey\)/, '계약 회사를 골라 두지 않습니다');
  const P = loadCF();
  ['계약번호', '계약일', '계약금액', '계약금액한글', '계약기간', '성공보수', '주담당', '부가세처리', '납부일'].forEach(k => assert.ok(P.CONTRACT_WINS.test(k), k));
  ['회사명', '대표자', '근로자명', '담당자'].forEach(k => assert.ok(!P.CONTRACT_WINS.test(k), k));
});
test('ⓔ 화면 — 계약 자료 쓰는 중 칩(✕ 로 풀기), 처음 한 번만 계약을 연다', () => {
  const m = cutFn(stripJs(CFJ), 'function mount(');
  assert.match(m, /if \(host\.contract && !S\.contractTried\)/);
  const o = cutFn(m, 'function openContract(');
  assert.match(o, /host\.contractLoad\(host\.contract\)/);
  assert.match(o, /contractPick\(S\.forms, info\)/);
  assert.match(o, /S\.checked = ids\.slice\(\)/);
  const bar = cutFn(m, 'function filterBar(');
  assert.match(bar, /host\.contractCtx/);
  assert.match(bar, /host\.contractCtx = null/);
});

test('ⓒ 사건유형 번호 → 이름이 이알피 BIZ_CASE_SEED 와 같은 글자, 문서관리는 사건유형 표를 읽지 않는다', () => {
  const P = loadCF();
  const seed = ERP.slice(ERP.indexOf('var BIZ_CASE_SEED = ['), ERP.indexOf('];', ERP.indexOf('var BIZ_CASE_SEED = [')));
  const pairs = {}; seed.replace(/code:'([^']+)'[^}]*name:'([^']+)'/g, (a, c, n) => { pairs[c] = n; return a; });
  assert.ok(Object.keys(pairs).length >= 13, '이알피 사건유형 시드를 못 읽었습니다');
  assert.deepStrictEqual(out(P.CASE_CODES), pairs);
  const f = cutFn(stripJs(DOCS), 'async function formContract(');
  assert.ok(!/biz_case_types/.test(f), '사건유형 표를 읽습니다 — 규칙에 이름 없는 자리');
  assert.match(f, /c\.caseType \|\| PuContractForms\.CASE_CODES\[caseCode\]/);
});
