'use strict';
// 🏦 기금 업무 서랍에 기금 진행 — node --test tests/work-drawer-fund.test.js
//
// 대표 지시 2026-10-03 「다음」 → 목업 → 「진행」 (연결 지도 ③)
//
// 이 검사가 지키는 것
//   ①★ 기금 짝짓기가 기금관리 청구 화면(linkPuerp)과 «글자 그대로» 같다 — 한쪽만 고치면 조용히 갈린다
//   ②  번호·수동 지정으로 맞은 것과 이름으로 맞은 것을 가른다
//   ③★ 적힌 값만 보인다 — 단계를 짐작해 붙이지 않는다
//   ④  아직 안 읽었거나 못 읽으면 상자를 안 그리고, 다시 조르지 않는다
//   ⑤  보기만 한다 · 양 끝(받는 곳·그리는 곳·ⓘ)이 있다

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const W = fs.readFileSync(path.join(ROOT, 'work.html'), 'utf8').replace(/\r\n/g, '\n');
const F = fs.readFileSync(path.join(ROOT, 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
function grabIn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  assert.ok(i >= 0, '못 찾음: ' + name);
  let d = 0, j = i;
  for (;; j++) { if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (!d) { j++; break; } } }
  return src.slice(i, j);
}
const grab = (n) => grabIn(W, n);
const bare = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/\s+/g, '');

/* ── ① 같은 규칙 ── */

