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
/* 칸 — 글 하나면 한 문단, 배열이면 여러 문단(지난 업체 글이 여러 문단으로 든 칸) */
const cell = (t) => '<hp:tc><hp:subList>' + (Array.isArray(t) ? t : [t]).map((x) => P(x == null ? EMPTY : RUN(x))).join('') + '</hp:subList><hp:cellAddr colAddr="0" rowAddr="0"/></hp:tc>';
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

/* ── 서산상의 · 기술보호 (2026-10-09) ──
 * 서산 원본은 2024 «확정본»(빈 양식이 없다)이라 칸마다 지난 업체 글이 여러 문단으로 들어 있고, 둘째 장이 하나 더 있으며,
 * 상담역 도장 그림이 박혀 있다. 아래 합성 XML 은 그 «주소 꼴»만 흉내 내고, 지난 업체 글은 가짜(다라상사·김지난·010-0000-0000)다. */
const Q = (inner, pb) => '<hp:p id="0" paraPrIDRef="0" pageBreak="' + (pb ? 1 : 0) + '">' + inner + LS + '</hp:p>';
const tblQ = (pb, ...ts) => Q('<hp:run><hp:tbl><hp:tr>' + ts.map(cell).join('') + '</hp:tr></hp:tbl></hp:run>', pb);
const PIC = '<hp:pic id="7" zOrder="0"><hp:img binaryItemIDRef="image1" bright="0"/><hp:sz width="10" height="10"/></hp:pic>';
const PICRUN = (t) => '<hp:run charPrIDRef="0">' + PIC + '<hp:t>' + t + '</hp:t></hp:run>';

/* 서산 업체 방문 확인서 — 첫 장 P0~P8(T0~T2) · 둘째 장 P9~P16(T3·T4) */
function seosanVisitXml() {
  const 머리 = (pb) => tblQ(pb, '업 체 명', '다라상사 ', '방 문 일', '2024.05.10', '방문회차', '1회차');
  const 내용 = (old) => tblQ(0, '내 용', '상 담 분 야', '인사 노무관련', ['업  체', '문 의 내 용 /', '애 로 사 항'],
    old ? ['지난 문의 하나', '지난 문의 둘 010-0000-0000'] : null, ['전 문 가', '진 단 의 견'],
    old ? ['지난 진단 하나', '지난 진단 둘'] : null, '상담 / 자문내용', old ? ['지난 자문 하나', '지난 자문 둘', '지난 자문 셋'] : null);
  const 끝 = () => [Q(RUN('  위와 같이 방문하였음을 확인합니다.')), Q(EMPTY),
    Q(RUN('                                 업체담당자:                   (서명)')), Q(EMPTY),
    Q(PICRUN('                                 경영상담역:    김 지 난      (서명)')), Q(RUN('서산상공회의소 귀중'))];
  return SEC(tblQ(0, '업체 방문 확인서'), 머리(0), 내용(true), ...끝(), 머리(1), 내용(false), ...끝());
}
/* 서산 상담 및 자문 결과 보고서 — T0~T4 · P0~P12 */
function seosanReportXml() {
  return SEC(
    tblQ(0, '상담 및 자문 결과 보고서'),
    tblQ(0, '상담일시', '2024.05.10', '상담업체', '㈜다라상사', '사업자등록번호', '999-99-99999 ', '업종', '제조/지난업종',
      '소재지', '충남 서산시 지난로 1', '근로자수', '35', '근무형태', '교대근무'),
    tblQ(0, '부서', '지난부서', '직위', '지난직위', '성명', '김지난', '연락처', '010-0000-0000', '팩스', '010-0000-0001', '이메일', 'old@example.com'),
    tblQ(0, '요청사항 및 진단내용', ['지난 요청 하나', '지난 요청 둘', '지난 요청 셋']),
    Q(RUN(' ')), Q(RUN('2024년   05월   10일')), Q(EMPTY), Q(PICRUN('')), Q(RUN('                                 경영상담역: 김 지 난  (서명)')),
    Q(EMPTY), Q(EMPTY), Q(RUN('서산상공회의소 귀중')),
    tblQ(1, '상담 및 자문결과', ['지난 결과 하나', '지난 결과 둘', null, null, null]));
}
/* 기술보호 별지11 — T0~T8 · P0~P18 (P15 1일차 일지 · P16 교육 일지 · P17 참석자 명단 · P18 ○일차 일지) */
const TECH_FIELD = ' 지원분야 (□ 사전예방, □ 스타트업) / 전문가(□ 변호사 □ 변리사 ■ 노무사)';
function techXml() {
  const 날짜 = '   년      월      일', 안내 = '위에서 파악한 문제점에 대한 구체적 자문 내용 명시';
  return SEC(
    Q(EMPTY), tblQ(0, '별지 11', null, ' 자문서식 (법률)'), Q(EMPTY), tblQ(0, '‘통합 기술보호지원반’법률 자문 완료보고서'),
    tblQ(0, '1. 지원정보', '상담구분', TECH_FIELD, '기 업 명', '다라상사', '지원일자',
      '(1차)', '(2차)', '(3차)', '(4차)', '(5차)', '(6차)', '(7차)', '1/1(월) ', null, null, null, null, null, null),
    tblQ(0, '2. 자문내용', [null, null, '신청기업 자문 희망 내용에 따른 구체적 자문 내용 기술', null, null]),
    Q(EMPTY),
    tblQ(0, '3. 총 평', [null, null, null, '기업 소개 작성 불필요', '자문내용만 작성(지원 성과 등 구체적 기술)', null]),
    Q(RUN('상기 내용과 같이 통합 기술보호지원반 사업 완료보고서를 제출합니다.')), Q(EMPTY),
    Q(RUN('                              신청기업  대 표 자 :              (서명/인)')),
    Q(PICRUN('                                   “    담 당 자 :              (서명/인)')),
    Q(RUN('                                        전 문 가 : 김 지 난     (서명/인)')), Q(EMPTY),
    Q(RUN(' 대·중소기업·농어업협력재단 귀중')),
    tblQ(1, '법률 자문 일지 (1일차)', '자문일', 날짜, null, null, '문제점·개선사항', null, '자문 내용', 안내),
    tblQ(1, '법률 교육 수행 일지 (○일차)', '강 의 일 자', null, '강 의 장 소', null),
    tblQ(1, '법률 교육 참석자 명단', '연번', '직  책', '이  름', '서  명'),
    tblQ(1, '            법률 자문 일지 (○일차) * 지원일수 만큼 작성', '자문일', 날짜, null, null, '문제점·개선사항',
      '3일간 기업 방문 시 파악한 문제점·개선필요사항 등 명시', '자문 내용', 안내, '지원 성과', null, '향후 계획', null));
}

