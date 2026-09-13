/* ══════ 🔗 같은 곳인 두 줄을 «사람이 짚어» 합친다 (대표 지시 2026-09-12) ═══════════
   대표: 「추천대로 해라」 — 기능 검토 보고의 ②

   ■ 먼저, 검토 보고를 바로잡는다
   「앱이 경고만 하고 고칠 길이 없다」고 적었는데 **과했다.** 재 보니 이미
   «상호↔사업자번호 다리»(nameIdx)가 있어서 이런 것은 자동으로 한 줄이 된다:
     · 등록증「주식회사 가나」 + 명함「가나」  → 한 줄
     · 명함만 「가나」「(주)가나」             → 한 줄
   남는 것은 **이름 자체가 다르게 적힌** 경우뿐이다:
     · 등록증「가나상사」 + 명함「가나」       → 두 줄
   그리고 등록증 둘(번호 다름)이 두 줄인 것은 **맞는 동작**이다 — 다른 사업자다.

   ★ 못 박는 것
     ①⚠⚠ **짐작으로 안 합친다.** 이름이 겹쳐도 다른 곳인 쌍이 실제로 있다
        (「천성」/「천성전자」·「화담원」/「화담원 아산점」). 사람이 짚어 준 것만 따른다.
     ② 짚어 두면 명함·서류가 «그 줄로» 옮겨가고, 합쳐진 줄은 목록에서 사라진다.
     ③ **되돌릴 수 있다.** 합쳐진 쪽은 사라지므로, 남은 줄에 푸는 단추가 있어야 한다 —
        없으면 잘못 합친 것을 영영 못 되돌린다.
     ④ 서로 가리키면(가→나·나→가) **아무 데도 안 간다.** 조용히 한쪽을 고르면 다시
        그릴 때마다 답이 달라진다.
     ⑤ 합치기 길은 「확인 필요」에 **안 넣는다** — 고유번호증 기관처럼 사업자번호가
        «원래 없는» 곳이 영영 노래진다. (2026-09-12 에 넣어 봤다가 되돌렸다.)

   node --test tests/cards-co-merge-rows.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { cutFn } = require('./cut-fn');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8')
  .split('\r\n').join('\n');

/* ── 줄을 «실제로 만들어» 본다 — coListBuild 를 통째로 돌린다 ─────────────── */
function build(items, coInfo) {
  const ctx = { console, Object, Array, String, Number, Boolean, Math, Date, JSON, RegExp, isFinite,
    esc: v => String(v == null ? '' : v),
    digits: v => String(v || '').replace(/\D/g, ''),
    allItems: () => { const m = {}; (items || []).forEach(i => m[i.id] = i); return m; },
    _coInfo: coInfo || {},
    _coWatch: null,
    /* 이알피는 이 검사가 보는 것이 아니다 — 아무것도 못 찾는 대역으로 둔다 */
    ErpMatch: { ready:false, match: () => null, matchAll: () => [], byId: {} },
    taxInvoiceFromText: () => '',
    /* 줄이 둘 이상일 때 «같은 이름»을 가려 알리는 자리에서 부른다 — 이 검사가 보는
       것은 줄이 몇 개인가이므로 이름만 그대로 돌려준다 */
    coDisplayName: o => String((o && o.name) || ''),
    coEffectiveExtra: (key, name, map) => (map || {})[key] || null };
  vm.createContext(ctx);
  vm.runInContext([
    /* ⚠ 둘 다 «원본에서 떠 온다». 베껴 적으면 제품이 규칙을 바꿔도 검사는 제 사본만 본다.
       ⚠ coKeyOf 는 function 이 아니라 화살표 한 줄이라 cutFn 으로는 못 뜬다 — 줄째로 뜬다. */
    SRC.match(/^const _norm = [^\n]*;$/m)[0],
    SRC.match(/^const coKeyOf = [^\n]*;$/m)[0],
    'var _coWatch = null;',
    cutFn(SRC, 'function coListBuild(')
  ].join('\n'), ctx);
  return ctx.coListBuild().map(o => ({ key:o.key, name:o.name, bizno:o.bizno,
                                       cards:(o.cards||[]).length, docs:o.docs||0 }));
}
const biz  = (id, bizno, company) => ({ id, kind:'biz', company, bizno, createdAt:1 });
const card = (id, company) => ({ id, kind:'card', company, bizno:'', name:'사람'+id, createdAt:2 });

