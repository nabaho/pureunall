/* 기업정보함의 «.mck» 창(🏚 없어진 듯한 곳 · 👤 명함 담당자 채우기 · 이름 확인)은 글자색을 «스스로» 정한다
   (2026-10-10 대표 화면 — 회사 이름·제목·갈래 숫자·「살아 있음」 단추가 흰 바탕에 흰 글자로 거의 안 보였다)

   ■ 까닭 — body 글자색이 어두운 화면용 var(--ink)=#f8fafc(흰색)다. .mck 는 흰 바탕인데 글자색을
     안 정해 두어, 색을 따로 안 준 글자가 모두 body 의 흰색을 물려받았다.
     (본 앱에서 잰 값: body·h2·갈래 숫자 모두 rgb(248, 250, 252))
   ■ 못 박는 것 — .mck 규칙에 어두운 글자색이 있다(팔레트의 진한 회색 계열). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8');

test('★★★ .mck 창은 글자색을 스스로 정한다 — 안 정하면 body 의 흰 글자를 물려받는다', () => {
  const m = SRC.match(/\n\.mck\{([^}]*)\}/);
  assert.ok(m, '.mck 규칙을 찾지 못했습니다');
  assert.match(m[1], /background:#fff/, '이 검사의 전제(흰 바탕)가 바뀌었습니다 — 글자색도 다시 보십시오');
  const c = (m[1].match(/(?:^|;)\s*color:\s*(#[0-9a-f]{6})/i) || [])[1];
  assert.ok(c, '★★★ .mck 에 글자색이 없습니다 — 흰 바탕에 흰 글자가 됩니다');
  assert.ok(['#1e293b', '#475569', '#000000'].includes(c.toLowerCase()), '★★ 글자색이 어둡지 않습니다: ' + c);
  /* body 가 정말 흰 글자인지 — 이것이 바뀌면 이 검사의 까닭도 바뀐다 */
  assert.match(SRC, /--ink:#f8fafc/, '전제: body 글자는 var(--ink) 흰색');
});
