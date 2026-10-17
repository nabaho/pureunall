'use strict';
/* 메일 첨부 미리보기 창 — 폰에서 아래 단추가 읽히고, 떠 있는 딱지에 안 가린다 (대표 화면 2026-10-17)
   실행: node --test tests/mail-preview-phone-footer.test.js

   ⚠ 왜 이 검사가 생겼나: 폰(355px)에서 네 단추(→ 급여데이터함 · → 기업별 계약서 ·
     📥 내려받기 · 닫기)가 한 줄에 끼어 들며 줄어들어 글자가 「→ 급 / 여데 / 이터」처럼
     세 줄로 접혔고, 단추 높이 밖은 잘렸다. 넷째 「닫기」는 「● 최신」 알약에 가렸다.
     (폰 크기로 실제로 그려 재 보니 네 단추 모두 잘려 있었다 — 고친 뒤 0개.)

   지키는 것.
   ① 단추 글자는 접지 않는다 — 한 칸은 한 줄(CLAUDE.md)
   ② 폰에서는 단추를 줄이지 않고 «줄을 늘린다»(격자)
   ③ 메일함의 창이 떠 있는 동안 떠다니는 딱지가 비킨다 — 시트(.modalbg)와 같은 규칙 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sliceFn } = require('./fnslice.js');

const app = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8');
const css = app.slice(app.indexOf('<style>'), app.indexOf('</style>')).replace(/\/\*[\s\S]*?\*\//g, ' ');

/* 「선택자{…}」 덩이들 — 선택자에 want 가 든 것만 */
function rulesOf(src, want) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(src))) if (m[1].indexOf(want) >= 0) out.push({ sel: m[1].trim(), body: m[2] });
  return out;
}
/* 폰 구간(@media max-width) 안의 글만 */
function phoneBlocks() {
  const out = [];
  const re = /@media\s*\(\s*max-width\s*:\s*\d+px\s*\)\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    let d = 1, i = re.lastIndex;
    for (; i < css.length && d; i++) { if (css[i] === '{') d++; else if (css[i] === '}') d--; }
    out.push(css.slice(re.lastIndex, i - 1));
  }
  return out.join('\n');
}

test('★★ 미리보기 아래 단추 글자는 접지 않는다 — 접히면 무슨 단추인지 못 읽는다', () => {
  const r = rulesOf(css, '.pvbox>footer button').filter(x => /white-space\s*:\s*nowrap/.test(x.body));
  assert.ok(r.length, '단추 글자가 접힐 수 있습니다 — 폰에서 「→ 급 / 여데 / 이터」로 세 줄이 됩니다');
});

test('★★ 폰에서는 단추를 줄이지 않고 «줄을 늘린다»', () => {
  const ph = phoneBlocks();
  const r = rulesOf(ph, '.pvbox>footer').filter(x => /display\s*:\s*grid/.test(x.body)
    && /grid-template-columns/.test(x.body));
  assert.ok(r.length,
    '폰 구간에 미리보기 단추 줄 격자가 없습니다 — 네 단추가 한 줄에 끼어 들며 글자가 잘립니다');
});

test('폰 구간이 고르는 미리보기 바깥 막(.mck-dim)의 이름이 실제 창에 붙어 있다', () => {
  /* 막에 붙인 이름이 바뀌면 폰 여백 규칙이 조용히 헛돈다 */
  const ph = phoneBlocks();
  const m = ph.match(/\.mck-dim\.([A-Za-z_][\w-]*)\s*\{/);
  assert.ok(m, '폰 구간에 미리보기 막 여백 규칙이 없습니다');
  const h = sliceFn(app, 'function mbPvHtml(');
  assert.ok(new RegExp('class="mck-dim[^"]*\\b' + m[1] + '\\b').test(h),
    '폰 규칙이 고르는 「' + m[1] + '」 이 미리보기 막에 없습니다 — 규칙이 헛돕니다');
});

test('★★ 메일함 창(.mck-dim)이 떠 있는 동안 「● 최신」 알약·즐겨찾기가 비킨다', () => {
  /* 시트(.modalbg)에는 이미 있던 규칙인데 메일함 창이 빠져 있었다 — 「닫기」가 알약에 가렸다.
     ⚠ 그 딱지들은 자리를 style= 로 박아 두어 !important 없이는 안 비킨다. */
  const hide = rulesOf(css, 'body:has(.mck-dim)').filter(x => /display\s*:\s*none\s*!important/.test(x.body));
  assert.ok(hide.length, '메일함 창이 떠 있어도 떠다니는 딱지가 그대로 남습니다');
  const sel = hide.map(x => x.sel).join(',');
  ['#pu-version-fab', '[data-pu-appbar-btn]', '#pu-backup-admin-button'].forEach(s =>
    assert.ok(sel.indexOf('body:has(.mck-dim) ' + s) >= 0, s + ' 이 메일함 창을 덮은 채로 남습니다'));
});
