/* ══════ ✏ 상호 고치기 — 사진첩이 «잘못 읽은 이름» (대표 지시 2026-09-18) ═══════

   대표: 「농업회사법인 주식회사 «충서» 이다. 그런데 «총서»로 되어 있다.
         사진첩에서부터 잘못 읽었다. 이부분 어떻게 해결하고 …」
     모음 ㅜ/ㅗ 한 획 차이다. 기계는 어느 쪽이 맞는지 «알 길이 없다» —
     국세청 조회는 상태(계속·휴업·폐업)만 주고 **상호를 안 준다.**
     그래서 목표는 「기계가 알아서 고친다」가 아니라
     **「사람이 한 번만 보면 끝나게 한다」**이다.

   ★ 이 검사가 못 박는 것 넷
     ㉠ 대표가 «틀린 것을 보신 자리»(기업 상세)에서 고치실 수 있다
     ㉡⚠⚠ 고치는 것은 «비추는 이름»이 아니라 **뿌리(카드의 상호)**다.
        덮개를 따로 두면 화면은 「충서」인데 찾기·업체 맞추기·중복 판단은 「총서」를
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
  vm.runInContext([
    (SRC.match(/^const _norm = [^\n]*$/m) || [])[0],
    cutFn(SRC, 'function coNameCards('), cutFn(SRC, 'function coNameDocs('),
    cutFn(SRC, 'function coNameFixHtml('), cutFn(SRC, 'function coAskName('),
    'async ' + cutFn(SRC, 'function coNameFixDo(')
  ].join('\n'), ctx);
  ctx._calls = calls;
  return ctx;
}

/* 대표가 보신 그 회사 — 등록증 한 장이 「총서」로 읽혔다 */
const 등록증 = (id, nm) => ({ id, kind:'biz', company:nm, bizno:'587-86-01913' });
const 명함   = (id, nm) => ({ id, kind:'card', company:nm, name:'박성달' });
const 회사 = (over) => Object.assign({
  key:'b5878601913', name:'농업회사법인주식회사총서',
  bizs:[등록증('d1','농업회사법인주식회사총서')], cards:[],
  extra:{ docs:{ x1:{ id:'p9', year:'2026', owner:'kim', name:'통합 기술보호지원 신청서', at:2 } } }
}, over || {});

/* ── ㉢ 무엇을 고치는가 ──────────────────────────────────────────────── */

test('★★★ 지금 이름과 «똑같이» 적힌 서류만 고른다', () => {
  const c = load();
  const o = 회사({ cards:[ 명함('c1','농업회사법인주식회사총서'),
                          명함('c2','가나상사') ] });
  assert.deepEqual(Array.from(c.coNameCards(o)).map(x => x.id), ['d1','c1'],
    '★★★ 딸린 카드를 다 고치면 「가나상사」 명함이 「총서」 이름으로 덮인다');
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
  c.coAskName('b5878601913');
  assert.equal(c._calls.panel, '', '★★ 고칠 것이 없는데 창을 열면 눌러도 아무 일이 없다');
  assert.match(c._calls.toast.join(' '), /업체관리/,
    '★★★ 왜 못 고치는지 안 말하면 대표가 같은 자리를 계속 누르신다');
});

/* ── ㉡ 뿌리를 고친다 ────────────────────────────────────────────────── */

test('★★★ 카드의 «상호»를 진짜로 고친다 — 덮개를 씌우지 않는다', async () => {
  const o = 회사({ cards:[명함('c1','농업회사법인주식회사총서')] });
  const c = load({ list:[o], input:'농업회사법인 주식회사 충서' });
  await c.coNameFixDo('b5878601913');
  const w = c._calls.put[0];
  assert.equal(w.keys, 'company', '★★★ 다른 칸까지 쓰면 그 사이 남이 고친 값이 날아간다');
  assert.equal(w.n, 2, '★★ 등록증과 명함 둘 다 고쳐야 목록이 한 이름이 된다');
  assert.deepEqual(Array.from(w.names),
    ['농업회사법인 주식회사 충서','농업회사법인 주식회사 충서']);
  /* ⚠ 기업정보함에 이름 덮개를 따로 두지 «않는다» — 그러면 화면과 검색이 갈린다 */
  assert.ok(cutFn(SRC, 'function coNameFixDo(').indexOf('coSaveInfoPatch') < 0,
    '★★★ coInfo 에 이름을 따로 적으면 한 회사가 두 이름으로 갈라져 산다');
});

