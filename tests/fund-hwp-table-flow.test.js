'use strict';
/* 반복 묶음이 든 표가 «쪽을 넘으면 다음 쪽으로 이어지는가» (대표 지시 2026-09-27
 *   「한화면이 안되면 다음화면으로 자동으로 넘어가게」)
 *
 * 한글 COM 으로 PDF 를 떠서 센 것(사람 16명을 넣었을 때 인쇄된 이름 수, 고치기 전 → 후):
 *   설립합의서 9 → 16 · 감사보고서 12 → 16 · 결산 승인 회의록 10 → 16 (회의록·등기신청서는 16 그대로)
 *   사람 2명(평소)일 때는 5종 모두 한글 PDF 글자 배치가 한 줄도 안 바뀌었다.
 * 원인: 본문을 감싼 테두리 표가 «글자처럼 취급»(treatAsChar=1) — 글자 하나처럼 움직여 절대 안 쪼개진다.
 * 여기서는 그 고침(_hwpTblFlow)이 «무엇을 바꾸고 무엇은 그대로 두는지»를 흉내 낸 XML 로 본다.
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
const line = (n) => SRC.match(new RegExp('var ' + n + '=[^\\n]*?;'))[0];
const box = {};
new Function([line('HWP_MK_OPEN'), line('HWP_FLOW_MARK'), grabFn('_hwpStripLinesegs'), grabFn('_hwpParaAlign'),
  grabFn('_hwpTblFlow'), 'this.flow=_hwpTblFlow; this.align=_hwpParaAlign;'].join('\n')).call(box);

const LS = (h) => '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="' + h + '"/></hp:linesegarray>';
const P = (t) => '<hp:p id="0" paraPrIDRef="16"><hp:run charPrIDRef="1"><hp:t>' + t + '</hp:t></hp:run>' + LS(1000) + '</hp:p>';
/* 실제 설립합의서 틀 모양: 가운데 정렬 문단(12) 안에 글자처럼 취급한 1×1 테두리 표, 표 뒤 문단 줄 높이 = 표 높이 */
const TBL = (inner, o) => '<hp:tbl id="1" textWrap="TOP_AND_BOTTOM" pageBreak="' + ((o && o.pb) || 'NONE') + '" repeatHeader="1" rowCnt="1" colCnt="1">'
  + '<hp:sz width="40862" height="46103"/><hp:pos treatAsChar="' + ((o && o.inl) == null ? 1 : o.inl) + '" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" horzOffset="0"/>'
  + '<hp:tr><hp:tc><hp:subList>' + inner + '</hp:subList></hp:tc></hp:tr></hp:tbl>';
const BOX = (inner, o) => '<hp:p id="0" paraPrIDRef="12"><hp:run charPrIDRef="8">' + TBL(inner, o) + '<hp:t>  </hp:t></hp:run>' + LS(46383) + '</hp:p>' + P('');
const HDR = '<hh:paraPr id="12" tabPrIDRef="0"><hh:align horizontal="CENTER" vertical="BASELINE"/></hh:paraPr>'
  + '<hh:paraPr id="16" tabPrIDRef="0"><hh:align horizontal="JUSTIFY" vertical="BASELINE"/></hh:paraPr>';
const posOf = (x) => (x.match(/<hp:pos\b[^>]*>/) || [''])[0];

test('★★★ 늘어나는 반복이 든 «글자처럼 취급» 표 — 풀고(0)·칸 안에서 나누고(CELL)·줄 정보를 걷는다', () => {
  const x = BOX(P('제목') + P('{{#서명}}{{회사}} 대표이사') + P('{{대표이사}} (인){{/서명}}'));
  const y = box.flow(x, HDR);
  assert.match(posOf(y), /treatAsChar="0"/, '★ 글자처럼 취급을 안 풀었다 — 한글에서 안 쪼개진다');
  assert.match(y, /<hp:tbl\b[^>]*pageBreak="CELL"/, '★ 나누지 않음(NONE) 그대로다');
  assert.ok(!/vertsize="46383"/.test(y), '★ 표를 품은 문단의 옛 줄 높이(표 높이)가 남았다 — 끝에 빈 쪽이 생긴다');
  const i = y.indexOf('<hp:tbl'), j = y.indexOf('</hp:tbl>');
  assert.ok(!/<hp:linesegarray/.test(y.slice(i, j)), '★ 표 안 옛 줄 정보가 남았다 — 앱 미리보기(rhwp)가 한 쪽으로 셈하고 자른다');
  assert.ok(/<hp:linesegarray/.test(y.slice(j)), '표 «밖» 다음 문단의 줄 정보까지 걷을 까닭은 없다');
  assert.ok(!/puFlow/.test(y), '★ 두 번 훑는 사이의 표시가 남았다 — 한글이 모르는 속성이 파일에 들어간다');
});

test('★★ 글자처럼 취급할 때 따르던 «문단 정렬»(가운데)을 표 자리로 옮긴다 — 안 옮기면 상자가 왼쪽으로 쏠린다', () => {
  const y = box.flow(BOX(P('{{#서명}}가{{/서명}}')), HDR);
  assert.match(posOf(y), /horzAlign="CENTER"/);
  assert.equal(box.align(HDR, '12'), 'CENTER');
  assert.equal(box.align(HDR, '99'), '', '모르는 문단 모양이면 비운다');
  const noHdr = box.flow(BOX(P('{{#서명}}가{{/서명}}')));
  assert.match(posOf(noHdr), /horzAlign="LEFT"/, 'header.xml 이 없으면 정렬은 손대지 않는다(지어내지 않는다)');
});

test('★★ 쪽 반복(쪽:)만 든 표는 그대로 — 장마다 표가 따로 복사된다(출연확인서·재산변동보고서는 한글로 맞춰 둔 것)', () => {
  const x = BOX(P('{{#쪽:확인서}}{{회사}}{{/쪽:확인서}}'));
  assert.equal(box.flow(x, HDR), x);
});

test('★ 반복이 없는 표 · 이미 넘어가는 표(설립인가신청서: 글자처럼 취급 아님 + CELL)는 그대로', () => {
  const a = BOX(P('{{기금명}}'));
  assert.equal(box.flow(a, HDR), a, '반복 없는 표를 건드렸다 — 접수번호 칸 같은 작은 표가 쪽 끝에서 쪼개질 수 있다');
  const b = BOX(P('{{#서명}}가{{/서명}}'), { inl: 0, pb: 'CELL' });
  assert.equal(box.flow(b, HDR), b);
});

test('★ 표 속 표 — 바깥·안쪽 머리를 모두 풀고, 줄 정보는 바깥 하나로 덮는다', () => {
  const inner = '<hp:p id="0" paraPrIDRef="16"><hp:run charPrIDRef="1">' + TBL(P('{{#서명}}가{{/서명}}')) + '</hp:run>' + LS(9000) + '</hp:p>';
  const y = box.flow(BOX(P('제목') + inner), HDR);
  assert.equal((y.match(/treatAsChar="0"/g) || []).length, 2, '★ 안쪽 표를 못 풀었다');
  assert.ok(!/treatAsChar="1"/.test(y));
  assert.ok(!/puFlow/.test(y));
});

test('채우기가 이 고침을 «반복을 펼치기 전»에 부른다 — 펼친 뒤엔 반복 표지가 없어 어느 표인지 모른다', () => {
  const fx = grabFn('_hwpFillXml');
  assert.ok(fx.indexOf('_hwpTblFlow(xml,hdr)') >= 0 && fx.indexOf('_hwpTblFlow(xml,hdr)') < fx.indexOf('X.expand('));
});
