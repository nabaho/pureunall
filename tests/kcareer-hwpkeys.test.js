'use strict';
/* ⌨ 한글과 «같은» 단축키 (대표 지시 2026-09-27
   「한글과 같이 특수 문자나오기나 단축키등 모두 일치시킬수 있게해달라 모든 기능을」)
   ─────────────────────────────────────────────────────────────
   ■ 재어 보고 안 것 (2026-09-27)
     편집기(rhwp-studio)는 명령 189개·단축키 73개를 들고 있고 «거의 다» 한글과 같다.
     한컴 공식 「단축키 일람」과 하나씩 대조해 어긋난 여덟 개만 덧댄다.
       문자표 Ctrl+F10(편집기는 Alt+F10) · 불러오기 Alt+O · 저장 Alt+S · 인쇄 Alt+P ·
       찾기 F2 · 찾아 바꾸기 Ctrl+H · 쪽 나누기 Ctrl+J · 표 만들기 Ctrl+N,T
     특수문자·한자는 «편집기 일이 아니라 윈도 IME 일»이고, 그 길이 살아 있는 것을
     끝까지 확인했다(※·權·㈜ 가 실제로 문서에 들어갔다).

   여기서 못 박는 것:
     ① 편집기가 «이미 쓰는» 글쇠는 절대 가로채지 않는다 — 가로채면 제 기능이 죽는다
     ② 글쇠는 `code` 로 읽는다 — 한글로 쓰다 누르는 것이 «보통»이다
     ③ 글자를 조합하는 중에는 비켜 준다
     ④ 두 번 누르는 것(Ctrl+N,T)은 앞 타를 잠깐만 문다
     ⑤ 못 덧대는 것은 «숨기지 않고 밝힌다» */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripComments } = require('./strip-comments');

const R = path.join(__dirname, '..');
const K = require(path.join(R, 'js', 'kcareer-hwpkeys.js'));
const CODE = stripComments(fs.readFileSync(path.join(R, 'kcareer.html'), 'utf8'));

/* 2026-09-27 실측: 편집기가 실제로 쓰는 단축키(commands.list 로 받은 것) */
const 편집기가쓰는것 = [
  'Alt+Shift+V', 'Ctrl+C', 'Ctrl+X', 'Ctrl+E', 'Ctrl+Shift+H', 'Ctrl+F', 'Ctrl+L',
  'Ctrl+F2', 'Alt+C', 'Alt+G', 'Ctrl+V', 'Ctrl+Shift+Z', 'Ctrl+A', 'Ctrl+Z', 'Ctrl+M,K',
  'Alt+N', 'F7', 'Ctrl+P', 'Ctrl+S', 'Ctrl+Shift+S', 'Alt+Shift+C', 'Alt+Shift+D',
  'Ctrl+Shift+M', 'Ctrl+Shift+L', 'Alt+Shift+H', 'Ctrl+B', 'Shift+Alt+J', 'Shift+Alt+K',
  'Alt+L', 'Shift+Alt+N', 'Shift+Alt+W', 'Alt+Shift+R', 'Alt+Shift+E', 'Ctrl+I',
  'Ctrl+Num +', 'Ctrl+Num -', 'Alt+Shift+A', 'Alt+Shift+Z', 'P', 'Alt+T', 'F6', 'Ctrl+U',
  'Ctrl+K,B', 'Ctrl+M,M', 'Ctrl+K+E', 'Ctrl+K+H', 'Alt+F10', 'Ctrl+Enter',
  'Ctrl+Alt+Enter', 'Ctrl+Shift+Enter', 'Ctrl+M,S', 'Ctrl+M,Z', 'Ctrl+Shift+A',
  'Ctrl+Shift+P', 'H', 'M', 'S', 'W', 'Alt+Delete', 'Ctrl+M,F', 'Alt+Enter', 'Ctrl+M,A',
  'Alt+V,T', 'Ctrl+G,C', 'Ctrl+G,T', 'Ctrl+F1', 'Ctrl+G,Q', 'Ctrl+G,P', 'Ctrl+G,W',
  'Ctrl++', 'Ctrl+-'
];
const ev = (o) => Object.assign({ ctrlKey: false, altKey: false, shiftKey: false, metaKey: false }, o);

