'use strict';
/* 정부컨설팅 보고서 — 기관이 보낸 «빈 양식»을 지도대로 채운다 (js/pu-gov-report.js)
 * (대표 결정 2026-10-07 「승인 — 1단계부터 시작」 · 계획 docs/superpowers/plans/2026-10-07-gov-report-step1.md)
 *
 * ★ 저장소는 공개다 — 실제 양식·업체 자료를 넣지 않는다. 아래 문서는 2025 충남북부상의 양식의
 *   «주소 꼴»(표 차례·칸 차례·문단 차례)만 흉내 낸 합성 XML 이고, 값은 홍길동·가나상사다.
 *
 * 못 박는 것(규칙):
 *   ① 지도의 칸이 모두 채워지고 결과에 표지({{)가 하나도 안 남는다
 *   ② 근로자수는 상시근로자수(workers) — 피보험자수가 있어도 쓰지 않는다. 없으면 밑줄(지어내지 않는다)
 *   ③ 회차가 모자라면 빈 회차는 밑줄 + «모자람»을 알린다 · 넘치면 «넘침»을 알린다
 *   ④ 방문 여부를 모르면 체크칸은 원문 그대로(□방문 □사무활동) — 아무 쪽도 칠하지 않는다
 *   ⑤ 여러 줄 글은 한 칸 안에서 한글 줄바꿈 — 칸 밖에 문단을 늘리지 않는다
 *   ⑥ 원본 양식 글(제목·이름표·작성기준)은 그대로 남는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const X = require('../js/pu-hwpx-fill.js');
const G = require('../js/pu-gov-report.js');

const LS = '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" horzsize="40000"/></hp:linesegarray>';
const EMPTY = '<hp:run charPrIDRef="0"/>';
const P = (inner) => '<hp:p id="0" paraPrIDRef="0">' + inner + LS + '</hp:p>';
const RUN = (t) => '<hp:run charPrIDRef="0"><hp:t>' + t + '</hp:t></hp:run>';
const cell = (t) => '<hp:tc><hp:subList>' + P(t == null ? EMPTY : RUN(t)) + '</hp:subList><hp:cellAddr colAddr="0" rowAddr="0"/></hp:tc>';
const tbl = (...ts) => P('<hp:run><hp:tbl><hp:tr>' + ts.map(cell).join('') + '</hp:tr></hp:tbl></hp:run>');
const SEC = (...ps) => '<hs:sec>' + ps.join('') + '</hs:sec>';

/* 2025 충남북부상의 결과보고서의 주소 꼴 — T0~T6 · P0~P21 */
function northXml() {
  const 날짜 = '2025년   월   일', 체크 = '□방문 □사무활동';
  return SEC(
    tbl('충남북부상공회의소 인사노무 컨설팅 결과보고서'),
    tbl('업 체 명', null, '사업자등록번호', ' ', '대표자', null, '업종', null, '소재지', null,
      '근로자수', null, '기업 담당자', null, '부서/직위', null,
      '회차별 수행일자', '1회', 날짜, 체크, '2회', 날짜, 체크, '3회', 날짜, 체크),
    tbl(' 1. 지원기업 문의·요청사항 및 기업진단', null),
    tbl(' 2. 컨설팅 회차별 수행내역', '1회', null, '2회', null, '3회', null),
    tbl(' 3. 컨설팅 결과종합', '검토사항(기존)', '조치결과', '산출물(별첨)', null, null, null),
    tbl(' 4. 기타사항', null),
    P(EMPTY), P(EMPTY), P(RUN('위와 같이 컨설팅 수행 결과보고서를 제출합니다.')), P(EMPTY),
    P(RUN('2025년      월      일')), P(EMPTY), P(EMPTY),
    P(RUN('경영상담역:              (서명/날인)')), P(EMPTY), P(EMPTY),
    P(RUN('(참여기업) 대표자:              (서명/날인)')), P(EMPTY), P(EMPTY),
    P(RUN('충남북부상공회의소 회장 귀하')), P(EMPTY),
    tbl(' 작성기준', '① 기업의 문의·요청사항에 대해 진단-처방-결과물 산출 과정을 논리적으로 상세히 기록'));
}

