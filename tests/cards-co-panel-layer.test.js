/* ══════ 기업 상세 패널은 «창»이 아니라 «화면의 한 자리»다 (점검 2026-09-12) ═══════
   대표 지시 「다시 전체 점검」 → 「고침」

   ■ 무엇이 문제였나 — 화면에서 재서 찾았다
   기업 상세 패널(#pcDetail)만 층 높이가 120 이고, 이 앱의 창은 «모두» 100(.modalbg)이다.
   그래서 패널을 열어 둔 채 여는 창이 죄다 «패널 뒤»로 갔다.

     · 폰 — 패널이 전체화면이라 창이 통째로 안 보였다. 기업 상세에서 사람 이름을 누르면
       명함이 «열리는데» 화면은 그대로여서 「눌러도 아무 일도 안 난다」로 보였다.
       확인서 갱신 창·수정 창도 같았다. 실측으로 셋 다 확인했다.
     · PC — 확인서 창(196~756)과 패널(532~952)이 224px 겹쳐 창의 오른쪽이 잘렸다.
       그 안에 ✕ 닫기 단추가 있어 «못 눌렀다». ESC 도 안 먹었다(바깥을 눌러야 닫혔다).

   ★ 못 박는 것
     ① 패널은 창보다 «아래»다. 창은 늘 그 위에 뜬다.
     ② 그래도 화면의 붙박이 것들(고른 것 띠 60 · 흐림막 70)보다는 «위»다 —
        그것들은 화면의 일부라 패널에 가려야 맞다.
     ③ 창의 층은 .modalbg «한 곳»이 정한다. 창마다 제 층을 박으면 다음에 하나가
        늘 때 그것만 또 패널 뒤로 간다.
     ④ 폰에서 패널이 전체화면이 되는 규칙은 그대로다 — 그것이 있어 ①이 치명적이었다.

   node --test tests/cards-co-panel-layer.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8')
  .split('\r\n').join('\n');
const CSS = SRC.slice(SRC.indexOf('<style'), SRC.lastIndexOf('</style>'));

/* 규칙 하나를 «실제로 읽어» 층 높이를 꺼낸다 — 글자를 찾는 것이 아니라 값을 잰다.
   ⚠ 여러 줄로 적힌 규칙이 흔하므로 닫는 중괄호까지 읽는다. */
function 층(selector) {
  const at = CSS.indexOf('\n' + selector + '{');
  assert.ok(at > 0, '규칙을 찾지 못했습니다: ' + selector);
  const body = CSS.slice(at, CSS.indexOf('}', at));
  const m = body.match(/z-index\s*:\s*(-?\d+)/);
  assert.ok(m, selector + ' 에 층 높이가 없습니다');
  return Number(m[1]);
}

/* ── ① 창이 패널 위에 뜬다 ──────────────────────────────────────────────── */

test('★★★ 기업 상세 패널은 창(.modalbg)보다 «아래» 층이다', () => {
  const 패널 = 층('#pcDetail'), 창 = 층('.modalbg');
  assert.ok(패널 < 창,
    '★★★ 패널(' + 패널 + ')이 창(' + 창 + ') 위에 있습니다 — 폰에서는 명함·확인서 창·수정 창이 '
    + '통째로 안 보이고, PC 에서는 창의 오른쪽이 잘려 ✕ 를 못 누릅니다');
});

/* ── ② 그래도 화면의 붙박이보다는 위다 ─────────────────────────────────── */

test('★★ 패널이 «화면의 붙박이»(고른 것 띠·흐림막)보다는 위다', () => {
  const 패널 = 층('#pcDetail');
  const 띠 = 층('#pcSel'), 흐림 = 층('.mck-dim');
  assert.ok(패널 > 띠, '★★ 고른 것 띠(' + 띠 + ')가 패널(' + 패널 + ') 위로 올라옵니다');
  assert.ok(패널 > 흐림, '★★ 흐림막(' + 흐림 + ')이 패널을 덮습니다');
});

/* ── ③ 창의 층은 한 곳이 정한다 ────────────────────────────────────────── */

/* 어떤 이름이든 «그 덮개의 층»을 찾아 준다 — id 규칙이 먼저, 없으면 클래스 규칙 */
function 덮개층(id, classes) {
  const 후보 = ['#' + id].concat(classes.map(c => '.' + c));
  for (const sel of 후보) {
    const at = CSS.indexOf('\n' + sel + '{');
    if (at < 0) continue;
    const m = CSS.slice(at, CSS.indexOf('}', at)).match(/z-index\s*:\s*(-?\d+)/);
    if (m) return { sel: sel, z: Number(m[1]) };
  }
  return null;
}

test('★★★ 붙박이 덮개가 «하나도 빠짐없이» 기업 상세 패널보다 위다', () => {
  /* ⚠ 「모두 .modalbg 를 쓰나」로 보면 안 된다 — .smbg(자료 보내기)처럼 제 층을 따로
     쓰면서도 «위»에 있는 것이 실제로 있다. 지켜야 하는 것은 이름이 아니라 «차례»다. */
  const body = SRC.slice(SRC.indexOf('<body'), SRC.indexOf('<script', SRC.indexOf('<body')));
  const 덮개 = (body.match(/<div[^>]*\sid="[A-Za-z0-9_]*Bg"[^>]*>/g) || []);
  assert.ok(덮개.length >= 10,
    '덮개를 ' + 덮개.length + '개밖에 못 찾았습니다 — 찾는 법이 낡아 검사가 눈먼 것입니다');
  const 패널 = 층('#pcDetail');
  const 아래 = [], 모름 = [];
  덮개.forEach(d => {
    const id = (d.match(/id="([^"]+)"/) || [])[1];
    const cls = String((d.match(/class="([^"]*)"/) || [])[1] || '').split(/\s+/).filter(Boolean);
    const got = 덮개층(id, cls);
    if (!got) { 모름.push(id); return; }
    if (got.z <= 패널) 아래.push(id + '(' + got.sel + ' ' + got.z + ')');
  });
  assert.deepEqual(모름, [], '층을 못 읽은 덮개가 있습니다: ' + 모름.join(', '));
  assert.deepEqual(아래, [],
    '★★★ 패널(' + 패널 + ') 아래에 있는 덮개: ' + 아래.join(', ')
    + ' — 폰에서는 그 창이 통째로 안 보입니다');
});

test('★★ 층 차례가 «화면 → 패널 → 창» 이다', () => {
  const 차례 = [층('#pcSel'), 층('.mck-dim'), 층('#pcDetail'), 층('.modalbg')];
  assert.deepEqual(차례.slice().sort((a, b) => a - b), 차례,
    '★★ 층 차례가 뒤엉켰습니다: ' + 차례.join(' → ')
    + ' (고른것띠 · 흐림막 · 기업상세 · 창 순이어야 합니다)');
});

/* ── ④ 폰 전체화면 규칙 ────────────────────────────────────────────────── */

test('★★ 폰에서 패널이 «전체화면»이 되는 규칙은 그대로다', () => {
  /* 이것이 있어서 ①이 치명적이었다 — 없어졌다고 ①을 되돌리면 안 된다는 뜻이 아니라,
     이 규칙이 사라지면 폰 상세가 420px 짜리 옆 패널로 돌아간다. */
  assert.match(CSS, /body:not\(\.pc\)\s*#pcDetail\.open\{[^}]*inset:0/,
    '★★ 폰에서 기업 상세가 전체화면으로 뜨는 규칙이 사라졌습니다');
});