/* ══════ ① 겹치면 안 붙인다 ══════ */
test('★★★ 편집기가 «이미 쓰는» 글쇠는 한 개도 안 가로챈다', () => {
  const p = K.plan(편집기가쓰는것);
  const 쓰는것 = new Set(편집기가쓰는것.map(K.canon));
  p.bind.forEach((b) => {
    assert.ok(!쓰는것.has(b.key),
      '★ ' + b.key + ' 를 가로챕니다 — 편집기 제 기능이 조용히 죽습니다');
  });
});

test('★★ 두 번 누르는 것은 «앞 타»가 이미 쓰이면 안 붙인다', () => {
  /* Ctrl+N,T(표 만들기)를 붙이려는데 편집기가 Ctrl+N 을 쓰기 시작하면 —
     붙이면 편집기의 Ctrl+N 이 통째로 죽는다. 물러서야 한다. */
  const p = K.plan(편집기가쓰는것.concat(['Ctrl+N']));
  assert.ok(!p.bind.some((b) => b.key === 'Ctrl+N,T'),
    '★ 앞 타(Ctrl+N)를 편집기가 쓰는데 그 위에 덧댑니다 — 편집기 기능이 죽습니다');
  const s = p.skip.filter((x) => x.key === 'Ctrl+N,T')[0];
  assert.ok(s, '물러섰다는 기록이 없습니다');
  assert.match(s.why, /Ctrl\+N/, '★ 무엇 때문에 물러섰는지 안 밝힙니다: ' + s.why);
  /* ⚠ Alt+V 는 «이어받기»를 들고 있어 일부러 안 막는다 — 아래 전용 검사가 본다 */
});

test('★ 편집기가 나중에 그 글쇠를 쓰기 시작하면 «스스로 물러선다»', () => {
  const p = K.plan(편집기가쓰는것.concat(['Ctrl+F10', 'Alt+O']));
  assert.ok(!p.bind.some((b) => b.key === 'Ctrl+F10'), '★ 안 물러섭니다');
  assert.ok(!p.bind.some((b) => b.key === 'Alt+O'));
  assert.equal(p.skip.length, 2, '물러선 까닭을 안 남깁니다');
  p.skip.forEach((s) => assert.match(s.why, /이미/, '까닭이 비었습니다'));
});

test('지금 편집기에는 열 개가 다 붙는다 — 실측과 같아야 한다', () => {
  const p = K.plan(편집기가쓰는것);
  assert.equal(p.bind.length, 10, '붙는 개수가 달라졌습니다: ' + JSON.stringify(p.bind.map(b => b.key)));
  assert.equal(p.skip.length, 0);
  assert.deepEqual(p.bind.map((b) => b.key).sort(),
    ['Alt+O', 'Alt+P', 'Alt+S', 'Alt+V', 'Ctrl+F10', 'Ctrl+H', 'Ctrl+J', 'Ctrl+N,T', 'F2', 'F9'].sort());
});

/* ══════ ①-2 Alt+V — 한글의 «다른 이름으로 저장»과 편집기의 «투명 선»을 둘 다 살린다 ══════ */
test('★★★ Alt+V 혼자면 «다른 이름으로 저장» — 한글과 같다', () => {
  const m = K.makeMatcher(K.plan(편집기가쓰는것).bind);
  const r = m(ev({ key: 'v', code: 'KeyV', altKey: true }), 0);
  assert.ok(r && r.pending, '★ 기다리지 않습니다: ' + JSON.stringify(r));
  assert.ok(r.timeout && r.timeout.cmd === 'file:save-as',
    '★ 혼자 눌렀을 때 할 일이 «다른 이름으로 저장»이 아닙니다');
  assert.ok(r.wait > 0, '기다릴 시간을 안 알려 줍니다');
});

test('★★★ Alt+V 뒤에 T 를 누르면 편집기의 «투명 선» — 그 기능을 안 죽인다', () => {
  const m = K.makeMatcher(K.plan(편집기가쓰는것).bind);
  m(ev({ key: 'v', code: 'KeyV', altKey: true }), 0);
  const r = m(ev({ key: 't', code: 'KeyT' }), 100);
  assert.ok(r && r.cmd === 'view:border-transparent',
    '★ Alt+V,T(투명 선)가 죽었습니다: ' + JSON.stringify(r));
});

test('★ Alt+V 뒤에 엉뚱한 글쇠면 «혼자 누른 것»으로 본다', () => {
  const m = K.makeMatcher(K.plan(편집기가쓰는것).bind);
  m(ev({ key: 'v', code: 'KeyV', altKey: true }), 0);
  const r = m(ev({ key: 'q', code: 'KeyQ' }), 100);
  assert.ok(r && r.cmd === 'file:save-as', '★ 아무 일도 안 합니다: ' + JSON.stringify(r));
});

