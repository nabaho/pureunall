'use strict';
/* 기업정보함 정리(2026-09-27) 뒤에 «되살아나면 안 되는 것» 둘
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시: 「기업정보함에 중복이나 불필요한부분 사용안하는 부분 모두 찾아 정리해라
            단 다른 앱과 문제가 되면 안된다」

   ① 사진 화질 깎기 도구(pucardsShrinkPhotos)
      원본 1600px 을 800px 로 «덮어써서» 영영 되돌릴 수 없게 만드는 콘솔 도구였다.
      무료 저장 한도(1GB) 때문에 만들었는데, 유료 전환 뒤 사진이 창고로 가면서 쓸 까닭이
      사라졌고, 기록에는 「절대 돌리면 안 된다」로 적혀 있었다. 아무도 안 불렀다.
      → 걷었다. 되살아나면 누가 콘솔에서 한 번 돌리는 것만으로 명함 원본이 사라진다.
      ⚠ 썸네일 옮기기(pucardsMoveThumbs)는 «되돌릴 수 있는» 도구라 그대로 둔다
        (cards-photos-storage 검사가 지킨다).

   ② 글상자 높이 맞추기 규칙은 «한 곳»이다
      heFit 과 mgFit 이 한 글자도 안 다른 몸을 따로 들고 있었다. 한쪽만 고치면
      두 편집기의 글상자가 다르게 늘어난다.
      ⚠ mgFit «이름»은 남긴다 — cards-hwp-integration 검사가 이 선언을 자르는 자리
        표지로 쓴다. 속만 heFit 을 부른다.

   실행: node --test tests/cards-cleanup-guard.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripComments } = require('./strip-comments');

const RAW = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8');
/* ⚠ 주석을 걷고 본다 — 이 파일 주석에 도구 이름이 적혀 있어도 «코드»가 아니다 */
const app = stripComments(RAW);

test('★★★ 사진 화질 깎기 도구가 되살아나지 않는다 — 원본이 영영 사라진다', () => {
  assert.doesNotMatch(app, /pucardsShrinkPhotos\s*=/,
    '★★★ 화질 깎기 도구가 돌아왔습니다. 콘솔에서 한 번 돌리면 명함 원본 1600px 이 ' +
    '800px 로 덮여 되돌릴 수 없습니다. 사진은 이제 창고로 가므로 깎을 까닭이 없습니다.');
});

test('★ 되돌릴 수 있는 썸네일 옮기기는 «남아 있다» — 함께 걷지 않았다', () => {
  assert.match(app, /window\.pucardsMoveThumbs = async function/,
    '썸네일 옮기기는 되돌릴 수 있는 도구입니다 — 깎기와 함께 지우면 안 됩니다.');
});

test('★★ 글상자 높이 맞추기 규칙은 «한 곳»이다 — mgFit 은 heFit 을 부른다', () => {
  const m = app.match(/function mgFit\(el\)\{([^}]*)\}/);
  assert.ok(m, 'mgFit 선언을 찾지 못했습니다 — 검사 하나가 이것을 자르는 자리 표지로 씁니다.');
  assert.match(m[1], /^\s*heFit\(el\);\s*$/,
    '★ mgFit 이 제 규칙을 다시 들고 있습니다 — 한쪽만 고치면 두 편집기 글상자가 다르게 늘어납니다.');
  assert.match(app, /function heFit\(el\)\{[^}]*scrollHeight/, '규칙을 든 heFit 이 사라졌습니다.');
});
