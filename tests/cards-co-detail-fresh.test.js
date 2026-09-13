/* ══════ 열어 둔 기업 상세도 «새 값으로» 다시 그린다 (점검 2026-09-12) ═══════════
   대표 지시: 「기업정보함을 전체 검토하고 오류나 불량 있는 부분 검토해달라」

   ■ 점검에서 찾은 것 둘
   ① 자료가 바뀌면 «목록만» 다시 그렸다. 열어 둔 상세 패널은 건드리지 않아서,
      서류를 사업에 끌어다 붙여도 「붙였습니다」라고 알리면서 화면은 그대로였다.
      ⚠ 끌어다 붙이는 쪽(coDocDrop)은 「구독이 새 값을 주면 패널도 다시 그려진다」고
        적어 두었는데 **그 길이 없었다.** 실측으로 확인했다 — 목록은 새 이름으로
        바뀌는데 패널은 옛 이름 그대로였다.
   ② 서류 칸이 「다 붙음」이라고 «단정»했다. 붙임새는 이알피 기록이 와야 셀 수 있는데
      «모름»(null)을 0 으로 읽어, 아무 데도 안 붙은 서류 두 장을 「다 붙음」으로 적었다.

   ★ 못 박는 것
     ① 명함을 보고 있으면 «건드리지 않는다» — 읽던 사람을 기업 상세로 끌어내면 안 된다.
     ② 구르던 자리를 지킨다.
     ③ 펴 둔 사업 서류를 지킨다 — 같은 회사를 다시 그리는 것뿐이다.
     ④ 그새 사라진 회사면 닫는다.
     ⑤ 「다 붙음」은 세어 본 뒤에만 말한다 — 모르면 「읽는 중」이다.

   node --test tests/cards-co-detail-fresh.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { cutFn } = require('./cut-fn');
const { panelDeps } = require('./lib-co-hist');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8')
  .split('\r\n').join('\n');

/* ── ①~④ 다시 그리는 잣대 ────────────────────────────────────────────── */

function load(opt) {
  const o = opt || {};
  const el = { cls: o.open === false ? '' : 'open',
    dataset: { coKey: o.showing === undefined ? '1' : o.showing },
    classList: { contains: c => el.cls.indexOf(c) >= 0, add(){}, remove(){} },
    querySelector: () => o.body || null };
  const ctx = { String, Array, Object,
    state: { coPick: o.pick === undefined ? '1' : o.pick },
    coList: () => o.list === undefined ? [{ key:'1' }] : o.list,
    $: id => (id === 'pcDetail' ? el : null),
    _opened: null, _keep: null, _closed: 0,
    openCoDetailPanel: (k, keep) => { ctx._opened = k; ctx._keep = keep; },
    closePcDetail: () => { ctx._closed++; } };
  vm.createContext(ctx);
  vm.runInContext(cutFn(SRC, 'function coDetailRefresh('), ctx);
  return ctx;
}

test('★★★ 새 값이 오면 열어 둔 기업 상세를 다시 그린다', () => {
  const c = load();
  c.coDetailRefresh();
  assert.equal(c._opened, '1',
    '★★★ 서류를 붙여도 화면이 안 바뀐다 — 「붙였습니다」라고 알리면서 그대로 남는다');
});

test('★★★ 명함을 보고 있으면 «건드리지 않는다» — 읽던 사람을 끌어내면 안 된다', () => {
  /* 기업 상세에서 명함을 열면 같은 자리에 명함이 뜬다. 그때 새 값이 왔다고 기업
     상세로 갈아 끼우면, 보던 명함이 눈앞에서 사라진다. */
  const c = load({ showing: undefined, pick: '1' });
  c.$('pcDetail').dataset.coKey = undefined;      /* 지금 떠 있는 것은 명함 */
  c.coDetailRefresh();
  assert.equal(c._opened, null, '★★★ 명함을 보고 있는데 기업 상세로 끌어냈다');
  assert.equal(c._closed, 0, '★★ 명함 창을 닫아 버렸다');
});

