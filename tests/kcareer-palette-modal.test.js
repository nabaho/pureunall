/* ══════ 창이 열리면 「📋 데이터」 팔레트가 «비킨다» (점검 2026-09-12) ══════════════
   대표 지시 「고쳐라」 — 기업정보함 층 점검에서 딸려 나온 것.

   ■ 무엇이 문제였나 — 실측
   폰 폭(375)에서 떠 있는 팔레트(.cv-pop)는 아래쪽 띠(725~804)가 된다. 거기서 «긴 창»
   (700px)이 열리면 창의 맨 아래 **36px** 을 덮었다. 그 자리에 [저장] 같은 단추가 있으면
   눌리지 않는다.

   ★ 못 박는 것
     ① 창이 떠 있는 «동안만» 비킨다. 창을 닫으면 돌아온다 — 켜 둔 것은 사람의 뜻이다.
     ② ⚠⚠ **층(z-index)을 내려서 고치지 않는다.** 팔레트는 아래쪽 탭 바(#groupTabs 60)와
        붙여 둔 옆 미리보기(#sidePreview.pinned 70) «위»에 있어야 한다 — 내리면 그것들이
        팔레트를 덮어, 이번에는 팔레트를 못 쓴다. 고친 값이 아니라 «까닭»을 못 박는다.
     ③ 폰에서 팔레트가 아래쪽 띠가 되는 규칙은 그대로다 — 그것이 겹침의 자리였다.

   node --test tests/kcareer-palette-modal.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8')
  .split('\r\n').join('\n');

/* 규칙의 층 높이를 «읽어» 온다 — 글자를 찾는 것이 아니라 값을 잰다 */
function 층(selector) {
  /* ⚠ 같은 이름의 규칙이 여럿이다(.cv-pop 은 꾸밈용·어두운 차림용이 따로 있다).
     층 높이가 «적힌» 규칙을 찾아야 한다 — 첫 규칙만 보면 「층이 없다」로 헛나간다. */
  let at = -1, found = null, n = 0;
  while ((at = SRC.indexOf('\n' + selector + '{', at + 1)) > 0) {
    const m = SRC.slice(at, SRC.indexOf('}', at)).match(/z-index\s*:\s*(-?\d+)/);
    if (m) { found = Number(m[1]); n++; }
  }
  assert.ok(found !== null, selector + ' 에 층 높이를 적은 규칙이 없습니다');
  assert.equal(n, 1, selector + ' 의 층 높이가 ' + n + '곳에 적혀 있습니다 (하나여야 합니다)');
  return found;
}

/* ── ① 비키는 규칙 ─────────────────────────────────────────────────────── */

test('★★★ 창이 열려 있는 동안 팔레트가 «비킨다»', () => {
  /* 규칙을 실제로 찾아 「무엇이 · 언제 · 어떻게」 셋을 다 본다 —
     셋 중 하나만 봐도 통과하는 검사는 반쪽을 지우면 그냥 지나간다. */
  const 줄 = SRC.split('\n').filter(l => /\.cv-pop\s*\{/.test(l) && /:has\(/.test(l));
  assert.equal(줄.length, 1,
    '★★★ 「창이 열리면 팔레트가 비킨다」 규칙이 ' + 줄.length + '개입니다 (하나여야 합니다)');
  const r = 줄[0];
  assert.match(r, /\.modal-ov\.open/,
    '★★★ «창이 열렸을 때»라는 조건이 없습니다 — 늘 숨으면 팔레트를 아예 못 씁니다');
  assert.match(r, /display\s*:\s*none\s*!important/,
    '★★ 인라인 display:flex 를 이기려면 !important 가 필요합니다 (팔레트는 그것으로 켭니다)');
});

test('★★ 켜 둔 것을 «지우지» 않는다 — 창이 닫히면 돌아온다', () => {
  /* 팔레트를 «끄는» 자리는 모두 사람이 누르는 길이어야 한다(토글 단추·✕·ESC).
     창이 열릴 때 자바스크립트로 꺼 버리면 인라인 값이 'none' 으로 덮여,
     창을 닫아도 팔레트가 안 돌아온다 — 사람은 「사라졌다」고 읽는다.
     ⚠ ✕ 와 ESC 는 «사람이» 끄는 길이라 옳다. 처음에 이 둘을 문제로 셌다(2026-09-12). */
  const 끄는곳 = SRC.split('\n').filter(l =>
    /cvPalettePop/.test(l) && /style\.display\s*=\s*'none'/.test(l));
  assert.ok(끄는곳.length >= 1, '팔레트를 끄는 자리를 못 찾았습니다 — 찾는 법이 낡았습니다');
  const 창때문에 = 끄는곳.filter(l => /modal|\.open\b/i.test(l));
  assert.deepEqual(창때문에, [],
    '★★ 창 때문에 팔레트를 «자바스크립트로» 끄고 있습니다 — 창을 닫아도 안 돌아옵니다:\n'
    + 창때문에.join('\n'));
});

/* ── ② 층을 내려서 고친 것이 «아니다» ──────────────────────────────────── */

test('★★★ 팔레트는 여전히 아래쪽 탭 바·붙인 미리보기 «위»다 — 층으로 고치면 안 된다', () => {
  const 팔레트 = 층('.cv-pop');
  const 탭바 = 층('#groupTabs');
  const 미리보기 = 층('#sidePreview.pinned');
  assert.ok(팔레트 > 탭바,
    '★★★ 팔레트(' + 팔레트 + ')가 아래쪽 탭 바(' + 탭바 + ') 아래로 내려갔습니다 — '
    + '폰에서 팔레트가 탭 바에 덮여 못 씁니다');
  assert.ok(팔레트 > 미리보기,
    '★★★ 팔레트(' + 팔레트 + ')가 붙여 둔 옆 미리보기(' + 미리보기 + ') 아래로 내려갔습니다');
});

/* ── ③ 겹침이 생기던 자리 ──────────────────────────────────────────────── */

test('★ 폰에서 팔레트가 «아래쪽 띠»가 되는 규칙은 그대로다', () => {
  /* 이 규칙이 사라지면 겹칠 일 자체가 없어지지만, 팔레트가 폰에서 오른쪽 위
     260px 상자로 돌아가 화면 절반을 덮는다 — 그래서 함께 못 박는다. */
  const at = SRC.indexOf('@media(max-width:780px){ .cv-pop{');
  assert.ok(at > 0, '★ 폰에서 팔레트를 아래쪽 띠로 만드는 규칙이 사라졌습니다');
  const r = SRC.slice(at, SRC.indexOf('}', at + 30));
  assert.match(r, /bottom\s*:\s*8px!important/, '★ 아래쪽에 붙이는 값이 없습니다');
});
