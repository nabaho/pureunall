'use strict';
/* 🗖 한글 편집기를 큰 창으로 · ⛶ 전체 화면 · ⌨ 단축키 (대표 지시 2026-09-26)
   ─────────────────────────────────────────────────────────────
   대표 지시: 「한글편집화면 너무 내려왔다. 팝업창으로 크게 볼수 있게 해달라.
              한글단축키와 똑같이 사용할 수 있도록 해달라.」

   ■ 재어 보고 안 것 ①  «따로 뜨는 창»(window.open)으로는 못 한다
     편집기(rhwp-studio)는 제 «부모 문서»가 보낸 것만 받는다 —
     `if(i.source!==e.parentWindow) { 포트 닫고 return; }`.
     딴 문서에 심어 보니 편집기는 멀쩡히 떴는데(WASM 초기화 완료 로그까지) 악수
     (rhwp-connect)가 통째로 무시돼 서류를 넣지도 받지도 못했다.
     → 같은 문서 안에서 화면을 통째로 덮는다. 전체 화면은 브라우저 껍데기까지
       사라지므로 따로 뜨는 창보다 오히려 넓다.

   ■ 재어 보고 안 것 ②  1440×900 에서 편집칸 632 → 847px (시작 185 → 46px),
     틀(iframe)은 그대로 «하나»이고 편집기도 살아 있었다(pageCount 1).

   여기서 못 박는 것:
     ① 틀을 «옮기지 않는다» — 옮기면 고치던 것이 사라진다
     ② 켜면 덮고 화면을 잠그고, 끄면 «반드시» 푼다
     ③ 나갈 길(Esc)이 늘 있다 — 전체 화면 중에는 브라우저에 비켜 준다
     ④ 듣는 사람은 한 번만 붙는다
     ⑤ 여는 «뒤»에 편다 — 순서를 바꾸면 펴자마자 도로 접힌다
     ⑥ 편집기가 없는데 검은 화면만 남기지 않는다
     ⑦ 전체 화면을 나오면 잠근 키를 «반드시» 푼다
     ⑧ 단축키 목록을 손으로 적지 않는다 — 편집기에게 묻는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripComments } = require('./strip-comments');

const R = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(R, 'kcareer.html'), 'utf8');
const CODE = stripComments(SRC);

function cutFn(src, decl) {
  const head = src.indexOf(decl);
  assert.notEqual(head, -1, decl + ' 을 찾지 못했습니다 — 이름이 바뀌었나요?');
  let i = src.indexOf('{', head + decl.length), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (!depth) break; }
  }
  return src.slice(head, i + 1);
}

/* 가짜 화면 — 막대·상자·단추와 «듣는 사람»을 손에 들고 본다 */
function 세상(opt) {
  opt = opt || {};
  const 들은것 = [], 알림 = [], 붙인것 = [];
  const mk = (id) => ({
    id, textContent: '', innerHTML: '', style: {},
    _cls: new Set(),
    classList: {
      toggle: function (c, on) { if (on) mk._set.add(c); else mk._set.delete(c); },
      contains: (c) => mk._set.has(c)
    },
    remove: function () { this._removed = true; },
    onclick: null
  });
  mk._set = new Set();
  const 막대 = mk('rhHwpEd');
  const 큰단추 = { id: 'rhEdBigBtn', textContent: '🗖 큰 창', style: {} };
  const 전체단추 = { id: 'rhEdFullBtn', textContent: '⛶ 전체 화면', style: {} };
  const body = { style: {}, appendChild: (el) => { 붙인것.push(el); } };
  const 있는것 = { rhHwpEd: 막대, rhEdBigBtn: 큰단추, rhEdFullBtn: 전체단추 };

  const ctx = {
    console, JSON, String, Number, Array, Object, Error, Date, Boolean, Set, Promise,
    setTimeout,
    document: {
      body,
      fullscreenElement: opt.전체화면 ? 막대 : null,
      getElementById: (id) => 있는것[id] || null,
      createElement: () => ({ id: '', style: { cssText: '' }, innerHTML: '', onclick: null,
        remove: function () { this._removed = true; } }),
      addEventListener: (ev, fn) => { 들은것.push({ ev, fn }); },
      removeEventListener: (ev, fn) => {
        const i = 들은것.findIndex((x) => x.ev === ev && x.fn === fn);
        if (i >= 0) 들은것.splice(i, 1);
      },
      exitFullscreen: async () => { ctx.document.fullscreenElement = null; }
    },
    navigator: opt.잠그개 === false ? {} : {
      keyboard: {
        lock: async (keys) => { if (opt.잠금실패) throw new Error('막힘'); ctx._잠근키 = keys; },
        unlock: () => { ctx._푼적 = (ctx._푼적 || 0) + 1; }
      }
    },
    toast: (m, ms) => { 알림.push({ m: String(m), ms }); },
    escapeHtml: (x) => String(x == null ? '' : x),
    _safe: (f) => { try { return f(); } catch (e) { ctx._safeErr = String(e); } },
    _막대: 막대, _옷: mk._set, _큰단추: 큰단추, _전체단추: 전체단추,
    _body: body, _들은것: 들은것, _알림: 알림, _붙인것: 붙인것, _있는것: 있는것
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);

  /* ⚠ 잠글 키 목록은 «소스에 적힌 그대로» 가져온다 — 여기 다시 적으면 소스가 바뀌어도 모른다 */
  const 키줄 = CODE.match(/var\s+RH_ED_LOCK_KEYS\s*=\s*\[[^\]]*\];/);
  assert.ok(키줄, 'RH_ED_LOCK_KEYS 를 찾지 못했습니다');
  vm.runInContext(키줄[0], ctx);
  vm.runInContext('var _rhEdBig=false,_rhEdBigWant=true,_rhEdEsc=null,_rhEdFsBound=false;'
    + ' var _rhHwpEd=null, _hwpViewEd=null;', ctx);
  ['function rhEdBigSet(', 'function rhHwpEdBig(', 'function _rhEdFsWatch(',
   'async function rhHwpEdFull(', 'async function rhHwpEdKeys(']
    .forEach((d) => vm.runInContext(cutFn(CODE, d), ctx));
  /* 전체 화면 들어가기는 브라우저 일이라 가짜로 — 부르면 그렇다고 적어 둔다 */
  막대.requestFullscreen = async () => {
    if (opt.전체화면실패) throw new Error('막혔습니다');
    ctx.document.fullscreenElement = 막대;
  };
  return ctx;
}