test('★★ 이어받는 것은 «앞 타 겹침»으로 막지 않는다 — 막으면 Alt+V 가 영영 안 붙는다', () => {
  const p = K.plan(편집기가쓰는것);              /* 편집기가 Alt+V,T 를 쓰는 상태 */
  const v = p.bind.filter((b) => b.key === 'Alt+V')[0];
  assert.ok(v, '★ Alt+V 가 겹침으로 걸러졌습니다 — 이어받기를 아는데도 막았습니다');
  assert.ok(v.after && v.after.T, '★ 이어지는 T 를 어떻게 할지 안 들고 있습니다');
});

/* ══════ ①-3 F9 한자 ══════ */
test('★★★ F9 는 «우리가» 한다 — 편집기에 그 명령이 없다', () => {
  const p = K.plan(편집기가쓰는것);
  const f9 = p.bind.filter((b) => b.key === 'F9')[0];
  assert.ok(f9, '★ F9 를 안 붙입니다 — 한글에는 있는 기능입니다');
  assert.equal(f9.cmd, '@hanja', '★ 편집기 명령을 부르려 합니다 — 그런 명령이 없습니다');
  assert.match(f9.label, /한자/);
});

/* ══════ ② 한글로 쓰는 중에도 알아본다 ══════ */
test('★★★ 한글 입력 중에도 «code» 로 알아본다 — key 는 자모(ㅐ)로 온다', () => {
  assert.equal(K.fromEvent(ev({ key: 'o', code: 'KeyO', altKey: true })), 'Alt+O');
  assert.equal(K.fromEvent(ev({ key: 'ㅐ', code: 'KeyO', altKey: true })), 'Alt+O',
    '★ 한글로 쓰다 누르면 못 알아봅니다 — 이것이 «보통» 상황입니다');
  assert.equal(K.fromEvent(ev({ key: 'Process', code: 'KeyH', ctrlKey: true })), 'Ctrl+H',
    '★ IME 가 Process 로 줄 때 못 알아봅니다');
});

test('★ 수식어만 누른 것은 아무것도 아니다', () => {
  ['Control', 'Alt', 'Shift', 'Meta'].forEach((k) => {
    assert.equal(K.fromEvent(ev({ key: k, code: k })), '', k + ' 를 글쇠로 셉니다');
  });
  assert.equal(K.fromEvent(ev({ key: 'Dead', code: '' })), '');
  /* ⚠ code 가 비어 오는 브라우저·IME 도 있다 — 그때 'Process' 를 글쇠로 세면
     조합 중에 엉뚱한 명령이 돈다. code 가 있을 때는 그쪽이 먼저라 이 줄이 안 걸렸다. */
  assert.equal(K.fromEvent(ev({ key: 'Process', code: '', ctrlKey: true })), '',
    '★ 조합 신호(Process)를 글쇠로 셉니다');
  assert.equal(K.fromEvent(ev({ key: 'Unidentified', code: '' })), '');
});

test('기능키·숫자·엔터도 제 이름으로', () => {
  assert.equal(K.fromEvent(ev({ key: 'F10', code: 'F10', ctrlKey: true })), 'Ctrl+F10');
  assert.equal(K.fromEvent(ev({ key: 'Enter', code: 'NumpadEnter', ctrlKey: true })), 'Ctrl+Enter');
  assert.equal(K.fromEvent(ev({ key: '1', code: 'Digit1', altKey: true })), 'Alt+1');
});

/* ══════ ③ 이름표를 한 가지 꼴로 ══════ */
test('★ 사람이 적은 이름표를 한 꼴로 편다 — 안 그러면 «겹침»을 못 본다', () => {
  assert.equal(K.canon('Shift+Alt+J'), K.canon('Alt+Shift+J'), '★ 차례가 다르면 다른 것으로 봅니다');
  assert.equal(K.canon('ctrl+f10'), 'Ctrl+F10');
  assert.equal(K.canon('Ctrl+K+E'), 'Ctrl+K,E', '★ +로 적은 두 타를 못 알아봅니다');
  assert.equal(K.canon('Ctrl+K,B'), 'Ctrl+K,B');
  assert.equal(K.canon(''), '');
  assert.equal(K.canon(null), '');
});