test('★ 기금 짝짓기가 기금관리 청구 화면과 «글자 그대로» 같다(linkPuerp·_mkey·_dg10·isTrashed)', () => {
  const theirs = bare(grabIn(F, 'linkPuerp')).replace(/\bfunctionlinkPuerp\(/, 'functionfdLinkPuerp(')
    .replace(/\bfunds\[/g, 'fdFunds[').replace(/Object\.keys\(funds\)/g, 'Object.keys(fdFunds)')
    .replace(/isTrashed\(/g, 'fdTrashed(');
  assert.equal(bare(grab('fdLinkPuerp')), theirs, '기금관리 linkPuerp 와 달라졌습니다 — 둘을 함께 고치세요');
  assert.equal(bare(grab('_mkey')), bare(grabIn(F, '_mkey')), '_mkey 가 다릅니다');
  assert.equal(bare(grab('_dg10')), bare(grabIn(F, '_dg10')), '_dg10 이 다릅니다');
  assert.equal(bare(grab('fdTrashed')).replace('fdTrashed', 'isTrashed'), bare(grabIn(F, 'isTrashed')), 'isTrashed 가 다릅니다');
});

/* ── 상자 ── */

const FUNDS = {
  F1: { name: '충남1호 공동근로복지기금', short_name: '충남1호', tax_id_no: '123-82-00001',
    years: { 2025: { subsidy: { request_amount: '12,000,000', decided_amount: 9000000, paid_date: '2025-06-10' } },
             2026: { subsidy: { request_amount: 12000000 } } } },
  F2: { name: '충남2호 공동근로복지기금', short_name: '충남2호' },
  F3: { name: '가치를더하는 공동근로복지기금', short_name: '가치' },
  F9: { name: '지운기금', short_name: '지운', deleted: true }
};
const Y = new Date().getFullYear();

function box(o) {
  o = o || {};
  const store = o.store || {
    'fund_erp/funds': FUNDS, 'fund_erp/puerp_link': o.link || {},
    'fund_erp/closing/F1': { [Y - 1]: { locked: true, locked_at: '2026-03-15', months: { '01': { at: 'x' }, '02': { at: 'x' } } } },
    ['fund_erp/txns/F1/' + Y]: {},
    ['fund_erp/txns/F1/' + (Y - 1)]: { a: { approved: true }, b: { approved: true }, c: {} }
  };
  const reads = [];
  const fbDb = { ref: (p) => ({ once: () => { reads.push(p);
    if (o.fail && o.fail(p)) return Promise.reject(new Error('권한 없음'));
    const v = store[p]; return Promise.resolve({ val: () => (v === undefined ? null : JSON.parse(JSON.stringify(v))) }); } }) };
  const b = {
    console, String, Object, Array, Number, Date, isFinite, Math, JSON, Promise, fbDb, reads,
    esc: (x) => String(x == null ? '' : x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
    PE: o.pe || null
  };
  vm.createContext(b);
  vm.runInContext(
    "var FD_ROOT='fund_erp', fdFunds=null, fdLink=null, _fdTried=false, fdBox={}, _fdT={};\n"
    + 'function md(s){var p=String(s).split("-");return p.length===3?(+p[1])+"/"+(+p[2]):s;}\n'
    + 'function hlp(){ return ""; }\nfunction peRec(){ return PE; }\n'
    + ['_mkey', '_dg10', 'fdTrashed', 'fdLinkPuerp', 'fdIsFund', 'fdFundOf', 'fdYears', 'fdNeed', 'fdLoad',
       'fdMoney', 'fdChip', 'fdYearHTML', 'fdHeadRight', 'dFundHTML'].map(grab).join('\n'), b);
  return b;
}
async function open(b, it) { while (b.fdNeed(it)) await b.fdLoad(it); return b.dFundHTML(it); }

test('★ 업무관리에서 만든 기금 업무(계약 없음)는 기금 이름으로 잇고, 그렇다고 적는다', async () => {
  const b = box();
  const h = await open(b, { cat: '기금', company: '충남1호' });
  assert.match(h, /기금 이름으로 이은 것/);
  assert.equal(b.fdFundOf({ cat: '기금', company: '충남1호' }).fid, 'F1');
});

test('푸른이알피 계약의 고유번호·수동 지정으로 맞으면 «이름으로 이은 것»이라 하지 않는다', async () => {
  const byNo = box({ pe: { id: 'P1', companyName: '엉뚱한 이름', bizNo: '1238200001' } });
  await open(byNo, { cat: '기금', ref: { type: 'fund', id: 'P1' } });
  const m = byNo.fdFundOf({ cat: '기금', ref: { type: 'fund', id: 'P1' } });
  assert.equal(m.fid, 'F1'); assert.equal(m.guess, false);
  const man = box({ pe: { id: 'P2', companyName: '충남1호' }, link: { P2: 'F2' } });
  await open(man, { cat: '기금', ref: { type: 'fund', id: 'P2' } });
  const n = man.fdFundOf({ cat: '기금', ref: { type: 'fund', id: 'P2' } });
  assert.equal(n.fid, 'F2', '수동 지정이 이름보다 먼저여야 합니다'); assert.equal(n.guess, false);
});

test('후보가 둘이면 잇지 않는다 · 지운 기금에는 안 잇는다 · 기금 업무가 아니면 아무것도 안 읽는다', async () => {
  const b = box();
  await open(b, { cat: '기금', company: '충남' });
  assert.equal(b.fdFundOf({ cat: '기금', company: '충남' }).fid, null, '충남1호·2호 둘 다 걸리는데 하나를 골랐습니다');
  assert.equal(b.fdFundOf({ cat: '기금', company: '지운' }).fid, null);
  const c = box();
  assert.equal(c.fdNeed({ cat: '자문', company: '충남1호' }), false);
  assert.equal(c.dFundHTML({ cat: '자문', company: '충남1호' }), '');
  assert.equal(c.reads.length, 0);
});

test('★ 적힌 값만 — 장부·승인 전·월마감·결산 확정·지원금 신청·결정·교부', async () => {
  const b = box();
  const h = await open(b, { cat: '기금', company: '충남1호' });
  const last = h.slice(h.indexOf('>' + (Y - 1) + '<'));
  assert.match(last, /장부 3건 · 승인 전 1/);
  assert.match(last, /월마감 2\/12/);
  assert.match(last, /결산 확정 3\/15/);
  assert.match(last, /지원금 신청 1,200만/);
  assert.match(last, /결정 900만/);
  assert.match(last, /교부 6\/10/);
  assert.doesNotMatch(last, /집행/, '없는 값을 칩으로 그렸습니다');
  assert.match(h, new RegExp((Y - 1) + ' 결산 확정'), '머리에 가장 최근 결산 상태가 없습니다');
});

test('★ 단계를 짐작하지 않는다 — 장부만 있고 확정이 없으면 「결산 작성 전」, 아무것도 없으면 그렇다고만', async () => {
  const b = box({ store: { 'fund_erp/funds': FUNDS, 'fund_erp/puerp_link': {}, 'fund_erp/closing/F2': {},
    ['fund_erp/txns/F2/' + Y]: { a: {} }, ['fund_erp/txns/F2/' + (Y - 1)]: {} } });
  const h = await open(b, { cat: '기금', company: '충남2호' });
  assert.match(h, /결산 작성 전/);
  assert.match(h, /아직 적힌 것 없음/);
  assert.doesNotMatch(h, /%|진행률|단계 \d/);
  const src = bare(['fdYearHTML', 'fdHeadRight'].map(grab).join(''));
  assert.doesNotMatch(src, /\/12\*|\*100|%/, '퍼센트를 셈합니다');
});

test('★ 아직 안 읽었거나 못 읽으면 상자를 안 그리고, 다시 조르지 않는다', async () => {
  const b = box({ fail: (p) => p === 'fund_erp/funds' });
  const it = { cat: '기금', company: '충남1호' };
  assert.equal(b.dFundHTML(it), '');
  assert.equal(b.fdNeed(it), true);
  await b.fdLoad(it);
  assert.equal(b.fdNeed(it), false, '못 읽었는데 또 받으려 합니다 — 서랍이 끝없이 다시 그려집니다');
  assert.equal(b.dFundHTML(it), '');
  const c = box({ fail: (p) => /closing/.test(p) });
  assert.equal(await open(c, it), '', '장부·결산을 못 읽었는데 상자를 그렸습니다');
});

test('두 해만 읽는다(올해·작년) — 장부를 통째로 받지 않는다', async () => {
  const b = box();
  await open(b, { cat: '기금', company: '충남1호' });
  const tx = b.reads.filter((p) => /txns/.test(p));
  assert.deepEqual(tx.sort(), ['fund_erp/txns/F1/' + (Y - 1), 'fund_erp/txns/F1/' + Y]);
});

/* ── ⑤ ── */

test('보기만 한다 — 적는 곳이 없다', () => {
  const src = ['fdLoad', 'fdFundOf', 'fdYearHTML', 'dFundHTML', 'fdGo'].map(grab).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  /* 배열에 넣는 push 는 괜찮다 — 막는 것은 «데이터베이스에 적는 것» */
  assert.doesNotMatch(src, /\.(set|update|remove|transaction)\(|ref\([^)]*\)\.push\(/);
});

test('양 끝 — 서랍이 받고(renderDrawer) 그린다, ⓘ 설명이 있다', () => {
  const rd = grab('renderDrawer').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(rd, /if\(fdNeed\(items\[S\.drawerId\]\)\) fdLoad\(items\[S\.drawerId\]\)/);
  assert.match(rd, /h\+=dFundHTML\(it\);/);
  assert.match(W.slice(W.indexOf('var HELP={'), W.indexOf('function hlp(')), /fd:'/);
});
