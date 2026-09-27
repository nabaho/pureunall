/* 푸른 캘린더 — 화면 밝기 «자동 · 밝게 · 어둡게» 고르기
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-27 「폰에서 화면변동 자동화 기능 만들고 선택할 수 도 있게해라」.

   ★ 규칙
     ① 자동 = 폰·컴퓨터의 밤 모드 설정을 따른다
     ② 처음 여는 사람: 폰은 자동, 컴퓨터는 밝게(예전 그대로). 고른 것이 있으면 그것
     ③ 누를 때마다 자동 → 밝게 → 어둡게 → 자동, 고른 것은 이 기기에 기억
     ④ 자동일 때 밤 모드가 바뀌면 그 자리에서 따라간다(다시 열 필요 없음) */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const 캘린더 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8');

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

/* 가짜 기기 — 밤 모드인가 · 폰인가 · 저장된 값 */
function 상자(밤, 폰이다, 저장) {
  const 들음 = [];
  const 담긴 = { pu_cal_theme: 저장 };
  const b = {
    console, String, Object, Array, JSON, Math,
    S: {}, 그림: 0, 알림: [],
    localStorage: { getItem: (k) => (담긴[k] === undefined ? null : 담긴[k]), setItem: (k, v) => { 담긴[k] = v; } },
    document: { documentElement: { setAttribute: (k, v) => { b.달린 = v; } } },
    $: () => null,
    render: () => { b.그림++; }, toast: (t) => b.알림.push(t),
    window: { matchMedia: (q) => ({
      matches: /prefers-color-scheme: dark/.test(q) ? b.밤 : 폰이다,
      addEventListener: (ev, fn) => { if (/change/.test(ev)) 들음.push(fn); }
    }) },
    밤: 밤
  };
  vm.createContext(b);
  vm.runInContext((캘린더.match(/var 테마차례 = \[[^\]]*\];/) || [''])[0] + '\n'
    + (캘린더.match(/var 테마글 = \{[^}]*\};/) || [''])[0] + '\n'
    + ['function 폰(){', 'function 기기가어둡나(){', 'function themeResolve(){', 'function themeInit(){',
       'function themeApply(){', 'function themeToggle(){'].map((h) => 함수몸(캘린더, h)).join('\n'), b);
  return { b, 들음, 담긴 };
}

test('①② 처음 여는 폰은 «자동» — 밤 모드면 어둡게, 낮이면 밝게', () => {
  const 밤폰 = 상자(true, true);
  vm.runInContext('themeInit()', 밤폰.b);
  assert.equal(밤폰.b.S.themeMode, 'auto');
  assert.equal(밤폰.b.달린, 'dark', '밤 모드 폰인데 어둡게 안 됩니다');
  const 낮폰 = 상자(false, true);
  vm.runInContext('themeInit()', 낮폰.b);
  assert.equal(낮폰.b.달린, 'light');
});

test('② 처음 여는 컴퓨터는 예전처럼 «밝게» — 밤 모드 컴퓨터여도 저절로 어두워지지 않는다', () => {
  const r = 상자(true, false);
  vm.runInContext('themeInit()', r.b);
  assert.equal(r.b.S.themeMode, 'light');
  assert.equal(r.b.달린, 'light');
});

test('② 한 번 고른 것은 그대로 — 예전에 «어둡게»를 골라 둔 사람', () => {
  const r = 상자(false, true, 'dark');
  vm.runInContext('themeInit()', r.b);
  assert.equal(r.b.S.themeMode, 'dark');
  assert.equal(r.b.달린, 'dark');
});

test('③ 누를 때마다 자동 → 밝게 → 어둡게 → 자동, 고른 것을 이 기기에 기억한다', () => {
  const r = 상자(true, true);
  vm.runInContext('themeInit()', r.b);
  const 차례 = [];
  for (let i = 0; i < 3; i++) { vm.runInContext('themeToggle()', r.b); 차례.push(r.b.S.themeMode + ':' + r.b.달린); }
  assert.deepStrictEqual(차례, ['light:light', 'dark:dark', 'auto:dark']);
  assert.equal(r.담긴.pu_cal_theme, 'auto', '고른 것을 기억하지 않습니다');
  assert.ok(r.b.그림 >= 3, '바꾼 뒤 다시 안 그립니다 — 칸·칩 색이 안 따라옵니다');
});

test('④ 자동일 때 밤 모드가 바뀌면 그 자리에서 따라간다 — 고른 것이 있으면 안 따라간다', () => {
  const r = 상자(false, true);
  vm.runInContext('themeInit()', r.b);
  assert.equal(r.b.달린, 'light');
  assert.ok(r.들음.length >= 1, '밤 모드 바뀜을 안 듣습니다');
  r.b.밤 = true; r.들음.forEach((fn) => fn());
  assert.equal(r.b.달린, 'dark', '밤 모드로 바뀌었는데 안 따라갑니다');
  vm.runInContext('S.themeMode = "light"; themeResolve(); themeApply();', r.b);
  r.b.밤 = true; r.들음.forEach((fn) => fn());
  assert.equal(r.b.달린, 'light', '«밝게»를 골랐는데 밤 모드를 따라갔습니다');
});