test('★★ 펴 둔 자리를 지키며 다시 그린다 — 보던 것이 접히면 안 된다', () => {
  const c = load();
  c.coDetailRefresh();
  assert.equal(c._keep, true,
    '★★ 펴 둔 사업 서류가 새 값이 올 때마다 접힌다 — 무엇을 보고 있었는지 잃는다');
});

test('★★ 그새 사라진 회사면 «닫는다» — 빈 패널이 남으면 안 된다', () => {
  const c = load({ list: [] });
  c.coDetailRefresh();
  assert.equal(c._opened, null, '★★ 없는 회사를 다시 열었다');
  assert.equal(c._closed, 1, '★ 빈 패널이 그대로 남는다');
});

test('★ 고른 회사가 없거나 패널이 닫혀 있으면 아무 일도 안 한다', () => {
  const a = load({ pick: '' });
  a.coDetailRefresh();
  assert.equal(a._opened, null, '★ 고른 회사가 없는데 열었다');
  const b = load({ open: false });
  b.coDetailRefresh();
  assert.equal(b._opened, null, '★ 닫힌 패널을 되살렸다');
});

test('★★★ 자료가 바뀌면 그 길(renderCoAny)이 «실제로» 이 손을 부른다', () => {
  const any = cutFn(SRC, 'function renderCoAny(');
  assert.match(any, /coDetailRefresh\(\)/,
    '★★★ 다시 그리는 손을 만들어 놓고 아무도 안 부르면 예전과 똑같다');
});

test('★★ 패널이 «지금 무엇이 떠 있나»를 적어 둔다 — 그것이 ①의 잣대다', () => {
  const co = cutFn(SRC, 'function openCoDetailPanel(');
  const card = cutFn(SRC, 'function openPcDetail(');
  assert.match(co, /dataset\.coKey = key/, '★★ 기업 상세가 제 표를 안 남긴다');
  assert.match(co, /delete \$\('pcDetail'\)\.dataset\.cardId/, '★ 옛 명함 표가 남는다');
  assert.match(card, /delete \$\('pcDetail'\)\.dataset\.coKey/,
    '★★★ 명함을 열고도 기업 상세 표가 남으면, 새 값이 올 때 명함이 밀려난다');
});

/* ── ⑤ 「다 붙음」은 세어 본 뒤에만 ───────────────────────────────────── */

function tiles(leftN) {
  const ctx = { Object, String, Number, Math, Date, JSON,
    esc: s => String(s == null ? '' : s),
    ErpMatch: { ready:true, byId:{} },
    _coHist: { o:null }, _coHistSum: null, _coLeftDocsN: leftN,
    coErpPinHtml: () => '' };
  vm.createContext(ctx);
  vm.runInContext(panelDeps(SRC), ctx);
  return ctx.coTilesHtml({ key:'1', name:'가', extra:{ docs:{ d1:{}, d2:{} } } });
}

test('★★★ 붙임새를 «모를 때» 「다 붙음」이라 단정하지 않는다', () => {
  const h = tiles(null);
  assert.ok(!/다 붙음/.test(h),
    '★★★ 어디에도 안 붙은 서류 두 장을 「다 붙음」으로 적는다 — 화면이 거짓말을 한다');
  assert.match(h, /읽는 중/, '★★ 왜 아직 모르는지 말해야 한다(「한 일」 칸과 같은 잣대)');
});

test('★★ 세어 봤으면 그대로 말한다 — 0이면 「다 붙음」, 남았으면 몇 건', () => {
  assert.match(tiles(0), /다 붙음/, '★★ 다 붙었는데 영영 「읽는 중」이다');
  assert.match(tiles(2), /안 붙음 2/, '★★ 안 붙은 서류가 몇인지 안 말한다');
});
