'use strict';
// 📱 업무관리 — 폰 화면에 «들어오게» (2026-10-18 폰화면관리) — node --test tests/work-phone-fit.test.js
//
// 대표 지시 「폰화면관리」 — 360·411px 폰으로 «로그인한 채» 그려 재 보고(tools/phone-audit) 고친 것.
//
// ■ 무엇이 나빴나 (360px 실측)
//   ① 빠른 기록 바 — 입력칸이 줄지 않아 「🎤 말로」가 반쯤, 「/ 기록 · ? 단축키」는 통째로 화면 밖
//   ② 「＋ 새 업무」 창 — 두 칸 그대로라 창 안이 576px 로 벌어져 기한·상대기관·부담당이 잘렸다
//   ③ ⚙ 에서 표·보드·타임라인을 한 번 고르면 «폰 목록으로 돌아올 길이 없었다»
//   ④ 서랍의 「다음 할 일」 글칸이 날짜칸에 밀려 52px(다섯 글자)
//   ⑤ 폰 목록의 ☐ 는 17px 상자만 눌렸다 — 조금만 어긋나도 서랍이 열렸다
//   ⑥ 「종료」 표 — 긴 업무 이름 하나가 칸을 벌려 «한 줄이 180px»
//   ⑦ 묶기를 고르면(「묶기 · 사업장 ▾」) 폰 목록 조종칸이 넘쳐 ⚙ 가 반쯤 화면 밖
//
// ■ 이 검사가 지키는 것 — «규칙»이지 지금 px 값이 아니다
//   · 고친 것은 «폰 구간(@media max-width)»에만 있고, 넓은 화면 규칙은 그대로다
//   · ③⑤ 는 함수를 떼어 «실제로 돌려» 본다

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const W = fs.readFileSync(path.join(__dirname, '..', 'work.html'), 'utf8').replace(/\r\n/g, '\n');