function report(over) {
  const r = {
    company: { name: '가나상사', bizNo: '123-45-67890', ceo: '김가나', bizType: '제조업', address: '충남 천안시 서북구 가나로 1',
      workers: 12, insuredCount: 9, contact: '홍길동', contactTitle: '총무팀/대리' },
    consultant: '이푸른',
    writtenAt: '2025-11-20',
    rounds: [
      { date: '2025-09-04', visit: true, inquiry: '취업규칙 개정 문의', diagnosis: '연장근로 규정 미비', advice: '개정안 초안 제시', result: '', next: '노사협의' },
      { date: '2025-10-02', visit: false, inquiry: '', diagnosis: '', advice: '임금체계 검토', result: '검토 의견서', next: '' },
      { date: '2025-11-06', visit: true, inquiry: '', diagnosis: '', advice: '최종 점검', result: '개정 취업규칙 확정', next: '' },
    ],
    summary: { inquiryDiag: '취업규칙이 2019년 판이라 개정 필요', review: '연장근로·휴가 규정', action: '개정안 확정',
      outputs: ['취업규칙 개정안', '임금체계 검토 의견서'], etc: '없음' },
  };
  return Object.assign(r, over || {});
}

const at = (xml, a) => { const p = X.scan(xml).find((q) => q.addr === a); assert.ok(p, a + ' 자리가 없음'); return p; };
const textAt = (xml, a) => at(xml, a).text;
const rawAt = (xml, a) => { const p = at(xml, a); return xml.slice(p.start, p.end); };

test('① 지도의 칸이 모두 채워지고 표지가 하나도 안 남는다', () => {
  const r = G.fillForm(northXml(), 'cci-north', 'main', report());
  assert.deepEqual(r.left, [], '안 채워진 표지가 남았다');
  assert.deepEqual(r.unknown, []);
  assert.doesNotMatch(r.xml, /{{|}}/);
  assert.equal(r.short, null);
  assert.equal(textAt(r.xml, 'T1.C1.P0'), '가나상사');
  assert.equal(textAt(r.xml, 'T1.C3.P0'), '123-45-67890');
  assert.equal(textAt(r.xml, 'T1.C5.P0'), '김가나');
  assert.equal(textAt(r.xml, 'T1.C7.P0'), '제조업');
  assert.equal(textAt(r.xml, 'T1.C9.P0'), '충남 천안시 서북구 가나로 1');
  assert.equal(textAt(r.xml, 'T1.C13.P0'), '홍길동');
  assert.equal(textAt(r.xml, 'T1.C15.P0'), '총무팀/대리');
  assert.equal(textAt(r.xml, 'T1.C18.P0'), '2025년 9월 4일');
  assert.equal(textAt(r.xml, 'T1.C21.P0'), '2025년 10월 2일');
  assert.equal(textAt(r.xml, 'T1.C19.P0'), '■방문 □사무활동');
  assert.equal(textAt(r.xml, 'T1.C22.P0'), '□방문 ■사무활동');
  assert.equal(textAt(r.xml, 'T2.C1.P0'), '취업규칙이 2019년 판이라 개정 필요');
  assert.equal(textAt(r.xml, 'T4.C4.P0'), '연장근로·휴가 규정');
  assert.equal(textAt(r.xml, 'T4.C5.P0'), '개정안 확정');
  assert.equal(textAt(r.xml, 'T5.C1.P0'), '없음');
  assert.equal(textAt(r.xml, 'P10'), '2025년 11월 20일');
  assert.match(textAt(r.xml, 'P13'), /^경영상담역: 이푸른\s+\(서명\/날인\)$/);
  assert.match(textAt(r.xml, 'P16'), /^\(참여기업\) 대표자: 김가나\s+\(서명\/날인\)$/);
});

test('⑥ 원본 양식 글(제목·이름표·작성기준)은 그대로', () => {
  const r = G.fillForm(northXml(), 'cci-north', 'main', report());
  ['충남북부상공회의소 인사노무 컨설팅 결과보고서', '업 체 명', '사업자등록번호', '근로자수', '1회', '3회',
    '위와 같이 컨설팅 수행 결과보고서를 제출합니다.', '충남북부상공회의소 회장 귀하', ' 작성기준']
    .forEach((t) => assert.ok(X.scan(r.xml).some((p) => p.text === t), '원본 글이 사라짐: ' + t));
  assert.equal(X.scan(r.xml).length, X.scan(northXml()).length, '문단 수가 바뀌면 안 된다 — 칸 밖에 문단을 늘리지 않는다');
});

