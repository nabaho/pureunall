'use strict';
/* 사진첩 — 폰에서 «양옆 빈자리»가 돌아오지 않게 (대표 지시 2026-10-18 「양옆 빈공백이 많다 — 좌우 옆공간 모두 채워서」)
   실행: node --test tests/photos-phone-edge.test.js

   ⚠ 왜 이 검사가 생겼나 — 411px 로 재 보니 격자가 화면 끝에서 12px 안쪽에 서고, 서류 카드 글은 20px 에서,
     설정 카드 글은 27px(겉 12 + 테두리 1 + 안쪽 14)에서 시작했다.
     폰에서는 격자 겉 여백을 줄이고, 설정 카드는 화면 폭을 다 쓰며 옆 테두리·둥근 모서리를 걷었다.
   ⚠ px 값을 박지 않는다 — «폰 값이 PC 값보다 작은가 / 넓힌 만큼이 겉 여백과 같은가» 를 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'pu-photos.html'), 'utf8');
const css = app.slice(app.indexOf('<style'), app.indexOf('</style>'));

/* 탭 줄을 감추는 폭(폰 구간의 바깥 경계) — 숫자를 박지 않고 CSS 에서 읽는다 */
function blocks() {
  const out = [];
  let base = '', i = 0;
  while (i < css.length) {
    const at = css.indexOf('@media', i);
    if (at < 0) { base += css.slice(i); break; }
    base += css.slice(i, at);
    const open = css.indexOf('{', at);
    const cond = css.slice(at, open);
    let depth = 0, k = open;
    for (; k < css.length; k++) {
      if (css[k] === '{') depth++;
      else if (css[k] === '}') { depth--; if (!depth) break; }
    }
    out.push({ cond, body: css.slice(open + 1, k) });
    i = k + 1;
  }
  return { out, base };
}
function rulesOf(block) {
  const out = [];
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(block))) out.push({ sel: m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim(), body: m[2] });
  return out;
}
const B = blocks();
const BASE = rulesOf(B.base);
/* 폰 = max-width 만 있는 구간 */
const PHONE = [].concat(...B.out.filter(b => /max-width/.test(b.cond) && !/min-width/.test(b.cond)).map(b => rulesOf(b.body)));

function has(rules, selRe) { return rules.filter(r => r.sel.split(',').some(s => selRe.test(s.trim()))); }
function sideOf(rules, selRe, prop) {
  let v = null;
  has(rules, selRe).forEach(r => {
    const re = new RegExp('(?:^|;)\\s*' + prop + '(-left)?\\s*:\\s*([^;]+)', 'g');
    let m;
    while ((m = re.exec(r.body))) {
      if (m[1]) { v = parseFloat(m[2]); continue; }
      const p = m[2].trim().split(/\s+/).map(parseFloat);
      v = p.length === 1 ? p[0] : p.length <= 3 ? p[1] : p[3];
    }
  });
  return v;
}

