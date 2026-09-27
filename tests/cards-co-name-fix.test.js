/* ══════ ✏ 상호 고치기 — 사진첩이 «잘못 읽은 이름» (대표 지시 2026-09-18) ═══════

   대표: 「농업회사법인 주식회사 «부성» 이다. 그런데 «보성»으로 되어 있다.
         사진첩에서부터 잘못 읽었다. 이부분 어떻게 해결하고 …」
     모음 ㅜ/ㅗ 한 획 차이다. 기계는 어느 쪽이 맞는지 «알 길이 없다» —
     국세청 조회는 상태(계속·휴업·폐업)만 주고 **상호를 안 준다.**
     그래서 목표는 「기계가 알아서 고친다」가 아니라
     **「사람이 한 번만 보면 끝나게 한다」**이다.

   ★ 이 검사가 못 박는 것 넷
     ㉠ 대표가 «틀린 것을 보신 자리»(기업 상세)에서 고치실 수 있다
     ㉡⚠⚠ 고치는 것은 «비추는 이름»이 아니라 **뿌리(카드의 상호)**다.
        덮개를 따로 두면 화면은 「부성」인데 찾기·업체 맞추기·중복 판단은 「보성」을
        본다 — 한 회사가 두 이름으로 갈라져 산다.
     ㉢⚠⚠ **지금 이름과 똑같이 적힌 서류만** 고친다. 딸린 카드를 모두 고치면
        「가나상사」 명함이 「가나」로 바뀐다 — 그 명함은 틀린 것이 아니다.
     ㉣ 원본 사진을 «열어 볼 길»이 그 자리에 있다. 한 획 차이는 눈으로만 가려진다.

   node --test tests/cards-co-name-fix.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { cutFn } = require('./cut-fn');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8')
  .split('\r\n').join('\n');

function load(over){
  const calls = { asked:0, msg:'', put:[], toast:[], opened:[], panel:'' };
  const ctx = Object.assign({ console, Object, Array, String, Number, Set, Promise, JSON, Date,
    esc: s => String(s == null ? '' : s)
      .replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])),
    state: { coPick: '' },
    _closeBtn: () => '<x>',
    $: () => (over && over.input !== undefined) ? { value: over.input, focus(){}, select(){} } : null,
    setTimeout: (fn) => fn(),
    showPanel: h => { calls.panel = h; },
    toast: m => calls.toast.push(String(m)),
    confirm: m => { calls.asked++; calls.msg = String(m); return !(over && over.예스 === false); },
    openCoDoc: (y, i, w) => calls.opened.push([y, i, w].join('|')),
    openCoDetailPanel: () => {},
    coListBust: () => {}, render: () => {},
    bulkPatchFlush: (items, keys) => { calls.put.push({ n: items.length, keys: keys.join(','),
      names: items.map(x => x.company) }); return Promise.resolve(1); },
    coList: () => (over && over.list) || [] }, (over && over.ctx) || {});
  vm.createContext(ctx);
  /* 이 PC 저장소 대역 — 고친 글자 짝을 적어 두는 자리다(진짜 브라우저 것이 아니다) */
  const bag = Object.assign({}, (over && over.기억) || {});
  ctx.localStorage = { getItem: k => (k in bag ? bag[k] : null),
                       setItem: (k, v) => { bag[k] = String(v); } };
  ctx._bag = bag;
  vm.runInContext([
    (SRC.match(/^const _norm = [^\n]*$/m) || [])[0],
    (SRC.match(/^const CO_NAMEFIX_LS = [^\n]*$/m) || [])[0].replace('const ', 'var '),
    cutFn(SRC, 'function coNameFixLoad('), cutFn(SRC, 'function coNameFixSave('),
    cutFn(SRC, 'function coNameFixPairs('), cutFn(SRC, 'function coNameFixRemember('),
    cutFn(SRC, 'function coNameFixSuggest('), cutFn(SRC, 'function coNameFixTake('),
    cutFn(SRC, 'function coNameCards('), cutFn(SRC, 'function coNameDocs('),
    cutFn(SRC, 'function coNameOff1('),
    cutFn(SRC, 'function coNameFixHtml('), cutFn(SRC, 'function coAskName('),
    'async ' + cutFn(SRC, 'function coNameFixDo(')
  ].join('\n'), ctx);
  ctx._calls = calls;
  return ctx;
}