/* ══════ ④ 두 번 누르기 ══════ */
test('★★ 두 번 누르는 것(Ctrl+N,T)이 된다', () => {
  const m = K.makeMatcher(K.plan(편집기가쓰는것).bind);
  assert.equal(m(ev({ key: 'n', code: 'KeyN', ctrlKey: true }), 0), 'pending');
  const r = m(ev({ key: 't', code: 'KeyT' }), 100);
  assert.ok(r && r.cmd === 'table:create', '★ 표 만들기가 안 됩니다: ' + JSON.stringify(r));
});

test('★ 뒤 타가 틀리면 아무 일도 안 한다 — 엉뚱한 명령을 부르면 더 나쁘다', () => {
  const m = K.makeMatcher(K.plan(편집기가쓰는것).bind);
  m(ev({ key: 'n', code: 'KeyN', ctrlKey: true }), 0);
  assert.equal(m(ev({ key: 'z', code: 'KeyZ' }), 50), null);
});

test('★★ 앞 타를 «오래 물지 않는다» — 한참 뒤 누른 T 가 엉뚱하게 먹으면 안 된다', () => {
  const m = K.makeMatcher(K.plan(편집기가쓰는것).bind, { ms: 1000 });
  m(ev({ key: 'n', code: 'KeyN', ctrlKey: true }), 0);
  assert.equal(m(ev({ key: 't', code: 'KeyT' }), 5000), null, '★ 5초 뒤 T 가 표를 만듭니다');
});

test('★★ 기다림은 «짝꿍마다 따로» — 모듈에 두면 편집기 둘이 섞인다', () => {
  const b = K.plan(편집기가쓰는것).bind;
  const m1 = K.makeMatcher(b), m2 = K.makeMatcher(b);
  assert.equal(m1(ev({ key: 'n', code: 'KeyN', ctrlKey: true }), 0), 'pending');
  /* m2 는 앞 타를 모른다 — 그냥 T 다 */
  assert.equal(m2(ev({ key: 't', code: 'KeyT' }), 10), null, '★ 다른 편집기의 기다림이 샙니다');
});

test('우리 몫이 아닌 글쇠는 그냥 흘려보낸다', () => {
  const m = K.makeMatcher(K.plan(편집기가쓰는것).bind);
  assert.equal(m(ev({ key: 'b', code: 'KeyB', ctrlKey: true }), 0), null, '★ 편집기 몫(굵게)을 가로챕니다');
  assert.equal(m(ev({ key: 'a', code: 'KeyA' }), 0), null);
});

/* ══════ ⑤ 못 하는 것이 있으면 밝힌다 ══════ */
test('★ 못 덧대는 것이 생기면 «숨기지 않고» MISSING 에 적는다', () => {
  assert.ok(Array.isArray(K.MISSING), 'MISSING 이 없어졌습니다');
  K.MISSING.forEach((m) => {
    assert.ok(m.key && m.label && m.why,
      '무엇이 왜 안 되는지 비었습니다: ' + JSON.stringify(m));
  });
});

