/* 이관이 막히면 «이유와 푸는 길»을 팝업으로 알린다 (2026-10-12 대천맛김 계약-2026-124, 대표 지시)
   까닭: 연결 방식이 비어 이관이 조용히 막혔고(알림 2초), 계약확정 칸에 그대로 남아 대표는 이관한 줄 알았다.
   규칙: ① 연결 방식이 비면 사유 글이 나온다 ② 연결 보류(신규)·업체 연결이면 막지 않는다
        ③ 막히는 «모든» 경우 — 사유마다 푸는 길이 붙는다
        ④ 검증 함수들이 알림으로만 알리던 글도 모아 팝업으로 다시 보인다
        ⑤ doTransfer·재이관은 알림 한 줄로만 끝나지 않는다.
        ⑥ 막힘 창은 «알림창»(단추 하나)이다 — 확인 안 된 상태에서 고르는 창(popConfirm)을 열지 않는다
           (온톨로지 규칙: 부분 이관·번호 단독 연결을 완료 근거로 삼지 않는다 — tests/ontology-intake.test.js). */
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
/* 사업자번호는 «123-» 으로 시작하는 가짜만 쓴다 — 저장소가 공개라 실제 사업장을 가리키면 안 된다
   (tests/no-real-client-data.test.js) */
const base = { id: 'ct-x', contractNo: '계약-2026-900', companyName: '새로운(주)', bizNo: '1234567890', kinds: ['consulting'], company: { name: '새로운(주)', bizNo: '1234567890' } };

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
  const co = { id: 'co-1', name: '새로운(주)', bizNo: '123-45-67890', typeCode: '자문', status: 'active' };
  const ctx = build([co]);
  const c = Object.assign({}, base, { companyId: 'co-1', companyLinkStatus: 'linked', company: Object.assign({}, base.company, { companyId: 'co-1' }) });
  assert.equal(ctx.erpTransferBlockReason(c), '');
});

test('사유마다 푸는 길이 붙는다 — 업체 연결·담당자·원본 변경·서버 저장', () => {
  const c = { window: {} }; vm.createContext(c);
  vm.runInContext(cutFn('function erpXferFixFor('), c);
  assert.match(c.erpXferFixFor('업체를 선택하거나 신규·미확정 업체는 연결 보류를 선택하세요.'), /업체 연결 확인/);
  assert.match(c.erpXferFixFor('명부에서 사번을 유일하게 확인할 수 없습니다: P-004'), /담당자/);
  assert.match(c.erpXferFixFor('원본 계약이 변경됐습니다. 다시 열고 이관하세요.'), /새로고침/);
  assert.match(c.erpXferFixFor('서버 저장 확인 실패 (기술보호-2026-011)'), /새로고침/);
  assert.ok(c.erpXferFixFor('처음 보는 사유').length > 10, '모르는 사유도 빈 말로 두지 않는다');
});

test('이관 중 뜬 알림 글을 모아 두고, stop 뒤에는 모으지 않는다', () => {
  const ctx = { window: {} }; vm.createContext(ctx);
  vm.runInContext(cutFn('function erpXferToastCapture('), ctx);
  const seen = [];
  ctx.window.showToast = (m) => seen.push(m);
  const cap = ctx.erpXferToastCapture();
  ctx.window.showToast('원본 계약이 변경됐습니다.');
  const got = cap.stop();
  assert.equal(JSON.stringify(got), JSON.stringify(['원본 계약이 변경됐습니다.']));
  assert.deepEqual(seen, ['원본 계약이 변경됐습니다.'], '알림은 그대로 뜬다');
  ctx.window.showToast('뒤 알림');
  assert.equal(got.length, 1, 'stop 뒤에는 모으지 않는다');
});

test('doTransfer 는 이관 처리 전에 사유를 보고, 막힘을 알림 한 줄로만 끝내지 않는다', () => {
  const a = src.indexOf('erpTransferBlockReason(ct)');
  const b = src.indexOf('results = transferContract(ct, _xferOpt)');
  assert.ok(a > 0 && b > 0, '두 호출을 못 찾음');
  assert.ok(a < b, '사유 확인이 이관 처리보다 앞에 있어야 함');
  assert.ok(b - a < 20000, '같은 함수 안이어야 함');
  assert.match(src.slice(a, a + 300), /erpXferBlockedPopup\(/, '창으로 알린다');
  const i = src.indexOf('async function doTransfer(');
  const head = src.slice(i, b);
  assert.doesNotMatch(head, /showToast\('(계약유형 없음|⚠ '\+_unverifiedT|⚠ 일부 업무만)/, '막힘 알림 한 줄이 남아 있다');
  assert.match(src.slice(b, b + 2500), /erpXferBlockedPopup\(ct, _tmsgs/, '검증 함수가 알린 글을 팝업으로 다시 보인다');
  assert.match(src, /erpXferBlockedPopup\(ct, _rmsgs/, '종료관리 재이관도 팝업');
});

test('막힘 창은 알림창이다 — 고르는 창(popConfirm)을 열지 않고, 알림 한 줄에도 사유를 남긴다', async () => {
  const toasts = [], alerts = [];
  const ctx = { window: {}, String, Promise,
    popConfirm: async () => { throw new Error('막힘을 알리는데 고르는 창을 열었다'); },
    showToast: (m) => toasts.push(String(m)) };
  ctx.window.showAlert = async (m, o) => { alerts.push({ m: String(m), o: o || {} }); };
  vm.createContext(ctx);
  vm.runInContext(cutFn('function erpXferFixFor(') + '\n' + cutFn('async function erpXferBlockedPopup('), ctx);
  const why = '일부 업무만 이관된 기록이 있습니다. 계약은 완료 처리하지 않았습니다.';
  const ret = await ctx.erpXferBlockedPopup(base, why);
  assert.equal(ret, undefined, '알림창은 «고른 값»을 돌려주지 않는다 — 돌려주면 그 값으로 이어 가는 길이 생긴다');
  assert.ok(alerts.length >= 1, '창을 띄우지 않았다');
  assert.ok(alerts[0].m.includes(why) && alerts[0].m.includes(ctx.erpXferFixFor(why)), '창에 사유와 푸는 길이 함께 있어야 함');
  assert.ok(String(alerts[0].o.title || '').includes(base.contractNo), '어느 계약인지 창 머리에 보여야 함');
  assert.ok(toasts.some((t) => t.includes(why)), '알림 한 줄에도 사유가 남아야 함');
  delete ctx.window.showAlert;
  await ctx.erpXferBlockedPopup(base, why);
  assert.ok(toasts.filter((t) => t.includes(why)).length >= 2, '알림창이 없는 자리에서도 사유는 알림으로 남는다');
});
