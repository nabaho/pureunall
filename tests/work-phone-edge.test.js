'use strict';
// 📱 업무관리 — 폰에서 «양옆 빈자리»를 걷는다 (대표 지시 2026-10-18 「양옆 빈공백이 많다 — 좌우 옆공간 모두 채워서」)
// node --test tests/work-phone-edge.test.js
//
// ■ 무엇이 나빴나 (411px 실측 · tools/phone-audit 「양옆 L/R·겹」)
//   글이 화면 끝에서 23px(내 업무·팀·업무량) · 31/71px(치울 것, 상자 안 상자 2겹) · 42/138px(종료) 안쪽에서 시작했다.
//   겉 여백 12 + 상자 테두리 1 + 상자 안 여백 10~18 이 겹겹이 쌓였다. 닫힌 메뉴 서랍의 그림자는
//   화면 왼쪽 끝에 회색 띠로 늘 비쳤다. 보드는 258px 칸이라 오른쪽 절반이 늘 비었다.
//
// ■ 이 검사가 지키는 것 — «규칙»이지 지금 px 값이 아니다
//   ① 폰의 겉 여백은 넓은 화면보다 작다
//   ② 맨 위 상자는 «겉 여백만큼» 바깥으로 나가(음수 여백) 화면 폭을 다 쓰고, 옆 테두리·둥근 모서리가 없다
//   ③ 상자 안의 상자(치울 것의 도구줄·표)는 바탕·옆 테두리를 걷어 한 겹이다
//   ④ 보드는 폰에서 위아래로 쌓고, 칸 상자를 걷는다
//   ⑤ 서랍·창은 폰에서 화면을 다 쓴다(창 바깥·안 여백이 원래보다 작다)
//   ⑥ 닫힌 메뉴 서랍에는 그림자가 없다(열렸을 때만)

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const W = fs.readFileSync(path.join(__dirname, '..', 'work.html'), 'utf8').replace(/\r\n/g, '\n');
const CSS = (() => {
  const head = W.slice(0, W.indexOf('</head>'));
  return [...head.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
})();
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
const maxW = (c) => +((c.match(/max-width\s*:\s*(\d+)px/) || [])[1] || 0);
/* 폰 — 이 앱의 폰 폭(560px 이하, isPhone 과 같은 경계) */
const PHONE = BLOCKS.filter((b) => maxW(b.cond) && maxW(b.cond) <= 560 && !/min-width/.test(b.cond)).map((b) => b.body).join('\n');
/* 폰 서랍이 사는 구간(760px 이하) */
const NARROW = BLOCKS.filter((b) => maxW(b.cond) && maxW(b.cond) <= 760 && !/min-width/.test(b.cond)).map((b) => b.body).join('\n');
const WIDE = (() => { let s = '', p = 0; BLOCKS.forEach((b) => { s += CSS.slice(p, b.start); p = b.end; }); return s + CSS.slice(p); })();
function rules(css) {
  const out = []; const re = /([^{}]+)\{([^{}]*)\}/g; let m;
  while ((m = re.exec(css))) m[1].split(',').forEach((s) => out.push({ sel: s.trim().replace(/\s+/g, ' '), body: m[2] }));
  return out;
}
const decls = (css, selRe) => rules(css).filter((r) => selRe.test(r.sel)).map((r) => r.body).join(';');
/* 마지막에 적힌 값(뒤가 이긴다) */
function last(body, prop) {
  const re = new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;!]+)', 'g'); let m, v = null;
  while ((m = re.exec(body))) v = m[1].trim();
  return v;
}
/* padding 줄임꼴에서 왼쪽 값 */
function padLeft(body) {
  const pl = last(body, 'padding-left'); if (pl) return parseFloat(pl);
  const p = last(body, 'padding'); if (!p) return null;
  const v = p.split(/\s+/);
  return parseFloat(v.length === 4 ? v[3] : v.length >= 2 ? v[1] : v[0]);
}
const marginLeft = (body) => { const v = last(body, 'margin-left'); return v == null ? null : parseFloat(v); };