test('② 근로자수는 상시근로자수 — 피보험자수는 안 쓴다 · 없으면 밑줄', () => {
  const r = G.fillForm(northXml(), 'cci-north', 'main', report());
  assert.equal(textAt(r.xml, 'T1.C11.P0'), '12명');
  const c = report().company; delete c.workers;
  const r2 = G.fillForm(northXml(), 'cci-north', 'main', report({ company: c }));
  assert.equal(textAt(r2.xml, 'T1.C11.P0'), X.BLANK, '피보험자수(9)로 채우면 안 된다 — 지어내지 않는다');
  const c3 = report().company; delete c3.bizType;
  assert.equal(textAt(G.fillForm(northXml(), 'cci-north', 'main', report({ company: c3 })).xml, 'T1.C7.P0'), X.BLANK);
});

test('③ 회차가 모자라면 빈 회차는 밑줄 + 모자람 · 넘치면 넘침', () => {
  const two = report(); two.rounds = two.rounds.slice(0, 2);
  const r = G.fillForm(northXml(), 'cci-north', 'main', two);
  assert.deepEqual(r.short, { need: 3, have: 2 });
  assert.equal(textAt(r.xml, 'T1.C24.P0'), X.BLANK);
  assert.equal(textAt(r.xml, 'T3.C6.P0'), X.BLANK);
  assert.equal(textAt(r.xml, 'T1.C25.P0'), '□방문 □사무활동', '없는 회차의 체크칸을 칠하면 안 된다');
  assert.equal(r.over, null);
  const four = report(); four.rounds = four.rounds.concat([{ date: '2025-11-13', visit: true, advice: '추가' }]);
  const r4 = G.fillForm(northXml(), 'cci-north', 'main', four);
  assert.deepEqual(r4.over, { max: 3, have: 4 }, '넷째 회차가 조용히 사라지면 안 된다');
});

test('④ 방문 여부를 모르면 체크칸은 원문 그대로', () => {
  const rp = report(); delete rp.rounds[0].visit;
  const r = G.fillForm(northXml(), 'cci-north', 'main', rp);
  assert.equal(textAt(r.xml, 'T1.C19.P0'), '□방문 □사무활동');
  assert.equal(G.visitBox(true), '■방문 □사무활동');
  assert.equal(G.visitBox(false), '□방문 ■사무활동');
  assert.equal(G.visitBox(undefined), null);
});

test('⑤ 회차 수행내역·산출물은 한 칸 안에서 한글 줄바꿈 — 빈 항목은 뺀다', () => {
  const r = G.fillForm(northXml(), 'cci-north', 'main', report());
  const c1 = rawAt(r.xml, 'T3.C2.P0');
  assert.match(c1, /문의: 취업규칙 개정 문의<hp:lineBreak\/>진단: 연장근로 규정 미비<hp:lineBreak\/>자문: 개정안 초안 제시<hp:lineBreak\/>향후: 노사협의/);
  assert.doesNotMatch(c1, /성과:/, '빈 항목 이름표만 덩그러니 남기지 않는다');
  assert.doesNotMatch(c1, /<hp:linesegarray/, '여러 줄이 된 칸은 옛 줄 정보를 걷는다');
  assert.match(rawAt(r.xml, 'T4.C6.P0'), /#1 취업규칙 개정안<hp:lineBreak\/>#2 임금체계 검토 의견서/);
  assert.equal(G.koDate('2025-09-04'), '2025년 9월 4일');
  assert.equal(G.koDate(''), '');
});

test('지도 — 모든 주소가 양식에 실제로 있고(빈 칸·이름표 칸 아님), 표지 이름이 겹치지 않는다', () => {
  const f = G.FORMS['cci-north'];
  assert.ok(f && f.files.main);
  const addrs = X.scan(northXml()).map((p) => p.addr);
  const toks = [];
  (f.files.main.set || []).forEach((r) => { assert.ok(addrs.includes(r.at), '양식에 없는 주소: ' + r.at); toks.push(r.tok); });
  assert.equal(new Set(toks).size, toks.length, '같은 표지를 두 칸에 쓰면 한 값이 두 번 들어간다');
});