/* ── 먼저: 이미 붙는 것은 «그대로» 붙는다 (내가 새로 깨뜨리지 않았나) ──────── */

test('★★★ 이미 있던 「상호↔번호 다리」는 그대로다', () => {
  const 한줄 = build([ biz('b1','1348605772','주식회사 가나'), card('c1','가나') ]);
  assert.equal(한줄.length, 1, '★★★ 자동으로 붙던 것이 안 붙으면 4,000곳이 통째로 갈라진다');
  assert.equal(한줄[0].cards, 1);
  assert.equal(한줄[0].docs, 1);
});

test('★★ 번호가 다른 등록증 둘은 «따로» 선다 — 다른 사업자다', () => {
  const r = build([ biz('b1','3128149225','가나'), biz('b2','4118612345','가나') ]);
  assert.equal(r.length, 2, '★★★ 번호가 다른 곳을 합치면 남남의 서류가 한 줄에 쌓인다');
});

/* ── ①② 짚어 주면 합친다 ────────────────────────────────────────────────── */

test('★★★ 이름이 다르게 적힌 두 줄은 «저절로» 안 합쳐진다 — 짐작하지 않는다', () => {
  const r = build([ biz('b1','2208612345','가나상사'), card('c1','가나') ]);
  assert.equal(r.length, 2,
    '★★★ 이름이 겹친다고 합치면 「천성」과 「천성전자」가 한 줄이 된다');
});

test('★★★ 사람이 짚어 주면 «그 줄로» 옮겨간다', () => {
  const 짚음 = { 'n가나': { sameAs: '2208612345' } };
  const r = build([ biz('b1','2208612345','가나상사'), card('c1','가나') ], 짚음);
  assert.equal(r.length, 1, '★★★ 짚어 줬는데도 두 줄이면 합치기가 아무 일도 안 한 것이다');
  assert.equal(r[0].key, '2208612345', '★★ 남는 줄은 «번호 있는» 쪽이어야 한다');
  assert.equal(r[0].cards, 1, '★★★ 명함이 안 따라갔다 — 서류가 갈려 쌓인다');
  assert.equal(r[0].docs, 1);
});

test('★★ 등록증 쪽을 명함 쪽으로 합칠 수도 있다 — 방향을 가두지 않는다', () => {
  const 짚음 = { '2208612345': { sameAs: 'n가나' } };
  const r = build([ biz('b1','2208612345','가나상사'), card('c1','가나') ], 짚음);
  assert.equal(r.length, 1);
  assert.equal(r[0].key, 'n가나');
  assert.equal(r[0].docs, 1, '★★ 등록증이 안 따라갔다');
});

/* ── ④ 서로 가리키면 ───────────────────────────────────────────────────── */

test('★★★ 가↔나로 서로 가리키면 «아무 데도 안 간다» — 영영 돌면 안 된다', () => {
  const 짚음 = { 'n가나': { sameAs:'2208612345' }, '2208612345': { sameAs:'n가나' } };
  const r = Array.from(build([ biz('b1','2208612345','가나상사'), card('c1','가나') ], 짚음));
  assert.equal(r.length, 2, '★★ 줄 수가 둘이 아니다');
  /* ⚠★ 줄 «수»만 보면 안 된다 — 서로 따라가면 둘이 자리를 «맞바꿔» 수는 그대로 둘이다
     (2026-09-12 이빨 확인에서 이 고장이 샜다). 무엇이 어느 줄에 앉았는지까지 본다. */
  const 번호줄 = r.find(x => x.key === '2208612345');
  const 이름줄 = r.find(x => x.key === 'n가나');
  assert.ok(번호줄 && 이름줄, '★★ 둘 다 제자리에 서 있어야 한다');
  assert.equal(번호줄.docs, 1, '★★★ 등록증이 제자리를 떠났다 — 서로 따라가 자리를 맞바꿨다');
  assert.equal(번호줄.cards, 0);
  assert.equal(이름줄.cards, 1, '★★★ 명함이 제자리를 떠났다');
  assert.equal(이름줄.docs, 0);
});

