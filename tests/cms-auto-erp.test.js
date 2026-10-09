/* 이알피 CMS 자동 처리 접착부 — 스위치·쓰는 문·통장 줄은 표시만 (2026-10-09) */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
function noComments(s) { return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); }
function cutFn(h) { const i = src.indexOf(h); assert.ok(i >= 0, h + ' 를 못 찾음'); let j = src.indexOf('{', i), d = 0;
  for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) break; } return noComments(src.slice(i, j + 1)); }

test('모듈을 캐시 번호와 함께 싣는다', () => {
  assert.match(src, /<script src="js\/pu-cms-auto\.js\?v=\d+"><\/script>/);
});
test('스위치가 꺼져 있으면 쓰지 않는다 — 쓰기 앞에 cmsAutoConfirm 확인', () => {
  const b = cutFn('function erpCmsAutoRun(');
  assert.match(b, /cmsAutoConfirm\s*===\s*true/);
  const iSw = b.search(/cmsAutoConfirm\s*===\s*true/), iW = b.search(/erpUpsertIncome\(/);
  assert.ok(iSw >= 0 && iW > iSw, '스위치 확인이 쓰기보다 앞에 있어야 한다');
  const iL = b.search(/erpCmsLedgerSave\(/);
  assert.ok(iL > iSw, 'cms_ledger 저장도 스위치 확인 뒤');
  assert.match(b.slice(Math.max(0, iL - 80), iL), /canWrite/, 'cms_ledger 저장은 canWrite 일 때만');
});
test('입금은 erpUpsertIncome 문으로만, 통장 줄은 처리됨 표시만', () => {
  const b = cutFn('function erpCmsAutoRun(');
  assert.doesNotMatch(b, /dbUpsert\(\s*['"]finance_income/, 'finance_income 을 직접 쓰지 않는다');
  assert.match(b, /erpMarkBankRowProcessed\(/);
  assert.doesNotMatch(b, /dbSet\(\s*['"]finance_income/);
});
test('관리자만 돈다', () => {
  assert.match(cutFn('function erpCmsAutoRun('), /isAdminByUser\(\s*CURRENT_USER\s*\)/);
});

/* ── 실제로 돌려 본다 — 스텁을 꽂은 vm 안에서 erpCmsAutoRun 을 실행 ── */
const vm = require('vm');
function runErp(opts) {
  const calls = { upsert: [], mark: [], ledgerSave: 0 };
  const row = { _k: 'k1', code: '1001', name: '가나상사', amount: 220000, fee: 0, status: 'ok', wdate: '2026-10-10', setdate: '2026-10-12' };
  const bankRow = Object.assign({ date: '2026-10-12 10:00', amount: 220000, memo: '더빌이체3572', type: 'income' }, opts.rowSrc ? { src: opts.rowSrc } : {});
  const data = {
    app_settings: { cmsAutoConfirm: opts.on },
    companies: [{ id: 'co-1', name: '가나상사', status: 'active', monthlyAdvisoryFee: 220000, vatType: 'inclusive', cmsMemberCodes: ['1001'], managerMain: 'A-001' }],
    finance_income: [],
    ledger_batches: [{ src: 'bank', rows: [bankRow] }],
  };
  const ctx = {
    console, Date, Math, Object, JSON, String, parseInt, Promise, Event: function () {},
    CURRENT_USER: { sid: 'P-001', isAdmin: true },
    isAdminByUser: () => true,
    fbDb: { ref: () => ({ once: () => Promise.resolve({ val: () => ({ rows: { k1: row }, status: {} }) }) }) },
    dbGet: (k, d) => (k in data ? data[k] : d),
    erpCmsLedgerGet: () => null,
    erpCmsLedgerSave: () => { calls.ledgerSave++; },
    erpBankProcessedStore: () => ({}),
    erpBankRowKey: (r) => String(r.date) + '|' + r.amount,
    erpNormName: (s) => String(s || '').toLowerCase().replace(/\s+/g, ''),
    erpCleanMemo: (s) => String(s || ''),
    isIncomeLocked: () => false,
    getActiveUsers: () => [],
    erpUpsertIncome: (rec) => { calls.upsert.push(rec); },
    erpMarkBankRowProcessed: (r, kind, label) => { calls.mark.push({ r, kind, label }); },
  };
  ctx.window = ctx; ctx.dispatchEvent = () => true;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-cms-auto.js'), 'utf8'), ctx);
  vm.runInContext(cutFn('function erpCmsAutoRun('), ctx);
  return ctx.erpCmsAutoRun(opts.run).then((res) => ({ res, calls }));
}
test('돌려 보기 — 스위치 켜짐 + write 면 입금 한 건·통장 줄 표시 한 건', async () => {
  const { res, calls } = await runErp({ on: true, run: { write: true }, rowSrc: 'bank' });
  assert.equal(calls.upsert.length, 1);
  assert.equal(calls.upsert[0].cmsKey, 'k1');
  assert.equal(calls.mark.length, 1);
  assert.equal(res.preview, false);
});
test('돌려 보기 — 스위치 꺼짐이면 아무것도 쓰지 않고 미리보기', async () => {
  const { res, calls } = await runErp({ on: false, run: { write: true }, rowSrc: 'bank' });
  assert.equal(calls.upsert.length, 0);
  assert.equal(calls.mark.length, 0);
  assert.equal(calls.ledgerSave, 0);
  assert.equal(res.preview, true);
});
test('돌려 보기 — 줄에 src 가 없어도 묶음이 bank 면 표시한다', async () => {
  const { calls } = await runErp({ on: true, run: { write: true }, rowSrc: '' });
  assert.equal(calls.mark.length, 1);
});
test('메뉴·라우터에 🤖 자동 처리가 있다', () => {
  assert.match(src, /id:'fin\/auto'/);
  assert.match(src, /current === 'fin\/auto'[\s\S]{0,120}FinanceAuto/);
});
test('잇기는 사람이 누를 때 한 업체 한 칸만 — 후보는 보여 주기만', () => {
  const b = cutFn('function erpCmsLinkMember(');
  assert.match(b, /dbPatch\(\s*['"]companies['"]/);
  assert.doesNotMatch(b, /dbSet\(\s*['"]companies/);
  const s = cutFn('function FinanceAuto(');
  assert.doesNotMatch(s, /useEffect\([^)]*erpCmsLinkMember/, '열자마자 잇지 않는다');
});
test('되돌리기는 휴지통으로, 그 줄은 다시 자동 확정하지 않게 skip 에 적는다', () => {
  const b = cutFn('function erpCmsUndo(');
  assert.match(b, /TrashBin\.remove\(\s*['"]finance_income/);
  assert.match(b, /cms_pull\/skip\//);
});
test('스위치는 관리자 화면 안, 기본은 꺼짐', () => {
  const s = cutFn('function FinanceAuto(');
  assert.match(s, /cmsAutoConfirm/);
  assert.doesNotMatch(s, /cmsAutoConfirm\s*:\s*true\s*\}\s*\)\s*;?\s*\}\s*,\s*\[\]/, '열 때 저절로 켜지 않는다');
});
