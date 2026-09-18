/* CMS 일괄이체 적요는 «업체 이름이 아니다» (건의 2026-09-15 · 김보람 노무사)

   건의 그대로 옮기면 —
     「더빌이체3572 라는 적요명으로 입금되는 cms 이체내역에 대하여, 자동매칭기능이
      엉뚱한 업체를 금액만 맞춰 입금처리하는 오류가 있습니다.
      3/19 더빌이체3572 로 입금된 110,000원은 가나메디의원 입금건이나,
      나루천막산업의 자문료로 자동 매치되어 있습니다.」

   ── 뿌리 ─────────────────────────────────────────────────────
   CMS 적요는 «걷어 온 통로»다. 같은 「더빌이체3572」가 달마다 «다른 업체»의 돈을 싣고 온다.
   그런데 한 번 손으로 확정하면 입금자 별칭으로 배워졌고, 두 번째부터는 신뢰(erpAliasTrusted)가
   되어 이름점수 100점을 받았다 — 그때부터 «금액만 맞으면» 그 업체로 저절로 찍혔다.
   ⚠ 2026-08-18 에 「닮지 않은 별칭은 두 번 확정돼야 규칙」으로 막아 두었지만, CMS 적요는
     **몇 번을 확정해도 규칙이 될 수 없다** — 매번 주인이 바뀌기 때문이다. 횟수로 풀 일이 아니다.

   ── 이 검사가 못 박는 것 ──────────────────────────────────────
   ① CMS 적요로는 «배우지 않는다» — 그리고 이미 잘못 배운 것은 그때 지운다
   ② 이미 배워 둔 CMS 별칭은 «증거로 안 쓴다»(erpAliasEvidence) — 옛 자료가 스스로 낫는다
   ③ 점수기가 100점을 줘도 CMS 입금은 «저절로 안 찍힌다» — 여러 업체가 합쳐진 줄이다
   ④ 그래도 «조용히 빠뜨리지 않는다» — 왜 못 하는지·어디서 하면 되는지를 적어 검토로 넘긴다
   ⑤ 후보를 «안 넘긴다» — 금액만 맞춘 후보를 보여 주면 사람이 그중 하나를 고른다(이 흠의 뿌리)
   ⚠ 평범한 적요(업체 이름)는 예전 그대로 배우고 찍는다 — 넓게 막으면 자동매칭이 통째로 죽는다. */

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');

/* `var 이름 = …;` 한 문장을 «깊이를 세어» 자른다. 줄 수·뒤에 붙은 주석에 안 매인다. */
function cutVar(src, name) {
  const at = src.indexOf('\nvar ' + name + ' = ');
  assert.ok(at > 0, '★ var ' + name + ' 을 못 찾았습니다');
  let i = src.indexOf('=', at) + 1, depth = 0, q = '';
  for (; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === '\\') i++; else if (ch === q) q = ''; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { q = ch; continue; }
    if (ch === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); continue; }
    if (ch === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 1; continue; }
    if ('([{'.indexOf(ch) >= 0) depth++;
    else if (')]}'.indexOf(ch) >= 0) depth--;
    else if (ch === ';' && depth === 0) break;
  }
  return src.slice(at + 1, i + 1);
}

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');

/* 진짜 함수를 떼어 돌린다 — 흉내 낸 것으로는 「CMS 인가」를 가릴 수 없다 */
function boot(over) {
  const store = {};
  const ctx = {
    console, Object, Array, String, Number, Math, Date, JSON, RegExp, parseInt, parseFloat, isNaN,
    window: {},
    dbGet: (k, d) => (k in store ? store[k] : d),
    dbSet: (k, v) => { store[k] = v; return true; },
    __store: store
  };
  Object.assign(ctx, over || {});
  vm.createContext(ctx);
  /* 값 선언 — 파일에서 그대로 떼어 온다(베끼면 화면과 검사가 갈라진다).
     ⚠ 「첫 세미콜론까지」로 자르면 뒤에 붙은 주석을 삼켜 구문이 깨진다 — 괄호 깊이를 센다. */
  ['ERP_MEMO_NOISE', 'ERP_BANK_WORDS', '_erpCleanCache', 'PAYER_ALIAS_KEY', 'CMS_MEMO_MARKERS']
    .forEach((n) => vm.runInContext(cutVar(SRC, n), ctx));
  ['erpNormName', 'erpLcsLen', '_erpNameCmp', '_erpStripNoiseWord', 'erpCleanMemo',
   'erpIsCmsMemo', 'erpAliasStore', 'erpAliasCompany', 'erpAliasFind', 'erpAliasEvidence',
   'erpAliasNameClose', 'erpAliasWeak', 'erpAliasTrusted', 'erpForgetPayerAlias',
   'erpLearnPayerAlias', 'erpAutoMarkCompanyIncome'].forEach((n) => {
    vm.runInContext(cutFn(SRC, 'function ' + n + '('), ctx);
  });
  return ctx;
}

