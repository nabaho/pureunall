/* 정부사업일정 사진 고르기 — 「찍은 날 · 올린 순」 (대표 지시 2026-09-28 「최근올린순」)
 *
 * 무슨 일이 있었나: 9/27 에 올린 회의 사진이 «찍은 날»(9/2)로 묶여 한참 아래에 있어
 * 「사진첩에 올린 사진이 정부사업일정에 안 나온다」로 보였다. 사진첩은 «올린 날»로 묶는다.
 *
 * ★ 지키는 것: ① 기본은 올린 순, 이 PC 가 기억한다 ② 올린 순이면 올린 날로 묶고 칸에 찍은 날을
 *   적는다(다르면 표시) ③ 찍은 날 순은 예전 그대로(방문일 딱지 포함) ④ 합치기 순서는 안 건드린다
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');

const GOV = fs.readFileSync(path.join(__dirname, '..', 'gov-consulting.html'), 'utf8');
const T = function (s) { return Date.parse(s + '+09:00'); };

function box(order, rows, visit) {
  const body = { innerHTML: '' };
  const ctx = {
    Date, String, Math,
    PK: { order: order, size: 'md', sel: [] },
    q: function (s) { return s === '#pkaBody' ? body : null; },
    albumPickItems: rows,
    pkShown: function () { return rows.slice(); },
    pkVisitDay: function () { return visit || ''; },
    pkKindLabel: function () { return '회의·현장'; }, pkUsed: function () { return false; },
    pkName: function () { return '회의·현장'; }, escAttr: function (s) { return String(s); },
    pkThumbs: function () {}
  };
  vm.createContext(ctx);
  vm.runInContext([cutFn(GOV, 'function pkDayKey('), cutFn(GOV, 'function pkAt('),
    cutFn(GOV, 'function pkRows('), cutFn(GOV, 'function pkPaintBody(')].join('\n'), ctx);
  ctx.pkPaintBody();
  return body.innerHTML;
}
const rows = [
  { id: 'old', meta: { takenAt: T('2026-09-18T10:00:00'), upAt: T('2026-09-18T11:00:00'), byName: '권형하' } },
  { id: 'late', meta: { takenAt: T('2026-09-02T15:45:00'), upAt: T('2026-09-27T19:56:00'), byName: '권형하' } }
];

test('★★★ 올린 순이면 방금 올린 것이 «맨 위» — 찍은 날이 옛날이어도', () => {
  const h = box('up', rows);
  assert.ok(h.indexOf('9월 27일 올림') >= 0, '★★ 올린 날로 묶지 않습니다');
  assert.ok(h.indexOf('9월 27일 올림') < h.indexOf('9월 18일 올림'), '★★★ 방금 올린 것이 위로 안 옵니다');
  assert.ok(h.indexOf('data-pk-id="late"') < h.indexOf('data-pk-id="old"'));
});

test('★★ 올린 순에서는 칸에 «찍은 날»을 적고, 올린 날과 다르면 표시한다', () => {
  const h = box('up', rows);
  const late = h.slice(h.indexOf('data-pk-id="late"'));
  assert.match(late, /<span class="hl">찍음 9\/2 ·/, '★★ 9/27 에 올린 9/2 사진이 표시 없이 섞입니다');
  const old = h.slice(h.indexOf('data-pk-id="old"'));
  assert.match(old, /<span>찍음 9\/18 ·/, '★ 같은 날 올린 것까지 표시하면 표시가 뜻을 잃습니다');
});

test('★★ 찍은 날 순은 예전 그대로 — 찍은 날로 묶고 「올림」·표시가 없다', () => {
  const h = box('taken', rows, '2026-09-02');
  assert.ok(h.indexOf('9월 18일') < h.indexOf('9월 2일'), '찍은 날 내림차순이 아닙니다');
  assert.ok(h.indexOf('올림') < 0 && h.indexOf('class="hl"') < 0, '찍은 날 순에 올린 순 표시가 섞였습니다');
  assert.match(h, /9월 2일<b class="pka-vis">이 일정의 방문일<\/b>/, '방문일 딱지가 사라졌습니다');
});

test('★ 올린 날 묶음에는 「이 일정의 방문일」을 안 붙인다 — 올린 날은 방문일이 아니다', () => {
  /* 방문일 = 9/2(늦게 올린 사진의 찍은 날). 올린 순에서는 그 사진이 «9월 27일 올림» 묶음에
     들어가는데, 거기에 방문일 딱지가 붙으면 9/27 을 방문일로 읽게 된다. */
  const h = box('up', rows, '2026-09-02');
  assert.ok(h.indexOf('이 일정의 방문일') < 0, '★ 올린 날 묶음에 방문일 딱지를 붙입니다');
});

test('★★ 기본은 올린 순이고, 고른 것을 이 PC 가 기억한다', () => {
  function pref(v) {
    const ctx = { localStorage: { getItem: function () { return v; } } };
    vm.createContext(ctx);
    vm.runInContext((GOV.match(/^const PK_ORDER_LS = [^\n]*;$/m) || [''])[0].replace('const ', 'var ')
      + '\n' + cutFn(GOV, 'function pkOrderPref(') + '\nvar __r = pkOrderPref();', ctx);
    return ctx.__r;
  }
  assert.equal(pref(null), 'up', '★★ 처음 여는 사람에게 올린 순이 기본이 아닙니다(대표 결정)');
  assert.equal(pref('taken'), 'taken', '★ 찍은 날로 바꿔 둔 것을 안 기억합니다');
  assert.match(cutFn(GOV, 'function pkSetOrder(') || '', /localStorage\.setItem\(PK_ORDER_LS/, '★ 고른 것을 안 적어 둡니다');
});

test('★ 합치기(pkMergeItems)는 찍은 때 순 그대로 — 줄 세우기는 그릴 때 한다', () => {
  assert.match(cutFn(GOV, 'function pkMergeItems(') || '', /b\.meta\.takenAt\|\|0\)-\(a\.meta\.takenAt\|\|0\)/);
  assert.match(cutFn(GOV, 'function pkPaintBody(') || '', /const rows=pkRows\(\)/, '★ 그릴 때 고른 순서를 안 씁니다');
});
