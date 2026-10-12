/* 이관이 업체 연결 때문에 막히면 «이유를 창으로» 알린다 (2026-10-12 대천맛김 계약-2026-124)
   까닭: 연결 방식이 비어 이관이 조용히 막혔고(알림 한 줄뿐), 계약확정 칸에 그대로 남아 대표는 이관한 줄 알았다.
   규칙: ① 연결 방식이 비면 사유 글이 나온다 ② 연결 보류(신규)·업체 연결이면 막지 않는다
        ③ doTransfer 는 이관 처리 «전에» 이 사유를 보고 창으로 알린다. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
function cutFn(h) { const i = src.indexOf(h); assert.ok(i >= 0, h + ' 를 못 찾음'); let j = src.indexOf('{', i), d = 0;
  for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) break; } return src.slice(i, j + 1); }

function build(companies) {
  const ctx = { console, Date, Math, JSON, Object, Array, String, Number, RegExp, Set, Map, Error, parseInt, isNaN, setTimeout, Promise };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-ontology.js'), 'utf8'), ctx);
  ctx.dbGet = (k, d) => (k === 'companies' ? companies : d);
  vm.runInContext(cutFn('function erpDropDeadCoLink(') + '\n' + cutFn('function erpTransferBlockReason('), ctx);
  return ctx;
}
const base = { id: 'ct-x', contractNo: '계약-2026-900', companyName: '새로운(주)', bizNo: '1112233334', kinds: ['consulting'], company: { name: '새로운(주)', bizNo: '1112233334' } };

test('연결 방식이 비어 있으면 사유 글이 나온다', () => {
  const ctx = build([]);
  const why = ctx.erpTransferBlockReason(base);
  assert.ok(why && why.length > 5, '사유가 비어 있음');
});

test('신규 업체 «연결 보류» 이면 막지 않는다', () => {
  const ctx = build([]);
  assert.equal(ctx.erpTransferBlockReason(Object.assign({}, base, { companyLinkStatus: 'pending' })), '');
});

test('업체 ID 로 연결돼 있으면 막지 않는다', () => {
  const co = { id: 'co-1', name: '새로운(주)', bizNo: '111-22-33334', typeCode: '자문', status: 'active' };
  const ctx = build([co]);
  const c = Object.assign({}, base, { companyId: 'co-1', companyLinkStatus: 'linked', company: Object.assign({}, base.company, { companyId: 'co-1' }) });
  assert.equal(ctx.erpTransferBlockReason(c), '');
});

test('doTransfer 는 이관 처리 전에 사유를 보고 창으로 알린다', () => {
  const a = src.indexOf('erpTransferBlockReason(ct)');
  const b = src.indexOf('results = transferContract(ct, _xferOpt)');
  assert.ok(a > 0 && b > 0, '두 호출을 못 찾음');
  assert.ok(a < b, '사유 확인이 이관 처리보다 앞에 있어야 함');
  assert.ok(b - a < 20000, '같은 함수 안이어야 함');
  assert.match(src.slice(a, a + 900), /popConfirm\(/, '알림 한 줄(showToast)이 아니라 창(popConfirm)으로 알린다');
});