/* 서산·기술보호용 자료 — 회차는 일부러 날짜 순이 아니게 넣는다(쓸 때 날짜 순으로 정렬돼야 한다) */
function report2(n) {
  const base = report();
  base.company = Object.assign({}, base.company, { contactDept: '총무팀', contactTitle: '대리', tel: '000-000-0000', fax: '',
    email: 'hong@example.com', workType: '주간근무' });
  base.writtenAt = '2025-05-10';
  base.field = '인사노무';
  base.techField = { prevent: true, startup: false };
  const dates = ['2025-06-11', '2025-04-16', '2025-05-07', '2025-07-02', '2025-07-16', '2025-07-23', '2025-08-07', '2025-08-14'];
  base.rounds = dates.slice(0, n).map((d) => ({ date: d, visit: true, inquiry: '문의' + d, diagnosis: '진단' + d,
    advice: '자문' + d, result: '성과' + d, next: '향후' + d }));
  base.summary = Object.assign({}, base.summary, { inquiryDiag: '요청 첫줄\n요청 둘째줄', adviceAll: '자문 결과 첫줄\n자문 결과 둘째줄', overall: '총평 한 줄' });
  return base;
}
const count = (xml, t) => X.scan(xml).filter((p) => p.text === t).length;
const textAll = (xml) => X.textOf(xml);
const OLD = ['다라상사', '김 지 난', '김지난', '010-0000-0000', '지난 문의', '지난 진단', '지난 자문', '지난 요청', '지난 결과',
  '지난업종', '지난부서', '지난직위', 'old@example.com', '999-99-99999', '2024.05.10'];
const noOld = (xml) => OLD.forEach((t) => assert.ok(!textAll(xml).includes(t), '지난 업체 글이 남았다: ' + t));