/* 대표가 보신 그 회사 — 등록증 한 장이 「보성」으로 읽혔다 */
const 등록증 = (id, nm) => ({ id, kind:'biz', company:nm, bizno:'123-45-67891' });
const 명함   = (id, nm) => ({ id, kind:'card', company:nm, name:'홍길동' });
const 회사 = (over) => Object.assign({
  key:'b1234567891', name:'농업회사법인주식회사보성',
  bizs:[등록증('d1','농업회사법인주식회사보성')], cards:[],
  extra:{ docs:{ x1:{ id:'p9', year:'2026', owner:'kim', name:'통합 기술보호지원 신청서', at:2 } } }
}, over || {});

/* ── ㉢ 무엇을 고치는가 ──────────────────────────────────────────────── */

test('★★★ 지금 이름과 «똑같이» 적힌 서류만 고른다', () => {
  const c = load();
  const o = 회사({ cards:[ 명함('c1','농업회사법인주식회사보성'),
                          명함('c2','가나상사') ] });
  assert.deepEqual(Array.from(c.coNameCards(o)).map(x => x.id), ['d1','c1'],
    '★★★ 딸린 카드를 다 고치면 「가나상사」 명함이 「보성」 이름으로 덮인다');
});

test('★★ (주)·주식회사·띄어쓰기 차이는 «같은 이름»으로 본다 — 목록이 그 잣대로 묶었다', () => {
  const c = load();
  const o = 회사({ name:'주식회사 가나', bizs:[등록증('d1','(주)가나')], cards:[명함('c1','가나')] });
  assert.equal(Array.from(c.coNameCards(o)).length, 2,
    '★★ 목록은 한 회사로 묶어 놓고 고칠 때만 갈라 보면, 고쳐도 옛 이름이 남는다');
});

test('★★★ 「상호 못 읽음」 등록증에 이름을 «넣을 수» 있다 — 그 회사야말로 필요하다', () => {
  /* ⚠ coListBuild 끝: 번호는 또렷한데 상호가 흐려 못 읽는 일이 있다.
     예전에는 이름이 비면 여기서 막아, 정작 채워 넣어야 할 회사에 ✏ 가 안 떴다
     (2026-09-18 이빨 확인이 그 가드를 「죽은 줄」로 짚어 주었다). */
  const c = load();
  const o = 회사({ name:'', bizs:[등록증('d1','')], cards:[] });
  assert.deepEqual(Array.from(c.coNameCards(o)).map(x => x.id), ['d1'],
    '★★★ 상호를 못 읽은 등록증이야말로 이름을 넣어 줘야 하는 곳이다');
});

test('★★★ 빈 이름이 «남의 상호»를 걸어 오지 않는다', () => {
  const c = load();
  const o = 회사({ name:'', bizs:[등록증('d1',''), 등록증('d2','가나상사')],
                   cards:[명함('c1','가나상사')] });
  assert.deepEqual(Array.from(c.coNameCards(o)).map(x => x.id), ['d1'],
    '★★★ 빈 이름으로 다 걸리면 「가나상사」가 통째로 덮인다');
  assert.equal(Array.from(c.coNameCards(null)).length, 0, '★ 회사가 없어도 안 터진다');
});

test('★★ 카드가 없는 회사(업체관리에서만 온 이름)는 여기서 못 고친다고 «말한다»', () => {
  const c = load({ list:[회사({ bizs:[], cards:[] })] });
  c.coAskName('b1234567891');
  assert.equal(c._calls.panel, '', '★★ 고칠 것이 없는데 창을 열면 눌러도 아무 일이 없다');
  assert.match(c._calls.toast.join(' '), /업체관리/,
    '★★★ 왜 못 고치는지 안 말하면 대표가 같은 자리를 계속 누르신다');
});

