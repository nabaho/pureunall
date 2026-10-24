// 재무 손질 (대표 「시안대로」 2026-10-24) — 예상부가세가 세금계산서 보관함을 읽고, 세금계산서 업로드 칸은 한 줄
// 전: 예상부가세가 «발행관리» 목록(finance_invoice)만 읽어 실제로 끊은 계산서가 수백 건인데 0건·0원이었다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { stripComments } = require('./strip-comments');

const SRC = stripComments(fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n'));
const cut = (a, b) => { const i = SRC.indexOf(a); return i < 0 ? '' : SRC.slice(i, SRC.indexOf(b, i + a.length)); };
const VAT = cut('function FinanceVAT(', '\nfunction ');
const INV = cut('function FinanceInvoice(', '\nfunction ');

test('① ★★ 예상부가세가 보관함(_erpInvArch)도 센다 — 공급가액 × 10%', () => {
  assert.ok(VAT, 'FinanceVAT 를 못 찾았습니다');
  assert.match(VAT, /_erpInvArch/, '★★ 보관함을 안 읽습니다 — 다시 0건이 됩니다');
  assert.match(VAT, /quarterArchive\(/, '★ 분기별로 보관함 줄을 안 고릅니다');
  assert.match(VAT, /archSupply \* 0\.1/, '★ 보관함 부가세를 공급가액의 10% 로 안 셉니다');
  assert.match(VAT, /totalInvoice \+= archSupply/, '★ 「발행 합계」에 보관함 공급가액이 안 들어갑니다');
});

test('② ★ 보관함이 늦게 도착해도 다시 그린다 · 발행관리와 같은 줄은 한 번만', () => {
  assert.match(VAT, /addEventListener\('pureun-invidx'/, '★ 보관함이 나중에 도착하면 0 으로 남습니다');
  assert.match(VAT, /_erpInvArchLoad\(\)/, '★ 보관함 읽기를 시작하지 않습니다');
  assert.match(VAT, /_manualKey\[k\]/, '★★ 발행관리와 보관함에 같은 계산서가 있으면 두 번 셉니다');
});

test('③ ★ 업로드 칸은 한 줄 단추(FileDropBtn) — 큰 놓기 상자가 아니다', () => {
  const up = INV.slice(INV.indexOf('var uploadArea'), INV.indexOf('if(invoiceCompanies.length === 0)'));
  assert.ok(up.length > 0, '업로드 칸을 못 찾았습니다');
  assert.match(up, /h\(FileDropBtn,/, '★ 업로드 칸이 한 줄 단추가 아닙니다');
  assert.doesNotMatch(up, /h\(FileDropZone,/, '★ 큰 놓기 상자가 다시 들어갔습니다 — 위가 밀립니다');
  assert.match(up, /handleInvoiceUpload/, '★★ 파일을 골라도 올리지 않습니다');
  assert.match(up, /clearInvoiceArchive/, '★ 전체 삭제가 사라졌습니다');
});

test('④ ★ 업체별 아카이브 두 목록은 창 바닥까지(고정 px 아님)', () => {
  assert.match(INV, /useFillHeight\(240, 0, true\)/, '★ 아카이브 높이를 창에 맞추지 않습니다');
  assert.match(INV, /h\('div', \{ ref:[A-Za-z_$][\w$]*\.ref, style:\{ display:'grid'/, '★ 높이 재는 자리가 아카이브 목록 칸에 안 붙었습니다');
  assert.doesNotMatch(INV, /maxHeight:'600px'/, '★ 600px 고정이 돌아왔습니다 — 창이 작으면 위가 밀립니다');
});