/* 실제로 들어온 적요 — 건의의 그것과 이미 알아보던 것들 */
const CMS_MEMOS = ['더빌이체3572', '더빌이체', '나이스빌', '효성에프엠에스'];

test('★ 전제 — 「더빌이체3572」를 CMS 로 알아본다', () => {
  const c = boot();
  CMS_MEMOS.forEach((m) => assert.equal(c.erpIsCmsMemo(m), true, '★ «' + m + '» 을 CMS 로 못 알아본다'));
  assert.equal(c.erpIsCmsMemo('나루천막산업'), false, '평범한 업체명을 CMS 로 본다');
});

/* ══════ ① 배우지 않는다 ══════ */
test('★★ CMS 적요로는 별칭을 «배우지 않는다»', () => {
  const c = boot();
  CMS_MEMOS.forEach((m) => {
    assert.equal(c.erpLearnPayerAlias(m, { companyName: '나루천막산업' }), false,
      '★★ «' + m + '» 을 업체 이름으로 배웠습니다 — 그 통로는 달마다 주인이 바뀝니다');
  });
  assert.deepEqual(Object.keys(c.__store.payer_aliases || {}), [], '★★ 배운 것이 남았습니다');
});

test('★★ 이미 잘못 배워 둔 CMS 별칭은 «그때 지운다» — 안 지우면 다음 달에 또 끌려간다', () => {
  const c = boot();
  /* 옛 자료를 흉내 낸다 — 두 번 확정돼 «신뢰»가 된 상태(이 흠이 굳은 모습) */
  c.__store.payer_aliases = {
    [c.erpNormName('더빌이체3572')]: { companyName: '나루천막산업', count: 2, weak: true },
    [c.erpNormName(c.erpCleanMemo('더빌이체3572'))]: { companyName: '나루천막산업', count: 2, weak: true }
  };
  c.erpLearnPayerAlias('더빌이체3572', { companyName: '가나메디의원' });
  const 남은 = Object.keys(c.__store.payer_aliases || {});
  assert.deepEqual(남은, [], '★★ 잘못 배운 CMS 별칭이 남았습니다: ' + 남은.join(', '));
});

test('★ 평범한 적요는 «예전 그대로» 배운다 — 넓게 막으면 자동매칭이 통째로 죽는다', () => {
  const c = boot();
  assert.equal(c.erpLearnPayerAlias('최건(마루베이커리)', { companyName: '마루베이커리' }), true,
    '★ 보통 적요까지 못 배우게 됐습니다');
  assert.ok(Object.keys(c.__store.payer_aliases || {}).length >= 1);
});

/* ══════ ② 증거로 쓰지 않는다 ══════ */
test('★★ 이미 배워 둔 CMS 별칭은 «증거로 안 쓴다» — 옛 자료가 스스로 낫는다', () => {
  const c = boot();
  c.__store.payer_aliases = {
    [c.erpNormName('더빌이체3572')]: { companyName: '나루천막산업', count: 9, weak: true }
  };
  assert.ok(c.erpAliasFind('더빌이체3572'), '★ 전제 — 지우려면 찾을 수는 있어야 한다');
  assert.equal(c.erpAliasEvidence('더빌이체3572'), null,
    '★★ CMS 적요의 별칭을 증거로 씁니다 — 이름점수 100점이 되어 저절로 찍힙니다');
  assert.ok(c.erpAliasEvidence('최건(마루베이커리)') === null || true);   // 보통 적요는 아래 검사에서
});

test('★ 보통 적요의 별칭은 그대로 증거다', () => {
  const c = boot();
  c.erpLearnPayerAlias('디와이엠', { companyName: '라온엠솔루션' });
  const e = c.erpAliasEvidence('디와이엠');
  assert.ok(e && e.entry && e.entry.companyName === '라온엠솔루션', '★ 보통 별칭까지 막혔습니다');
});

