'use strict';
/* 계약 여러 건 → 한 번에 채우기 (서식 묶음 설계 2026-09-28 상황 1-C, 대표 「진행」 2026-10-03)
   ⓐ 이알피 계약판(끌어 옮기는 칸반)은 그대로 — 고르는 목록은 문서관리 「📦 계약 여러 건」 창에
   ⓑ 계약마다 이알피와 같은 규칙(contractPick)으로 양식을 고르고, 같은 한 벌(PuContractVars) 값으로 채운다
   ⓒ 하나씩 차례로(한글 엔진 메모리), 한 건이 실패해도 나머지는 계속, 결과를 계약마다 보인다
   ⓓ .zip 하나 — 계약마다 폴더(번호_계약번호_회사), 파일 이름은 묶음 채우기와 같은 규칙
   ⓔ 창은 db 를 만지지 않는다 — 계약 읽기는 host(contractList·contractLoad) */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');
const { stripJs } = require('./strip-comments');
const { cutFn } = require('./cut-fn');
const R = path.join(__dirname, '..');
const rd = (f) => fs.readFileSync(path.join(R, f), 'utf8').replace(/\r\n/g, '\n');
const CFJ = rd('js/pu-contract-forms.js'), DOCS = rd('docs-esign.html');
function loadCF() {
  const box = { console, Date, Math, JSON, Promise, Object, Array, String, Number, Error, setTimeout, clearTimeout };
  box.window = box; vm.createContext(box); vm.runInContext(CFJ, box);
  return box.PuContractForms;
}

test('ⓓ 계약 폴더 이름 — 번호_계약번호_회사, 위험한 글자 걷기', () => {
  const P = loadCF();
  assert.strictEqual(P.contractFolder({ contractNo: 'C-2026-001', vals: { 회사명: '가나상사(주)' } }, 0), '01_C-2026-001_가나상사(주)');
  assert.strictEqual(P.contractFolder({ contractNo: '', id: 'ct9', vals: { 회사명: 'A/B:C' } }, 11), '12_ct9_A_B_C');
  assert.strictEqual(P.contractFolder({ vals: {} }, 2), '03_계약');
});
test('ⓑ 계약 값 → 채울 값 — 기업정보함 기본값 위에 계약 값(빈 값은 덮지 않음)', () => {
  const box = { console, Date, Math, JSON, Promise, Object, Array, String, Number, Error, setTimeout, clearTimeout };
  box.window = box; vm.createContext(box);
  vm.runInContext(rd('js/pu-form-cardfill.js'), box); box.PuFormCardFill = box.module ? box.module.exports : box.PuFormCardFill;
  vm.runInContext(CFJ, box);
  const V = box.PuContractForms.contractValues({ vals: { 회사명: '가나상사', 주소: '천안시 가나로 1', 계약번호: 'C-1', 계약일: '2026-10-01', 담당자: '' } });
  assert.strictEqual(V.회사명, '가나상사');
  assert.strictEqual(V.계약번호, 'C-1');
  assert.strictEqual(V.계약일, '2026-10-01', '계약일이 오늘 날짜로 덮였습니다');
  assert.ok(/천안시 가나로 1$/.test(V.우편주소), '주소에서 만드는 칸(우편주소)이 비었습니다');
  assert.ok(V.오늘날짜, '오늘 날짜 같은 기본값이 사라졌습니다');
});
test('ⓒⓔ 창 — 하나씩 차례로, 실패는 계속, contractPick·fillFormOnce·host.zip, db 안 만짐', () => {
  const m = cutFn(stripJs(CFJ), 'function mount(');
  const o = cutFn(m, 'function openContracts(');
  assert.match(o, /host\.contractList\(/);
  assert.match(o, /host\.contractLoad\(/);
  assert.match(o, /contractPick\(S\.forms, Object\.assign\(\{ sets: S\.sets \}, info\)\)/);
  assert.match(o, /fillFormOnce\(/);
  assert.match(o, /host\.zip\(/);
  assert.match(o, /\.reduce\(function \(p, /, '계약을 한꺼번에 채웁니다 — 하나씩 차례로');
  assert.match(o, /if \(busy\) return;/);
  assert.ok(!/db\.ref|changeForms/.test(o), '창이 db 를 직접 만집니다');
  assert.match(cutFn(m, 'function toolItems('), /📦 계약 여러 건/);   // 2026-10-07 화면 개편 — ⋯ 메뉴로
});
test('ⓔ 문서관리 host — 계약 목록·계약 읽기는 한 번 읽은 자료를 같이 쓴다(읽기만)', () => {
  const s = stripJs(DOCS);
  assert.match(DOCS, /contractList: formContractList/);
  const d = cutFn(s, 'async function formContractData(');
  assert.match(d, /'data\/contracts'/);
  assert.ok(!/\.set\(|\.update\(|\.push\(|\.transaction\(/.test(d), '계약 자료에 씁니다');
  assert.match(cutFn(s, 'async function formContractList('), /formContractData\(/);
  assert.match(cutFn(s, 'async function formContract('), /formContractData\(/);
});