/* ── ㉡ 뿌리를 고친다 ────────────────────────────────────────────────── */

test('★★★ 카드의 «상호»를 진짜로 고친다 — 덮개를 씌우지 않는다', async () => {
  const o = 회사({ cards:[명함('c1','농업회사법인주식회사보성')] });
  const c = load({ list:[o], input:'농업회사법인 주식회사 부성' });
  await c.coNameFixDo('b1234567891');
  const w = c._calls.put[0];
  assert.equal(w.keys, 'company', '★★★ 다른 칸까지 쓰면 그 사이 남이 고친 값이 날아간다');
  assert.equal(w.n, 2, '★★ 등록증과 명함 둘 다 고쳐야 목록이 한 이름이 된다');
  assert.deepEqual(Array.from(w.names),
    ['농업회사법인 주식회사 부성','농업회사법인 주식회사 부성']);
  /* ⚠ 기업정보함에 이름 덮개를 따로 두지 «않는다» — 그러면 화면과 검색이 갈린다 */
  assert.ok(cutFn(SRC, 'function coNameFixDo(').indexOf('coSaveInfoPatch') < 0,
    '★★★ coInfo 에 이름을 따로 적으면 한 회사가 두 이름으로 갈라져 산다');
});

test('★★★ 묻고 나서 고친다 — 몇 장이 바뀌는지 «먼저» 말한다', async () => {
  const o = 회사({ cards:[명함('c1','농업회사법인주식회사보성')] });
  const c = load({ list:[o], input:'부성' });
  await c.coNameFixDo('b1234567891');
  assert.equal(c._calls.asked, 1, '★★★ 묻지 않고 고치면 되돌릴 길이 없다');
  assert.match(c._calls.msg, /2장/, '★★★ 등록증 한 장인 줄 알고 눌렀는데 명함까지 바뀐다');
  assert.match(c._calls.msg, /원본 사진은 그대로/, '★★ 사진까지 바뀌는 줄 알면 못 누르신다');
});

test('★★★ 「아니오」면 한 글자도 안 쓴다', async () => {
  const c = load({ list:[회사()], input:'부성', 예스:false });
  await c.coNameFixDo('b1234567891');
  assert.equal(c._calls.put.length, 0);
});

test('★★★ 상호를 «비울» 수는 없다 — 회사를 가리킬 이름이 없어진다', async () => {
  const c = load({ list:[회사()], input:'   ' });
  await c.coNameFixDo('b1234567891');
  assert.equal(c._calls.put.length, 0);
  assert.equal(c._calls.asked, 0, '★★ 묻지도 말아야 한다');
  assert.match(c._calls.toast.join(' '), /비울 수는 없습니다/);
});

test('★★ 그대로면 서버를 «안 만진다»', async () => {
  const c = load({ list:[회사()], input:'농업회사법인주식회사보성' });
  await c.coNameFixDo('b1234567891');
  assert.equal(c._calls.put.length, 0);
  assert.equal(c._calls.asked, 0);
});

test('★★ 고친 뒤 «몇 장을 고쳤는지» 말한다', async () => {
  const c = load({ list:[회사()], input:'농업회사법인 주식회사 부성' });
  await c.coNameFixDo('b1234567891');
  assert.match(c._calls.toast.join(' '), /부성/);
  assert.match(c._calls.toast.join(' '), /1장/);
});

/* ── ㉣ 원본을 볼 길 ─────────────────────────────────────────────────── */

test('★★★ 창에 «원본 보기»가 있다 — 한 획 차이는 눈으로만 가려진다', () => {
  const o = 회사();
  const c = load({ list:[o] });
  const h = c.coNameFixHtml(o);
  assert.match(h, /openCoDoc\('2026','p9','kim'\)/,
    '★★★ 원본을 못 보면 「보성」이 맞는지 「부성」이 맞는지 알 수가 없다');
  assert.match(h, /통합 기술보호지원 신청서/, '★★ 어느 서류인지 안 적으면 무엇을 여는지 모른다');
});

