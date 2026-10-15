/* 이알피 화면 — 근로자 주민번호·계좌·예금주를 담당자에게만 (대표 결정 2026-10-15)
 *   ① 칸 함수(erpWsCell): 담당자면 입력 칸, 아니면 「🔒 담당자만」/「—」 — 돌려 본다
 *   ② 계약·사건 창에 «날것» 입력 칸(value:w.rrn 를 바로 그리는 input)이 남지 않았다
 *   ③ 이관·되돌리기는 출발 건을 휴지통에 보내기 «전»에 담당자 칸을 옮긴다
 *   ④ 옮기지 못하면 조용히 넘기지 않고 알린다 — 돌려 본다
 *   ⑤ 서식 채우기는 담당자 칸을 붙인 뒤 채운다
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ERP = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const 걷기 = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

function 떠오기(head) {
  const at = ERP.indexOf(head);
  assert.ok(at >= 0, head + ' 를 못 찾았습니다');
  let i = ERP.indexOf('{', at), d = 0;
  for (; i < ERP.length; i++) { const c = ERP[i]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) break; } }
  return ERP.slice(at, i + 1);
}

test('★★ ① 칸 함수 — 담당자면 입력 칸, 아니면 잠김(있으면 🔒·없으면 —)', () => {
  const ctx = { Object, h: (tag, props, kid) => ({ tag, props, kid }) };
  vm.createContext(ctx);
  vm.runInContext(떠오기('function erpWsCell(state, wk, field, inputProps)') + '\nthis.f = erpWsCell;', ctx);
  const props = { value: '900101-1000000', style: { padding: '1px' } };
  assert.equal(ctx.f('ok', {}, 'rrn', props).tag, 'input');
  const lock = ctx.f('denied', { hasRrn: true }, 'rrn', props);
  assert.equal(lock.tag, 'span');
  assert.equal(lock.kid, '🔒 담당자만');
  assert.equal(JSON.stringify(lock).indexOf('900101') < 0, true, '★★ 잠김 칸에 번호가 실립니다');
  assert.equal(ctx.f('denied', {}, 'rrn', props).kid, '—');
  assert.equal(ctx.f('denied', { hasAccount: true }, 'holder', props).kid, '🔒 담당자만', '예금주는 계좌 표시를 따른다');
  assert.notEqual(ctx.f('loading', {}, 'rrn', props).tag, 'input', '불러오는 중에 빈 입력 칸을 내면 «없다»로 읽혀 지워질 수 있다');
});

test('★★ ② 계약·사건 창에 날것 입력 칸이 남지 않았다', () => {
  const 창 = 걷기(떠오기('function ContractModal(') + 떠오기('function CaseEditModal('));
  const raw = 창.match(/h\('input',\s*\{[^}]*value:\s*(wk|w)\.(rrn|account|holder)\b/g) || [];
  assert.deepEqual(raw, [], '★★ 담당자가 아니어도 그리는 주민번호·계좌 입력 칸이 있습니다');
  const cells = 창.match(/erpWsCell\(wsState, (wk|w), '(rrn|account|holder)'/g) || [];
  assert.ok(cells.length >= 7, '칸 함수를 쓰는 자리가 너무 적습니다(' + cells.length + ') — 계약 1 + 사건 6');
  assert.match(창, /useErpWorkerSecret\('contracts', f\.id, setF/);
  assert.match(창, /useErpWorkerSecret\('cases', f\.id, setF/);
});

test('★ 붙여넣기·통장 채우기도 담당자만', () => {
  const ct = 걷기(떠오기('function ContractModal('));
  assert.match(ct, /fields\[i\] === 'rrn' && wsState !== 'ok'/, '이름 칸 붙여넣기가 주민번호를 받습니다');
  assert.match(ct, /if\(wsState === 'ok'\) nwk\.rrn/, '엑셀 일괄 붙여넣기가 주민번호를 받습니다');
  const cs = 걷기(떠오기('function CaseEditModal('));
  assert.match(cs, /function bankBtn\(w, wi\)\{\s*if\(wsState !== 'ok'\) return null;/, '「📗 통장」 단추가 담당자가 아니어도 보입니다');
});

test('★★ ③ 이관 — 새 건 저장 뒤, 휴지통 «전»에 옮긴다', () => {
  const tr = 걷기(떠오기('function transferContract(contract, opt)'));
  assert.match(tr, /dbUpsert\('cases', newCase\)\)[^\n]*\n[^\n]*erpWsCarry\('contracts', contract\.id, 'cases', newCase\.id\)/);
  assert.match(tr, /erpWsCarry\('contracts', contract\.id, storageMap\[kindV\], item2\.id\)/);
  const rt = 걷기(떠오기('async function returnToContract(storeKey, itemId)'));
  const parks = [...rt.matchAll(/ctReturnPark\(/g)].map((m) => m.index);
  const carries = [...rt.matchAll(/erpWsCarry\(storeKey, itemId, 'contracts'/g)].map((m) => m.index);
  assert.equal(carries.length, 2, '되돌리기 두 길 모두 옮겨야 한다');
  carries.forEach((c, i) => assert.ok(c < parks[i], '★★ 휴지통에 보낸 «뒤»에 옮깁니다 — 규칙이 출발 건의 담당자를 몰라 거절됩니다'));
});

test('★★ ④ 옮기지 못하면 알린다', async () => {
  const toasts = [];
  const ctx = { window: {}, fbDb: {}, toasts, showToast: (m) => toasts.push(m), console: { warn() {} }, Date };
  ctx.window.PuWorkerSecret = { carry: async () => ({ ok: false, denied: true }) };
  ctx.PuWorkerSecret = ctx.window.PuWorkerSecret;
  vm.createContext(ctx);
  vm.runInContext(떠오기('function _wsFail(r)') + '\n' + 'var _wsToastAt = 0;\n' + 떠오기('function erpWsCarry(srcKind, srcId, dstKind, dstId)') + '\nthis.f = erpWsCarry;', ctx);
  ctx.f('contracts', 'ct-1', 'cases', 'c-1');
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(toasts.length, 1, '★★ 주민번호를 못 옮겼는데 아무 말이 없습니다');
  assert.match(toasts[0], /옮기지 못했습니다/);
});

test('⑤ 서식 채우기는 담당자 칸을 붙인 뒤 채운다', () => {
  const pm = 걷기(떠오기('function ContractFormPrintModal(props)'));
  assert.match(pm, /PuWorkerSecret\.read\(fbDb, 'contracts', c\.id\)/);
  assert.match(pm, /if\(ready && wsContract\) return h\(ContractFormPrintBody/);
});
