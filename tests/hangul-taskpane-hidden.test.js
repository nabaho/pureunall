'use strict';
/* 한글 편집기 — 오른쪽 «작업 창»(서식 · 자동 채우기)은 처음에 보이지 않는다 (2026-11-09, 대표 «한글프로그램에 이 부분 없애 달라»)
   ■ 무엇이었나
     편집기를 열면 오른쪽에 폭 260px 짜리 작업 창(서식 목록 · 자동 채우기)이 늘 떠 있어 글 쓰는 자리를 좁혔다.
   ■ 지금
     처음부터 숨겨 둔다(`hidden`). 기능은 지우지 않았다 — [보기 > 작업 창] 으로 켜고 끌 수 있고, 서식을 고르거나 «다시 찾기»를 부르면 열린다.
     (기금관리 연결·누름틀·메일 머지가 이 창의 칸 목록 `fieldList` 를 그대로 쓰므로 창의 자리 자체는 지우지 않는다.)
   ■ 지킴
     ① 처음에 숨김  ② 숨김 속성이 실제로 숨기는 CSS 가 있음  ③ 다시 열 길(보기 메뉴·열기 함수)이 남아 있음  ④ 창 안쪽 칸이 그대로 있음
   node --test tests/hangul-taskpane-hidden.test.js */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const R = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(R, 'hangul.html'), 'utf8').replace(/\r\n/g, '\n');
const CSS = fs.readFileSync(path.join(R, 'hangul/app.css'), 'utf8').replace(/\r\n/g, '\n');
const APP = fs.readFileSync(path.join(R, 'hangul/js/app.js'), 'utf8').replace(/\r\n/g, '\n');

test('★★★ 작업 창은 처음에 숨겨져 있다 — 오른쪽에 서식·자동 채우기가 뜨지 않는다', () => {
  const m = /<aside\b[^>]*\bid="taskpane"[^>]*>/.exec(HTML);
  assert.ok(m, 'hangul.html 에 작업 창(#taskpane)을 못 찾았습니다');
  assert.match(m[0], /\bhidden\b/, '작업 창이 처음부터 보입니다 — 대표가 «없애 달라» 한 부분');
});

test('★★ 숨김 속성이 «실제로» 숨긴다 — display 를 덮어쓰는 규칙이 이겨 버리지 않는다', () => {
  assert.match(CSS, /\[hidden\]\s*\{\s*display:\s*none\s*!important/, '[hidden] 이 !important 로 숨기지 않으면 .taskpane{display:flex} 가 이겨 창이 그대로 보입니다');
});

test('★★ 기능은 남아 있다 — [보기 > 작업 창] 으로 켜고 끌 수 있고, 서식 열기·다시 찾기가 창을 연다', () => {
  assert.match(APP, /it\('pane', '작업 창', C\.togglePane/, '보기 메뉴의 작업 창 항목');
  assert.match(APP, /togglePane: \(\) => \{ \$\('taskpane'\)\.hidden = !\$\('taskpane'\)\.hidden;/);
  assert.match(APP, /function showPane\(which\) \{\s*\$\('taskpane'\)\.hidden = false;/, '서식·자동 채우기를 부르면 창이 열려야 합니다');
  assert.match(APP, /showFill: \(\) => showPane\('fill'\), showTpl: \(\) => showPane\('tpl'\)/);
});

test('★★ 창 안쪽 칸은 그대로다 — 기금 연결·누름틀·메일 머지가 쓰는 fieldList 등이 지워지지 않았다', () => {
  for (const id of ['tplList', 'fieldList', 'fieldRescan', 'fieldClear', 'tpClose', 'tpTabs']) {
    assert.match(HTML, new RegExp('id="' + id + '"'), id + ' 칸이 없어지면 renderFields·showPane 이 오류를 냅니다');
  }
});

test('★ 폰 화면은 그대로다 — 폰에서는 처음부터 숨기고 «채우기» 단추로만 연다', () => {
  const mobile = fs.readFileSync(path.join(R, 'hangul/js/mobile.js'), 'utf8');
  assert.match(mobile, /\$\('taskpane'\)\.hidden = true/);
});