const appPadPhone = padLeft(decls(PHONE, /^#app$/));

// ══════════════════════════════════════════════════════════════════
test('① 폰의 겉 여백(#app 양옆)은 넓은 화면보다 작다', () => {
  const wide = padLeft(decls(WIDE, /^#app$/));
  assert.ok(appPadPhone != null, '★ 폰 구간에 #app 여백 규칙이 없습니다 — 겉 여백이 넓은 화면 그대로입니다');
  assert.ok(wide != null && appPadPhone < wide, '폰 겉 여백이 넓은 화면보다 작아야 합니다');
  /* 태블릿 폭(760) 규칙보다도 작다 — 그 위에 덮어써야 폰에서 줄어든다 */
  const tab = padLeft(decls(BLOCKS.filter((b) => maxW(b.cond) === 760).map((b) => b.body).join('\n'), /^#app$/));
  if (tab != null) assert.ok(appPadPhone < tab, '★ 폰 여백이 태블릿 규칙보다 크거나 같습니다 — 덮어쓰지 못합니다');
});

test('② ★ 맨 위 상자(목록·표·카드)는 겉 여백만큼 바깥으로 나가 화면 폭을 다 쓰고, 옆 테두리·둥근 모서리를 걷는다', () => {
  ['.phl', '.phbar', '.panel', '.tmwrap'].forEach((c) => {
    const sel = new RegExp('^#app > ' + c.replace('.', '\\.') + '$');
    const b = decls(PHONE, sel);
    assert.ok(b, '★ 폰 구간에 ' + c + ' 를 화면 폭으로 펴는 규칙이 없습니다');
    assert.equal(marginLeft(b), -appPadPhone, '★ ' + c + ' 의 음수 여백이 겉 여백과 다릅니다 — 화면 끝에 안 닿거나 넘칩니다');
    assert.match(b, /border-left-width:\s*0/, c + ' 옆 테두리가 남았습니다');
    assert.match(b, /border-radius:\s*0/, c + ' 둥근 모서리가 남았습니다(화면 끝에서 깎인 모서리)');
  });
  /* 펼친 상자의 안 여백은 넓은 화면의 상자 안 여백보다 작다 — 글이 화면 끝 가까이 온다 */
  const inPh = padLeft(decls(PHONE, /^#app > \.panel:not\(\.tbl\)$/));
  const inWide = padLeft(decls(WIDE, /^\.panel$/));
  assert.ok(inPh != null && inWide != null && inPh < inWide, '★ 폰 패널 안 여백이 넓은 화면 그대로입니다');
  /* 팀 현황판 칸도 옆 테두리를 걷는다 */
  assert.match(decls(PHONE, /\.tmwrap \.tmc$/), /border-left-width:\s*0/, '팀 현황판 칸의 옆 테두리가 남았습니다');
});

test('③ 상자 안의 상자는 한 겹으로 — 치울 것의 도구줄·표에서 바탕·옆 테두리를 걷는다', () => {
  const bar = decls(PHONE, /\.panel \.wsbar$/);
  assert.match(bar, /background:\s*transparent/, '★ 치울 것 도구줄의 바탕이 남아 상자가 두 겹입니다');
  assert.match(bar, /border-left-width:\s*0/);
  const tbl = decls(PHONE, /\.panel \.panel\.tbl$/);
  assert.match(tbl, /background:\s*transparent/, '★ 패널 안 표의 바탕이 남아 상자가 두 겹입니다');
  assert.match(tbl, /border-left-width:\s*0/);
  assert.ok(marginLeft(tbl) < 0, '패널 안 표가 패널 끝까지 펴지지 않습니다');
});

test('④ 보드는 폰에서 위아래로 쌓고 칸 상자를 걷는다 — 258px 칸 옆이 늘 비던 것', () => {
  assert.match(decls(PHONE, /\.bdwrap$/), /flex-direction:\s*column/, '★ 폰 보드가 여전히 옆으로 칸을 늘어놓습니다');
  const col = decls(PHONE, /\.bdcol$/);
  assert.match(col, /background:\s*transparent/, '보드 칸 바탕이 남아 카드가 두 겹입니다');
  assert.match(col, /border:\s*0/);
  assert.match(col, /max-height:\s*none/, '쌓은 칸이 제 높이 한도에 갇힙니다');
});

test('⑤ 서랍·창은 폰에서 화면을 다 쓴다', () => {
  const dr = decls(PHONE, /^#drawer$/);
  assert.match(dr, /(^|;)\s*width:\s*100%/, '★ 폰 서랍이 화면 폭을 다 쓰지 않습니다');
  assert.match(dr, /max-width:\s*100%/);
  const dbox = decls(PHONE, /^#drawer \.dbox$/);
  assert.equal(marginLeft(dbox), 0, '서랍 칸(상자)이 옆 여백을 둡니다');
  assert.match(dbox, /border-left-width:\s*0/);
  const dhPh = padLeft(decls(PHONE, /^#drawer \.dh$/)), dhW = padLeft(decls(WIDE, /^#drawer \.dh$/));
  assert.ok(dhPh != null && dhW != null && dhPh < dhW, '서랍 머리 옆 여백이 넓은 화면 그대로입니다');
  /* 창 — 바깥(#modalbg)·안(상자) 여백은 showModal 의 인라인 값보다 작다(인라인이라 !important) */
  const sm = W.slice(W.indexOf('function showModal('), W.indexOf('function showModal(') + 900);
  const bgPad = parseFloat((sm.match(/id='modalbg'[\s\S]*?padding:(\d+)px/) || sm.match(/inset:0;[^']*padding:(\d+)px/) || [])[1]);
  const boxPad = sm.match(/<div style="background:#fff;[^"]*padding:(\d+)px (\d+)px/);
  assert.ok(bgPad && boxPad, 'showModal 의 창 여백을 못 찾았습니다');
  const ph = decls(PHONE, /^#modalbg$/), phBox = decls(PHONE, /^#modalbg > div$/);
  assert.match(ph, /!important/, '창 여백은 인라인이라 !important 가 있어야 덮습니다');
  assert.ok(padLeft(ph.replace(/!important/g, '')) < bgPad, '★ 폰 창 바깥 여백이 원래보다 작지 않습니다');
  assert.ok(padLeft(phBox.replace(/!important/g, '')) < +boxPad[2], '★ 폰 창 안 여백이 원래보다 작지 않습니다');
});

test('⑥ 닫힌 메뉴 서랍에는 그림자가 없다 — 화면 왼쪽 끝 회색 띠', () => {
  const closed = rules(NARROW).filter((r) => r.sel === '#side').map((r) => r.body).join(';');
  assert.doesNotMatch(closed, /box-shadow:\s*(?!none)/, '★ 닫힌 서랍(#side)에 그림자가 있어 화면 왼쪽 끝에 비칩니다');
  assert.match(decls(NARROW, /^body\.sideopen #side$/), /box-shadow:/, '열린 서랍에는 그림자가 있어야 화면과 갈립니다');
});

test('⑦ 넓은 화면은 그대로 — 화면 폭 펴기 규칙은 폰 구간에만 있다', () => {
  assert.equal(decls(WIDE, /^#app > \.(phl|phbar|panel|tmwrap)$/), '', '넓은 화면에 화면 폭 펴기 규칙이 새었습니다');
  assert.doesNotMatch(decls(WIDE, /\.bdwrap$/), /flex-direction:\s*column/, '넓은 화면 보드가 세로로 쌓입니다');
});
