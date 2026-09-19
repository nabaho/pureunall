/* 푸른 캘린더 — 색 손질(옅게 칠하고 왼쪽에 띠) + 어두운판(수동)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-19 「색깔이 너무 눈에 불편하다 … 어두움 모드도 한번 검토해달라」
   → 견본 넷을 보여 드림 → 「2번 수동」(옅게 칠하고 왼쪽에 띠 · 어두운판은 손으로 켠다)

   ★ 무슨 일이 있었나
     진한 원색을 칸 전체에 채우던 것을 «옅게 칠하고 왼쪽에 띠만 진하게» 두는 방식으로
     바꿨다. 색 값(colorOf, 이알피가 정한 것) 자체는 안 바꾼다 — 그리는 법만 바꾼다.
     어두운판은 자동(prefers-color-scheme)이 아니라 단추로만 켠다.

   ★ 지키려는 것
     ① 칩은 이제 «채우지» 않는다 — 옅은 바탕 + 왼쪽 띠(원래 색)
     ② 글자는 늘 진하게 읽힌다(밝은판 dark ink · 어두운판 light ink), 대비 4.5:1 이상
     ③ 어두운판은 수동 단추로만 켜진다 — prefers-color-scheme 로 자동 전환하지 않는다
     ④ 어두운판 값도 팔레트 27색 + 흰/검 안에서만 고른다(새 색 없음)
     ⑤ 어두운판에서 「오늘·공휴일·찾음」 칸 배경을 옅게 칠하지 않는다(글자가 안 읽힌다) —
       대신 이미 있는 다른 표(파란 테두리 · 칩 · outline)가 그 뜻을 맡는다 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const 캘린더 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8');
const P = require('./lib-palette.js');

function 함수몸(src, head) {
  const i = src.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('닫는 괄호 없음: ' + head);
}

/* ── mixHex 를 실제로 돌려 본다 ── */
function mixHex상자() {
  const 상자 = { console };
  vm.createContext(상자);
  vm.runInContext(함수몸(캘린더, 'function mixHex(hexA, hexB, t){'), 상자);
  return 상자;
}

test('① mixHex — 원색을 그대로 안 쓴다(옅게 섞는다)', () => {
  const 상자 = mixHex상자();
  vm.runInContext('var __r = mixHex("#dc2626", "#ffffff", .85);', 상자);
  assert.notStrictEqual(상자.__r, '#dc2626', '섞지 않고 원색 그대로입니다');
  assert.strictEqual(P.norm(상자.__r) === '#dc2626', false);
  /* .85 만큼 흰쪽으로 갔으니 흰색에 «훨씬» 가까워야 한다 */
  assert.ok(P.lum(상자.__r) > 0.6, '흰쪽으로 충분히 안 섞였습니다: 밝기 ' + P.lum(상자.__r));
});