/* ══════ ① 틀을 옮기지 않는다 ══════ */
test('★★ 큰 창은 «옷만» 갈아입힌다 — 틀을 옮기면 고치던 것이 사라진다', () => {
  const src = cutFn(CODE, 'function rhEdBigSet(');
  ['innerHTML', 'appendChild', 'removeChild', 'destroy(', 'createEditor', 'insertBefore']
    .forEach((금지) => {
      assert.ok(!src.includes(금지),
        '★ rhEdBigSet 이 «' + 금지 + '» 를 합니다 — 틀이 다시 읽혀 고치던 것이 사라집니다');
    });
  assert.match(src, /classList\.toggle\(\s*['"]rh-ed-big['"]/,
    'rh-ed-big 옷을 갈아입히지 않습니다');
});

test('★ 큰 창 규칙은 자리를 «덮기»만 한다(position:fixed) — DOM 을 안 건드린다', () => {
  const i = CODE.indexOf('#rhHwpEd.rh-ed-big{');
  assert.notEqual(i, -1, '큰 창 규칙이 없습니다');
  const 규칙 = CODE.slice(i, CODE.indexOf('}', i));
  assert.match(규칙, /position:fixed/, '★ 덮지 않으면 여전히 아래로 밀립니다');
  assert.match(규칙, /inset:0/, '★ 가장자리를 남기면 좁아집니다');
});

/* ══════ ② 켜고 끄기 ══════ */
test('★ 켜면 덮고 화면을 잠그고, 끄면 «반드시» 푼다', () => {
  const ctx = 세상({});
  vm.runInContext('rhEdBigSet(true)', ctx);
  assert.ok(ctx._옷.has('rh-ed-big'), '★ 안 덮었습니다');
  assert.equal(ctx._body.style.overflow, 'hidden', '★ 뒤 화면이 같이 굴러갑니다');
  assert.equal(ctx._큰단추.textContent, '⤡ 작게', '단추 딱지가 안 바뀝니다');
  vm.runInContext('rhEdBigSet(false)', ctx);
  assert.ok(!ctx._옷.has('rh-ed-big'), '★ 안 거뒀습니다');
  assert.equal(ctx._body.style.overflow, '',
    '★ 화면 잠금이 남았습니다 — 아래 목록이 영영 안 굴러갑니다');
  assert.equal(ctx._큰단추.textContent, '🗖 큰 창');
});

test('★ 누르면 뒤집힌다 — 그리고 그 뜻을 기억한다', () => {
  const ctx = 세상({});
  vm.runInContext('rhHwpEdBig()', ctx);
  assert.equal(vm.runInContext('_rhEdBig', ctx), true);
  assert.equal(vm.runInContext('_rhEdBigWant', ctx), true, '★ 뜻을 기억하지 않습니다');
  vm.runInContext('rhHwpEdBig()', ctx);
  assert.equal(vm.runInContext('_rhEdBig', ctx), false);
  assert.equal(vm.runInContext('_rhEdBigWant', ctx), false,
    '★ 작게 줄여 두셨는데 다음에 또 큰 창으로 엽니다');
});

/* ══════ ③ 나갈 길 ══════ */
test('★★ Esc 로 나간다 — 큰 창은 다른 것을 다 덮으므로 길이 늘 있어야 한다', () => {
  const ctx = 세상({});
  vm.runInContext('rhEdBigSet(true)', ctx);
  const 듣 = ctx._들은것.filter((x) => x.ev === 'keydown');
  assert.equal(듣.length, 1, '★ Esc 를 안 듣습니다 — 나갈 길이 없습니다');
  듣[0].fn({ key: 'Escape' });
  assert.ok(!ctx._옷.has('rh-ed-big'), '★ Esc 를 눌러도 안 나갑니다');
  assert.equal(ctx._들은것.filter((x) => x.ev === 'keydown').length, 0,
    '★ 나간 뒤에도 듣는 사람이 남았습니다');
});

test('★ 전체 화면 중의 Esc 는 «브라우저 몫» — 가로채면 전체 화면을 못 나온다', () => {
  const ctx = 세상({});
  vm.runInContext('rhEdBigSet(true)', ctx);
  const 듣 = ctx._들은것.filter((x) => x.ev === 'keydown')[0];
  ctx.document.fullscreenElement = ctx._막대;          /* 지금 전체 화면 */
  듣.fn({ key: 'Escape' });
  assert.ok(ctx._옷.has('rh-ed-big'),
    '★ 전체 화면인데 큰 창까지 접혔습니다 — Esc 한 번에 두 겹이 사라집니다');
});

test('★ 딴 키는 그냥 지나간다', () => {
  const ctx = 세상({});
  vm.runInContext('rhEdBigSet(true)', ctx);
  ctx._들은것.filter((x) => x.ev === 'keydown')[0].fn({ key: 'a' });
  assert.ok(ctx._옷.has('rh-ed-big'), '★ 아무 키에나 닫힙니다');
});

test('★ 듣는 사람은 한 번만 — 여러 번 켜면 쌓인다', () => {
  const ctx = 세상({});
  vm.runInContext('rhEdBigSet(true); rhEdBigSet(true); rhEdBigSet(true);', ctx);
  assert.equal(ctx._들은것.filter((x) => x.ev === 'keydown').length, 1,
    '★ 듣는 사람이 쌓였습니다');
});

/* ══════ ④ 부르는 차례 ══════ */
test('★★ 여는 «뒤»에 편다 — 순서를 바꾸면 펴자마자 도로 접힌다', () => {
  const m = cutFn(CODE, 'function rhSetMode(');
  const i = m.indexOf('_safe(rhHwpEdOpen)');
  const j = m.indexOf('rhEdBigSet(_rhEdBigWant)');
  assert.ok(i > 0, 'rhSetMode 가 편집기를 안 엽니다');
  assert.ok(j > 0, '★ rhSetMode 가 큰 창을 안 폅니다');
  assert.ok(i < j,
    '★ 큰 창을 먼저 폅니다 — rhHwpEdOpen 이 앞머리에서 rhHwpEdClose 를 불러 도로 접습니다');
  /* 그 rhHwpEdClose 가 정말 거두는지도 함께 못박는다(까닭이 여기 있다) */
  assert.match(cutFn(CODE, 'function rhHwpEdClose('), /rhEdBigSet\(false\)/,
    '★ 편집기를 거두는데 큰 창이 남습니다 — 검은 화면만 남는 막다른 길입니다');
});

test('★ 한글 편집에서 나가면 큰 창도 거둔다', () => {
  const m = cutFn(CODE, 'function rhSetMode(');
  const 뒤 = m.slice(m.indexOf("if(m==='edit')"));
  const 닫는곳 = 뒤.indexOf('rhEdBigSet(false)');
  assert.ok(닫는곳 > 0,
    '★ edit 이 아닌 길에서 큰 창을 안 거둡니다 — 화면 잠금이 남습니다');
});

test('★ 편집기를 거둘 때 전체 화면도 나온다 — 검은 화면만 남으면 안 된다', () => {
  const c = cutFn(CODE, 'function rhHwpEdClose(');
  assert.match(c, /exitFullscreen/, '★ 전체 화면이 그대로 남습니다');
});

/* ══════ ⑤ 전체 화면 · 단축키 잠금 ══════ */
test('★★ 전체 화면에 들어가며 브라우저가 가져가는 키를 «되찾는다»', async () => {
  const ctx = 세상({});
  await vm.runInContext('rhHwpEdFull()', ctx);
  assert.ok(ctx.document.fullscreenElement, '★ 전체 화면에 못 들어갔습니다');
  assert.ok(ctx._옷.has('rh-ed-big'), '큰 창을 거쳐 가야 나올 때 자리가 맞습니다');
  assert.ok(Array.isArray(ctx._잠근키) && ctx._잠근키.length >= 5,
    '★ 키를 안 잠갔습니다 — Ctrl+W 가 여전히 브라우저로 갑니다');
  ['KeyW', 'KeyN', 'KeyT'].forEach((k) => {
    assert.ok(ctx._잠근키.includes(k), '★ ' + k + ' 를 안 잠갔습니다');
  });
  assert.match(ctx._알림[0].m, /Ctrl\+W/, '무엇이 되는지 말하지 않습니다');
});

test('★★ 잠그개가 없거나 막히면 «무엇이 안 되는지» 말한다 — 조용하면 고장으로 읽힌다', async () => {
  for (const 경우 of [{ 잠그개: false }, { 잠금실패: true }]) {
    const ctx = 세상(경우);
    await vm.runInContext('rhHwpEdFull()', ctx);
    assert.ok(ctx.document.fullscreenElement, '전체 화면은 그래도 들어가야 합니다');
    assert.equal(ctx._알림.length, 1, '★ 아무 말도 안 합니다');
    assert.match(ctx._알림[0].m, /내주지 않습니다|안 됩니다|못/,
      '★ 되는 것처럼 말합니다 — ' + ctx._알림[0].m);
  }
});

test('★ 전체 화면에 못 가면 그렇다고 말한다', async () => {
  const ctx = 세상({ 전체화면실패: true });
  await vm.runInContext('rhHwpEdFull()', ctx);
  assert.equal(ctx.document.fullscreenElement, null);
  assert.match(ctx._알림[0].m, /전체 화면으로 못 갑니다/, '★ 조용히 넘어갑니다');
});

test('★★ 전체 화면을 나오면 잠근 키를 «반드시» 푼다 — 안 풀면 그 뒤로 Ctrl+W 가 안 먹는다', async () => {
  const ctx = 세상({});
  await vm.runInContext('rhHwpEdFull()', ctx);
  const 듣 = ctx._들은것.filter((x) => x.ev === 'fullscreenchange');
  assert.equal(듣.length, 1, '★ 전체 화면을 드나드는 것을 안 봅니다');
  /* ⚠ «들어갈 때»부터 본다 — 처음 딱지가 이미 「⛶ 전체 화면」이라
     나올 때만 보면 «아무것도 안 하는» 코드도 통과한다(고장넣기가 잡았다) */
  듣[0].fn();
  assert.equal(ctx._전체단추.textContent, '⤡ 전체 화면 끄기',
    '★ 전체 화면인데 딱지가 그대로입니다 — 나가는 길이 안 보입니다');
  assert.ok(!ctx._푼적, '아직 전체 화면인데 키를 풀었습니다');
  ctx.document.fullscreenElement = null;
  듣[0].fn();
  assert.equal(ctx._푼적, 1, '★ 잠근 키를 안 풀었습니다');
  assert.equal(ctx._전체단추.textContent, '⛶ 전체 화면', '★ 단추 딱지가 안 돌아옵니다');
});

test('★ 전체 화면 듣는 사람도 한 번만 붙는다', async () => {
  const ctx = 세상({});
  await vm.runInContext('rhHwpEdFull()', ctx);
  ctx.document.fullscreenElement = null;
  await vm.runInContext('rhHwpEdFull()', ctx);
  assert.equal(ctx._들은것.filter((x) => x.ev === 'fullscreenchange').length, 1,
    '★ 듣는 사람이 쌓였습니다');
});

test('★ 이미 전체 화면이면 누를 때 «나온다»', async () => {
  const ctx = 세상({ 전체화면: true });
  await vm.runInContext('rhHwpEdFull()', ctx);
  assert.equal(ctx.document.fullscreenElement, null, '★ 나가지 않습니다');
});

/* ══════ ⑥ 단축키 목록 ══════ */
test('★★ 단축키를 «손으로 적지 않는다» — 편집기에게 물어 그 답만 그린다', async () => {
  const ctx = 세상({});
  vm.runInContext('_rhHwpEd={ commands:{ list: async function(){ return ['
    + '{shortcutLabel:"Ctrl+S", label:"저장"},'
    + '{shortcutLabel:"Alt+N", label:"새로 만들기"},'
    + '{label:"단축키 없는 것"} ]; } } };', ctx);
  await vm.runInContext('rhHwpEdKeys()', ctx);
  assert.equal(ctx._붙인것.length, 1, '★ 목록을 안 그렸습니다');
  const html = ctx._붙인것[0].innerHTML;
  assert.match(html, /Ctrl\+S/, '★ 편집기가 준 단축키가 안 보입니다');
  assert.match(html, /Alt\+N/);
  assert.ok(!/단축키 없는 것/.test(html), '★ 단축키가 없는 것까지 올렸습니다');
  assert.match(html, /2개/, '★ 몇 개인지 안 셉니다');
  assert.match(html, /전체 화면/, '★ 브라우저가 가져가는 키를 어떻게 쓰는지 안 알려 줍니다');
  /* 손으로 적어 둔 목록이 코드에 없어야 한다 */
  const src = cutFn(CODE, 'async function rhHwpEdKeys(');
  assert.match(src, /commands\.list\(\)/, '★ 편집기에게 묻지 않습니다');
});

test('★ 편집기가 없으면 말하고 아무것도 안 그린다', async () => {
  const ctx = 세상({});
  await vm.runInContext('rhHwpEdKeys()', ctx);
  assert.equal(ctx._붙인것.length, 0, '★ 빈 목록을 그렸습니다');
  assert.match(ctx._알림[0].m, /편집기가 열려 있지 않습니다/);
});

test('★ 두 번 열어도 겹쳐 쌓이지 않는다', async () => {
  const ctx = 세상({});
  vm.runInContext('_rhHwpEd={ commands:{ list: async function(){ return ['
    + '{shortcutLabel:"Ctrl+S", label:"저장"} ]; } } };', ctx);
  await vm.runInContext('rhHwpEdKeys()', ctx);
  ctx._있는것.rhEdKeys = ctx._붙인것[0];           /* 이제 화면에 있다 */
  await vm.runInContext('rhHwpEdKeys()', ctx);
  assert.ok(ctx._붙인것[0]._removed, '★ 앞것을 안 치웠습니다 — 창이 겹쳐 쌓입니다');
});

test('★ 물어보다 걸리면 조용히 넘기지 않는다', async () => {
  const ctx = 세상({});
  vm.runInContext('_rhHwpEd={ commands:{ list: async function(){ throw new Error("끊김"); } } };', ctx);
  await vm.runInContext('rhHwpEdKeys()', ctx);
  assert.equal(ctx._붙인것.length, 0);
  assert.match(ctx._알림[0].m, /단축키를 물어보지 못했습니다/);
});

/* ══════ ⑦ 옛 빗장은 그대로 ══════ */
test('★★ 편집기를 짓는 곳은 여전히 «한 곳»이고 studioUrl 빗장이 살아 있다', () => {
  const c = cutFn(CODE, 'async function _hwpEdCreate(');
  assert.match(c, /studioUrl:\s*'vendor\/rhwp-studio\/index\.html'/,
    '★ 우리 편집기를 안 가리킵니다 — 서류가 남의 서버로 갑니다');
  const 몇곳 = (CODE.match(/studioUrl\s*:/g) || []).length;
  assert.equal(몇곳, 1, '★ studioUrl 이 ' + 몇곳 + '곳입니다 — 한 곳만 고쳐지면 조용히 샙니다');
});
