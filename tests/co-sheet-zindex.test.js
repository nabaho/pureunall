'use strict';
/* 📄 회사 한 장 — 다른 창 «뒤»로 숨던 것 (2026-09-18 실측)

   대표 보고 「뒤의 팝업창 왜 이렇게 나오나」 — 계약 추가 창에서 「회사 한 장」을
   누르면 새 창이 열리는데, 계약 추가 창 «뒤»로 숨어 절반만 보였다.

   ■ 왜
     .modal-bg 는 전부 z-index:1000 하나뿐이다(css/pu-erp.css). 같은 값이면
     브라우저는 «나중에 그려진 것»을 위에 놓는다. 이 창은 App 뿌리에서
     달리는데(CompanySheetHost), 계약창 같은 다른 창은 그보다 나중에 DOM 에
     그려져 결과적으로 위를 차지했다 — 방금 연 창이 뒤로 숨는 순서였다.

   ★ 이 검사가 못 박는 것: 이 창은 «어디서 열리든» 늘 맨 위에 와야 한다. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const RAW = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'css', 'pu-erp.css'), 'utf8');
const MODAL = stripJs(cutFn(RAW, 'function CompanySheetModal('));

test('① 다른 창들의 기준 z-index 를 먼저 확인한다 (1000 — 값이 바뀌면 이 검사도 다시 봐야 한다)', () => {
  assert.match(CSS, /\.modal-bg \{[^}]*z-index:\s*1000/, '.modal-bg 기준값이 1000 이 아니면 아래 비교가 무의미하다');
});

test('②★ 이 창의 바깥 배경(modal-bg)에 그 기준보다 «높은» z-index 를 직접 준다', () => {
  const at = MODAL.indexOf("className:'modal-bg'");
  assert.ok(at > 0, "모달 배경(className:'modal-bg')을 못 찾았다");
  const band = MODAL.slice(at, at + 60);
  const m = /zIndex:\s*(\d+)/.exec(band);
  assert.ok(m, '이 창의 modal-bg 에 zIndex 를 직접 주지 않았다 — DOM 순서에 따라 다른 창 뒤로 숨을 수 있다');
  assert.ok(Number(m[1]) > 1000, 'zIndex 값이 다른 .modal-bg 기준(1000)보다 높아야 «항상» 위에 온다: ' + m[1]);
});

test('③ 배경을 눌러 닫는 동작은 그대로 살아 있다 — zIndex 를 주면서 onClick 을 지우면 안 된다', () => {
  const at = MODAL.indexOf("className:'modal-bg'");
  const band = MODAL.slice(at, at + 200);
  assert.match(band, /onClick:function\(e\)\{ if\(e\.target === e\.currentTarget\) props\.onClose\(\); \}/,
    '바깥을 눌러 닫는 동작이 없어졌다');
});