test('★★ 창이 «지금 이름»과 «바뀌는 장수»를 보여준다', () => {
  const o = 회사({ cards:[명함('c1','농업회사법인주식회사보성')] });
  const c = load({ list:[o] });
  const h = c.coNameFixHtml(o);
  assert.match(h, /농업회사법인주식회사보성/, '★★ 지금 이름이 없으면 무엇을 고치는지 모른다');
  assert.match(h, /똑같이 적힌 서류 2장/, '★★★ 몇 장이 바뀌는지 창에서도 말해야 한다');
  assert.match(h, /안 건드립니다/, '★★ 다른 서류가 안전하다는 말이 없으면 못 누르신다');
  assert.match(h, /id="coNameNew"/, '★ 적을 칸이 없다');
});

test('★ 서류가 없어도 창은 열린다 — 원본만 못 볼 뿐이다', () => {
  const o = 회사({ extra:{} });
  const c = load({ list:[o] });
  const h = c.coNameFixHtml(o);
  assert.ok(h.indexOf('openCoDoc(') < 0, '없는 원본을 여는 단추를 두면 눌러도 아무 일이 없다');
  assert.match(h, /id="coNameNew"/);
});

/* ── ㉠ 대표가 «보신 자리»에 있는가 ─────────────────────────────────── */

