'use strict';
/* 사건관리 표 — 의뢰인·상대방·관할기관·관할담당자·관할연락처·관할이메일 칸이
   글자 하나씩 세로로 쌓이던 것 (대표 지시 2026-09-21 「사건관리 갑자기 왜이렇게
   되었나? 컨설팅관리와 기금관리와 같이 행의 균형을 맞춰 달라. 그리고 빈공간으로
   인해 글자가 한줄씩 나오면 안된다.」)

   ★ 원인: 이 네 칸(관할기관 등)은 사건관리에만 있어 컨설팅·기금관리(다른 화면,
   ProjectManagementShared)와 견줄 짝이 없었고, whiteSpace:nowrap 없이 만들어졌다.
   관할 셋을 함께 켜면 표 전체 폭이 모자라져 CSS 표 자동배치가 이 칸들을 극단적으로
   좁혀, 한글이 글자 하나씩 줄바꿈됐다(공백 없는 한글은 nowrap 이 없으면 아무 데서나
   잘린다). 표를 담은 wrap 은 overflow:'auto' 라 — nowrap 을 주면 모자란 만큼
   가로스크롤이 뜨지, 글자가 세로로 쌓이지 않는다.

   ★ 못 박는 것은 «각 칸(그 칸의 고유 표시(colVis.jurOrg 등)로 지목)에 nowrap 이
   붙었는가»이지 minWidth 의 정확한 px 값이 아니다. 정규식마다 그 칸을 가리키는
   고유 표시(colVis.xxx && 또는 칸 이름)를 함께 넣어 «이웃 칸의 nowrap을 잘못
   집는 일»이 없게 했다(처음 짠 버전이 바로 이 함정에 걸려 다시 짰다). */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const RAW = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
const CM = stripJs(cutFn(RAW, 'function CaseManagement(props)'));

const 칸들 = [
  { 이름:'의뢰인',
    th: /h\('th', \{ onClick:function\(\)\{toggleSort\('companyName'\);\}, style:\{[^}]*whiteSpace:\s*'nowrap'[^}]*\} \}, '의뢰인'/,
    td: /h\('td', \{ style:\{\s*whiteSpace:\s*'nowrap'\s*\} \},\s*h\('div', \{ style:\{ fontWeight:600, color:'#2563eb'/ },
  { 이름:'상대방',
    th: /colVis\.opponent && h\('th', \{ style:\{[^}]*whiteSpace:\s*'nowrap'[^}]*\} \}, '상대방'\)/,
    td: /colVis\.opponent && h\('td', \{ style:\{\s*whiteSpace:\s*'nowrap'\s*\} \}/ },
  { 이름:'관할기관',
    th: /colVis\.jurOrg && h\('th', \{ style:\{[^}]*whiteSpace:\s*'nowrap'[^}]*\} \}, '관할기관'\)/,
    td: /colVis\.jurOrg && h\('td', \{ style:\{[^}]*whiteSpace:\s*'nowrap'[^}]*\}\s*\}, jur\.org/ },
  { 이름:'관할담당자',
    th: /colVis\.jurOfficer && h\('th', \{ style:\{[^}]*whiteSpace:\s*'nowrap'[^}]*\} \}, '관할담당자'\)/,
    td: /colVis\.jurOfficer && h\('td', \{ style:\{[^}]*whiteSpace:\s*'nowrap'[^}]*\}\s*\}, jur\.officer/ },
  { 이름:'관할연락처',
    th: /colVis\.jurPhone && h\('th', \{ style:\{[^}]*whiteSpace:\s*'nowrap'[^}]*\} \}, '관할연락처'\)/,
    td: /colVis\.jurPhone && h\('td', \{ style:\{[^}]*whiteSpace:\s*'nowrap'[^}]*\}\s*\}, jur\.phone/ },
  { 이름:'관할이메일',
    th: /colVis\.jurEmail && h\('th', \{ style:\{[^}]*whiteSpace:\s*'nowrap'[^}]*\} \}, '관할이메일'\)/,
    td: /colVis\.jurEmail && h\('td', \{ style:\{[^}]*whiteSpace:\s*'nowrap'[^}]*\}\s*\}, jur\.email/ },
];

칸들.forEach(function(c){
  test('«' + c.이름 + '» 머리(th)에 whiteSpace:nowrap 이 있다', () => {
    assert.match(CM, c.th, '이 칸 머리에 nowrap 이 없습니다 — 좁아지면 글자가 세로로 쌓입니다.');
  });
  test('«' + c.이름 + '» 몸(td)에 whiteSpace:nowrap 이 있다', () => {
    assert.match(CM, c.td, '이 칸 몸(td)에 nowrap 이 없습니다 — 좁아지면 글자가 세로로 쌓입니다.');
  });
});

test('표를 담은 자리는 넘치면 가로스크롤(overflow:auto)이다 — 문제가 다시 나도 잘리지 않는다', () => {
  assert.match(CM, /ref:[A-Za-z_$][\w$]*\.ref, style:\{\s*overflow:\s*'auto'/,
    '표 wrap(높이를 채우는 손잡이가 달린 자리) 에 overflow:auto 가 없습니다 — nowrap 칸이 넘칠 곳이 없습니다.');
});
