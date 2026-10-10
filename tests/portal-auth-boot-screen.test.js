'use strict';
/* 포털 첫 화면 — Firebase 인증 복원이 끝나기 전에 로그인 폼을 비치지 않는다.
   대표 제보 2026-10-02: 로그인 유지 상태에서 enter.html을 열면 로그인 화면이 순간 보였다가
   포털로 넘어감. 저장소 힌트가 아니라 실제 onAuthStateChanged 결과만 화면을 결정해야 한다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'enter.html'), 'utf8');

test('인증 확인 가림막은 HTML을 그리는 첫 순간부터 보인다', () => {
  const splash = source.match(/<div id="pu-boot-splash"[^>]*>/);
  assert.ok(splash, '인증 확인 가림막을 찾지 못했습니다');
  assert.match(splash[0], /style="[^"]*display:flex/,
    '★★ 자바스크립트가 돌기 전 로그인 폼이 한 번 그려집니다 — 가림막은 HTML에서부터 보여야 합니다');

  const splashAt = source.indexOf('id="pu-boot-splash"');
  const loginAt = source.indexOf('id="loginView"');
  assert.ok(splashAt >= 0 && loginAt > splashAt,
    '가림막이 로그인 폼보다 먼저 있어야 첫 페인트부터 가릴 수 있습니다');
});

test('일반 진입도 카카오 복귀도 인증 확인 중에는 같은 가림막을 유지한다', () => {
  const scripts = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const boot = scripts.find((s) => s.includes("getElementById('pu-boot-splash')") && s.includes('__kkReturning = true'));
  assert.ok(boot, '첫 인증 확인 스크립트를 찾지 못했습니다');
  assert.match(boot, /if\(s\)\s*s\.style\.display\s*=\s*'flex'/,
    '저장소 힌트가 없는 일반 진입에서 가림막이 켜지지 않습니다');
  assert.doesNotMatch(boot, /if\s*\(\s*hint\s*\)/,
    '저장소 힌트가 없어지면 로그인 화면이 다시 번쩍입니다 — 실제 인증 결과 전에는 조건 없이 가려야 합니다');
});

test('미로그인이 확정된 뒤에만 가림막을 걷고 로그인 폼을 드러낸다', () => {
  const authAt = source.indexOf('auth.onAuthStateChanged(function(user)');
  assert.notEqual(authAt, -1, 'Firebase 인증 관찰자를 찾지 못했습니다');
  const authArea = source.slice(authAt, source.indexOf('\n  });', authAt) + 6);
  assert.match(authArea, /else\s*\{[\s\S]*if\(!window\.__kkReturning\)\s*_rmBootSplash\(\)/,
    '미로그인 확정 뒤 로그인 폼을 여는 길이 없습니다');

  const portalAt = source.indexOf('function enterPortal(user');
  const portalArea = source.slice(portalAt, source.indexOf('\n  }', portalAt) + 4);
  assert.match(portalArea, /renderPortal\([\s\S]*portalView['"]?\)\.style\.display\s*=\s*'block'[\s\S]*_rmBootSplash\(\)/,
    '로그인 상태에서는 포털을 다 그리기 전에 가림막을 걷고 있습니다');
});