test('서산 방문확인서 — 회차마다 한 장, 날짜 순, 둘째 장·지난 글·그림이 사라진다', () => {
  const r = G.fillForm(seosanVisitXml(), 'cci-seosan', 'visit', report2(3));
  assert.deepEqual(r.left, []); assert.deepEqual(r.unknown, []); assert.equal(r.short, null); assert.equal(r.over, null);
  assert.doesNotMatch(r.xml, /{{|}}/);
  assert.equal(count(r.xml, '업체 방문 확인서'), 3, '회차 3 이면 3장');
  assert.equal(count(r.xml, '서산상공회의소 귀중'), 3, '둘째 장(원본의 남는 장)은 지운다');
  assert.doesNotMatch(r.xml, /<hp:pic\b/, '원본의 도장·서명 그림이 남으면 안 된다');
  noOld(r.xml);
  /* 장마다 T(3k)~T(3k+2) — 날짜 순(04-16 → 05-07 → 06-11) · 점 날짜 · 회차명 */
  assert.equal(textAt(r.xml, 'T1.C1.P0'), '가나상사');
  assert.equal(textAt(r.xml, 'T1.C3.P0'), '2025.04.16');
  assert.equal(textAt(r.xml, 'T1.C5.P0'), '1회차');
  assert.equal(textAt(r.xml, 'T4.C3.P0'), '2025.05.07');
  assert.equal(textAt(r.xml, 'T7.C3.P0'), '2025.06.11');
  assert.equal(textAt(r.xml, 'T7.C5.P0'), '3회차');
  assert.equal(textAt(r.xml, 'T2.C2.P0'), '인사노무');
  assert.equal(textAt(r.xml, 'T2.C4.P0'), '문의2025-04-16');
  assert.equal(textAt(r.xml, 'T2.C6.P0'), '진단2025-04-16');
  assert.equal(textAt(r.xml, 'T2.C8.P0'), '자문2025-04-16');
  assert.ok(!X.scan(r.xml).some((p) => p.addr === 'T2.C4.P1'), '여러 문단 칸은 한 문단이 된다');
  assert.match(textAt(r.xml, 'P5'), /^ +업체담당자: 홍길동\s+\(서명\)$/);
  assert.match(textAt(r.xml, 'P7'), /^ +경영상담역: 이푸른\s+\(서명\)$/);
  assert.equal(count(r.xml, '  위와 같이 방문하였음을 확인합니다.'), 3);
  assert.equal((r.xml.match(/pageBreak="1"/g) || []).length, 2, '둘째·셋째 장은 새 쪽에서');
  const one = G.fillForm(seosanVisitXml(), 'cci-seosan', 'visit', report2(1));
  assert.equal(count(one.xml, '업체 방문 확인서'), 1);
  assert.equal(count(one.xml, '서산상공회의소 귀중'), 1);
  noOld(one.xml);
});

test('서산 방문확인서 — 회차 없음은 모자람, 11회는 넘침', () => {
  const r0 = G.fillForm(seosanVisitXml(), 'cci-seosan', 'visit', report2(0));
  assert.deepEqual(r0.short, { need: 1, have: 0 });
  assert.equal(count(r0.xml, '업체 방문 확인서'), 1, '빈 한 벌은 남긴다');
  assert.equal(textAt(r0.xml, 'T1.C3.P0'), X.BLANK);
  const rp = report2(8); rp.rounds = rp.rounds.concat(report2(3).rounds);
  const r11 = G.fillForm(seosanVisitXml(), 'cci-seosan', 'visit', rp);
  assert.deepEqual(r11.over, { max: 10, have: 11 });
  assert.equal(count(r11.xml, '업체 방문 확인서'), 10, '양식 한도까지만 쓴다');
});

