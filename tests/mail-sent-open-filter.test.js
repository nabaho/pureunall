/* 👁 보낸메일함 「열어 본 것」 거르개 (대표 승인 목업 2026-10-05)

   「보낸메일함과 수신확인을 별도로 하는게 좋은건가 아니면 같이 보는게 좋은건가?」
   → 같이 본다. 누를 수 없던 「수신확인」 글자를 «누르면 켜지는 거르개»로 바꿨다.

   지키는 것.
   ① 켜면 보낸메일함에 «열린 것»만 — 받은 칸에는 아무 일도 안 한다
   ② 「누가 보냈나」 사람 칩과 함께 걸린다
   ③ 「안 연 것만」은 없다 — 그림을 막으면 읽어도 안 찍혀, 읽은 사람을 오해하게 된다
   ④ 옆줄(PC·폰 서랍) 단추 — 딴 칸에서 누르면 보낸메일함을 열며 켜고, 보낸메일함에서는 켜고 끈다
   ⑤ 이 기계에만 기억한다
   ⑥ 켜져 있으면 무엇을 보는지와 끄는 길이 목록 위에 보인다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { sliceFn } = require('./fnslice.js');

const app = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const T0 = 1759600000000;
/* 보낸 메일 넷 — 1·3 은 열림, 2·4 는 기록 없음. 1·2 는 홍길동이 보낸 것으로 짚인다 */
const ROWS = [
  { _slug:'SENT', u:1, t:'a@gana.kr', s:'급여대장', d:T0 },
  { _slug:'SENT', u:2, t:'b@gana.kr', s:'퇴직금',   d:T0 + 60000 * 5 },
  { _slug:'SENT', u:3, t:'c@dara.kr', s:'공문',     d:T0 + 60000 * 9 },
  { _slug:'SENT', u:4, t:'d@dara.kr', s:'안내',     d:T0 + 60000 * 13 },
];
function box(o){
  o = o || {};
  const ls = Object.assign({}, o.ls || {});
  const ctx = {
    Object, String, Number, Array, Math, JSON, console,
    state: Object.assign({ mbSentWho: o.who || '', mbFilter:'', mbQ:'' }, o.state || {}),
    localStorage: { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); } },
    _ls: ls,
    _mbOpen: o.opens === undefined ? null : o.opens,
    _memo: {}, _drew: 0, _opened: '',
    mbNow: () => (o.box || 'SENT'),
    mbSentBox: () => (o.box || 'SENT') === 'SENT',
    mbAllRows: () => ROWS.slice(),
    mbSpamOn: () => false, mbIsSpam: () => false, mbFindHit: () => false,
    mbWhoIndex: () => ({}),
    mbSentWho: v => ({ who: v.u <= 2 ? '홍길동' : '김철수' }),
    MB_SENT_NA: '*na',
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])),
    renderMailPage(){ ctx._drew++; }, renderPCSide(){},
    openMailBox(id){ ctx._opened = id; },
    mbTrackLoad(){},
  };
  ctx.mbMemoOf = () => ctx._memo;
  vm.createContext(ctx);
  vm.runInContext(app.match(/const MB_OPEN_ONLY_LS = [^;]+;/)[0].replace(/^const/, 'var'), ctx);
  ['mbTrackFp', 'mbOpenOf', 'mbOpenOnly', 'mbOpenOnlySet', 'mbOpenToggle', 'mbOpenCount',
   'mbOpenOnlyLineHtml', 'mbOpenPillHtml', 'mbMatchedRows']
    .forEach(n => vm.runInContext(sliceFn(app, 'function ' + n + '('), ctx));
  return ctx;
}
/* 열람 기록 — 서버(mail-deliver trackFp)와 같은 열쇠로 적는다 */
function opensFor(c, list){
  const out = {};
  list.forEach(r => { out[c.mbTrackFp(r.t, r.d, r.s)] = { first: r.d + 3600000, n: 1 }; });
  return out;
}
const us = rows => JSON.parse(JSON.stringify(rows)).map(v => v.u);

test('★★ 켜면 보낸메일함에 «열린 것»만 남는다 — 끄면 다 보인다', () => {
  const c = box();
  c._mbOpen = opensFor(c, [ROWS[0], ROWS[2]]);
  assert.deepEqual(us(c.mbMatchedRows()), [1, 2, 3, 4], '끈 채로 걸렀습니다');
  c.mbOpenOnlySet(true); c._memo = {};
  assert.deepEqual(us(c.mbMatchedRows()), [1, 3], '열린 것만 안 남았습니다');
  assert.equal(c.mbOpenCount(), 2);
});

test('★★ 「누가 보냈나」 사람 칩과 «함께» 걸린다', () => {
  const c = box({ who: '홍길동', ls: { pucards_mb_openonly: '1' } });
  c._mbOpen = opensFor(c, [ROWS[0], ROWS[2]]);
  assert.deepEqual(us(c.mbMatchedRows()), [1], '사람 칩과 함께 안 걸렸습니다');
});

