'use strict';
/* 입금 알림 ↔ 거래내역 잇기 · 출금 「배운 것은 저절로 등록」 모든 PC 공통 (대표 「추천대로」 2026-09-27)

   ■ 무엇이 있었나
     문자 입금 알림(「💰 입금 사업장 확인」)과 거래내역이 따로 놀아 같은 입금을 두 번 손봐야 했다.
     「사무관리 입력·확인」은 계약관리로 «가기만» 했고, 짝 맞추기 추천은 거래내역에만 있었다.
     출금 「배운 것은 저절로 등록」은 PC 마다 따로라 한 PC 에서 켜도 다른 PC 는 꺼져 있었다.
   ■ 규칙
     ⓐ 거래내역에서 같은 날·같은 금액 «입금»이 처리되거나 보류되면 알림을 닫는다 — 메모로 잇지 않는다.
     ⓑ 같은 날·같은 금액 알림이 처리 기록보다 많으면 아무것도 안 닫는다(어느 것인지 모른다).
     ⓒ 출금 처리 기록으로는 입금 알림을 닫지 않는다.
     ⓓ 알림에서 거래내역의 그 줄로 곧장 간다(문자 번호가 먼저).
     ⓔ 저절로 등록 설정은 모든 PC 가 받는 칸(app_settings)에 적는다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripComments } = require('./strip-comments');

const RAW = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const SRC = stripComments(RAW);
function body(src, head) {
  const i = src.indexOf(head); if (i < 0) throw new Error('없음: ' + head);
  let j = src.indexOf('{', i), d = 0;
  for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (!d) break; } }
  return src.slice(i, j + 1);
}

/* 닫기 셈을 «그대로» 싣고 돌린다 — 서버 부름은 기록만 */
async function settle(alerts, processed, held) {
  const closed = []; const toast = [];
  const box = {
    console, Object, String, parseInt, Promise,
    _meNow: () => ({ isAdmin: true }),
    erpBankProcessedStore: () => processed,
    dbGet: (k, d) => (k === 'ledger_held' ? (held || []) : d),
    hanaSmsCall: (act, a) => { if (act === 'adminResolve') closed.push(a.alertKey); return Promise.resolve({ ok: true }); },
    setHanaAlerts: () => {}, showToast: (m) => toast.push(m),
    hanaSettleBusy: { current: false }
  };
  vm.createContext(box);
  vm.runInContext(body(SRC, 'function _hanaDA('), box);
  vm.runInContext(body(SRC, 'async function hanaSettleFromLedger('), box);
  await box.hanaSettleFromLedger(alerts);
  return closed;
}
const A = (k, date, amount) => ({ alertKey: k, date, amount, memo: '계좌번호 680******45904 가나상사', status: 'pending_review' });

test('ⓐ ★★ 거래내역에서 처리한 입금이면 알림을 닫는다 — 메모 꼴이 달라도(은행 엑셀)', async () => {
  const closed = await settle([A('k1', '2026-09-23', 330000)],
    { '2026-09-23|330000|가나상사자문료': { kind: 'income', date: '2026-09-23', amount: 330000, memo: '가나상사 자문료' } });
  assert.deepEqual(closed, ['k1'], '★★ 거래내역에서 확정했는데 알림이 그대로입니다 — 같은 입금을 두 번 손봐야 합니다');
});

test('ⓐ ★ 보류해도 닫는다', async () => {
  const closed = await settle([A('k1', '2026-09-23', 6000)], {}, [{ date: '2026-09-23', amount: 6000, memo: '홍길동' }]);
  assert.deepEqual(closed, ['k1']);
});

test('ⓑ ★★ 같은 날·같은 금액이 처리 기록보다 많으면 아무것도 안 닫는다', async () => {
  const closed = await settle([A('k1', '2026-09-23', 330000), A('k2', '2026-09-23', 330000)],
    { x: { kind: 'income', date: '2026-09-23', amount: 330000 } });
  assert.deepEqual(closed, [], '★★ 둘 중 어느 것이 처리됐는지 모르는데 닫았습니다');
});

test('ⓒ ★ 출금 처리로는 입금 알림을 안 닫는다 · 날이 다르면 안 닫는다', async () => {
  assert.deepEqual(await settle([A('k1', '2026-09-23', 50000)], { x: { kind: 'expense', date: '2026-09-23', amount: 50000 } }), []);
  assert.deepEqual(await settle([A('k1', '2026-09-23', 50000)], { x: { kind: 'income', date: '2026-09-22', amount: 50000 } }), []);
});

test('ⓓ ★★ 알림에서 거래내역의 그 입금 줄로 곧장 간다', () => {
  const modal = SRC.slice(SRC.indexOf("'aria-label':'입금 사업장 확인 알림'"), SRC.indexOf('hanaFixModal(),'));
  assert.match(modal, /onClick:function\(\)\{hanaJumpTo\(a\);\}/, '★★ 알림에 거래내역으로 가는 단추가 없습니다');
  const jump = body(SRC, 'function hanaJumpTo(');
  assert.match(jump, /setLdStF\(''\)/, '★ 상태 거르개를 안 풀어 줄이 안 보일 수 있습니다');
  assert.match(jump, /setLdOnlyToday\(false\)/, '★ 「오늘만」을 안 풀어 줄이 안 보일 수 있습니다');
  const at = SRC.indexOf('if(!hanaJump) return;');
  assert.ok(at > 0, '★★ 넘어온 줄을 찾는 자리가 없습니다');
  const eff = SRC.slice(at, at + 900);
  assert.ok(eff.indexOf('originId === hanaJump.txId') > 0, '★ 문자 번호로 먼저 찾지 않습니다');
  assert.match(eff, /same\.length === 1/, '★★ 같은 날·같은 금액이 여럿인데 아무거나 엽니다');
  assert.match(eff, /showToast\(/, '★ 못 찾으면 까닭을 안 말합니다');
});

test('ⓔ ★★ 「배운 것은 저절로 등록」은 모든 PC 가 받는 칸에 적는다', () => {
  const at = SRC.indexOf('function setExpAutoReg(');
  assert.ok(at > 0);
  assert.match(SRC.slice(at, at + 300), /dbSet\('app_settings', Object\.assign\(\{\}, cur, \{ ledgerExpAutoReg:v \}\)\)/,
    '★★ 설정이 이 PC 에만 남습니다 — 다른 PC 는 꺼진 채라 출금 미처리가 쌓입니다');
  /* app_settings 는 부팅 때 모든 PC 가 받는 명단에 있어야 한다 */
  const list = SRC.slice(SRC.indexOf('var FB_ALL_SYNC_KEYS = ['), SRC.indexOf('];', SRC.indexOf('var FB_ALL_SYNC_KEYS = [')));
  assert.ok(list.indexOf("'app_settings'") > 0, '★★ app_settings 가 동기화 명단에 없습니다');
});
