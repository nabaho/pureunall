'use strict';
/* 근태관리 화면 정리 (2026-10-24 대표 「ui 너무 보기 이상하다 … 깔끔하게」→ 「추천대로」)
   «지금 값»이 아니라 «규칙»을 본다: 칸에는 종류만 · 한 사람은 한 줄 · 할 일 없으면 큰 띠 없음 · 값 있는 합계 칸만
   실행: node --test tests/attend-ui-tidy.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
function fnSrc(name){
  const i = SRC.indexOf('\nfunction ' + name + '(');
  assert.ok(i >= 0, name + ' 함수를 못 찾았습니다');
  const j = SRC.indexOf('\nfunction ', i + 10);
  return SRC.slice(i + 1, j < 0 ? undefined : j);
}
const ATT = fnSrc('AttendanceManagement');
const SYNC = fnSrc('GcalAttSync');

test('달력 칸에는 종류만 — 비고(캘린더 출처 글)는 칸 글이 아니라 title 로', () => {
  assert.match(ATT, /var chipLabel = /, '칸 글(chipLabel)과 전문(label)이 갈라져 있어야 한다');
  assert.doesNotMatch(ATT.match(/var chipLabel = [^\n]*/)[0], /r\.note/, '칸 글에 비고가 들어가면 잘린다');
  assert.match(ATT, /_chipIcon \? t\.icon : chipLabel/, '칸에 그리는 것은 chipLabel');
  assert.match(ATT, /title:label\+/, '전문은 title 에 남는다');
});

test('직원 목록 — 한 사람은 한 줄(이름·직책·배지가 한 flex 줄, 줄바꿈 없음)', () => {
  const row = ATT.slice(ATT.indexOf('한 사람은 한 줄'));
  assert.ok(row.length > 100, '한 줄 표지가 있어야 한다');
  const head = row.slice(0, 700);
  assert.match(head, /display:'flex'[^}]*whiteSpace:'nowrap'/);
  assert.match(head, /u\.name/);
  assert.match(head, /u\.title/);
});

test('가운데 입력 칸 — 잔여 연차는 한 덩이, 초과근로 단추·안내는 칸 전체 폭', () => {
  assert.doesNotMatch(ATT, /flex:1,background:'#eff6ff'[^]{0,200}잔여 연차/, '잔여 연차를 둘로 가른 옛 모양이 남아 있다');
  assert.match(ATT, /gridColumn:'1\/-1'[^}]*\}\}, '📋 상세'/);
  assert.match(ATT, /gridColumn:'1\/-1'[^}]*whiteSpace:'nowrap'[^}]*\}\},'→ 월별급여 자동반영'/);
});

test('기록 표 — 비고는 한 줄(말줄임), 캘린더에서 온 줄은 출처만 작게', () => {
  const cell = ATT.match(/h\('td',\{title:r\.note\|\|''[^\n]*/)[0];
  assert.match(cell, /whiteSpace:'nowrap'/);
  assert.match(cell, /textOverflow:'ellipsis'/);
  assert.match(cell, /r\.sourceKind==='gcal'/);
});

test('캘린더 연동 띠 — 새로 넣을 것·확인할 것이 없으면 큰 띠 대신 작은 글 한 줄', () => {
  const i = SYNC.indexOf('if(!askN && !goneN && !added)');
  assert.ok(i >= 0, '할 일 없음 분기가 있어야 한다');
  assert.match(SYNC.slice(i, i + 400), /return h\('div'/);
  assert.ok(SYNC.indexOf("h('b', { style:{ color:'#1e40af' } }, '📅 캘린더 연동')") > i, '큰 띠는 분기 뒤에 있어야 한다');
});

test('월별 매트릭스 — 이달 값이 있는 합계 칸만(없으면 전부), 재택·공가·특별휴가도 센다', () => {
  assert.match(ATT, /var SUM_ALL = \[/);
  assert.match(ATT, /var SUM_COLS = SUM_ALL\.filter\(function\(c\)\{ return \(totals\[c\.k\] \|\| 0\) > 0; \}\)/);
  assert.match(ATT, /if\(!SUM_COLS\.length\) SUM_COLS = SUM_ALL;/);
  ['telework', 'public', 'special-leave'].forEach(t => assert.match(ATT, new RegExp("r\\.type==='" + t + "'"), t + ' 을 합계에서 센다'));
  assert.doesNotMatch(ATT, /월 합계 \(' \+ SUM_COLS\.length/, '«N개 항목» 글은 칸 수가 바뀌므로 두지 않는다');
});