test('★★ 받은 칸에서는 아무 일도 안 한다 — 받은 메일에는 열람 기록이 없다', () => {
  const c = box({ box: 'IN', ls: { pucards_mb_openonly: '1' } });
  c._mbOpen = {};
  assert.equal(c.mbMatchedRows().length, 4, '받은 칸에서 걸렀습니다');
  assert.equal(c.mbOpenOnlyLineHtml(), '', '받은 칸에 띠가 떴습니다');
});

test('★★ 켜고 끄면 «다시» 센다 — 담아 둔 셈이 옛 목록을 주면 눌러도 안 바뀐다', () => {
  const c = box();
  c._mbOpen = opensFor(c, [ROWS[0]]);
  assert.equal(c.mbMatchedRows().length, 4);
  c.mbOpenToggle();                       // 같은 그리기 안에서(셈을 안 버린 채) 켠다
  assert.equal(c.mbMatchedRows().length, 1, '켰는데 옛 셈이 나왔습니다');
  c._mbOpen = opensFor(c, [ROWS[0], ROWS[1]]);   // 열람 기록이 늦게 왔다
  assert.equal(c.mbMatchedRows().length, 2, '기록이 늦게 왔는데 다시 안 셌습니다');
});

test('★★★ 「안 연 것만」은 없다 — 읽어도 안 찍히는 사람을 「안 읽음」으로 오해하게 된다', () => {
  const mr = strip(sliceFn(app, 'function mbMatchedRows('));
  assert.ok(/filter\(v=>!!mbOpenOf\(v\)\)/.test(mr), '열린 것 거르기가 없습니다');
  assert.ok(!/filter\(v=>!mbOpenOf\(v\)\)/.test(strip(app)), '「안 연 것」 거르기가 생겼습니다');
});

test('★★ 옆줄 단추 — 딴 칸에서 누르면 보낸메일함을 «열며» 켜고, 보낸메일함에서는 켜고 끈다', () => {
  const c = box({ box: 'IN' });
  c.mbOpenToggle('SENT');
  assert.equal(c._opened, 'SENT', '보낸메일함을 안 열었습니다');
  assert.equal(c.mbOpenOnly(), true, '열면서 안 켰습니다');
  const s = box({ ls: { pucards_mb_openonly: '1' } });
  s.mbOpenToggle('SENT');
  assert.equal(s.mbOpenOnly(), false, '보낸메일함에서 눌렀는데 안 꺼졌습니다');
  assert.equal(s._opened, '', '이미 보낸메일함인데 또 열었습니다');
});

test('★★ PC 옆줄·폰 서랍 모두 «누를 수 있는» 단추다 — 줄을 누른 것과 섞이지 않는다', () => {
  const c = box();
  const h = c.mbOpenPillHtml('SENT');
  assert.match(h, /event\.stopPropagation\(\);mbOpenToggle\('SENT'\)/, '누르면 줄까지 눌립니다');
  assert.match(h, /수신확인이 아니라/, '다음메일 수신확인인 줄 압니다');
  const side = strip(sliceFn(app, 'function mailSideHtml('));
  const drawer = strip(sliceFn(app, 'function mbDrawerHtml('));
  assert.ok(/mbOpenPillHtml\(f\.slug\)/.test(side), 'PC 옆줄에 단추가 없습니다');
  assert.ok(/mbOpenPillHtml\(f\.slug,\s*';mbDrawer\(false\)'\)/.test(drawer), '폰 서랍에 단추가 없거나 서랍이 안 닫힙니다');
});

test('★ 이 기계에만 기억한다 — 다시 열어도 켜진 그대로', () => {
  const c = box();
  c.mbOpenOnlySet(true);
  assert.equal(c._ls.pucards_mb_openonly, '1');
  const again = box({ ls: c._ls });
  assert.equal(again.mbOpenOnly(), true, '다시 열었더니 꺼졌습니다');
});

test('★★ 켜져 있으면 목록 위 한 줄 — 몇 통인지와 「모두 보기」, 기록을 아직 못 읽었으면 그렇다고', () => {
  const c = box({ ls: { pucards_mb_openonly: '1' } });
  assert.match(c.mbOpenOnlyLineHtml(), /읽고 있습니다/, '못 읽었는데 0통이라고 합니다');
  c._mbOpen = opensFor(c, [ROWS[0], ROWS[2]]); c._memo = {};
  const h = c.mbOpenOnlyLineHtml();
  assert.match(h, /열어 본 것만 2통/);
  assert.match(h, /mbOpenToggle\(\)/, '끄는 길이 없습니다');
  assert.ok(h.indexOf('<br') < 0, '띠가 두 줄입니다');
  const list = strip(sliceFn(app, 'function mbListHtml('));
  assert.ok(list.indexOf('mbOpenOnlyLineHtml()') > 0, '목록 위에 띠를 안 그립니다');
  const off = box();
  assert.equal(off.mbOpenOnlyLineHtml(), '', '꺼져 있는데 띠가 떴습니다');
});