test('★ 제 자신을 가리키면 그냥 제자리다', () => {
  const r = build([ card('c1','가나') ], { 'n가나': { sameAs:'n가나' } });
  assert.equal(r.length, 1);
  assert.equal(r[0].key, 'n가나');
});

test('★ 짚어 둔 곳이 «비어 있으면» 아무 일도 안 한다', () => {
  const r = build([ card('c1','가나') ], { 'n가나': { sameAs:'   ' } });
  assert.equal(r[0].key, 'n가나');
});

/* ── 후보 찾기 — «지어내지» 않는다 ───────────────────────────────────────── */

function finds(list, key, q) {
  const ctx = { console, Object, Array, String,
    coList: () => list,
    _coInfo: {} };
  vm.createContext(ctx);
  vm.runInContext(cutFn(SRC, 'function coMergedKeys(') + '\n' + cutFn(SRC, 'function coMergeFinds('), ctx);
  /* ⚠ vm 안에서 만든 배열은 «원형이 다르다» — 그대로 deepEqual 하면 값이 같아도 틀렸다고
     나온다(2026-09-12 에 빈 배열 둘이 안 같다고 나와서 알았다). 밖의 배열로 옮긴다. */
  return Array.from(ctx.coMergeFinds(key, q)).map(x => x.name);
}
const CO = (key, name, bizno) => ({ key, name, bizno:bizno||'', cards:[], docs:0, erp:null, extra:{} });

test('★★★ 후보는 «사람이 적은 말»로만 찾는다 — 안 적으면 하나도 안 준다', () => {
  const list = [ CO('n가나','가나'), CO('2208612345','가나상사','2208612345') ];
  assert.deepEqual(finds(list, 'n가나', ''), [],
    '★★★ 빈 말에 목록을 통째로 주면 4,000곳이 쏟아져 고를 수가 없다');
  assert.deepEqual(finds(list, 'n가나', '가나'), ['가나상사']);
});

test('★★ 자기 자신은 후보에 «없다» — 제자리를 가리키게 된다', () => {
  const list = [ CO('n가나','가나'), CO('2208612345','가나상사','2208612345') ];
  assert.ok(finds(list, 'n가나', '가나').indexOf('가나') < 0);
});

test('★ 사업자번호로도 찾는다 — 이름이 달라 못 찾을 때 쓸 길이 있어야 한다', () => {
  const list = [ CO('n가나','가나'), CO('2208612345','전혀다른이름','2208612345') ];
  assert.deepEqual(finds(list, 'n가나', '22086'), ['전혀다른이름']);
});

/* ── ③ 되돌리는 길 ─────────────────────────────────────────────────────── */

function 줄(o, coInfo) {
  const ctx = { console, Object, Array, String,
    esc: s => String(s == null ? '' : s),
    _coInfo: coInfo || {} };
  vm.createContext(ctx);
  vm.runInContext(cutFn(SRC, 'function coMergedKeys(') + '\n' + cutFn(SRC, 'function coMergeRowHtml('), ctx);
  return ctx.coMergeRowHtml(o);
}

test('★★★ 합쳐 둔 줄이 있으면 «푸는 단추»가 보인다 — 유일하게 되돌릴 자리다', () => {
  const h = 줄(CO('2208612345','가나상사','2208612345'),
               { 'n가나': { sameAs:'2208612345', name:'가나' } });
  assert.match(h, /합쳐 둔 줄 1개/, '★★ 합친 사실이 안 보이면 왜 줄이 사라졌는지 모른다');
  assert.match(h, /coUnmerge\('n가나'\)/,
    '★★★ 푸는 길이 없으면 잘못 합친 것을 영영 못 되돌린다');
});

test('★★ 사업자번호가 없는 줄에는 «합치기»가 보인다', () => {
  assert.match(줄(CO('n가나','가나')), /coAskMerge\('n가나'\)/);
  assert.match(줄(CO('n가나','가나')), /같은 곳이 따로 있나요/);
});

test('★★ 번호가 «있는» 멀쩡한 줄에는 아무것도 안 붙는다', () => {
  assert.equal(줄(CO('2208612345','가나상사','2208612345')), '',
    '★★ 번호가 곧 열쇠다 — 같은 회사면 이미 한 줄이고, 다르면 다른 사업자다');
});

