'use strict';
// 경력관리 기관 양식 채우기 — «한글 프로그램으로 열었을 때» 드러난 결함 둘 (2026-09-24, 이 PC 한글로 쪽 그림을 떠서 확인)
//  ① 한글이 저장한 빈 칸은 run 이 스스로 닫혀 있다(<hp:run charPrIDRef="0"/>). 예전엔 그 «뒤»에 <hp:t> 를 붙여
//     글자가 run 밖으로 나갔고, 한글은 그 글자를 버렸다 — 채운 파일을 한글로 열면 칸이 비어 있었다.
//     (우리 엔진 rhwp 는 그래도 보여 줘서 앱 안 미리보기로는 몰랐다.)
//  ② 글을 바꾼 문단에 옛 줄 정보(linesegarray)가 남으면 한글이 그것을 믿어 한 줄에 글자가 겹친다.
// 픽스처는 한글이 실제로 저장한 HWPX 의 칸 모양 그대로다(값은 가짜).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const F = require('../js/kcareer-hwpxfill.js');
const M = require('../js/kcareer-formmap.js');

const LS = '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="19956" flags="393216"/></hp:linesegarray>';
function tc(col, row, inner) {
  return '<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="3">'
    + '<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'
    + '<hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">' + inner + '</hp:p></hp:subList>'
    + '<hp:cellAddr colAddr="' + col + '" rowAddr="' + row + '"/><hp:cellSpan colSpan="1" rowSpan="1"/>'
    + '<hp:cellSz width="20977" height="282"/><hp:cellMargin left="510" right="510" top="141" bottom="141"/></hp:tc>';
}
const label = (c, r, t) => tc(c, r, '<hp:run charPrIDRef="0"><hp:t>' + t + '</hp:t></hp:run>' + LS);
const empty = (c, r) => tc(c, r, '<hp:run charPrIDRef="0"/>' + LS);   // 한글이 저장한 빈 칸 모양
function table(pairs) {
  const rows = pairs.map((l, r) => '<hp:tr>' + label(0, r, l) + empty(1, r) + '</hp:tr>').join('');
  return '<hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0">'
    + '<hp:tbl id="1" zOrder="0" numberingType="TABLE" rowCnt="' + pairs.length + '" colCnt="2" cellSpacing="0" borderFillIDRef="3" noAdjust="0">'
    + '<hp:sz width="41954" widthRelTo="ABSOLUTE" height="0" heightRelTo="ABSOLUTE" protect="0"/>'
    + rows + '</hp:tbl></hp:run>' + LS + '</hp:p>';
}
const SEC = (body) => '<?xml version="1.0" encoding="UTF-8"?><hs:sec xmlns:hs="x" xmlns:hp="y">' + body + '</hs:sec>';
const DATA = { fields: { name: '홍길동', addr: '가나시 다라구 마바로 123 사아아파트 101동 1203호', org: '시험노무법인', email: 'someone@example.com' },
  edu: [], career: [], work: [], certaward: [], secrets: {} };

// 모든 <hp:t> 가 어떤 run «안»에 있는지 — 한글은 run 밖의 글자를 버린다
function allTextInsideRuns(xml) {
  const re = /<hp:run\b[^>]*?(\/?)>|<\/hp:run>|<hp:t\b[^>]*>/g; let depth = 0, m;
  while ((m = re.exec(xml))) {
    if (m[0].startsWith('<hp:run')) { if (!m[1]) depth++; }
    else if (m[0] === '</hp:run>') depth--;
    else if (depth <= 0) return false;
  }
  return true;
}

test('① 한글이 저장한 빈 칸(스스로 닫힌 run)에 넣은 글자는 run 안에 들어간다', () => {
  const out = F.fillCell(empty(1, 0), '홍길동');
  assert.ok(out, '못 넣으면 안 된다');
  assert.match(out, /<hp:run charPrIDRef="0"><hp:t>홍길동<\/hp:t><\/hp:run>/);
  assert.doesNotMatch(out, /\/>\s*<hp:t>/, 'run 이 닫힌 뒤에 글자가 붙으면 한글이 버린다');
  assert.ok(allTextInsideRuns(out));
});

test('① 자동 채우기 — 한글 모양 표의 빈 칸 넷이 모두 run 안에 채워진다', () => {
  const r = F.autoFill(SEC(table(['성명', '주소', '소속', '이메일'])), DATA);
  assert.ok(r.changed);
  for (const v of ['홍길동', '시험노무법인', 'someone@example.com']) assert.ok(r.xml.includes('<hp:t>' + v + '</hp:t></hp:run>'), v);
  assert.ok(allTextInsideRuns(r.xml), '한 칸이라도 run 밖이면 한글에서 빈 칸으로 나온다');
});