/* ══════ ⑥ F9 를 실제로 해내는 코드 ══════ */
test('★★★ F9 는 «마지막으로 친 음절»을 봐 두었다가 바꾼다', () => {
  assert.match(CODE, /function rhEdWatchSyllable\(/, '★ 마지막 음절을 안 봐 둡니다');
  /* ⚠ 함수가 «있나»만 보면 «부르지» 않아도 통과한다(고장넣기가 잡았다) */
  const f = CODE.slice(CODE.indexOf('async function rhEdHwpKeys('),
                       CODE.indexOf('async function rhEdHwpKeys(') + 2200);
  /* ⚠ 그냥 이름만 찾으면 «바로 아래 함수 선언»(function rhEdWatchSyllable(doc){)이
     걸려 부르는 줄을 지워도 통과했다(고장넣기가 잡았다). «부르는 꼴»을 짚는다. */
  assert.match(f, /_safe\(function\(\)\{\s*rhEdWatchSyllable\(doc\);\s*\}\);/,
    '★ 봐 두는 일을 «부르지» 않습니다 — F9 가 늘 「바꿀 글자가 없습니다」가 됩니다');
  const w = CODE.slice(CODE.indexOf('function rhEdWatchSyllable('),
                       CODE.indexOf('function rhEdWatchSyllable(') + 900);
  assert.match(w, /compositionend/, '★ 한글 조합이 끝나는 것을 안 봅니다');
  assert.match(w, /isHangulSyllable/, '★ 한글 음절인지 안 가립니다');
  /* ⚠ 「_kcSyl 이라는 글자가 있나」로는 못 잡는다 — 표식을 «남기기»만 해도 통과했다 */
  assert.match(w, /if\(!ta \|\| ta\._kcSyl\) return;/,
    '★ 이미 붙였는지 «보고 돌아서지» 않습니다 — 귀가 쌓여 한 번에 여러 번 셉니다');
});

test('★★★ 한자를 «저절로 고르지 않는다» — 지어 넣으면 틀린 이름이 서류에 박힌다', () => {
  const h = CODE.slice(CODE.indexOf('function rhEdHanja('),
                       CODE.indexOf('function rhEdHanja(') + 2600);
  assert.match(h, /forSyllable/, '한자 사전을 안 봅니다');
  /* 사람이 누를 자리를 반드시 만든다 */
  assert.match(h, /onclick\s*=\s*function/, '★ 사람이 고르는 자리가 없습니다 — 저절로 넣고 있습니다');
  assert.ok(!/후보\[0\]|list\[0\]/.test(h),
    '★ 첫 한자를 저절로 고릅니다 — 같은 소리에 한자가 여럿입니다');
});

test('★★ 한자 후보는 «글자 배열»이다 — 감싼 모양으로 읽으면 단추가 0개가 된다', () => {
  /* 실측으로 잡은 흠이다: forSyllable 이 ["河","夏",…] 를 곧바로 주는데
     [{list:[…]}] 로 읽어 고르개가 «떴는데 비어» 있었다. */
  const HJ = require(path.join(R, 'js', 'kcareer-hanja.js'));
  const 후보 = HJ.forSyllable('하');
  assert.ok(Array.isArray(후보) && 후보.length > 0, '한자 사전이 「하」를 모릅니다');
  후보.forEach((h) => assert.equal(typeof h, 'string',
    '★ 후보가 글자가 아니라 ' + typeof h + ' 입니다 — 그리는 쪽과 어긋납니다'));
  const h = CODE.slice(CODE.indexOf('function rhEdHanja('),
                       CODE.indexOf('function rhEdHanja(') + 2600);
  assert.ok(!/g\.list/.test(h), '★ 감싼 모양(.list)으로 읽습니다 — 후보가 0개가 됩니다');
  assert.match(h, /후보\.forEach\(function\s*\(h\)/, '★ 후보를 글자로 안 훑습니다');
});

test('★★ 사전에 없으면 «지어내지 않고» 다른 길을 알려 준다', () => {
  const h = CODE.slice(CODE.indexOf('function rhEdHanja('),
                       CODE.indexOf('function rhEdHanja(') + 2600);
  assert.match(h, /if\(!후보 \|\| !후보\.length\)\{/, '★ 사전에 없을 때를 안 봅니다');
  /* ⚠ 그 «가지 안»만 본다 — 아래 고르개 글에도 Ctrl+F10 이 있어 통째로 보면
     안내를 지워도 통과했다(고장넣기가 잡았다). */
  const 가지 = h.slice(h.indexOf('if(!후보 || !후보.length){'));
  const 가지끝 = 가지.slice(0, 가지.indexOf('return;') + 7);
  assert.match(가지끝, /Ctrl\+F10/, '★ 문자표로 가는 길을 안 알려 줍니다(막다른 길)');
  assert.match(가지끝, /한자/, '★ 윈도 한자 글쇠를 안 알려 줍니다');
});

test('★★ 바꾸기는 «한 글자 지우고 넣는다» — 실측으로 확인한 그 길', () => {
  const p = CODE.slice(CODE.indexOf('function _rhEdPut('),
                       CODE.indexOf('function _rhEdPut(') + 1200);
  assert.match(p, /Backspace/, '★ 앞 글자를 안 지웁니다 — 「하河」가 됩니다');
  assert.match(p, /compositionend/, '★ IME 와 같은 차례로 안 넣습니다');
  /* ⚠ 「return false 가 있나」로는 못 잡는다 — 맨 앞의 빗장에도 있어서 걸림 처리를
     「됐다」로 바꿔도 통과했다(고장넣기가 잡았다). «걸렸을 때»를 콕 짚는다. */
  assert.match(p, /catch\(e\)\{[^}]*return false;\s*\}/,
    '★ 넣다가 걸렸는데 «됐다»고 알립니다 — 안 바뀐 줄 모르고 넘어갑니다');
});

test('★ 이어받기(Alt+V)는 부르는 쪽이 «시계»로 마무리한다', () => {
  const f = CODE.slice(CODE.indexOf('async function rhEdHwpKeys('),
                       CODE.indexOf('async function rhEdHwpKeys(') + 2200);
  assert.match(f, /r\.pending/, '★ 기다리라는 답을 안 봅니다');
  assert.match(f, /setTimeout/, '★ 혼자 눌렀을 때를 마무리하지 않습니다 — Alt+V 가 영영 안 됩니다');
  assert.match(f, /clearTimeout/, '★ 이어지는 글쇠가 와도 기다림을 안 끕니다 — 둘 다 실행됩니다');
});

test('★ @ 로 시작하는 것은 편집기에 넘기지 않는다 — 그런 명령이 없다', () => {
  const f = CODE.slice(CODE.indexOf('async function rhEdHwpKeys('),
                       CODE.indexOf('async function rhEdHwpKeys(') + 2200);
  assert.match(f, /'@hanja'/, '★ 우리 몫을 안 가려냅니다');
  assert.match(f, /rhEdHanja\(/, '★ 한자 창을 안 엽니다');
});

/* ══════ ⑥ 부르는 쪽(kcareer.html) ══════ */
test('★★★ 글자를 조합하는 중에는 «비켜 준다» — 가로채면 한글 입력이 깨진다', () => {
  const f = CODE.slice(CODE.indexOf('async function rhEdHwpKeys('));
  assert.match(f, /isComposing/, '★ 조합 중인지 안 봅니다');
  assert.match(f, /229/, '★ 옛 브라우저의 조합 신호(keyCode 229)를 안 봅니다');
});

test('★★ 편집기 «안»에 귀를 붙인다 — 밖에서는 글쇠가 한 개도 안 올라온다', () => {
  const f = CODE.slice(CODE.indexOf('async function rhEdHwpKeys('),
                       CODE.indexOf('async function rhEdHwpKeys(') + 2000);
  assert.match(f, /contentDocument/, '★ 틀 안쪽 문서에 안 붙입니다 — 아무 글쇠도 못 받습니다');
  assert.match(f, /addEventListener\('keydown'[\s\S]{0,400}true\s*\)/,
    '★ 먼저 듣지(capture) 않습니다 — 편집기가 먼저 먹어 버립니다');
});

test('★ 한 번만 붙인다 — 다시 붙으면 한 번 눌러도 두 번 실행된다', () => {
  const f = CODE.slice(CODE.indexOf('async function rhEdHwpKeys('),
                       CODE.indexOf('async function rhEdHwpKeys(') + 2000);
  /* ⚠ 「_kcHwpKeys 라는 글자가 있나」로는 못 잡는다 — 표식을 «남기기»만 하고
     «보지» 않아도 통과했다(고장넣기가 잡았다). 「보고 돌아서는가」를 짚는다. */
  assert.match(f, /if\([^)]*doc\._kcHwpKeys[^)]*\)\s*return/,
    '★ 이미 붙였는지 «보고 돌아서지» 않습니다 — 한 번 눌러도 두 번 실행됩니다');
  assert.match(f, /doc\._kcHwpKeys\s*=/, '★ 붙였다는 표식을 안 남깁니다');
});

test('★★ 편집기에게 못 물어보면 «아무것도 안 붙인다» — 겹칠 수 있다', () => {
  const f = CODE.slice(CODE.indexOf('async function rhEdHwpKeys('),
                       CODE.indexOf('async function rhEdHwpKeys(') + 2000);
  assert.match(f, /catch\s*\(e\)\s*\{\s*return null;/,
    '★ 목록을 못 받았는데 그냥 붙입니다 — 편집기 글쇠를 가로챌 수 있습니다');
});

test('★ 창을 여는 명령이라 allowDialog 를 켠다 — 안 켜면 문자표가 안 열린다', () => {
  const f = CODE.slice(CODE.indexOf('async function rhEdHwpKeys('),
                       CODE.indexOf('async function rhEdHwpKeys(') + 2000);
  assert.match(f, /allowDialog\s*:\s*true/, '★ 문자표·찾기 창이 안 열립니다');
});

test('★ 모듈을 싣고 캐시 번호를 올렸다', () => {
  assert.match(CODE, /js\/kcareer-hwpkeys\.js\?v=\d+/, '★ 모듈을 안 싣습니다');
});