/* ── ⑤ 「확인 필요」에 «안» 넣는다 ──────────────────────────────────────── */

test('★★★ 「번호 없음」을 «확인 필요»로 세지 않는다 — 고유번호증 기관이 영영 노래진다', () => {
  const fn = cutFn(SRC, 'function coNeedCount(');
  assert.ok(!/bizno/.test(fn),
    '★★★ 번호가 원래 없는 곳(고유번호증)이 늘 「확인 필요」가 된다 — 늘 노란 딱지는 눈이 배경으로 배운다');
  assert.match(fn, /linkBad\?1:0/);
});

test('★★ 카드와 숫자 칸이 «한 곳»에서 센다 — 따로 적으면 두 숫자가 어긋난다', () => {
  assert.match(cutFn(SRC, 'function coNeedHtml('), /const n = coNeedCount\(o\)/);
  assert.match(cutFn(SRC, 'function coTilesHtml('), /const need = coNeedCount\(o\)/);
});

test('★★ 상세 패널이 합치기 줄을 «실제로» 내보낸다', () => {
  assert.match(cutFn(SRC, 'function coDetailPanelHtml('), /coMergeRowHtml\(o\)/,
    '★★★ 만들어 놓고 안 붙이면 소용없다');
});

/* 합치기를 «실제로 눌러» 본다 — 글자로만 보면 `if(false && confirm(...))` 도 통과한다
   (2026-09-12 이빨 확인에서 그 고장이 샜다). */
function 합치기(예스) {
  const calls = { asked:0, wrote:null, opened:null };
  const list = [ { key:'n가나', name:'가나', bizno:'', cards:[{},{}], docs:1, erp:null, extra:{} },
                 { key:'2208612345', name:'가나상사', bizno:'2208612345', cards:[], docs:3, erp:null, extra:{} } ];
  const ctx = { console, Object, Array, String, Number,
    coList: () => list,
    state: {},
    confirm: (m) => { calls.asked++; calls.msg = String(m); return !!예스; },
    setTimeout: (f) => { try{ f(); }catch(_){} },
    openCoDetailPanel: (k) => { calls.opened = k; },
    coSaveInfoField: (k, f, v, msg) => { calls.wrote = { key:k, field:f, value:v }; } };
  vm.createContext(ctx);
  vm.runInContext(cutFn(SRC, 'function coDoMerge(') + '\n' + cutFn(SRC, 'function coUnmerge('), ctx);
  ctx.coDoMerge('n가나', '2208612345');
  return { ctx, calls };
}

test('★★★ 묻고 나서 합친다 — 「아니오」면 «아무것도» 안 쓴다', () => {
  const no = 합치기(false);
  assert.equal(no.calls.asked, 1, '★★★ 묻지도 않고 합치면 되돌릴 생각을 할 틈이 없다');
  assert.equal(no.calls.wrote, null, '★★★ 「아니오」라고 했는데 합쳐 버렸다');
  assert.match(no.calls.msg, /명함 2장 · 서류 1건/,
    '★★ 무엇이 옮겨가는지 안 말하면 무엇을 허락하는지 모르고 누른다');
  assert.match(no.calls.msg, /다시 풀 수 있습니다/, '★★ 되돌릴 수 있다는 말이 없다');
});

test('★★★ 「예」면 coInfo 의 «한 칸»에 짚어 두고, 남는 줄을 연다', () => {
  const yes = 합치기(true);
  assert.deepEqual({ key:yes.calls.wrote.key, field:yes.calls.wrote.field, value:yes.calls.wrote.value },
    { key:'n가나', field:'sameAs', value:'2208612345' },
    '★★ 저장 길을 새로 내면 담당·메모와 규칙이 갈린다');
  assert.equal(yes.calls.opened, '2208612345',
    '★★★ 합친 줄은 사라진다 — 아무것도 안 열리면 「눌렀더니 회사가 없어졌다」가 된다');
  assert.equal(yes.ctx.state.coPick, '2208612345');
});

test('★★ 푸는 길은 «같은 칸»을 비운다', () => {
  assert.match(cutFn(SRC, 'function coUnmerge('), /coSaveInfoField\(k, 'sameAs', ''/);
});
