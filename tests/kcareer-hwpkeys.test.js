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
  /* 반대로 Alt+V 는 아예 LIST 에 안 넣었다 — 그 까닭이 MISSING 에 적혀 있어야 한다 */
  assert.ok(!p.bind.some((b) => b.key === 'Alt+V'), 'Alt+V 는 붙이면 안 됩니다');
  assert.ok(K.MISSING.some((m) => m.key === 'Alt+V' && /Alt\+V,T|투명/.test(m.why)),
    '★ Alt+V 를 왜 못 붙이는지 안 밝힙니다');
});

test('★ 편집기가 나중에 그 글쇠를 쓰기 시작하면 «스스로 물러선다»', () => {
  const p = K.plan(편집기가쓰는것.concat(['Ctrl+F10', 'Alt+O']));
  assert.ok(!p.bind.some((b) => b.key === 'Ctrl+F10'), '★ 안 물러섭니다');
  assert.ok(!p.bind.some((b) => b.key === 'Alt+O'));
  assert.equal(p.skip.length, 2, '물러선 까닭을 안 남깁니다');
  p.skip.forEach((s) => assert.match(s.why, /이미/, '까닭이 비었습니다'));
});

test('지금 편집기에는 여덟 개가 다 붙는다 — 실측과 같아야 한다', () => {
  const p = K.plan(편집기가쓰는것);
  assert.equal(p.bind.length, 8, '붙는 개수가 달라졌습니다: ' + JSON.stringify(p.bind.map(b => b.key)));
  assert.equal(p.skip.length, 0);
  assert.deepEqual(p.bind.map((b) => b.key).sort(),
    ['Alt+O', 'Alt+P', 'Alt+S', 'Ctrl+F10', 'Ctrl+H', 'Ctrl+J', 'Ctrl+N,T', 'F2'].sort());
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

/* ══════ ⑤ 못 하는 것은 밝힌다 ══════ */
test('★★ 한글에는 있는데 못 덧대는 것을 «숨기지 않는다»', () => {
  assert.ok(K.MISSING.length >= 2, '못 하는 것을 안 적었습니다');
  const 한자 = K.MISSING.filter((m) => m.key === 'F9')[0];
  assert.ok(한자, '★ 한자 변환(F9)을 안 밝힙니다 — 한글에는 있는 기능입니다');
  assert.match(한자.why, /IME|한자/, '어떻게 쓰면 되는지 안 알려 줍니다');
  K.MISSING.forEach((m) => {
    assert.ok(m.label && m.why, '무엇이 왜 안 되는지 비었습니다: ' + JSON.stringify(m));
  });
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
