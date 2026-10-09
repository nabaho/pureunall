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
  // 통장 줄은 «처리됨» 표시 문(한 줄씩이든 한 번에든)으로만 — 입금으로 만들지 않는다
  assert.match(b, /erpMarkBankRowsProcessed\(|erpMarkBankRowProcessed\(/);
  assert.doesNotMatch(b, /dbSet\(\s*['"]finance_income/);
});
test('관리자만 돈다', () => {
  assert.match(cutFn('function erpCmsAutoRun('), /isAdminByUser\(\s*CURRENT_USER\s*\)/);
});

/* ── 실제로 돌려 본다 — 스텁을 꽂은 vm 안에서 erpCmsAutoRun 을 실행 ── */
const vm = require('vm');
function runErp(opts) {
  const calls = { upsert: [], mark: [], ledgerSave: 0, markCalls: 0 };
  const row = { _k: 'k1', code: '1001', name: '가나상사', amount: 220000, fee: 0, status: 'ok', wdate: '2026-10-10', setdate: '2026-10-12' };
  const bankRow = Object.assign({ date: '2026-10-12 10:00', amount: 220000, memo: '더빌이체3572', type: 'income' }, opts.rowSrc ? { src: opts.rowSrc } : {});
  const data = {
    app_settings: Object.assign({ cmsAutoConfirm: opts.on }, opts.since === undefined ? { cmsAutoSince: '2026-10-01' } : (opts.since ? { cmsAutoSince: opts.since } : {})),
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
    erpCmsLedgerGet: () => (opts.ledger ? { rows: [row] } : null),
    erpCmsLedgerSave: () => { calls.ledgerSave++; },
    erpBankProcessedStore: () => ({}),
    erpBankRowKey: (r) => String(r.date) + '|' + r.amount,
    erpNormName: (s) => String(s || '').toLowerCase().replace(/\s+/g, ''),
    erpCleanMemo: (s) => String(s || ''),
    isIncomeLocked: () => false,
    getActiveUsers: () => [],
    erpUpsertIncome: (rec) => { calls.upsert.push(rec); },
    erpMarkBankRowProcessed: (r, kind, label) => { calls.mark.push({ r, kind, label }); },
    erpMarkBankRowsProcessed: (list) => { calls.markCalls++; list.forEach(m => calls.mark.push({ r: m.row, kind: 'income', label: m.label, incomeId: m.incomeId })); return list.length; },
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

test('잇기 순서 — 대상 업체에 먼저 쓰고, 성공한 뒤에만 다른 업체에서 뺀다', () => {
  const b = cutFn('function erpCmsLinkMember(');
  const iTarget = b.search(/dbPatch\(\s*['"]companies['"]\s*,\s*companyId/);
  const iOther = b.search(/dbPatch\(\s*['"]companies['"]\s*,\s*other\.id/);
  assert.ok(iTarget >= 0 && iOther >= 0);
  assert.ok(iTarget < iOther, '대상 업체 쓰기가 먼저');
  assert.ok(b.search(/if\(!co\) return false/) < iTarget, '대상이 없으면 아무것도 건드리기 전에 끝낸다');
});
test('되돌리기는 약속(Promise)을 돌려주고 skip 쓰기 실패를 알린다', () => {
  const b = cutFn('function erpCmsUndo(');
  assert.match(b, /\.set\(true\)\s*\.then\(/);
  assert.match(b, /\.catch\(/);
  assert.match(b, /showToast\(/);
});

/* ── 최종 검토 고침 (2026-10-09) ── */
test('C1 — 자동 시작일 이전 줄은 켜져 있어도 쓰지 않는다', async () => {
  const { res, calls } = await runErp({ on: true, run: { write: true }, rowSrc: 'bank', since: '2026-10-11' });
  assert.equal(calls.upsert.length, 0);
  assert.equal(res.items[0].verdict, 'old');
  assert.equal(calls.mark.length, 0, '들어가지 않은 줄의 더빌 합계는 표시하지 않는다(I1)');
});
test('C1 — 켜져 있는데 시작일이 없으면 아무것도 자동 확정하지 않는다', async () => {
  const { calls } = await runErp({ on: true, run: { write: true }, rowSrc: 'bank', since: '' });
  assert.equal(calls.upsert.length, 0);
});
test('C1 — 켤 때 자동 시작일(한국 날짜)을 함께 적는다, 이미 있으면 그대로', () => {
  const s = cutFn('function FinanceAuto(');
  assert.match(s, /cmsAutoSince/);
  assert.match(s, /if\(v && !cur\.cmsAutoSince\)/);
  assert.match(s, /9 \* 3600e3/, '한국 날짜');
});
test('C1 — 판정에 시작일·미리보기·이름 다듬기를 넘긴다', () => {
  const b = cutFn('function erpCmsAutoRun(');
  assert.match(b, /since:\s*since/);
  assert.match(b, /preview:\s*!canWrite/);
  assert.match(b, /normName:\s*function\(s\)\{\s*return erpNormName\(s\);/);
});
test('I3 — 통장 줄 표시는 한 번에, 저장은 한 번', async () => {
  const { calls } = await runErp({ on: true, run: { write: true }, rowSrc: 'bank' });
  assert.equal(calls.markCalls, 1);
  const ctx = { dbSet: () => { ctx.n = (ctx.n || 0) + 1; }, dbGet: () => ({}), CURRENT_USER: { sid: 'P-001' }, window: {}, BANK_PROCESSED_KEY: 'bank_processed', BANK_PROCESSED_MAX: 3000,
    erpBankRowKey: r => r.date + '|' + r.amount, Object, String, parseInt, Date };
  vm.createContext(ctx);
  vm.runInContext(cutFn('function erpBankProcessedStore(') + cutFn('function erpMarkBankRowsProcessed('), ctx);
  const n = ctx.erpMarkBankRowsProcessed([{ row: { date: 'a', amount: 1 }, label: 'x' }, { row: { date: 'b', amount: 2 }, label: 'y', incomeId: 'i9' }, { row: { date: 'c', amount: 3 }, label: 'z' }]);
  assert.equal(n, 3); assert.equal(ctx.n, 1, 'dbSet 은 한 번');
});
test('I3 — 통장 줄은 시작일 7일 앞부터(없으면 최근 45일)만 훑는다', () => {
  const b = cutFn('function erpCmsAutoRun(');
  assert.match(b, /7 \* 864e5/); assert.match(b, /45 \* 864e5/);
  assert.match(b, />= fromDay/);
});
test('I4 — 첫 실행은 첫 받기(fb_initial_done) 뒤, 맨 시계(8초)는 없다', () => {
  const i = src.indexOf('🤖 CMS 자동 처리 — 첫 받기'); assert.ok(i >= 0);
  const b = noComments(src.slice(i, src.indexOf('}, []);', i)));
  assert.match(b, /addEventListener\('fb_initial_done', first\)/);
  assert.match(b, /removeEventListener\('fb_initial_done', first\)/);
  assert.match(b, /_fbSynced === true\) first\(\)/);
  assert.doesNotMatch(b, /setTimeout\(function\(\)\{ erpCmsAutoRun/, '조건 없는 시계 실행이 없다');
});
test('I6 — 새 줄이 없으면 cms_ledger 를 다시 저장하지 않는다', async () => {
  const a = await runErp({ on: true, run: { write: true }, rowSrc: 'bank', ledger: true });
  assert.equal(a.calls.ledgerSave, 0);
  const b = await runErp({ on: true, run: { write: true }, rowSrc: 'bank' });
  assert.equal(b.calls.ledgerSave, 1);
});
test('띠 — 더빌 탭 없음·수수료 안내·시작일 이전/이미 들어간 줄 숫자', () => {
  const s = cutFn('function FinanceAuto(');
  assert.match(s, /Aside 를 켜고 더빌에 로그인/);
  assert.match(s, /CMS 수수료는 자동으로 안 넣습니다/);
  assert.match(s, /verdict === 'old'/); assert.match(s, /verdict === 'recorded'/);
  assert.doesNotMatch(s, /CHECK = \{[^}]*(old|recorded)/, 'old·recorded 는 확인할 것에 안 넣는다');
});
