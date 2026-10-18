'use strict';
/* 기업정보함·메일 — 폰에서 «양옆 빈자리»를 채운다 (대표 지시 2026-10-18 「양옆 빈공백이 많다 · 좌우 옆공간 모두 채워서」)
   실행: node --test tests/cards-phone-edge.test.js

   폰 폭(360·411)으로 그려 재 보니 겉 여백과 상자 안 여백이 겹겹이 쌓여 글이 화면 끝에서 20~30px 에 섰다.
     · 아래에서 올라오는 창(.modal) 안쪽 18px → 명함 상세 글이 19px 에서 시작
     · ☰ 메뉴: 창 18px + 칸 10px → 칸 이름이 28px 에서 시작
     · 🏢 기업 상세: 겉 18px + 접는 칸·띠·한 일 줄의 테두리 상자 + 안 10~11px → 글이 30px, 상자가 두 겹
     · 📎 자료함: 겉 12px + 자료 한 장 상자 14px → 27px, 두 겹
     · 🏢 사업장별(메일): 위아래로 쌓인 뒤에도 사업장 칸이 글 길이만큼 좁았다(411px 폰에서 287px)
     · 날짜 머리(2026.10.17 · ⭐ 즐겨찾기)만 18px 로 들어가 줄(12px)과 어긋났다

   ⚠ px 값을 박지 않는다 — 「폰 규칙이 PC 값보다 작은가」「안쪽 상자의 옆 테두리·둥근 모서리를 걷었는가」
     「머리줄이 창 끝까지 덮는가(음수 여백 = 창 여백)」처럼 «규칙»만 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').split('\r\n').join('\n');
const css = app.slice(app.indexOf('<style>'), app.indexOf('</style>')).replace(/\/\*[\s\S]*?\*\//g, ' ');

/* 규칙 덩이를 { media, sel(쉼표로 가른 하나하나), body } 로 — 어느 @media 안인지 함께 적는다 */
function blocks() {
  const out = [];
  const walk = (src, media) => {
    const re = /@media([^{]*)\{|([^{}@]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(src))) {
      if (m[1] !== undefined) {
        let d = 1, i = re.lastIndex;
        for (; i < src.length && d; i++) { if (src[i] === '{') d++; else if (src[i] === '}') d--; }
        walk(src.slice(re.lastIndex, i - 1), m[1].trim());
        re.lastIndex = i;
        continue;
      }
      m[2].split(',').map((s) => s.trim().replace(/\s+/g, ' ')).forEach((sel) => out.push({ media, sel, body: m[3] }));
    }
  };
  walk(css, '');
  return out;
}
const ALL = blocks();
const isPhone = (b) => { const x = (b.media.match(/max-width\s*:\s*(\d+)px/) || [])[1]; return !!x && Number(x) <= 760 && !/min-width/.test(b.media); };
const phone = (re) => ALL.filter((b) => isPhone(b) && re.test(b.sel));
const base = (re) => ALL.filter((b) => !b.media && re.test(b.sel));

/* 한 덩이 안에서 «왼쪽/오른쪽» 값(padding·margin) — 줄임말과 낱말을 차례대로 읽어 마지막 것이 이긴다. 없으면 null */
function side(body, prop, which) {
  let v = null;
  const re = new RegExp('(?:^|;)\\s*' + prop + '(-left|-right)?\\s*:\\s*([^;]+)', 'g');
  let m;
  while ((m = re.exec(body))) {
    const t = m[2].trim().replace(/!important/, '').trim().split(/\s+/).map((x) => parseFloat(x) || 0);
    if (!m[1]) v = which === 'left' ? (t.length === 4 ? t[3] : t.length >= 2 ? t[1] : t[0]) : (t.length >= 2 ? t[1] : t[0]);
    else if (m[1] === '-' + which) v = t[0];
  }
  return v;
}
const sideOf = (bs, prop, which) => bs.map((b) => side(b.body, prop, which)).filter((n) => n !== null);
const has = (bs, re) => bs.some((b) => re.test(b.body.replace(/\s+/g, '')));

test('★★ 폰의 창(.modal)은 안쪽 여백이 PC 보다 작다 — 글이 화면 끝 가까이에서 시작한다', () => {
  const pc = sideOf(base(/^\.modal$/), 'padding', 'left');
  const ph = sideOf(phone(/^(body:not\(\.pc\) )?\.modal$/), 'padding', 'left');
  assert.ok(pc.length, '창(.modal)의 기본 여백 규칙을 못 찾았습니다');
  assert.ok(ph.length && Math.max(...ph) < Math.max(...pc), '★★ 폰 창 안쪽 여백이 PC 그대로입니다 — 양옆이 빕니다');
});

test('★★ 폰 ☰ 메뉴 — 창 여백 + 칸 여백이 PC 보다 작고, 붙박이 머리줄은 창 끝까지 덮는다', () => {
  const pcMenu = Math.max(0, ...sideOf(base(/^\.modal$/), 'padding', 'left'));
  const pcBtn = Math.max(0, ...sideOf(base(/^(#menuM )?\.sheetbtn$/), 'padding', 'left'));
  const phMenu = sideOf(phone(/^(body:not\(\.pc\) )?#menuM$/), 'padding', 'left');
  const phBtn = sideOf(phone(/^(body:not\(\.pc\) )?#menuM \.sheetbtn$/), 'padding', 'left');
  assert.ok(phMenu.length, '★★ 폰에서 메뉴 창 여백을 줄이는 규칙이 없습니다');
  const btn = phBtn.length ? Math.min(...phBtn) : pcBtn;
  assert.ok(Math.min(...phMenu) + btn < pcMenu + pcBtn, '★★ 폰 메뉴 칸 이름이 PC 만큼 안쪽에서 시작합니다');
  const head = phone(/^(body:not\(\.pc\) )?#menuM ?> ?\.mhead$/);
  const ml = sideOf(head, 'margin', 'left');
  assert.ok(ml.length && ml.some((x) => x === -Math.min(...phMenu)),
    '붙박이 머리줄의 음수 여백이 창 여백과 다릅니다 — 머리줄 양옆으로 글이 비쳐 보입니다');
});

test('★★ 폰 🏢 기업 상세 — 겉 여백이 PC 보다 작고, 안쪽 상자는 옆 테두리·둥근 모서리를 걷어 한 겹이다', () => {
  const pc = sideOf(base(/^#pcDetail \.pdbody$/), 'padding', 'left');
  const ph = sideOf(phone(/^(body:not\(\.pc\) )?#pcDetail \.pdbody$/), 'padding', 'left');
  assert.ok(pc.length, '기업 상세 몸통의 기본 여백 규칙을 못 찾았습니다');
  assert.ok(ph.length && Math.max(...ph) < Math.max(...pc), '★★ 폰 기업 상세 겉 여백이 PC 그대로입니다');
  [/\.cocard$/, /\.coerppin$/, /\.cohist-row$/].forEach((re) => {
    const r = phone(new RegExp('^(body:not\\(\\.pc\\) )?#pcDetail .*' + re.source));
    assert.ok(has(r, /border-left:0|border-left:none/) && has(r, /border-radius:0/),
      '★★ 폰 기업 상세의 ' + re.source + ' 상자가 옆 테두리·둥근 모서리를 그대로 둡니다 — 상자 안의 상자(두 겹)');
  });
  /* 한 일 줄은 흰 바탕 위 흰 상자였다 — 폰에서는 바탕도 걷어 한 겹 */
  assert.ok(has(phone(/^(body:not\(\.pc\) )?#pcDetail \.cohist-row$/), /background:transparent/), '「한 일」 줄이 바탕 상자를 그대로 둡니다');
});

test('폰 날짜 머리(⭐ 즐겨찾기·날짜)는 명함 줄과 같은 자리에서 시작한다', () => {
  const row = sideOf(phone(/^\.row$/), 'padding', 'left');
  const head = sideOf(phone(/^\.datehead$/), 'padding', 'left');
  assert.ok(row.length && head.length, '폰 줄·날짜 머리의 여백 규칙을 못 찾았습니다');
  assert.equal(Math.max(...head), Math.max(...row), '날짜 머리가 줄과 다른 자리에서 시작합니다 — 양옆이 들쭉날쭉합니다');
});

test('폰 👷 근로자 화면은 겉 여백이 PC(기본)보다 작다', () => {
  const pc = sideOf(base(/^\.wkmob$/), 'padding', 'left');
  const ph = sideOf(phone(/^\.wkmob$/), 'padding', 'left');
  assert.ok(pc.length && ph.length && Math.max(...ph) < Math.max(...pc), '근로자 화면 겉 여백이 그대로입니다');
});

/* ── 메일 쪽 ── */
test('★★ 폰 📎 자료함 — 자료 한 장은 화면 끝까지 펴고(음수 여백 = 겉 여백) 옆 테두리·둥근 모서리를 걷는다', () => {
  const outer = sideOf(phone(/^#matM$/), 'padding', 'left');
  const card = phone(/^#matM \.matcard$/);
  assert.ok(outer.length, '폰 자료함 겉 여백 규칙을 못 찾았습니다');
  assert.ok(sideOf(card, 'margin', 'left').some((x) => x === -Math.max(...outer)), '★★ 자료 한 장이 겉 여백 안쪽에 갇혀 있습니다(두 겹)');
  assert.ok(has(card, /border-left:0|border-left:none/) && has(card, /border-radius:0/), '★★ 자료 한 장이 옆 테두리·둥근 모서리를 그대로 둡니다');
  const pcPad = sideOf(base(/^\.matcard$/), 'padding', 'left');
  const phPad = sideOf(card, 'padding', 'left');
  assert.ok(phPad.length && Math.max(...phPad) < Math.max(...pcPad), '자료 한 장 안쪽 여백이 PC 그대로입니다');
  /* 바탕을 걷어도 «고른 장»은 표가 나야 한다 */
  if (has(card, /background:transparent/)) {
    assert.ok(has(phone(/^#matM \.matcard\.pkon$/), /background:#/), '바탕을 걷으면서 고른 장의 표시까지 지웠습니다');
  }
});

test('★ 폰 🏢 사업장별(메일) — 사업장 칸이 글 길이만큼 좁지 않고 화면 폭을 다 쓴다', () => {
  /* 위아래로 쌓을 때 묶음(.ctwrap)이 align-items:flex-start 이면 칸은 «글 길이만큼»만 선다 */
  const wrapStart = base(/^\.ctwrap$/).some((b) => /align-items\s*:\s*flex-start/.test(b.body));
  if (wrapStart) assert.ok(has(phone(/^(body:not\(\.pc\) )?\.ctside$/), /align-self:stretch/), '★ 사업장 칸이 글 길이만큼 좁게 섭니다');
});
