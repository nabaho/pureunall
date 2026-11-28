'use strict';
/* 컨설팅 15개 앱 폰 화면 초콤팩트 통일 회귀 테스트
 * - 대시보드 유지 예외(3종): chamber, sixthind, jobtrans
 * - 일반 컨설팅(12종): ilteo, safety, clinic, techprotect, evalcomp, familywork,
 *                      hrconsult, laboraudit, pubconsult, socialent, specialcons, unionneg
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PALETTE, norm } = require('./lib-palette');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const stripCssComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

const DASH_APPS = ['chamber.html', 'sixthind.html', 'jobtrans.html'];
const GENERAL_APPS = [
  'ilteo.html', 'safety.html', 'clinic.html', 'techprotect.html',
  'evalcomp.html', 'familywork.html', 'hrconsult.html', 'laboraudit.html',
  'pubconsult.html', 'socialent.html', 'specialcons.html', 'unionneg.html',
];
const ALL_15 = [...DASH_APPS, ...GENERAL_APPS];
const ALLOWED_COLORS = new Set([].concat(...Object.values(PALETTE), '#ffffff', '#000000'));

test('① 15개 컨설팅 HTML 전부가 pu-design.css 뒤에 같은 ?v= 로 css/pu-consult-phone.css 를 싣는다', () => {
  const vers = new Set();
  for (const f of ALL_15) {
    const h = read(f);
    const desIdx = h.search(/<link[^>]+href="css\/pu-design\.css\?v=\d+"/);
    const phoneMatch = h.match(/<link[^>]+href="css\/pu-consult-phone\.css\?v=(\d+)"/);
    assert.ok(desIdx > 0, f + ': pu-design.css 링크를 못 찾았습니다');
    assert.ok(phoneMatch, f + ': css/pu-consult-phone.css?v= 링크가 없습니다');
    assert.ok(h.indexOf(phoneMatch[0]) > desIdx, f + ': pu-consult-phone.css 는 pu-design.css 뒤에 실어야 합니다');
    vers.add(phoneMatch[1]);
  }
  assert.equal(vers.size, 1, '15개 HTML 이 서로 다른 ?v= 번호로 pu-consult-phone.css 를 부르고 있습니다');

  for (const slimFile of ['clinic.html', 'techprotect.html']) {
    const h = read(slimFile);
    assert.ok(!h.includes('id="projYrSel"') && !h.includes('id="p-yearly"'), slimFile + ': 정적 금지 ID가 없어야 합니다');
  }
});

test('② css/pu-consult-phone.css 는 PC 무영향 · 폰 16px 입력 · 27색 준수 · 앱바 비간섭을 지킨다', () => {
  const raw = read('css/pu-consult-phone.css');
  const css = stripCssComments(raw);
  assert.ok(!/(#pu-appbar\b|#pu-appbar-fab\b|#pu-version-fab\b)/.test(css), '공용 앱바·버전 FAB 은 건드리지 않아야 합니다');

  const hexes = [...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => norm(m[0]));
  assert.deepEqual([...new Set(hexes.filter((h) => !ALLOWED_COLORS.has(h)))], [], '공식 27색 팔레트 밖 색을 쓰면 안 됩니다');

  const firstMediaIdx = css.indexOf('@media');
  assert.ok(firstMediaIdx > 0, '@media 규칙이 있어야 합니다');
  const topCss = css.slice(0, firstMediaIdx).trim();
  assert.equal(topCss, '.pu-phone-yr-sel{display:none}', 'PC 구간(@media 바깥)에는 .pu-phone-yr-sel 숨김만 두어야 합니다');

  const mediaHeaders = [...css.matchAll(/@media\s*\(([^)]+)\)/g)].map((m) => m[1]);
  assert.ok(mediaHeaders.length >= 1, '@media 조건을 읽지 못했습니다');
  for (const cond of mediaHeaders) {
    const mx = cond.match(/max-width\s*:\s*(\d+)px/);
    assert.ok(mx && Number(mx[1]) <= 768 && !/min-width/.test(cond), '폰 범위(max-width <= 768px) 밖 미디어 쿼리 금지: ' + cond);
  }
  assert.match(css, /input\s*,\s*select\s*,\s*textarea\{font-size:16px/, '폰 입력칸 16px 이상 규칙이 있어야 합니다');
});

test('③ 중복 연도 알약 띠는 숨기고 연도 드롭다운과 3종 대시보드(chamber·sixthind·jobtrans)는 유지한다', () => {
  const css = stripCssComments(read('css/pu-consult-phone.css'));
  for (const barId of ['#recentDiffBarWrap', '#yearQuickBar', '#projYrBar', '#inboxYrBar', '#yrPillsBar', '#yearSummaryBar']) {
    assert.ok(css.includes(barId), '폰에서 중복 연도/요약/변경점 줄 ' + barId + ' 숨김이 빠져 있습니다');
  }
  assert.match(css, /tr\.split-row\s+td\[data-k="badge"\]/, 'chamber·sixthind 의 지역 배지를 2줄째로 내려 2줄 카드를 유지해야 합니다');
  assert.match(css, /#projYear\s*,\s*#projYrSel\s*,\s*\.pu-phone-yr-sel\{[^}]*display:block!important/, '연도 드롭다운 표시 규칙이 있어야 합니다');
  assert.ok(!/\.left-dash\{[^}]*display:none/.test(css), 'chamber·sixthind 의 왼쪽 대시보드(#leftDash/.left-dash)를 통째로 숨기면 안 됩니다');
  assert.ok(!/\.agency-scope-bar\{[^}]*display:none/.test(css), 'jobtrans 의 기관 대시보드(#agencyScopeBar)를 통째로 숨기면 안 됩니다');
  assert.match(css, /thead\s+th\.c[\s\S]*?background:transparent!important/, '다크모드 검은 체크박스 헤더 방지를 위해 thead 배경 투명 규칙이 있어야 합니다');
});

test('④ 4개 뷰 JS 가 동적 연도 드롭다운·핵심 단일 버튼(data-pm-act)·부수열 숨김(pc-only)·모바일 행 진입을 갖춘다', () => {
  const files = ['js/pu-consult-view.js', 'js/pu-ilteo-view.js', 'js/pu-jobtrans-view.js', 'js/pu-safety-view.js'];
  for (const f of files) {
    const src = read(f);
    assert.ok(src.includes('data-pm-act="1"'), f + ': 폰 핵심 단일 버튼 표식(data-pm-act="1")이 없습니다');
    assert.ok(src.includes('pc-only'), f + ': 폰 숨김 부수열(pc-only) 표식이 없습니다');
    assert.ok(/innerWidth\s*<=\s*768|tr\[data-row\][\s\S]{0,220}TAB\s*=\s*'intake'|tr\[data-row\][\s\S]{0,400}openProjectDetailModal\(tr\.getAttribute\('data-row'\)\)/.test(src), f + ': 행 탭 시 작업실(또는 진행 기록·완료보고서 창) 진입 처리가 없습니다');
  }
  assert.match(read('js/pu-consult-view.js'), /pu-phone-yr-sel/, 'pu-consult-view.js 에 동적 연도 드롭다운(.pu-phone-yr-sel) 동기화가 없습니다');
  assert.match(read('js/pu-jobtrans-view.js'), /yrSelEl\s*=\s*\$\('projYear'\)/, 'pu-jobtrans-view.js 에 #projYear 동적 연도 옵션 갱신이 없습니다');
  assert.match(read('js/pu-safety-view.js'), /yrSelEl\s*=\s*\$\('projYear'\)/, 'pu-safety-view.js 에 #projYear 동적 연도 옵션 갱신이 없습니다');
});