test('서산 결과보고서 — 칸 값 · 여러 문단 칸은 한 문단 · 서명줄 · 지난 글 사라짐', () => {
  const r = G.fillForm(seosanReportXml(), 'cci-seosan', 'report', report2(3));
  assert.deepEqual(r.left, []); assert.deepEqual(r.unknown, []);
  assert.doesNotMatch(r.xml, /{{|}}|<hp:pic\b/);
  noOld(r.xml);
  assert.equal(textAt(r.xml, 'T1.C1.P0'), '2025.04.16', '상담일시는 첫 회차(날짜 순)');
  assert.equal(textAt(r.xml, 'T1.C3.P0'), '가나상사');
  assert.equal(textAt(r.xml, 'T1.C5.P0'), '123-45-67890');
  assert.equal(textAt(r.xml, 'T1.C7.P0'), '제조업');
  assert.equal(textAt(r.xml, 'T1.C9.P0'), '충남 천안시 서북구 가나로 1');
  assert.equal(textAt(r.xml, 'T1.C11.P0'), '12명');
  assert.equal(textAt(r.xml, 'T1.C13.P0'), '주간근무');
  assert.equal(textAt(r.xml, 'T2.C1.P0'), '총무팀');
  assert.equal(textAt(r.xml, 'T2.C3.P0'), '대리');
  assert.equal(textAt(r.xml, 'T2.C5.P0'), '홍길동');
  assert.equal(textAt(r.xml, 'T2.C7.P0'), '000-000-0000');
  assert.equal(textAt(r.xml, 'T2.C9.P0'), X.BLANK, '모르는 팩스는 밑줄');
  assert.equal(textAt(r.xml, 'T2.C11.P0'), 'hong@example.com');
  assert.match(rawAt(r.xml, 'T3.C1.P0'), /요청 첫줄<hp:lineBreak\/>요청 둘째줄/);
  assert.ok(!X.scan(r.xml).some((p) => p.addr === 'T3.C1.P1'));
  assert.equal(textAt(r.xml, 'P5'), '2025년 5월 10일');
  assert.match(textAt(r.xml, 'P8'), /^ +경영상담역: 이푸른\s+\(서명\)$/, '서명줄의 지난 상담역 이름은 지운다');
  assert.match(rawAt(r.xml, 'T4.C1.P0'), /자문 결과 첫줄<hp:lineBreak\/>자문 결과 둘째줄/);
  assert.ok(!X.scan(r.xml).some((p) => p.addr === 'T4.C1.P1'), '칸의 남은 문단(빈 것 포함)은 지운다');
  assert.equal(count(r.xml, '서산상공회의소 귀중'), 1);
  assert.equal(count(r.xml, '상담 및 자문결과'), 1);
});

test('기술보호 — 회차 7 이면 일지 7장 · 지원일자 「8/7(목)」 · 교육 일지·명단·1일차 일지 사라짐 · 분야 체크', () => {
  const r = G.fillForm(techXml(), 'techguard', 'main', report2(7));
  assert.deepEqual(r.left, []); assert.deepEqual(r.unknown, []); assert.equal(r.over, null);
  assert.doesNotMatch(r.xml, /{{|}}|<hp:pic\b/);
  noOld(r.xml);
  for (let k = 1; k <= 7; k++) assert.equal(count(r.xml, '법률 자문 일지 (' + k + '일차)'), 1, k + '일차');
  assert.ok(!textAll(r.xml).includes('○일차'));
  assert.ok(!textAll(r.xml).includes('법률 교육 수행 일지'));
  assert.ok(!textAll(r.xml).includes('법률 교육 참석자 명단'));
  assert.ok(!textAll(r.xml).includes('년      월      일'));
  assert.equal(textAt(r.xml, 'T2.C2.P0'), ' 지원분야 (■ 사전예방, □ 스타트업) / 전문가(□ 변호사 □ 변리사 ■ 노무사)');
  assert.equal(textAt(r.xml, 'T2.C4.P0'), '가나상사');
  assert.equal(textAt(r.xml, 'T2.C13.P0'), '4/16(수)');
  assert.equal(textAt(r.xml, 'T2.C19.P0'), '8/7(목)');
  assert.match(rawAt(r.xml, 'T3.C1.P0'), /자문 결과 첫줄<hp:lineBreak\/>자문 결과 둘째줄/);
  assert.ok(!X.scan(r.xml).some((p) => p.addr === 'T3.C1.P1'));
  assert.equal(textAt(r.xml, 'T4.C1.P0'), '총평 한 줄');
  assert.ok(!X.scan(r.xml).some((p) => p.addr === 'T4.C1.P1'));
  assert.match(textAt(r.xml, 'P10'), /^ +신청기업  대 표 자 : 김가나\s+\(서명\/인\)$/);
  assert.match(textAt(r.xml, 'P11'), /^ +“    담 당 자 : 홍길동\s+\(서명\/인\)$/);
  assert.match(textAt(r.xml, 'P12'), /^ +전 문 가 : 이푸른\s+\(서명\/인\)$/);
  /* 일지는 T5 부터(지운 T5~T7 자리) — 첫 장 = 4/16 회차, 끝 장 = 8/7 회차 */
  assert.equal(textAt(r.xml, 'T5.C2.P0'), '2025년 4월 16일');
  assert.equal(textAt(r.xml, 'T5.C6.P0'), '진단2025-04-16');
  assert.equal(textAt(r.xml, 'T5.C8.P0'), '자문2025-04-16');
  assert.equal(textAt(r.xml, 'T5.C10.P0'), '성과2025-04-16');
  assert.equal(textAt(r.xml, 'T5.C12.P0'), '향후2025-04-16');
  assert.equal(textAt(r.xml, 'T11.C2.P0'), '2025년 8월 7일');
  assert.equal(textAt(r.xml, 'T11.C0.P0'), '법률 자문 일지 (7일차)');
});