test('② chipHtml — 채우지 않는다: 바탕은 옅게, 사람 색은 왼쪽 띠에', () => {
  const 캘린더칩정의 = 함수몸(캘린더, 'function chipHtml(e, ymd){');
  assert.match(캘린더칩정의, /border-left:3px solid/, '왼쪽 띠가 없습니다');
  assert.match(캘린더칩정의, /mixHex\(/, '옅게 섞는 길(mixHex)을 안 씁니다');
  /* ⚠ 「지금」 스타일(칠하기 + textOn)로 되돌아가면 이 자리에 없어야 할 것들이 남는다 */
  assert.strictEqual(/textOn\(/.test(캘린더칩정의), false,
    'textOn 으로 다시 «채우는» 길로 돌아갔습니다 — 원색을 그대로 칠하면 눈이 시립니다');
});

test('③ 대비 — 실제 자료의 사람 색으로 섞어 봐도 글자가 4.5:1 이상 읽힌다', () => {
  /* 구글 기본 색표(우리 staff_colors 가 실제로 쓰는 값들) + 극단값 몇 개 */
  const 색들 = ['#ffb878', '#46d6db', '#e1e1e1', '#5484ed', '#51b749', '#a4bdfc',
    '#7ae7bf', '#dbadff', '#ff887c', '#fbd75b', '#dc2626', '#16a34a', '#1e293b', '#f59e0b'];
  const 상자 = mixHex상자();
  const 안읽힘 = { light: [], dark: [] };
  색들.forEach((c) => {
    vm.runInContext('var __l = mixHex(' + JSON.stringify(c) + ', "#ffffff", .85);'
      + 'var __d = mixHex(' + JSON.stringify(c) + ', "#1e293b", .78);', 상자);
    const cLight = P.contrast(상자.__l, '#1e293b');   // 밝은판 글자색 = --ink
    const cDark = P.contrast(상자.__d, '#f8fafc');    // 어두운판 글자색 = --ink(dark)
    if (cLight < 4.5) 안읽힘.light.push(c + ' → ' + 상자.__l + ' (' + cLight.toFixed(2) + ':1)');
    if (cDark < 4.5) 안읽힘.dark.push(c + ' → ' + 상자.__d + ' (' + cDark.toFixed(2) + ':1)');
  });
  assert.strictEqual(안읽힘.light.length, 0, '밝은판에서 4.5:1 을 못 채운 색:\n  ' + 안읽힘.light.join('\n  '));
  assert.strictEqual(안읽힘.dark.length, 0, '어두운판에서 4.5:1 을 못 채운 색:\n  ' + 안읽힘.dark.join('\n  '));
});

test('④ 왼쪽 띠는 원래 색 그대로다 — 표(식별)가 사라지면 안 된다', () => {
  const 캘린더칩정의 = 함수몸(캘린더, 'function chipHtml(e, ymd){');
  assert.match(캘린더칩정의, /border-left:3px solid ['"][\s\S]{0,20}esc\(사람색\)/,
    '왼쪽 띠가 섞인 색이 아니라 «원래 색»(esc(사람색))이어야 합니다');
  /* mixHex 로 섞은 bg 를 왼쪽 띠에 다시 쓰면 안 된다 — 띠까지 옅어지면 식별이 안 된다 */
  assert.strictEqual(/border-left:3px solid ['"][\s\S]{0,20}esc\(bg\)/.test(캘린더칩정의), false,
    '왼쪽 띠에 옅게 섞은 bg 를 썼습니다 — 그러면 띠도 흐려져 사람을 못 알아봅니다');
});

test('⑤ 어두운판은 «수동»으로만 켜진다 — CSS 미디어로 자동 전환하지 않는다', () => {
  /* ⚠ 글자 그대로 찾지 않는다 — 「수동으로 간다」를 설명하는 주석 안에도 이 낱말이
     나온다(2026-09-19 에 그래서 한 번 샜다). «CSS 미디어 자리에서 실제로 쓰는지»만 본다. */
  assert.strictEqual(/@media[^{]*prefers-color-scheme/.test(캘린더), false,
    '@media (prefers-color-scheme…) 로 자동 전환하는 CSS 가 들어왔습니다 — 대표 지시는 수동입니다');
  assert.ok(캘린더.indexOf('id="themeToggle"') >= 0, '단추(id=themeToggle)가 없습니다');
  assert.ok(캘린더.indexOf("$('themeToggle').onclick") >= 0, '단추에 누름 손잡이를 안 겁니다');
  assert.match(캘린더, /setAttribute\("data-theme", S\.theme\)/, '켜고 끄는 표(data-theme)를 안 답니다');
});

test('⑥ 켠 채로 기억한다 — 이 기기에서만(localStorage), 서버로 안 보낸다', () => {
  const 초기화 = 함수몸(캘린더, 'function themeInit(){');
  assert.match(초기화, /localStorage\.getItem\("pu_cal_theme"\)/, '저장해 둔 값을 안 읽습니다');
  const 전환 = 함수몸(캘린더, 'function themeToggle(){');
  assert.match(전환, /localStorage\.setItem\("pu_cal_theme"/, '바꾼 값을 저장 안 합니다');
  assert.match(전환, /render\(\)/, '판을 바꾼 뒤 다시 안 그립니다 — 칸·칩 색이 안 따라옵니다');
});

test('⑦ 어두운판 값도 팔레트 27색 + 흰/검 안에서만 고른다', () => {
  const 뿌리다크 = (캘린더.match(/:root\[data-theme="dark"\]\{([^}]*)\}/) || [])[1];
  assert.ok(뿌리다크, '어두운판 뿌리 색표(:root[data-theme="dark"])가 없습니다');
  const 밖 = [];
  for (const m of 뿌리다크.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    const c = P.norm(m[0]);
    const 있음 = [].concat(...Object.values(P.PALETTE)).includes(c) || c === '#ffffff' || c === '#000000';
    if (!있음) 밖.push(c);
  }
  assert.strictEqual(밖.length, 0, '팔레트 밖 색: ' + 밖.join(', '));
});

test('⑧ 어두운판에서 「오늘·공휴일·찾음」 칸을 옅게 칠하지 않는다', () => {
  /* 밝은판 갈래(: 뒤)까지 같이 집으면 늘 걸린다(그쪽엔 옅은 칠이 «있는 게 맞다») —
     삼항의 어두운판 갈래(? 와 : 사이)만 정확히 잘라 본다. */
  const 계산 = 함수몸(캘린더, 'function calendarHtml(eumOnly){');
  const i = 계산.indexOf('어둠 ? (c.other');
  assert.ok(i >= 0, '어두운판 칸 배경 갈래를 못 찾았습니다');
  /* ⚠ 줄끝(\r\n · \n)을 못 박지 않는다 — 이 저장소는 CRLF, CI 는 LF 로 받는다
     (tests-crlf-vs-ci-lf 메모). 공백·줄바꿈은 몇 글자든 건너뛴다. */
  const m = 계산.slice(i).match(/\)\s*:\s*\(/);
  assert.ok(m, '어두운판 갈래가 끝나는 자리(: 로 넘어가는 곳)를 못 찾았습니다');
  const 어둠갈래 = 계산.slice(i, i + m.index);
  assert.strictEqual(/fffbeb|fef2f2/.test(어둠갈래), false,
    '어두운판 갈래에도 옅은 칠(오늘·공휴일)을 씁니다 — 글자가 안 읽힙니다: ' + 어둠갈래);
});