test('① 여는·닫는 run(글자 없음) 모양은 예전처럼 여는 태그 뒤에 넣는다', () => {
  const out = F.fillCell(tc(1, 0, '<hp:run charPrIDRef="5"></hp:run>'), '값');
  assert.match(out, /<hp:run charPrIDRef="5"><hp:t>값<\/hp:t><\/hp:run>/);
});

test('② 채운 칸은 옛 줄 정보를 걷고, 손대지 않은 라벨 칸은 그대로 둔다', () => {
  const r = F.autoFill(SEC(table(['성명', '주소'])), DATA);
  const cells = r.xml.match(/<hp:tc\b[\s\S]*?<\/hp:tc>/g);
  assert.equal(cells.length, 4);
  assert.ok(cells[0].includes('<hp:linesegarray>'), '라벨 칸 「성명」은 서식 모양 그대로');
  assert.ok(!cells[1].includes('linesegarray'), '채운 칸은 한글이 새로 나눠 그리게');
  assert.ok(cells[2].includes('<hp:linesegarray>'));
  assert.ok(!cells[3].includes('linesegarray'));
  assert.ok(r.xml.trimEnd().endsWith(LS + '</hp:p></hs:sec>'), '표를 품은 바깥 문단의 줄 정보도 그대로');
});

test('② 글자를 통째로 바꾸는 길(setCellText·문단 바꾸기)도 줄 정보를 걷는다 — 안 바뀌면 그대로', () => {
  const c = label(1, 0, '예전 글자');
  assert.ok(!F.setCellText(c, '아주 긴 새 글자가 들어갑니다').includes('linesegarray'));
  assert.equal(F.setCellText(c, '예전 글자'), c, '같은 글자면 손대지 않는다');
  const p = '<hp:p id="0"><hp:run charPrIDRef="0"><hp:t>  년   월   일</hp:t></hp:run>' + LS + '</hp:p>';
  const out = F.fillParagraphs(SEC(p), { name: '홍길동' }, { fields: [] }, new Date(2026, 8, 24));
  assert.ok(out.includes('2026'), '날짜가 들어간다');
  assert.ok(!out.includes('linesegarray'), '날짜를 넣은 문단은 줄 정보를 걷는다');
});

test('② 칸 안내글 뒤에 이어 쓰기(칸 지도)도 줄 정보를 걷는다', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'kcareer-formmap.js'), 'utf8');
  const i = src.indexOf('function appendAfter(');
  assert.ok(i > 0);
  assert.match(src.slice(i, src.indexOf('\n  }', i)), /X\.dropLines\(/);
  assert.equal(typeof M.apply, 'function');
});

test('② relineLeaves — 글자가 바뀐 맨 안쪽 문단만 줄 정보를 걷는다', () => {
  const a = '<hp:p id="1"><hp:run charPrIDRef="0"><hp:t>{{이름}}</hp:t></hp:run>' + LS + '</hp:p>';
  const b = '<hp:p id="2"><hp:run charPrIDRef="0"><hp:t>그대로</hp:t></hp:run>' + LS + '</hp:p>';
  const out = F.relineLeaves(a + b, (p) => p.replace('{{이름}}', '홍길동'));
  assert.ok(out.includes('홍길동'));
  assert.equal(out.split('<hp:linesegarray>').length - 1, 1, '바뀐 문단 하나만 걷는다');
  assert.ok(out.endsWith(b));
  assert.equal(F.dropLines('<hp:p><hp:linesegarray/></hp:p>'), '<hp:p></hp:p>', '빈 줄 정보 태그도 걷는다');
});

test('② 경력관리의 {{토큰}} 채우기 두 곳이 토큰 든 문단의 줄 정보를 걷는다 · 새 모듈을 불러오게 판 올림', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
  const fill = html.slice(html.indexOf('async function hwpxFill('), html.indexOf('function renderPersonalDocs('));
  assert.match(fill, /relineLeaves[\s\S]*_fillTokens\(s,map,stat\)/, '토큰을 바꾸기 «전에» 그 문단을 표시해 걷는다');
  const gen = html.slice(html.indexOf('async function generateFilledHWP('), html.indexOf('function renderFillPanel('));
  assert.match(gen, /relineLeaves/);
  assert.match(html, /js\/kcareer-hwpxfill\.js\?v=(\d+)/);
  assert.ok(Number(html.match(/js\/kcareer-hwpxfill\.js\?v=(\d+)/)[1]) >= 28);
  assert.ok(Number(html.match(/js\/kcareer-formmap\.js\?v=(\d+)/)[1]) >= 17);
});