test('★★★ 기업 상세 이름 옆에 ✏ 가 선다 — 틀린 것을 보신 그 자리다', () => {
  const panel = cutFn(SRC, 'function coDetailPanelHtml(');
  assert.match(panel, /coAskName\('/, '★★★ 여기에 없으면 사업자 탭으로 건너가 다시 찾아야 한다');
  assert.match(panel, /coNameCards\(o\)\.length\?/,
    '★★ 고칠 서류가 없는 회사에도 ✏ 를 띄우면 눌러도 아무 일이 없다');
  /* ⚠ 이름 «자체»를 누르게 하지 않는다 — 길어서 읽다가 잘못 눌린다 */
  assert.ok(!/class="pdname" onclick/.test(panel),
    '★★ 이름 전체가 단추가 되면 읽다가 고치기 창이 열린다');
});

/* ══ 고친 «글자 짝»을 기억한다 — 제안만 한다 (대표 지시 2026-09-18) ═══════════
   「다른 사업장도 이렇게 잘못 읽혀질때 … 어떻게 자동으로 정리시켜야 할까?」
   ⚠⚠ 자동으로는 안 된다 — 국세청 조회는 상호를 안 주고, 기계는 어느 쪽이 맞는지
     알 길이 없다. 할 수 있는 것은 «사람이 한 번 고친 것을 기억해 두었다가 묻는 것»뿐이다. */

test('★★★ 대표가 실제로 하신 고침에서 「보 → 부」를 뽑아낸다', () => {
  const c = load();
  /* ⚠ 띄어쓰기가 늘어난 고침이다 — 공백까지 글자로 세면 아무 짝도 안 뽑힌다 */
  assert.deepEqual(Array.from(c.coNameFixPairs('농업회사법인주식회사보성',
                                               '농업회사법인 주식회사 부성')).map(p => p.join('→')),
    ['보→부'], '★★★ 바로 이 고침을 못 외우면 기억할 것이 아무것도 없다');
});

test('★★★ 서너 글자가 한꺼번에 바뀌면 «안 외운다» — 오독이 아니라 다른 이름이다', () => {
  const c = load();
  assert.equal(Array.from(c.coNameFixPairs('가나상사', '다라무역')).length, 0);
  assert.equal(Array.from(c.coNameFixPairs('보성', '부성산업')).length, 0,
    '★★★ 길이가 달라지면 「한 글자 오독」이 아니라 이름을 새로 적으신 것이다');
  assert.equal(Array.from(c.coNameFixPairs('가나', '가나상사')).length, 0, '★★ 길이가 다르면 안 본다');
  assert.equal(Array.from(c.coNameFixPairs('가나상사', '가나상사')).length, 0, '★ 안 바뀐 것은 없다');
});

test('★★★ 고친 뒤에 외운다 — 못 썼는데 외우면 «일어나지도 않은» 고침을 제안한다', async () => {
  const c = load({ list:[회사()], input:'농업회사법인 주식회사 부성' });
  await c.coNameFixDo('b1234567891');
  assert.deepEqual(Array.from(c.coNameFixLoad()).map(p => p.join('→')), ['보→부']);
  /* 못 썼을 때는 안 외운다 */
  const d = load({ list:[회사()], input:'농업회사법인 주식회사 부성', 예스:false });
  await d.coNameFixDo('b1234567891');
  assert.equal(Array.from(d.coNameFixLoad()).length, 0,
    '★★★ 「아니오」를 누르셨는데 외워 두면 다음에 엉뚱한 제안이 뜬다');
});

test('★★ 같은 짝은 «한 번만» 쌓인다 — 고칠 때마다 쌓으면 목록이 부풀어 잘린다', () => {
  const c = load();
  c.coNameFixRemember('보성', '부성');
  c.coNameFixRemember('보성산업', '부성산업');   /* 같은 「보→부」다 */
  c.coNameFixRemember('가서', '거서');
  assert.deepEqual(Array.from(c.coNameFixLoad()).map(p => p.join('→')), ['보→부','가→거'],
    '★★ 200개를 넘으면 앞엣것부터 잘린다 — 겹쳐 쌓으면 진짜 기억이 밀려 나간다');
});

test('★★★ 다음에 같은 글자가 보이면 «후보»를 만들어 보여준다', () => {
  const c = load({ 기억: { pucards_namefix: JSON.stringify([['보','부']]) } });
  const got = Array.from(c.coNameFixSuggest('보성산업'));
  assert.equal(got.length, 1);
  assert.equal(got[0].text, '부성산업');
  assert.equal(got[0].from + '→' + got[0].to, '보→부', '★★ 무엇을 바꾸는지 안 보이면 못 믿는다');
});

test('★★★ 저절로 바뀌지 «않는다» — 「보건부」가 「부건부」가 되면 안 된다', () => {
  const o = 회사({ name:'보건산업' });
  const c = load({ list:[o], 기억: { pucards_namefix: JSON.stringify([['보','부']]) } });
  const h = c.coNameFixHtml(o);
  /* 제안은 뜨되, 적을 칸에는 «지금 이름»이 그대로 있어야 한다 */
  assert.match(h, /conamesug/, '★★ 제안이 아예 없으면 기억한 값어치가 없다');
  assert.match(h, /value="보건산업"/,
    '★★★ 제안이 칸을 미리 바꿔 두면, 그대로 누르는 순간 「부건산업」이 된다');
  assert.match(h, /coNameFixTake\(/, '★★ 후보를 칸에 채워 넣을 길이 없다');
  assert.match(h, /보→부/,
    '★★★ 무엇을 바꾸자는 것인지 «화면에» 안 보이면, 「보건부」가 「부건부」가 되는 제안을 걸러낼 수가 없다');
});

test('★★ 적어 둔 것이 없으면 제안 자리가 «아예 없다»', () => {
  const o = 회사();
  const c = load({ list:[o] });
  assert.ok(c.coNameFixHtml(o).indexOf('conamesug') < 0, '★★ 빈 띠가 줄을 먹는다');
});

test('★★★ 후보를 누르면 «칸에 채워만» 둔다 — 여기서 저장하지 않는다', async () => {
  /* ⚠ 저장으로 새는지 보려면 «저장이 될 수 있는 판»을 깔아 둬야 한다 —
     회사도 고를 서류도 없으면 무엇을 해도 안 써져서, 검사가 아무것도 못 본다. */
  const box = { value:'보성산업', focus(){} };
  const o = 회사({ name:'보성산업', bizs:[등록증('d1','보성산업')], cards:[] });
  const c = load({ list:[o], ctx: { $: () => box, state: { coPick:'b1234567891' } } });
  c.coNameFixTake('부성산업');
  await new Promise(r => setImmediate(r));
  assert.equal(box.value, '부성산업');
  assert.equal(c._calls.put.length, 0,
    '★★★ 누르자마자 저장되면 「확인하고 누르셔야 바뀝니다」가 거짓말이 된다');
  assert.equal(c._calls.asked, 0, '★★ 묻지도 않고 지나갔다');
});

/* ══ 🔗 합치기가 «한 글자 다른» 줄도 찾아낸다 (대표 지시 2026-09-18) ═══════════
   잘못 읽힌 이름은 한 회사를 «두 줄»로 갈라놓는다. 그런데 글자가 안 들어맞으니
   합칠 상대를 찾아도 안 나왔다 — 합칠 길이 통째로 막혀 있었다. */

test('★★★ 「부성」으로 찾으면 「보성」 줄이 «나온다»', () => {
  const ctx = { console, Object, Array, String, Number };
  vm.createContext(ctx);
  ctx.coList = () => [ { key:'a', name:'보성산업', bizno:'1' },
                       { key:'b', name:'가나상사', bizno:'2' },
                       { key:'me', name:'부성산업', bizno:'3' } ];
  ctx._coInfo = {};
  vm.runInContext([cutFn(SRC, 'function coMergedKeys('), cutFn(SRC, 'function coNameOff1('),
                   cutFn(SRC, 'function coMergeFinds(')].join('\n'), ctx);
  assert.deepEqual(Array.from(ctx.coMergeFinds('me', '부성산업')).map(o => o.key), ['a'],
    '★★★ 글자가 안 들어맞으면 합칠 길이 통째로 막힌다');
});

test('★★ 글자가 그대로 들어맞는 줄이 «언제나 먼저»다', () => {
  const ctx = { console, Object, Array, String, Number };
  vm.createContext(ctx);
  ctx.coList = () => [ { key:'off', name:'보성산업', bizno:'1' },
                       { key:'hit', name:'부성산업 아산점', bizno:'2' },
                       { key:'me', name:'부성산업', bizno:'3' } ];
  ctx._coInfo = {};
  vm.runInContext([cutFn(SRC, 'function coMergedKeys('), cutFn(SRC, 'function coNameOff1('),
                   cutFn(SRC, 'function coMergeFinds(')].join('\n'), ctx);
  assert.deepEqual(Array.from(ctx.coMergeFinds('me', '부성산업')).map(o => o.key), ['hit','off'],
    '★★ 짐작한 것이 앞에 서면, 확실한 것을 못 보고 지나친다');
});

test('★★★ 두 글자 이상 다르면 «안» 본다 — 「두레」과 「두레전자」는 다른 곳이다', () => {
  const c = load();
  assert.equal(c.coNameOff1('보성', '부성'), true);
  assert.equal(c.coNameOff1('보성산업', '부성상업'), false,
    '★★★ 두 글자가 다르면 오독이 아니라 다른 회사다 — 합치면 남의 서류가 딸려 간다');
  assert.equal(c.coNameOff1('가나상사', '다라무역'), false);
  assert.equal(c.coNameOff1('보성', '부성산업'), false,
    '★★★ 길이가 다르면 안 본다 — 「가나」와 「가나상사」가 한 곳으로 합쳐진다');
  assert.equal(c.coNameOff1('가나', '가나상사'), false, '★★ 길이가 다르면 안 본다');
  assert.equal(c.coNameOff1('가나', '가나'), false, '★ 같은 것은 합칠 상대가 아니다');
  assert.equal(c.coNameOff1('가', '나'), false, '★★ 한 글자짜리는 다 한 글자 차이다 — 안 본다');
  assert.equal(c.coNameOff1('부성 산업', '보성산업'), true, '★★ 띄어쓰기는 글자로 안 센다');
});

test('★★ 고친 뒤 목록을 «다시 짓는다» — 안 그러면 옛 이름이 화면에 남는다', () => {
  const fn = cutFn(SRC, 'function coNameFixDo(');
  assert.match(fn, /coListBust\(\)/, '★★★ 목록이 그대로면 고쳐도 안 고친 것처럼 보인다');
  assert.match(fn, /bulkPatchFlush\(cards, \['company'\]\)/,
    '★★ 한 장씩 보내면 2026-08-16 대량 쓰기 사고와 같은 길이 된다');
});