test('★★★ 묻고 나서 고친다 — 몇 장이 바뀌는지 «먼저» 말한다', async () => {
  const o = 회사({ cards:[명함('c1','농업회사법인주식회사총서')] });
  const c = load({ list:[o], input:'충서' });
  await c.coNameFixDo('b5878601913');
  assert.equal(c._calls.asked, 1, '★★★ 묻지 않고 고치면 되돌릴 길이 없다');
  assert.match(c._calls.msg, /2장/, '★★★ 등록증 한 장인 줄 알고 눌렀는데 명함까지 바뀐다');
  assert.match(c._calls.msg, /원본 사진은 그대로/, '★★ 사진까지 바뀌는 줄 알면 못 누르신다');
});

test('★★★ 「아니오」면 한 글자도 안 쓴다', async () => {
  const c = load({ list:[회사()], input:'충서', 예스:false });
  await c.coNameFixDo('b5878601913');
  assert.equal(c._calls.put.length, 0);
});

test('★★★ 상호를 «비울» 수는 없다 — 회사를 가리킬 이름이 없어진다', async () => {
  const c = load({ list:[회사()], input:'   ' });
  await c.coNameFixDo('b5878601913');
  assert.equal(c._calls.put.length, 0);
  assert.equal(c._calls.asked, 0, '★★ 묻지도 말아야 한다');
  assert.match(c._calls.toast.join(' '), /비울 수는 없습니다/);
});

test('★★ 그대로면 서버를 «안 만진다»', async () => {
  const c = load({ list:[회사()], input:'농업회사법인주식회사총서' });
  await c.coNameFixDo('b5878601913');
  assert.equal(c._calls.put.length, 0);
  assert.equal(c._calls.asked, 0);
});

test('★★ 고친 뒤 «몇 장을 고쳤는지» 말한다', async () => {
  const c = load({ list:[회사()], input:'농업회사법인 주식회사 충서' });
  await c.coNameFixDo('b5878601913');
  assert.match(c._calls.toast.join(' '), /충서/);
  assert.match(c._calls.toast.join(' '), /1장/);
});

/* ── ㉣ 원본을 볼 길 ─────────────────────────────────────────────────── */

test('★★★ 창에 «원본 보기»가 있다 — 한 획 차이는 눈으로만 가려진다', () => {
  const o = 회사();
  const c = load({ list:[o] });
  const h = c.coNameFixHtml(o);
  assert.match(h, /openCoDoc\('2026','p9','kim'\)/,
    '★★★ 원본을 못 보면 「총서」가 맞는지 「충서」가 맞는지 알 수가 없다');
  assert.match(h, /통합 기술보호지원 신청서/, '★★ 어느 서류인지 안 적으면 무엇을 여는지 모른다');
});

test('★★ 창이 «지금 이름»과 «바뀌는 장수»를 보여준다', () => {
  const o = 회사({ cards:[명함('c1','농업회사법인주식회사총서')] });
  const c = load({ list:[o] });
  const h = c.coNameFixHtml(o);
  assert.match(h, /농업회사법인주식회사총서/, '★★ 지금 이름이 없으면 무엇을 고치는지 모른다');
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

test('★★ 고친 뒤 목록을 «다시 짓는다» — 안 그러면 옛 이름이 화면에 남는다', () => {
  const fn = cutFn(SRC, 'function coNameFixDo(');
  assert.match(fn, /coListBust\(\)/, '★★★ 목록이 그대로면 고쳐도 안 고친 것처럼 보인다');
  assert.match(fn, /bulkPatchFlush\(cards, \['company'\]\)/,
    '★★ 한 장씩 보내면 2026-08-16 대량 쓰기 사고와 같은 길이 된다');
});