test('기술보호 — 안 쓴 지원일자 칸은 빈칸 한 칸(밑줄 아님) · 8회는 넘침 · 분야 모르면 원문', () => {
  const rp = report2(2); delete rp.techField;
  const r = G.fillForm(techXml(), 'techguard', 'main', rp);
  assert.equal(textAt(r.xml, 'T2.C13.P0'), '4/16(수)');
  assert.equal(textAt(r.xml, 'T2.C14.P0'), '6/11(수)');
  for (let c = 15; c <= 19; c++) assert.equal(textAt(r.xml, 'T2.C' + c + '.P0'), ' ', 'T2.C' + c + ' — 안 쓴 칸은 밑줄이 아니라 빈칸');
  assert.equal(count(r.xml, '법률 자문 일지 (2일차)'), 1);
  assert.equal(count(r.xml, '법률 자문 일지 (3일차)'), 0);
  assert.equal(textAt(r.xml, 'T2.C2.P0'), TECH_FIELD, '분야를 모르면 원문 그대로');
  const r8 = G.fillForm(techXml(), 'techguard', 'main', report2(8));
  assert.deepEqual(r8.over, { max: 7, have: 8 });
  assert.equal(count(r8.xml, '법률 자문 일지 (8일차)'), 0, '양식 한도(7)까지만 쓴다');
});

test('공통 — 있을 수 없는 날짜는 밑줄(뒤로 정렬) · 윤년 2월 29일은 받는다', () => {
  assert.equal(G.koDate('2025-02-30'), '');
  assert.equal(G.koDate('2025-13-01'), '');
  assert.equal(G.koDate('2024-02-29'), '2024년 2월 29일');
  assert.equal(G.koDate('2025-02-29'), '');
  const rp = report2(3); rp.rounds[1].date = '2025-02-30';            // 04-16 이 틀린 날짜가 된다
  const r = G.fillForm(seosanVisitXml(), 'cci-seosan', 'visit', rp);
  assert.equal(textAt(r.xml, 'T1.C3.P0'), '2025.05.07', '틀린 날짜 회차는 맨 뒤로');
  assert.equal(textAt(r.xml, 'T7.C3.P0'), X.BLANK, '틀린 날짜는 지어내지 않는다');
  assert.equal(textAt(r.xml, 'T7.C5.P0'), '3회차');
});

test('공통 — 북부도 회차를 날짜 순으로 쓰고, 그림은 걷는다', () => {
  const rp = report(); rp.rounds = rp.rounds.slice().reverse();
  const r = G.fillForm(northXml(), 'cci-north', 'main', rp);
  assert.equal(textAt(r.xml, 'T1.C18.P0'), '2025년 9월 4일');
  assert.equal(textAt(r.xml, 'T1.C24.P0'), '2025년 11월 6일');
  assert.equal(G.tokenize(northXml().replace('<hp:t>경영상담역', PIC + '<hp:t>경영상담역'), 'cci-north', 'main'),
    G.tokenize(northXml(), 'cci-north', 'main'), '그림만 걷히고 나머지는 같다');
});

test('지도 — 서산·기술보호 주소가 합성 양식에 실제로 있다', () => {
  [['cci-seosan', 'visit', seosanVisitXml()], ['cci-seosan', 'report', seosanReportXml()], ['techguard', 'main', techXml()]].forEach(([fk, file, xml]) => {
    const addrs = X.scan(xml).map((p) => p.addr);
    (G.FORMS[fk].files[file].set || []).forEach((r) => {
      const a = r.at || r.cell || r.drop;
      assert.ok(addrs.some((x) => x === a || (a.endsWith('.') && x.startsWith(a))), fk + '/' + file + ' 양식에 없는 주소: ' + a);
    });
  });
  assert.deepEqual(G.FORMS['cci-seosan'].rounds, { min: 1, max: 10 });
  assert.deepEqual(G.FORMS.techguard.rounds, { min: 1, max: 7 });
});