test('★ 폰에서 격자 겉 여백(#main)은 PC 보다 좁다', () => {
  const pc = sideOf(BASE, /^#main$/, 'padding');
  const ph = sideOf(PHONE, /^#main$/, 'padding');
  assert.ok(pc > 0, 'PC 겉 여백을 못 읽었습니다');
  assert.ok(ph !== null && ph < pc, '★ 폰 격자 겉 여백(' + ph + ')이 PC(' + pc + ')보다 좁지 않습니다');
  assert.ok(ph > 0, '사진 칸이 화면 끝에 딱 붙습니다');
});

/* 서류 카드 글이 화면 끝에서 몇 px 에서 시작하나 = 격자 겉 여백 + 칸 테두리 + 카드 안쪽 여백.
   ⚠ 14 는 «지금 값»이 아니라 목표다 — 총괄 기준 「글은 화면 끝에서 8~14px 안에서 시작한다」(대표 지시 2026-10-18). 검사고정-허용 */
test('★ 폰에서 서류 카드 글은 화면 끝 가까이(목표 14px 이내)에서 시작한다', () => {
  const pad = sideOf(PHONE, /^#main$/, 'padding');
  const cell = has(BASE, /^#grid \.cell\.doc$/).map(r => r.body).join(';');
  const border = parseFloat((cell.match(/border:\s*([\d.]+)px/) || [])[1]) || 0;
  const bd = sideOf(PHONE, /#grid \.cell\.doc \.bd$/, 'padding') ?? sideOf(BASE, /^#grid \.cell\.doc \.bd$/, 'padding');
  const start = pad + border + bd;
  assert.ok(start <= 14, '★ 서류 카드 글이 화면 끝에서 ' + start + 'px 에서 시작합니다(목표 14 이내) — 검사고정-허용');
  assert.ok(start >= 6, '글이 화면 끝에 딱 붙습니다');
});

test('★ 폰에서 윗줄(#side)도 격자와 같은 겉 여백 — 윗줄만 안쪽에 서면 들쭉날쭉하다', () => {
  assert.equal(sideOf(PHONE, /^#side$/, 'padding'), sideOf(PHONE, /^#main$/, 'padding'));
});

test('★ 폰에서 설정 카드는 화면 폭을 다 쓴다 — 넓힌 만큼이 겉 여백과 같다(덜 넓히면 빈 틈, 더 넓히면 화면 밖)', () => {
  const pad = sideOf(PHONE, /^#main$/, 'padding');
  const m = sideOf(PHONE, /#viewSettings \.card$/, 'margin');
  assert.equal(m, -pad, '★ 설정 카드가 화면 끝까지 안 닿거나 화면 밖으로 나갑니다');
  const r = has(PHONE, /#viewSettings \.card$/).map(x => x.body).join(';');
  assert.match(r, /border-radius:\s*0/, '화면 끝까지 넓힌 카드에 둥근 모서리가 남으면 귀퉁이가 빕니다');
  assert.match(r, /border-left:\s*0/, '화면 끝에 옆 테두리가 남습니다');
});

test('★ 폰에서 설정 카드 안쪽 여백은 PC 보다 좁다', () => {
  const pc = sideOf(BASE, /^#viewSettings \.card$/, 'padding');
  const ph = sideOf(PHONE, /#viewSettings \.card$/, 'padding');
  assert.ok(ph !== null && ph < pc, '★ 설정 카드 안 글이 여전히 깊이 들어가 있습니다');
});

test('★ 넓히는 규칙은 바탕보다 힘이 세다 — 바탕 규칙이 뒤에 있어 같은 힘이면 폰 규칙이 진다', () => {
  /* 바탕 #viewSettings .card · #backBar 는 이 폰 덩어리보다 «뒤»에 적혀 있다 */
  ['#viewSettings \\.card$', '#backBar$'].forEach(s => {
    const sels = [].concat(...has(PHONE, new RegExp(s)).map(r => r.sel.split(',').map(x => x.trim()).filter(x => new RegExp(s).test(x))));
    const ids = Math.max(...sels.map(x => (x.match(/#/g) || []).length));
    const baseIds = Math.max(...[].concat(...has(BASE, new RegExp('^' + s)).map(r => r.sel.split(',').map(x => x.trim()))).map(x => (x.match(/#/g) || []).length));
    assert.ok(ids > baseIds, '★ ' + s + ' 폰 규칙이 바탕 규칙보다 힘이 세지 않습니다 — 폰에서 안 먹습니다');
  });
});

test('★ PC 는 그대로 — 바탕 규칙의 겉 여백·카드 여백은 손대지 않았다', () => {
  assert.ok(sideOf(BASE, /^#main$/, 'padding') > sideOf(PHONE, /^#main$/, 'padding'));
  const hit = BASE.some(r => /border-radius:\s*0/.test(r.body) && /#viewSettings \.card/.test(r.sel));
  assert.equal(hit, false, '★ 설정 카드 모서리를 PC 에서도 걷었습니다');
});