/* ── CSS 읽개 — <head> 의 <style> 만, 주석은 걷는다 ── */
const CSS = (() => {
  const head = W.slice(0, W.indexOf('</head>'));
  return [...head.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
})();
/* @media 덩어리를 중괄호 짝으로 떼어 낸다 */
function mediaBlocks(css) {
  const out = []; const re = /@media([^{]*)\{/g; let m;
  while ((m = re.exec(css))) {
    let d = 1, i = re.lastIndex;
    for (; i < css.length && d; i++) { if (css[i] === '{') d++; else if (css[i] === '}') d--; }
    out.push({ cond: m[1].trim(), body: css.slice(re.lastIndex, i - 1), start: m.index, end: i });
    re.lastIndex = i;
  }
  return out;
}
const BLOCKS = mediaBlocks(CSS);
/* 폰 구간 — max-width 가 태블릿 폭(760) 이하이고 min-width 가 없는 것 */
const isPhoneCond = (c) => { const w = (c.match(/max-width\s*:\s*(\d+)px/) || [])[1]; return !!w && +w <= 760 && !/min-width/.test(c); };
const PHONE = BLOCKS.filter((b) => isPhoneCond(b.cond)).map((b) => b.body).join('\n');
/* 넓은 화면(아무 @media 밖) */
const WIDE = (() => { let s = '', p = 0; BLOCKS.forEach((b) => { s += CSS.slice(p, b.start); p = b.end; }); return s + CSS.slice(p); })();
/* 선택자가 맞는 규칙들의 선언을 모은다 */
function decls(css, selRe) {
  const out = []; const re = /([^{}]+)\{([^{}]*)\}/g; let m;
  while ((m = re.exec(css))) {
    const sels = m[1].split(',').map((s) => s.trim().replace(/\s+/g, ' '));
    if (sels.some((s) => selRe.test(s))) out.push(m[2]);
  }
  return out.join(';');
}
const px = (v) => parseFloat(String(v).replace(/px$/, ''));

function grab(name) {
  const i = W.indexOf('function ' + name + '(');
  assert.ok(i >= 0, '못 찾음: ' + name);
  let d = 0, j = i;
  for (;; j++) { if (W[j] === '{') d++; else if (W[j] === '}') { d--; if (!d) { j++; break; } } }
  return W.slice(i, j);
}

// ══════════════════════════════════════════════════════════════════
test('① 빠른 기록 바 — 폰에서 입력칸이 «남는 자리만» 쓰고, 단축키 안내는 폰에서만 뺀다', () => {
  assert.match(decls(PHONE, /^#qbar input$/), /min-width:\s*0/,
    '★ 폰에서 #qbar input 에 min-width:0 이 없습니다 — 입력칸이 제 폭을 고집해 「🎤 말로」가 화면 밖으로 밀립니다');
  /* 단축키 안내는 제 이름(클래스)이 있어야 폰에서만 뺄 수 있다 */
  const hint = (W.match(/<span class="k ([a-z][\w-]*)" onclick="keysModal\(\)"/) || [])[1];
  assert.ok(hint, '★ 단축키 안내(/ 기록 · ? 단축키)에 제 클래스가 없습니다 — 폰에서만 뺄 손잡이가 없습니다');
  const hintSel = new RegExp('^#qbar \\.' + hint + '$');
  assert.match(decls(PHONE, hintSel), /display:\s*none/, '★ 폰에서 단축키 안내가 그대로 있습니다(자판이 없는 폰에서 화면 밖으로 밀림)');
  assert.doesNotMatch(decls(WIDE, hintSel), /display:\s*none/, '넓은 화면에서는 단축키 안내가 보여야 합니다');
  /* 🎤 말로는 폰에서 더 쓰는 길 — 감추면 안 된다 */
  assert.doesNotMatch(decls(PHONE, /^#qbar \.(mic|k)$/), /display:\s*none/, '★ 폰에서 「🎤 말로」까지 감췄습니다');
});

test('② 「＋ 새 업무」 창 — 폰에서는 한 칸씩, 그리고 «내용보다 좁아질 수 있는» 칸이다', () => {
  const ph = decls(PHONE, /^\.grid2$/);
  const cols = (ph.match(/grid-template-columns:\s*([^;]+)/) || [])[1];
  assert.ok(cols, '★ 폰 구간에 .grid2 칸 나누기가 없습니다 — 두 칸 그대로라 창이 화면 밖으로 벌어집니다');
  assert.match(cols, /minmax\(\s*0/, '★ 그냥 1fr 은 «내용보다 좁아지지 않아» 같은 일이 되풀이됩니다 — minmax(0, …) 로');
  assert.equal(cols.trim().split(/\s+(?![^(]*\))/).length, 1, '폰에서는 한 칸이어야 합니다: ' + cols);
  assert.match(decls(PHONE, /^#modalbg > div$/), /min-width:\s*0/,
    '★ 창 상자에 min-width:0 이 없으면 flex 안에서 «내용 폭 이상»으로 넓어집니다');
  /* 넓은 화면은 두 칸 그대로 */
  const wide = (decls(WIDE, /^\.grid2$/).match(/grid-template-columns:\s*([^;]+)/) || [])[1] || '';
  assert.equal(wide.trim().split(/\s+(?![^(]*\))/).length, 2, '넓은 화면의 「새 업무」 창은 두 칸이어야 합니다: ' + wide);
});

test('③ ★ 폰에서 표·보드·타임라인을 골라도 「목록」(폰 보기)으로 돌아오는 단추가 있다 — 넓은 화면은 그대로 셋', () => {
  function seg(phone) {
    const b = { localStorage: { getItem: () => 'board', setItem: () => {} }, esc: (s) => String(s), String };
    if (phone !== undefined) b.isPhone = () => phone;
    vm.createContext(b);
    vm.runInContext("var MYMODE_KEY='work_my_mode';\n" + grab('myMode') + '\n' + grab('myModeSeg'), b);
    return vm.runInContext('myModeSeg()', b);
  }
  const ph = seg(true);
  assert.match(ph, /setMyMode\('phone'\)/, '★ 폰에서 폰 목록으로 돌아올 단추가 없습니다 — ⚙ 는 폰 목록 머리에만 있어 갇힙니다');
  ['table', 'board', 'timeline'].forEach((m) => assert.match(ph, new RegExp("setMyMode\\('" + m + "'\\)"), m + ' 단추가 사라졌습니다'));
  assert.ok(ph.indexOf("setMyMode('phone')") < ph.indexOf("setMyMode('table')"), '「목록」이 맨 앞에 있어야 찾기 쉽습니다');
  [false, undefined].forEach((p) => assert.doesNotMatch(seg(p), /setMyMode\('phone'\)/,
    '넓은 화면(또는 검사 상자)에는 「목록」 단추가 없어야 합니다 — 넓은 화면은 한 글자도 안 바뀝니다'));
});

test('④ 서랍 「다음 할 일」 — 폰에서 날짜칸에 한도가 있고, 옆 여백이 넓은 화면보다 좁다(글칸에 자리를 돌려준다)', () => {
  assert.match(decls(PHONE, /^#drawer \.dcomp \.nextbox input\[type=date\]$/), /max-width:/,
    '★ 폰에서 날짜칸에 한도가 없습니다 — 16px 글씨의 날짜칸이 글칸을 다섯 글자로 누릅니다');
  const wideP = decls(WIDE, /^#drawer \.dcomp$/).match(/padding:\s*\S+\s+(\d+(?:\.\d+)?)px/);
  const phoneP = decls(PHONE, /^#drawer \.dcomp$/).match(/padding-left:\s*(\d+(?:\.\d+)?)px/);
  assert.ok(wideP && phoneP, '쓰는 칸의 옆 여백 규칙을 못 찾았습니다');
  assert.ok(px(phoneP[1]) < px(wideP[1]), '폰의 옆 여백이 넓은 화면보다 좁아야 합니다');
  /* 한 줄은 그대로 — 세 줄로 접히던 옛 모양으로 돌아가지 않는다 */
  assert.doesNotMatch(decls(PHONE, /nextbox$/), /flex-wrap:\s*wrap/, '「다음 할 일」이 다시 여러 줄로 접힙니다');
});

test('⑤ 폰 목록의 ☐ — 누르는 자리가 줄 높이만큼이고, 눌러도 서랍이 안 열린다 (대표 지시 2026-10-05)', () => {
  const b = { esc: (s) => String(s == null ? '' : s), escJ: (s) => String(s), itemName: (it) => it.title,
    phDue: () => '<span class="phd n">—</span>', String };
  vm.createContext(b);
  vm.runInContext(grab('phRowHTML'), b);
  const r = vm.runInContext("phRowHTML({_id:'A',company:'가나상사',title:'현장클리닉'},1,false)", b);
  const lab = r.match(/<label class="([\w-]+)"([^>]*)>\s*<input type="checkbox"/);
  assert.ok(lab, '★ ☐ 가 누르는 자리(label)에 싸여 있지 않습니다 — 17px 상자만 눌립니다');
  assert.match(lab[2], /onclick="event\.stopPropagation\(\)"/, '★ label 을 누르면 줄(서랍 열기)까지 눌립니다');
  assert.ok(r.indexOf('<label') < r.indexOf('class="no"'), '맨 왼쪽은 ☐, 그다음 번호입니다');
  const css = decls(WIDE + PHONE, new RegExp('^\\.phr \\.' + lab[1] + '$'));
  assert.match(css, /align-self:\s*stretch/, '★ 누르는 자리가 줄 높이를 다 덮지 않습니다');
  assert.match(css, /margin:\s*-\d/, '★ 누르는 자리가 줄 여백까지 덮지 않습니다(음수 여백)');
});

test('⑥ 「종료」 표는 폰에서도 «한 칸은 한 줄» — 칸마다 한도, 넘치면 …', () => {
  assert.match(decls(PHONE, /^#artbl td$/), /white-space:\s*nowrap/, '★ 종료 표 칸이 폰에서 여러 줄로 접힙니다(한 줄 180px)');
  assert.match(decls(PHONE, /^#artbl \.cut$/), /max-width:/, '★ 사업장·업무 칸에 한도가 없어 긴 이름 하나가 표를 벌립니다');
  const last = decls(PHONE, /^#artbl \.last$/);
  assert.match(last, /max-width:/, '「마지막 기록」 칸에 한도가 없습니다');
  assert.match(last, /text-overflow:\s*ellipsis/, '「마지막 기록」이 넘칠 때 … 로 줄이지 않습니다');
  assert.match(last, /overflow:\s*hidden/);
  /* 넓은 화면은 손대지 않았다 */
  assert.equal(decls(WIDE, /^#artbl/), '', '넓은 화면에 종료 표 규칙이 새로 생겼습니다 — 이 고침은 폰에서만입니다');
});

test('⑦ 폰 목록 조종칸 — 묶기 단추 글이 길어져도 🔍 · ⚙ 는 화면 안에 있다', () => {
  /* 「묶기 · 사업장 ▾」 처럼 길어지면 360px 에서 조종칸이 넘쳐 ⚙ 가 반쯤 밀려났다 */
  const gb = decls(PHONE, /^\.phbar \.phgb$/);
  assert.match(gb, /min-width:\s*0/, '★ 묶기 단추가 줄지 않습니다 — 넘치면 오른쪽 ⚙ 가 화면 밖으로 밀립니다');
  assert.match(gb, /text-overflow:\s*ellipsis/, '줄어든 묶기 글이 … 로 줄지 않습니다');
  assert.match(gb, /overflow:\s*hidden/);
  assert.match(decls(PHONE, /^\.phbar \.r$/), /flex:\s*0 0 auto|flex-shrink:\s*0/, '★ 🔍 · ⚙ 묶음이 대신 줄어듭니다');
  /* 줄일 때 «무엇으로 묶었는지»는 남아야 한다 — 「묶기 · …」 만 보이면 어떤 묶기인지 모른다 */
  const b = { localStorage: { getItem: (k) => (k === 'work_my_group' ? 'co' : null) }, esc: (s) => String(s), String };
  vm.createContext(b);
  vm.runInContext(W.match(/var MYGRP_KEY='[^']*';/)[0] + '\n' + W.match(/var PH_GRP=\[[\s\S]*?\]\];/)[0] + '\n'
    + grab('myGroup') + '\n' + grab('phHeadHTML'), b);
  const h = vm.runInContext('phHeadHTML(3,1,0)', b);
  const btn = (h.match(/<span class="phgb"[^>]*>([\s\S]*?)<\/span>/) || [])[1] || '';
  const lab = vm.runInContext("PH_GRP.find(function(x){return x[0]==='co';})[1]", b);
  const 접는것 = btn.match(/<i class="([\w-]+)">([^<]*)<\/i>/);
  assert.ok(btn.indexOf(lab) >= 0, '묶기 단추에 고른 묶기 이름이 없습니다');
  if (접는것) {
    assert.ok(접는것[2].indexOf(lab) < 0, '★ 접는 자리에 묶기 이름까지 들어 있어 좁은 폰에서 «무엇으로 묶었는지»가 사라집니다');
    const 숨김 = BLOCKS.filter((x) => isPhoneCond(x.cond)).map((x) => x.body).join('\n');
    assert.match(decls(숨김, new RegExp('\\.phgb \\.' + 접는것[1] + '$')), /display:\s*none/, '접는 자리를 정해 놓고 안 접습니다');
  }
});