test('★★ 쓰는 쪽 둘이 «같은 하나»를 쓴다 — 두 벌이면 한쪽만 고쳐진다', () => {
  const score = cutFn(SRC, 'function erpMatchScore(');
  const tidy = cutFn(SRC, 'function erpAutoTidyOk(');
  assert.match(score, /erpAliasEvidence\(/, '★★ erpMatchScore 가 거르지 않은 별칭을 씁니다');
  assert.ok(!/erpAliasFind\(/.test(score), '★★ erpMatchScore 에 옛 길(erpAliasFind)이 남아 있습니다');
  assert.match(tidy, /erpAliasEvidence\(/, '★★ erpAutoTidyOk 가 거르지 않은 별칭을 씁니다');
  assert.ok(!/erpAliasCompany\(/.test(tidy), '★★ erpAutoTidyOk 에 옛 길(erpAliasCompany)이 남아 있습니다');
});

/* ══════ ③④⑤ 저절로 찍지 않는다 ══════ */
/* 점수기가 «만점»을 준다고 두고 돌린다 — 그래도 CMS 는 찍히면 안 된다.
   ⚠ 이것이 이 검사의 급소다. 별칭을 막아도 금액지문·세금계산서 같은 다른 신호가
     이름점수를 올릴 길이 남아 있고, 그때 또 같은 사고가 난다. */
function autoMark(memo, amount) {
  const c = boot({});
  vm.runInContext('function erpMatchScore(t, cand){ return { score:100, nameScore:100, amountScore:100, reasons:["금액 일치"] }; }', c);
  const txns = [{ id: 'T1', date: '2026-03-19', type: 'income', amount: amount, memo: memo }];
  const pool = [{ name: '나루천막산업', fee: amount, payDay: '19' }];
  return c.erpAutoMarkCompanyIncome(txns, 2026, pool);
}

test('★★ 점수가 100점이어도 CMS 입금은 «저절로 안 찍힌다»', () => {
  const r = autoMark('더빌이체3572', 110000);
  /* ⚠ vm 안에서 만든 배열이라 deepEqual 이 «원형»까지 견준다 — Array.from 으로 옮겨 본다
       (이 저장소가 전에도 밟은 자리다). */
  assert.deepEqual(Array.from(r.applied), [],
    '★★ CMS 입금을 한 업체로 찍었습니다 — 건의의 그 사고(110,000원이 남의 돈이 됩니다)');
});

test('★★ 그래도 «조용히 빠뜨리지 않는다» — 왜 못 하는지·어디서 하면 되는지를 적는다', () => {
  const r = autoMark('더빌이체3572', 110000);
  assert.equal(r.review.length, 1, '★★ CMS 입금이 목록에서 통째로 사라졌습니다 — 그 돈이 잊힙니다');
  const it = r.review[0];
  assert.equal(it.cms, true, 'CMS 라는 표시가 없습니다');
  assert.match(it.why || '', /CMS/, '★ 왜 못 하는지 안 적혀 있습니다');
  assert.match(it.why || '', /골라/, '★★ 어디서 무엇을 하면 되는지가 없습니다 — 「확인 필요」만으로는 손쓸 데가 없습니다');
  assert.equal(it.memo, '더빌이체3572');
  assert.equal(it.amount, 110000);
});

test('★★ 후보를 «안 넘긴다» — 금액만 맞춘 후보를 보이면 사람이 그중 하나를 고른다', () => {
  const r = autoMark('더빌이체3572', 110000);
  assert.deepEqual(Array.from(r.review[0].candidates), [],
    '★★ 금액만 맞춘 후보가 딸려 갑니다 — 이 흠이 바로 그렇게 생겼습니다');
});

test('★ 보통 입금은 «예전 그대로» 저절로 찍힌다', () => {
  const r = autoMark('나루천막산업', 110000);
  assert.equal(r.applied.length, 1, '★ 보통 입금까지 안 찍힙니다 — 자동매칭이 통째로 죽었습니다');
  assert.equal(r.applied[0].co.name, '나루천막산업');
});

test('★ 검토 목록이 그 까닭을 «화면에» 보인다', () => {
  const i = SRC.indexOf('autoMarkModal.review.map');
  assert.ok(i > 0, '★ 검토 목록을 그리는 자리를 못 찾았습니다');
  assert.match(SRC.slice(i, i + 1200), /r\.why/,
    '★ 적어 둔 까닭을 화면이 안 보여 줍니다 — 「-」만 있으면 사람은 결국 금액으로 짐작합니다');
});
