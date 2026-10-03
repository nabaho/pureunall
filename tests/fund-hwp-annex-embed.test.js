'use strict';
/* 설립인가신청서 «다음 쪽»에 [별지] 설립준비위원회 위원 명단 (대표 지시 2026-10-03
 *   「별지 명단 다음페이지에 만들어 서 넣어 줄수 있나 ? 지역공동기금은 모두다 별지명단을 넣어야 한다.」)
 *
 * 인가신청서 틀 뒤쪽에 별지 틀을 한글 「문서 끼워 넣기」로 붙이고 {{#별지명단}}…{{/별지명단}} 로 감쌌다.
 * 참/거짓 값은 «있거나 없거나» 묶음 — 채우기 전에 남기거나(표지만 지움) 문단째로 걷는다(_hwpOptBlock).
 * 진짜 한글로 확인(가짜 기금): 지역기금 위원 21명 → 2쪽(별지 전원) · 60명 → 3쪽(별지가 이어짐) ·
 *   지역 아님 2+2명 → 1쪽(격자에 이름, 별지 없음) · 옛 틀 → 1쪽(따로 받으라고 안내). 앱 미리보기(rhwp)도 같은 쪽 수.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
function grabFn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'fund.html 에 함수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') { d++; on = true; }
    else if (SRC[j] === '}') { d--; if (on && !d) return SRC.slice(i, j + 1); }
  }
  throw new Error('함수 끝을 못 찾음: ' + name);
}
function grabDecl(name) {
  const i = SRC.indexOf('var ' + name + '=');
  let d = 0, on = false;
  for (let j = SRC.indexOf('=', i); j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{' || c === '[') { d++; on = true; }
    else if (c === '}' || c === ']') { d--; if (on && !d) return SRC.slice(i, j + 1) + ';'; }
  }
}
const line = (n) => SRC.match(new RegExp('var ' + n + '=[^\\n]*?;'))[0];
const X = require('../js/pu-hwpx-fill.js');
const box = {};
new Function('PuHwpxFill', [grabDecl('FTYPE_PAIRS'), grabDecl('FTYPE_GONG_ONLY'), line('HWP_TPL_BLANK'), line('HWP_MK_OPEN'), line('HWP_FLOW_MARK'),
  'function ftypeSkipDoc(k){ return k==="inka"||k==="charter"; }',
  grabFn('_hwpStripLinesegs'), grabFn('_hwpParaAlign'), grabFn('_hwpTblFlow'), grabFn('_hwpOptBlock'), grabFn('_hwpTypeRules'), grabFn('_hwpFillXml'),
  'this.opt=_hwpOptBlock; this.fill=_hwpFillXml;'].join('\n')).call(box, X);

const LS = '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0"/></hp:linesegarray>';
const P = (t, pb) => '<hp:p id="0" paraPrIDRef="1" pageBreak="' + (pb || 0) + '"><hp:run charPrIDRef="1"><hp:t>' + t + '</hp:t></hp:run>' + LS + '</hp:p>';
/* 별지의 위원 표 — 한 줄을 {{#행:위원}} 로 사람 수만큼 */
const ROW = (cells) => '<hp:tr>' + cells.map((c, i) => '<hp:tc><hp:subList>' + P(c) + '</hp:subList><hp:cellAddr colAddr="' + i + '" rowAddr="0"/></hp:tc>').join('') + '</hp:tr>';
const TABLE = '<hp:p id="0" paraPrIDRef="1"><hp:run charPrIDRef="1"><hp:tbl id="9" pageBreak="CELL" rowCnt="2" colCnt="2"><hp:sz width="1" height="1"/><hp:pos treatAsChar="0" horzAlign="LEFT"/>'
  + ROW(['성명', '직책']) + ROW(['{{#행:위원}}{{성명}}', '{{직책}}{{/행:위원}}']) + '</hp:tbl></hp:run></hp:p>';
/* 인가신청서(앞장) + 별지(다음 쪽) */
const DOC = '<hs:sec>' + P('명칭 {{기금명}}') + P('{{#별지명단}}[별지] 위원 명단', 1) + P('기금법인 명칭: {{기금명}}') + TABLE + P('근로자측 {{근로자측수}}명{{/별지명단}}') + '</hs:sec>';
const V = (on) => ({ 기금명: '가짜기금', 별지명단: on, 위원: on ? [{ 성명: '홍길동', 직책: '과장' }, { 성명: '김가나', 직책: '대리' }] : [], 근로자측수: '2' });

test('★★★ 별지를 붙이면 — 다음 쪽(새 쪽 표시 그대로)에 명단 전원, 표지는 남지 않는다', () => {
  const r = box.fill(DOC, V(true), '공동', '공동', 'inka');
  const t = X.textOf(r.xml);
  assert.ok(t.includes('[별지] 위원 명단') && t.includes('홍길동') && t.includes('김가나'), '★ 별지·명단이 빠졌다');
  assert.ok(!/\{\{/.test(t), '★ 표지가 글자로 남았다: ' + t);
  assert.match(r.xml, /pageBreak="1"><hp:run charPrIDRef="1"><hp:t>\[별지\]/, '★ 별지가 새 쪽에서 시작하지 않는다');
  assert.deepEqual(r.opts, { 별지명단: true });
  assert.deepEqual(r.unknown, [], '★ 별지 안 표 줄 반복의 칸 이름을 «모르는 표지»로 잘못 알린다: ' + r.unknown);
});

test('★★★ 별지를 안 붙이면 — 그 문단들째로 사라져 빈 쪽이 남지 않는다', () => {
  const r = box.fill(DOC, V(false), '공동', '공동', 'inka');
  const t = X.textOf(r.xml);
  assert.ok(t.includes('명칭 가짜기금'), '앞장은 그대로');
  assert.ok(!t.includes('[별지]') && !t.includes('근로자측'), '★ 별지가 남았다');
  assert.ok(!/pageBreak="1"/.test(r.xml), '★ 새 쪽 표시가 남아 빈 쪽이 생긴다');
  assert.ok(!/<hp:tbl/.test(r.xml), '★ 별지 표가 남았다');
  assert.deepEqual(r.opts, { 별지명단: false });
});

test('★★ 옛 틀(별지 묶음이 없는 것)은 손대지 않는다 — opts 가 비어 «따로 받으라»는 안내로 간다', () => {
  const old = '<hs:sec>' + P('명칭 {{기금명}}') + '</hs:sec>';
  const o = box.opt(old, '별지명단', true);
  assert.equal(o.found, false); assert.equal(o.xml, old);
  const r = box.fill(old, V(true), '공동', '공동', 'inka');
  assert.deepEqual(r.opts, {});
});

test('★ 끝말은 틀에 별지가 정말 있었는지로 정한다 — 옛 틀에 «다음 쪽에 붙였다»고 하면 거짓말이다', () => {
  const fn = grabFn('hwpTplFill');
  assert.match(fn, /V\.별지명단===true/);
  assert.match(fn, /'별지명단' in r\.opts\)\?' — 다음 쪽에 붙였습니다':' — \[⬇ 별지 명단\]으로 따로 받으세요'/);
});

test('★★ 별지를 붙일지는 한 곳(_cmAnnexNeeded) — 지역공동기금은 늘, 그 밖에는 격자(세 줄)를 넘칠 때', () => {
  const fn = grabFn('_cmAnnexNeeded');
  assert.match(fn, /isRegionFund\(f\)/, '★ 지역공동기금 규칙이 없다(대표 지시 2026-10-03)');
  assert.match(fn, /_cmOver\(f,'근로자측',sites\)\|\|_cmOver\(f,'사용자측',sites\)/);
});
