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
const P = (inner, pp) => '<hp:p id="0" paraPrIDRef="' + (pp || 0) + '">' + inner + LS + '</hp:p>';
const RUN = (t, cp) => '<hp:run charPrIDRef="' + (cp || 0) + '"><hp:t>' + t + '</hp:t></hp:run>';
/* 칸 — 글 하나면 한 문단, 배열이면 여러 문단(지난 업체 글이 여러 문단으로 든 칸).
   문단 모양·글자 모양을 흉내 낼 때는 {t, pp, cp} (pp = paraPrIDRef, cp = charPrIDRef) */
const cell = (t) => '<hp:tc><hp:subList>' + (Array.isArray(t) ? t : [t]).map((x) => {
  const o = (x && typeof x === 'object') ? x : { t: x };
  return P(o.t == null ? '<hp:run charPrIDRef="' + (o.cp || 0) + '"/>' : RUN(o.t, o.cp), o.pp);
}).join('') + '</hp:subList><hp:cellAddr colAddr="0" rowAddr="0"/></hp:tc>';
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
  /* 문의(C4)·자문(C8) 칸은 원본처럼 «자동 번호» 문단 모양(29·30), 진단(C6)은 번호 없는 모양(23) */
  const pp = (n, ts) => ts.map((t) => ({ t, pp: n }));
  const 내용 = (old) => tblQ(0, '내 용', '상 담 분 야', '인사 노무관련', ['업  체', '문 의 내 용 /', '애 로 사 항'],
    old ? pp(29, ['지난 문의 하나', '지난 문의 둘 010-0000-0000']) : null, ['전 문 가', '진 단 의 견'],
    old ? pp(23, ['지난 진단 하나', '지난 진단 둘']) : null, '상담 / 자문내용', old ? pp(30, ['지난 자문 하나', '지난 자문 둘', '지난 자문 셋']) : null);
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
    tblQ(0, '요청사항 및 진단내용', [26, 26, 26].map((pp, i) => ({ t: '지난 요청 ' + '하둘셋'[i], pp }))),
    Q(RUN(' ')), Q(RUN('2024년   05월   10일')), Q(EMPTY), Q(PICRUN('')), Q(RUN('                                 경영상담역: 김 지 난  (서명)')),
    Q(EMPTY), Q(EMPTY), Q(RUN('서산상공회의소 귀중')),
    /* 결과 칸 — 글 든 문단은 «자동 번호» 모양(27), 뒤 빈 문단(P2~)은 번호 없는 모양(23) */
    tblQ(1, '상담 및 자문결과', [{ t: '지난 결과 하나', pp: 27 }, { t: '지난 결과 둘', pp: 27 }].concat([2, 3, 4, 5, 6, 7, 8].map(() => ({ t: null, pp: 23 })))));
}
/* 기술보호 별지11 — T0~T8 · P0~P18 (P15 1일차 일지 · P16 교육 일지 · P17 참석자 명단 · P18 ○일차 일지) */
const TECH_FIELD = ' 지원분야 (□ 사전예방, □ 스타트업) / 전문가(□ 변호사 □ 변리사 ■ 노무사)';
function techXml() {
  const 날짜 = '   년      월      일', 안내 = '위에서 파악한 문제점에 대한 구체적 자문 내용 명시';
  return SEC(
    Q(EMPTY), tblQ(0, '별지 11', null, ' 자문서식 (법률)'), Q(EMPTY), tblQ(0, '‘통합 기술보호지원반’법률 자문 완료보고서'),
    /* 안내 글자 모양: 파란 기울임 47·43 · 파랑 55 — 첫 지원일자 칸만 43, 나머지 6칸은 45 · 값 글자 모양 기준은 T8.C4(4) */
    tblQ(0, '1. 지원정보', '상담구분', TECH_FIELD, '기 업 명', '다라상사', '지원일자',
      '(1차)', '(2차)', '(3차)', '(4차)', '(5차)', '(6차)', '(7차)', { t: '1/1(월) ', cp: 43 },
      { cp: 45 }, { cp: 45 }, { cp: 45 }, { cp: 45 }, { cp: 45 }, { cp: 45 }),
    tblQ(0, '2. 자문내용', [{ cp: 47 }, { cp: 47 }, { t: '신청기업 자문 희망 내용에 따른 구체적 자문 내용 기술', cp: 47 }, { cp: 47 }, { cp: 47 }]),
    Q(EMPTY),
    tblQ(0, '3. 총 평', [{ cp: 43 }, { cp: 43 }, { cp: 43 }, { t: '기업 소개 작성 불필요', cp: 43 }, { t: '자문내용만 작성(지원 성과 등 구체적 기술)', cp: 43 }, { cp: 43 }]),
    Q(RUN('상기 내용과 같이 통합 기술보호지원반 사업 완료보고서를 제출합니다.')), Q(EMPTY),
    Q(RUN('                              신청기업  대 표 자 :              (서명/인)')),
    Q(PICRUN('                                   “    담 당 자 :              (서명/인)')),
    Q(RUN('                                        전 문 가 : 김 지 난     (서명/인)')), Q(EMPTY),
    Q(RUN(' 대·중소기업·농어업협력재단 귀중')),
    tblQ(1, '법률 자문 일지 (1일차)', '자문일', 날짜, null, null, '문제점·개선사항', null, '자문 내용', 안내),
    tblQ(1, '법률 교육 수행 일지 (○일차)', '강 의 일 자', null, '강 의 장 소', null),
    tblQ(1, '법률 교육 참석자 명단', '연번', '직  책', '이  름', '서  명'),
    tblQ(1, '            법률 자문 일지 (○일차) * 지원일수 만큼 작성', '자문일', 날짜, null, { cp: 4, pp: 4 }, '문제점·개선사항',
      { t: '3일간 기업 방문 시 파악한 문제점·개선필요사항 등 명시', cp: 47 }, '자문 내용', { t: 안내, cp: 47 }, '지원 성과', { cp: 55 }, '향후 계획', { cp: 55 }));
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

/* ── 모양 빌리기(like) — 2026-10-09 한글로 열어 보니 ──
 *   서산 칸 첫 문단이 «자동 번호» 모양이라 값 앞에 「1.」 이 붙고 베낀 장마다 「2.」「3.」 으로 이어졌다.
 *   기술보호 안내 칸의 파란 기울임이 값에 묻었고, 첫 지원일자 칸만 글자 모양이 달랐다.
 *   → 값 칸의 문단 모양·글자 모양을 «같은 문서의 기준 칸» 것으로 바꾼다(속성만 — 주소는 그대로). */
const ppAt = (xml, a) => /paraPrIDRef="(\d+)"/.exec(rawAt(xml, a))[1];
const cpsAt = (xml, a) => (rawAt(xml, a).match(/charPrIDRef="(\d+)"/g) || []).map((m) => m.slice(13, -1));

test('모양 빌리기 — 서산 칸은 번호 없는 문단 모양(23)으로, 베낀 장에도 번호 모양이 안 남는다', () => {
  const r = G.fillForm(seosanVisitXml(), 'cci-seosan', 'visit', report2(3));
  for (let k = 0; k < 3; k++) {
    const t = 'T' + (3 * k + 2);
    assert.equal(ppAt(r.xml, t + '.C4.P0'), '23', t + '.C4');
    assert.equal(ppAt(r.xml, t + '.C8.P0'), '23', t + '.C8');
    assert.equal(ppAt(r.xml, t + '.C6.P0'), '23', t + '.C6');
  }
  assert.doesNotMatch(r.xml, /paraPrIDRef="(29|30)"/, '자동 번호 모양이 남으면 「1.」「2.」 가 붙는다');
  const rr = G.fillForm(seosanReportXml(), 'cci-seosan', 'report', report2(3));
  assert.equal(ppAt(rr.xml, 'T3.C1.P0'), '23');
  assert.equal(ppAt(rr.xml, 'T4.C1.P0'), '23');
  assert.doesNotMatch(rr.xml, /paraPrIDRef="(26|27)"/);
  assert.deepEqual(rr.missing, []);
});

test('모양 빌리기 — 기술보호 값 칸은 안내 글자 모양(파란 기울임)을 버리고 기준 칸(4) 모양, 첫 지원일자 칸은 둘째 칸과 같게', () => {
  const r = G.fillForm(techXml(), 'techguard', 'main', report2(7));
  for (let t = 5; t <= 11; t++) ['C6', 'C8', 'C10', 'C12'].forEach((c) => {
    const a = 'T' + t + '.' + c + '.P0';
    assert.deepEqual([...new Set(cpsAt(r.xml, a))], ['4'], a);
    assert.equal(ppAt(r.xml, a), '4', a);
  });
  assert.deepEqual([...new Set(cpsAt(r.xml, 'T3.C1.P0'))], ['4']);
  assert.deepEqual([...new Set(cpsAt(r.xml, 'T4.C1.P0'))], ['4']);
  assert.doesNotMatch(r.xml, /charPrIDRef="(47|55|43)"/, '안내 글자 모양이 값에 남으면 안 된다');
  assert.deepEqual(cpsAt(r.xml, 'T2.C13.P0'), ['45']);
  assert.deepEqual(r.missing, []);
});

test('모양 빌리기 — like 없는 칸은 그대로(북부 결과 불변) · 기준 칸이 없으면 지어내지 않고 missing 으로 알린다', () => {
  const plain = G.fillForm(northXml(), 'cci-north', 'main', report());
  assert.deepEqual(plain.missing, []);
  /* 결과보고서의 결과 칸이 해마다 짧아져 기준 문단(T4.C1.P7)이 없는 경우 */
  const short = seosanReportXml().replace(/(<hp:p [^>]*paraPrIDRef="23">(?:(?!<\/hp:p>)[\s\S])*<\/hp:p>)+(?=<\/hp:subList>)/, '');
  const r = G.fillForm(short, 'cci-seosan', 'report', report2(3));
  assert.ok(r.missing.includes('like T4.C1.P7'), JSON.stringify(r.missing));
  assert.equal(ppAt(r.xml, 'T4.C1.P0'), '27', '기준이 없으면 모양은 원본 그대로(추측하지 않는다)');
  assert.equal(textAt(r.xml, 'T4.C1.P0').indexOf('자문 결과 첫줄'), 0, '값은 그대로 채운다');
});

test('missing — 해마다 바뀐 양식에서 지도 칸이 없으면 조용히 버리지 않고 알린다', () => {
  /* 기술보호 서식에서 일지 장(P18·T8)이 빠진 해 */
  const noJournal = techXml().replace(/<hp:p [^>]*pageBreak="1"><hp:run><hp:tbl><hp:tr><hp:tc><hp:subList><hp:p id="0" paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t> {12}법률 자문 일지[\s\S]*<\/hs:sec>$/, '</hs:sec>');
  assert.ok(!noJournal.includes('지원일수 만큼'), '검사 준비: 일지 장이 빠져야 한다');
  const r = G.fillForm(noJournal, 'techguard', 'main', report2(2));
  ['T8.C0.P0', 'T8.C2.P0', 'T8.C6.', 'T8.C12.'].forEach((a) => assert.ok(r.missing.includes(a), a + ' — ' + JSON.stringify(r.missing)));
  assert.ok(r.missing.includes('like T8.C4.P0'));
  assert.ok(!r.missing.includes('T2.C4.P0'), '있는 칸은 missing 이 아니다');
  assert.deepEqual(G.fillForm(seosanVisitXml(), 'cci-seosan', 'visit', report2(3)).missing, []);
});

/* ── 비즈니스지원단 현장클리닉 현장지도결과서(별지 14) (2026-10-12) ──
 * 합성 XML 은 2025.2.17 개정 운영지침 별지14 를 한글로 HWPX 변환한 양식의 «주소 꼴»(T0~T6 · 칸 차례 · 문단 차례)만 흉내 낸다.
 * 일정 칸 3개(T2) 는 «(수정 불가)»(시스템이 채우는 칸)·«(작성란)» 글자가 들어 있고, 큰 칸(T1·T3·T5)은 칸마다 다른 문단·글자 모양이다.
 * 값은 다라정밀·홍길동·이푸른(합성)이다 — 실제 양식 파일·고객사 이름은 저장소에 두지 않는다. */
const CL_LABEL = ['수행일자', '지원기업담당자', '수행시간', '현장수행시간'];
function clinicXml() {
  /* «(수정 불가)»·«(작성란)» 안내 칸은 실제 양식처럼 회색·가운데 맞춤 모양(문단 136 · 글자 152), 합계 칸은 글자 188 */
  const NB = { t: '(수정 불가)', pp: 136, cp: 152 }, WR = { t: '(작성란)', pp: 136, cp: 152 };
  const 일정 = (n, 일자라벨) => [String(n), 일자라벨, NB, '지원기업담당자', NB, '수행시간', NB,
    '현장수행시간', NB, ['수행내용', NB], '특이사항', WR];
  const 전후 = (n) => [String(n), null, null, '(파일첨부)'];
  return SEC(
    P(EMPTY), P(RUN('【별지 14】')), P(EMPTY), P(RUN('현장클리닉 현장지도결과서')), P(EMPTY), P(RUN('1. 현장클리닉 개요')), P(EMPTY),
    tbl('지원기업명', { t: null, pp: 140, cp: 65 }, ['지원기업 ', '담당자명'], null, '지원단 소속', null, '지원단 명', null, '분야', null,
      '총 수행일수', null, '테마', null, '수행 일자', null),
    P(EMPTY), P(RUN('2. 지원기업 애로사항 및 문제점')), P(EMPTY),
    tbl({ t: null, pp: 9, cp: 9 }),                                              // T1.C0 — 큰 칸(기준과 다른 모양)
    P(EMPTY), P(EMPTY), P(RUN('3. 현장클리닉 일정별 수행 내역(수행계획서 작성내용) 및 특이사항')), P(EMPTY),
    tbl('번호', '수행내역', ...일정(1, CL_LABEL[0]), ...일정(2, CL_LABEL[0]), ...일정(3, '수행 일자'),
      '총 수행시간', { t: '00시간 00분', pp: 136, cp: 188 }, '현장 수행시간', { t: '00시간 00분(  %)', pp: 136, cp: 188 }),
    P(EMPTY), P(RUN('4. 현장클리닉 수행 내용(상세입력)')), P(EMPTY),
    tbl('구분', '수행내용', ['기업', '현황'], { t: null, pp: 23, cp: 7 }, ['문제', '진단'], { t: null, pp: 11, cp: 11 },
      ['처방', '내용'], { t: null, pp: 11, cp: 11 }),                              // T3.C3 = 기준 칸(23·7)
    P(RUN('5. 현장클리닉 결과 및 성과(현장클리닉 전후 비교)')), P(EMPTY),
    tbl('순번', '현장클리닉 전(개선 전)', '현장클리닉 후(개선 후)', '산출물(필수)', ...전후(1), ...전후(2), ...전후(3), ...전후(4)),
    P(EMPTY), P(RUN('6. 향후 추진사항 및 성과추적관리 방안')), P(EMPTY),
    tbl({ t: null, pp: 9, cp: 9 }),                                              // T5.C0
    P(EMPTY), P(RUN('7. 첨부파일(필수사항-시스템기재 내용 보완을 위한 별도의 현장지도결과서 제출용)')), P(EMPTY), P(RUN('8. 작성기준')),
    tbl(['1. 현장지도결과서 작성 기준', ' ○ 수행계획서의 내용을 충실히 반영', '  - 기업 애로 해결 과정을 논리적으로 기록한 완결된 보고서를 제출해야 하며']),
    P(RUN('* 70점 미만인 경우 지침 29조에 의거 현장클리닉 취소 및 사업비 미지급 예정이오니 유의하시기 바랍니다.')));
}
/* 회차 n 개(날짜는 일부러 뒤섞어 둔다 — 날짜 순으로 써야 한다) */
function clinicReport(n, over) {
  const r = report2(n);
  r.company = Object.assign({}, r.company, { name: '다라정밀' });
  r.field = '노무'; r.consultantOrg = '푸른노무법인';
  r.summary = { theme: '취업규칙 정비', inquiryDiag: '애로 첫줄\n애로 둘째줄', status: '제조업 12명', diag: '연장근로 규정 미비', remedy: '개정안 제시',
    effects: '규정 없음 → 규정 신설\n연차 관리 수기 → 전산 관리', followUp: '반기 점검' };
  return Object.assign(r, over || {});
}
const CLINIC_TOKS = ['업체명', '담당자', '소속', '지원단명', '분야', '총수행일수', '테마', '수행일자목록', '애로사항',
  '일자1', '담당1', '시간1', '현장시간1', '내용1', '특이1', '일자2', '담당2', '시간2', '현장시간2', '내용2', '특이2',
  '일자3', '담당3', '시간3', '현장시간3', '내용3', '특이3', '총시간', '총현장시간', '기업현황', '문제진단', '처방내용',
  '전1', '후1', '산출1', '전2', '후2', '산출2', '전3', '후3', '산출3', '전4', '후4', '산출4', '향후'];
const clAddrs = (xml) => X.scan(xml).map((p) => p.addr);
const clRuleAddr = (r) => r.at || r.cell || r.drop;
const clHas = (addrs, a) => addrs.some((x) => x === a || (a.endsWith('.') && x.startsWith(a)));

test('현장클리닉 — FORMS.clinic 모양 · 표지 목록이 지도와 같고 겹치지 않는다', () => {
  const f = G.FORMS.clinic;
  assert.ok(f && f.files.main);
  assert.equal(f.name, '비즈니스지원단 현장클리닉 현장지도결과서(별지 14)');
  assert.equal(f.agency, '중소벤처기업부 비즈니스지원단');
  assert.deepEqual(f.rounds, { min: 1, max: 3 });
  assert.deepEqual(Object.keys(f.files), ['main', 'plan']);
  const toks = f.files.main.set.map((r) => r.tok);
  assert.deepEqual(toks, CLINIC_TOKS);
  assert.equal(new Set(toks).size, toks.length, '같은 표지를 두 칸에 쓰면 한 값이 두 번 들어간다');
});

test('현장클리닉 — 지도의 주소가 합성 양식에 실제로 있고, 표지가 칸마다 한 번씩 박힌다 (검사가 헛돌지 않는다는 보증)', () => {
  const xml = clinicXml(), addrs = clAddrs(xml);
  /* 합성 양식이 실제 별지14 꼴인지 — 지도가 가리키는 칸 + «(수정 불가)»/«(작성란)» 자리 */
  assert.equal(textAt(xml, 'T2.C4.P0'), '(수정 불가)');
  assert.equal(textAt(xml, 'T2.C11.P1'), '(수정 불가)');
  assert.equal(textAt(xml, 'T2.C13.P0'), '(작성란)');
  assert.equal(textAt(xml, 'T2.C41.P0'), '00시간 00분(  %)');
  assert.equal(textAt(xml, 'T0.C15.P0'), '');
  assert.equal(textAt(xml, 'T4.C18.P0'), '');
  assert.equal(textAt(xml, 'T5.C0.P0'), '');
  const rules = G.FORMS.clinic.files.main.set;
  rules.forEach((r) => assert.ok(clHas(addrs, clRuleAddr(r)), '양식에 없는 주소: ' + clRuleAddr(r)));
  rules.forEach((r) => { if (r.like) assert.ok(addrs.includes(r.like), '양식에 없는 기준 칸: ' + r.like); });
  /* 기준 칸은 지도 자신의 값 칸이어야 한다(안내 글자 칸·이름표 칸을 기준 삼으면 회색·가운데 맞춤이 번진다) */
  const own = rules.map((r) => (r.cell ? r.cell + 'P0' : r.at));
  [...new Set(rules.filter((r) => r.like).map((r) => r.like))].forEach((a) => assert.ok(own.includes(a), '기준 칸이 지도의 값 칸이 아니다: ' + a));
  assert.deepEqual([...new Set(rules.filter((r) => r.like).map((r) => r.like))].sort(), ['T0.C1.P0', 'T3.C3.P0']);
  const tk = G.tokenize(xml, 'clinic', 'main');
  CLINIC_TOKS.forEach((t) => assert.equal(tk.split('{{' + t + '}}').length - 1, 1, '표지 {{' + t + '}} 가 한 번씩 박혀야 한다'));
  /* 헛돌지 않는다 — 칸이 없는 양식으로 바꾸면 검사가 실제로 알린다 */
  const noT4 = xml.replace(/<hp:p [^>]*><hp:run><hp:tbl><hp:tr>(?:(?!<\/hp:tbl>)[\s\S])*순번[\s\S]*?<\/hp:tbl><\/hp:run>[\s\S]*?<\/hp:p>/, '');
  assert.notEqual(noT4, xml, '검사 준비: 전후 비교 표가 빠져야 한다');
  const bad = G.fillForm(noT4, 'clinic', 'main', clinicReport(3));
  assert.ok(bad.missing.length > 0, '칸이 빠진 양식인데 missing 이 비면 검사가 헛도는 것이다');
});

test('현장클리닉 — 회차 3개: 값이 제 칸에 들어가고 «(수정 불가)»·«(작성란)» 글자가 남지 않는다', () => {
  const xml = clinicXml();
  const r = G.fillForm(xml, 'clinic', 'main', clinicReport(3));
  assert.deepEqual(r.missing, []); assert.deepEqual(r.unknown, []); assert.deepEqual(r.left, []);
  assert.equal(r.short, null); assert.equal(r.over, null);
  assert.doesNotMatch(r.xml, /{{|}}/);
  assert.ok(!textAll(r.xml).includes('(수정 불가)'), '«(수정 불가)» 글자가 남았다');
  assert.ok(!textAll(r.xml).includes('(작성란)'), '«(작성란)» 글자가 남았다');
  assert.ok(!textAll(r.xml).includes('00시간 00분'), '시스템 자리표시 글자가 남았다');
  /* 1. 개요 */
  assert.equal(textAt(r.xml, 'T0.C1.P0'), '다라정밀');
  assert.equal(textAt(r.xml, 'T0.C3.P0'), '홍길동');
  assert.equal(textAt(r.xml, 'T0.C5.P0'), '푸른노무법인');
  assert.equal(textAt(r.xml, 'T0.C7.P0'), '이푸른');
  assert.equal(textAt(r.xml, 'T0.C9.P0'), '노무');
  assert.equal(textAt(r.xml, 'T0.C11.P0'), '3일');
  assert.equal(textAt(r.xml, 'T0.C13.P0'), '취업규칙 정비');
  assert.equal(textAt(r.xml, 'T0.C15.P0'), '2025.04.16, 2025.05.07, 2025.06.11', '날짜 순');
  assert.match(rawAt(r.xml, 'T1.C0.P0'), /애로 첫줄<hp:lineBreak\/>애로 둘째줄/);
  /* 3. 일정 3칸 — 회차는 날짜 순(04-16 → 05-07 → 06-11) */
  [['C4', '2025.04.16'], ['C16', '2025.05.07'], ['C28', '2025.06.11']].forEach(([c, d]) => assert.equal(textAt(r.xml, 'T2.' + c + '.P0'), d, c));
  ['C6', 'C18', 'C30'].forEach((c) => assert.equal(textAt(r.xml, 'T2.' + c + '.P0'), '홍길동', c));
  ['C8', 'C10', 'C20', 'C22', 'C32', 'C34', 'C13', 'C25', 'C37', 'C39', 'C41'].forEach((c) =>
    assert.equal(textAt(r.xml, 'T2.' + c + '.P0'), ' ', 'T2.' + c + ' — 보고서에 없는 값은 지어내지 않고 빈칸(밑줄 아님)'));
  assert.match(rawAt(r.xml, 'T2.C11.P1'), /문의: 문의2025-04-16<hp:lineBreak\/>진단: 진단2025-04-16<hp:lineBreak\/>자문: 자문2025-04-16<hp:lineBreak\/>성과: 성과2025-04-16<hp:lineBreak\/>향후: 향후2025-04-16/);
  assert.ok(textAt(r.xml, 'T2.C23.P1').startsWith('문의: 문의2025-05-07'));
  assert.ok(textAt(r.xml, 'T2.C35.P1').startsWith('문의: 문의2025-06-11'));
  /* 4. 수행 내용 */
  assert.equal(textAt(r.xml, 'T3.C3.P0'), '제조업 12명');
  assert.equal(textAt(r.xml, 'T3.C5.P0'), '연장근로 규정 미비');
  assert.equal(textAt(r.xml, 'T3.C7.P0'), '개정안 제시');
  assert.equal(textAt(r.xml, 'T5.C0.P0'), '반기 점검');
  /* 원본 이름표·제목·작성기준·산출물 안내는 그대로, 문단 수도 그대로 */
  ['【별지 14】', '현장클리닉 현장지도결과서', '지원기업명', '지원단 소속', '번호', '수행내역', '수행일자', '지원기업담당자', '수행시간', '현장수행시간',
    '수행내용', '특이사항', '총 수행시간', '현장 수행시간', '구분', '순번', '산출물(필수)', '1. 현장지도결과서 작성 기준']
    .forEach((t) => assert.ok(X.scan(r.xml).some((p) => p.text === t), '원본 글이 사라짐: ' + t));
  assert.equal(count(r.xml, '(파일첨부)'), 0, '산출물 칸의 «(파일첨부)» 글자가 남았다');
  assert.equal(textAt(r.xml, 'T4.C7.P0'), ' ', '산출물 값이 없으면 빈칸');
  assert.equal(X.scan(r.xml).length, X.scan(xml).length, '문단 수가 바뀌면 안 된다');
  assert.equal(count(r.xml, '2. 지원기업 애로사항 및 문제점'), 1);
});

test('현장클리닉 — 모양 빌리기: 큰 칸(애로사항·문제진단·처방내용·향후)은 기업현황 칸(T3.C3)의 문단·글자 모양', () => {
  const r = G.fillForm(clinicXml(), 'clinic', 'main', clinicReport(3));
  ['T1.C0.P0', 'T3.C3.P0', 'T3.C5.P0', 'T3.C7.P0', 'T5.C0.P0'].forEach((a) => {
    assert.equal(ppAt(r.xml, a), '23', a);
    assert.deepEqual([...new Set(cpsAt(r.xml, a))], ['7'], a);
  });
  assert.deepEqual(r.missing, []);
  /* 기준 칸(T3.C3.P0)이 없으면 지어내지 않고 missing 으로 알린다 */
  const noRef = clinicXml().replace(/<hp:p [^>]*paraPrIDRef="23">(?:(?!<\/hp:p>)[\s\S])*<\/hp:p>/, '');
  const r2 = G.fillForm(noRef, 'clinic', 'main', clinicReport(3));
  assert.ok(r2.missing.includes('like T3.C3.P0'), JSON.stringify(r2.missing));
});

test('현장클리닉 — 일정 칸 값은 «(수정 불가)» 안내 글자 모양(회색·가운데)을 버리고 개요 값 칸(140·65)·큰 칸(23·7) 모양', () => {
  const xml = clinicXml();
  assert.equal(ppAt(xml, 'T2.C4.P0'), '136'); assert.deepEqual(cpsAt(xml, 'T2.C4.P0'), ['152'], '검사 준비: 원본 칸이 안내 모양이어야 한다');
  for (const n of [0, 1, 3]) {
    const r = G.fillForm(xml, 'clinic', 'main', clinicReport(n));
    assert.deepEqual(r.missing, [], '회차 ' + n);
    for (let k = 0; k < 3; k++) {
      [4, 6, 8, 10].forEach((c) => { const a = 'T2.C' + (12 * k + c) + '.P0'; assert.equal(ppAt(r.xml, a), '140', a); assert.deepEqual([...new Set(cpsAt(r.xml, a))], ['65'], a); });
      ['T2.C' + (12 * k + 11) + '.P1', 'T2.C' + (12 * k + 13) + '.P0'].forEach((a) => {
        assert.equal(ppAt(r.xml, a), '23', a); assert.deepEqual([...new Set(cpsAt(r.xml, a))], ['7'], a);
      });
    }
    ['T2.C39.P0', 'T2.C41.P0'].forEach((a) => { assert.equal(ppAt(r.xml, a), '140', a); assert.deepEqual([...new Set(cpsAt(r.xml, a))], ['65'], a); });
    assert.doesNotMatch(r.xml, /paraPrIDRef="136"|charPrIDRef="(152|188)"/, '안내·자리표시 글자 모양이 값에 남았다');
    /* 이름표 칸은 그대로 */
    assert.equal(ppAt(r.xml, 'T2.C3.P0'), '0'); assert.equal(textAt(r.xml, 'T2.C3.P0'), '수행일자');
    assert.equal(textAt(r.xml, 'T2.C11.P0'), '수행내용');
  }
  /* 기준 칸(개요 값 칸 T0.C1.P0)이 없으면 지어내지 않고 missing 으로 알린다 */
  const noRef = xml.replace(/<hp:p [^>]*paraPrIDRef="140">(?:(?!<\/hp:p>)[\s\S])*<\/hp:p>/, '');
  assert.notEqual(noRef, xml);
  assert.ok(G.fillForm(noRef, 'clinic', 'main', clinicReport(3)).missing.includes('like T0.C1.P0'));
});

test('현장클리닉 — 회차 0·1·2개: 안 쓴 일정 칸은 빈칸 한 칸(밑줄·옛 글자 아님), 모자람 알림', () => {
  /* 일정 칸 k(0~2)의 값 칸 = 첫 칸 번호 + 12k — 일자 4 · 담당 6 · 시간 8 · 현장시간 10 · 특이 13 (수행내용은 C11 의 둘째 문단) */
  const empty = (xml, n) => {
    for (let k = n; k < 3; k++) {
      [4, 6, 8, 10, 13].forEach((c) => assert.equal(textAt(xml, 'T2.C' + (12 * k + c) + '.P0'), ' ', 'T2.C' + (12 * k + c) + ' (일정 ' + (k + 1) + ')'));
      assert.equal(textAt(xml, 'T2.C' + (12 * k + 11) + '.P1'), ' ', '수행내용 ' + (k + 1));
    }
  };
  const clean = (r) => {
    assert.deepEqual(r.left, []); assert.deepEqual(r.unknown, []); assert.deepEqual(r.missing, []);
    assert.ok(!textAll(r.xml).includes('(수정 불가)')); assert.ok(!textAll(r.xml).includes('(작성란)'));
  };
  const r0 = G.fillForm(clinicXml(), 'clinic', 'main', clinicReport(0));
  clean(r0); empty(r0.xml, 0);
  assert.deepEqual(r0.short, { need: 1, have: 0 });
  assert.equal(textAt(r0.xml, 'T0.C11.P0'), X.BLANK, '회차가 없으면 총 수행일수는 모르는 값 — 밑줄');
  assert.equal(textAt(r0.xml, 'T0.C15.P0'), X.BLANK);
  const r1 = G.fillForm(clinicXml(), 'clinic', 'main', clinicReport(1));
  clean(r1); empty(r1.xml, 1);
  assert.equal(r1.short, null);
  assert.equal(textAt(r1.xml, 'T0.C11.P0'), '1일');
  assert.equal(textAt(r1.xml, 'T0.C15.P0'), '2025.06.11');
  assert.equal(textAt(r1.xml, 'T2.C4.P0'), '2025.06.11');
  assert.equal(textAt(r1.xml, 'T2.C6.P0'), '홍길동');
  assert.equal(textAt(r1.xml, 'T2.C16.P0'), ' ');
  const r2 = G.fillForm(clinicXml(), 'clinic', 'main', clinicReport(2));
  clean(r2); empty(r2.xml, 2);
  assert.equal(textAt(r2.xml, 'T0.C11.P0'), '2일');
  assert.equal(textAt(r2.xml, 'T2.C16.P0'), '2025.06.11', '둘 중 날짜 순 — 04-16 이 먼저, 06-11 이 둘째');
  assert.equal(textAt(r2.xml, 'T2.C4.P0'), '2025.04.16');
  assert.equal(textAt(r2.xml, 'T2.C28.P0'), ' ');
  assert.equal(textAt(r2.xml, 'T2.C35.P1'), ' ');
});

test('현장클리닉 — 회차 4개는 셋째까지만 쓰고 넘침을 알린다 (넷째가 조용히 사라지지 않는다)', () => {
  const rp = clinicReport(3);
  rp.rounds.push({ date: '2025-08-14', visit: true, inquiry: '넷째 문의', diagnosis: '', advice: '', result: '', next: '' });
  const r = G.fillForm(clinicXml(), 'clinic', 'main', rp);
  assert.deepEqual(r.over, { max: 3, have: 4 });
  assert.deepEqual(r.left, []); assert.deepEqual(r.unknown, []); assert.deepEqual(r.missing, []);
  assert.ok(!textAll(r.xml).includes('넷째 문의'), '양식 한도(3)까지만 쓴다');
  assert.ok(!textAll(r.xml).includes('2025.08.14'));
  assert.equal(textAt(r.xml, 'T0.C11.P0'), '3일');
  assert.equal(textAt(r.xml, 'T0.C15.P0'), '2025.04.16, 2025.05.07, 2025.06.11');
});

test('현장클리닉 — 전후 비교 4행: 줄 4개·2개·«→» 없는 줄·5줄(초과는 무시)·없음', () => {
  const eff = (effects) => G.fillForm(clinicXml(), 'clinic', 'main', clinicReport(3, { summary: Object.assign(clinicReport(3).summary, { effects }) }));
  const row = (r, k) => [textAt(r.xml, 'T4.C' + (4 * k + 5) + '.P0'), textAt(r.xml, 'T4.C' + (4 * k + 6) + '.P0')];
  const out = (r, k) => textAt(r.xml, 'T4.C' + (4 * k + 7) + '.P0');
  let r = eff('가1 → 나1\n가2 → 나2\n가3 → 나3\n가4 → 나4');
  assert.deepEqual([0, 1, 2, 3].map((k) => row(r, k)), [['가1', '나1'], ['가2', '나2'], ['가3', '나3'], ['가4', '나4']]);
  assert.deepEqual(r.left, []); assert.deepEqual(r.unknown, []); assert.deepEqual(r.missing, []);
  r = eff('가1 → 나1\r\n  가2→나2  \r\n');
  assert.deepEqual([0, 1].map((k) => row(r, k)), [['가1', '나1'], ['가2', '나2']], 'CRLF·공백 정리');
  assert.deepEqual([2, 3].map((k) => row(r, k)), [[' ', ' '], [' ', ' ']], '줄이 없는 행은 빈칸 한 칸 — 밑줄이 아니다');
  assert.deepEqual(r.left, []);
  r = eff('개선 전만 적은 줄\n\n가2 → 나2 → 나3');
  assert.deepEqual(row(r, 0), ['개선 전만 적은 줄', ' '], '«→» 가 없으면 «전» 에만 넣고 «후» 는 빈칸');
  assert.deepEqual(row(r, 1), ['가2', '나2'], '첫 «→» 에서 나눈다(빈 줄은 건너뜀)');
  assert.equal(out(r, 0), ' ');
  assert.equal(out(r, 1), '나3', '둘째 «→» 뒤는 산출물');
  r = eff('1 → 가\n2 → 나\n3 → 다\n4 → 라\n다섯째줄 → 여섯째줄');
  assert.deepEqual([0, 1, 2, 3].map((k) => row(r, k)), [['1', '가'], ['2', '나'], ['3', '다'], ['4', '라']]);
  assert.ok(!textAll(r.xml).includes('다섯째줄'), '5째 줄은 양식에 칸이 없다 — 무시');
  assert.equal(X.scan(r.xml).length, X.scan(clinicXml()).length);
  r = eff(undefined);
  assert.deepEqual([0, 1, 2, 3].map((k) => row(r, k)), [[' ', ' '], [' ', ' '], [' ', ' '], [' ', ' ']]);
  assert.deepEqual(r.left, []);
  r = eff('→ 후만\n전만 →');
  assert.deepEqual(row(r, 0), [' ', '후만'], '전이 비면 빈칸');
  assert.deepEqual(row(r, 1), ['전만', ' '], '후가 비면 빈칸');
});

test('현장클리닉 — 전후 비교 줄은 «개선 전 → 개선 후 → 산출물» 셋까지, 산출물 칸의 «(파일첨부)» 는 남지 않는다', () => {
  const eff = (effects) => G.fillForm(clinicXml(), 'clinic', 'main', clinicReport(3, { summary: Object.assign(clinicReport(3).summary, { effects }) }));
  const cells = (r, k) => [5, 6, 7].map((o) => textAt(r.xml, 'T4.C' + (4 * k + o) + '.P0'));
  let r = eff('규정 없음 → 규정 신설 → 취업규칙.hwp\n수기 → 전산\n수기만\n전 → 후 → 산출 → 더');
  assert.deepEqual(cells(r, 0), ['규정 없음', '규정 신설', '취업규칙.hwp'], '3쪽');
  assert.deepEqual(cells(r, 1), ['수기', '전산', ' '], '2쪽 — 산출물은 빈칸(밑줄 아님)');
  assert.deepEqual(cells(r, 2), ['수기만', ' ', ' '], '1쪽');
  assert.deepEqual(cells(r, 3), ['전', '후', '산출 → 더'], '둘째 구분 뒤는 모두 산출물');
  assert.deepEqual(r.left, []); assert.deepEqual(r.unknown, []); assert.deepEqual(r.missing, []);
  assert.ok(!textAll(r.xml).includes('(파일첨부)'), '(파일첨부) 가 남았다');
  assert.equal(X.scan(r.xml).length, X.scan(clinicXml()).length);
  r = eff(undefined);
  [0, 1, 2, 3].forEach((k) => assert.deepEqual(cells(r, k), [' ', ' ', ' ']));
  assert.ok(!textAll(r.xml).includes('(파일첨부)'));
  r = eff('→ → 산출만');
  assert.deepEqual(cells(r, 0), [' ', ' ', '산출만']);
});

test('현장클리닉 — 전후 비교 구분은 «→» «->» «=>» 모두(공백 있든 없든), 섞어 써도 된다', () => {
  const eff = (effects) => G.fillForm(clinicXml(), 'clinic', 'main', clinicReport(3, { summary: Object.assign(clinicReport(3).summary, { effects }) }));
  const cells = (r, k) => [5, 6, 7].map((o) => textAt(r.xml, 'T4.C' + (4 * k + o) + '.P0'));
  let r = eff('가1 -> 나1\n가2=>나2\n가3->나3=>다3\n가4 → 나4 -> 다4');
  assert.deepEqual([0, 1, 2, 3].map((k) => cells(r, k)),
    [['가1', '나1', ' '], ['가2', '나2', ' '], ['가3', '나3', '다3'], ['가4', '나4', '다4']]);
  assert.deepEqual(r.left, []); assert.deepEqual(r.missing, []);
  r = eff('구분 없는 한 줄(예: 주 5일 근무)');
  assert.deepEqual(cells(r, 0), ['구분 없는 한 줄(예: 주 5일 근무)', ' ', ' '], '구분이 없으면 전체가 «전», 후·산출물은 빈칸');
  const V = G.buildValues({ summary: { effects: 'a->b' } }, 'clinic');
  assert.equal(V['전1'], 'a'); assert.equal(V['후1'], 'b'); assert.equal(V['산출1'], ' ');
});

test('현장클리닉 — 총수행일수는 «서로 다른 날» 수, 수행일자목록은 같은 날을 한 번만 · 일정 칸은 회차마다', () => {
  const rp = clinicReport(3);
  rp.rounds = [{ date: '2025-04-16', inquiry: '오전' }, { date: '2025-04-16', inquiry: '오후' }];
  let r = G.fillForm(clinicXml(), 'clinic', 'main', rp);
  assert.equal(textAt(r.xml, 'T0.C11.P0'), '1일', '같은 날 두 회차는 1일');
  assert.equal(textAt(r.xml, 'T0.C15.P0'), '2025.04.16', '같은 날은 한 번만');
  assert.equal(textAt(r.xml, 'T2.C4.P0'), '2025.04.16'); assert.equal(textAt(r.xml, 'T2.C16.P0'), '2025.04.16', '일정 칸은 회차마다');
  assert.ok(textAt(r.xml, 'T2.C23.P1').includes('오후'));
  assert.deepEqual(r.left, []); assert.deepEqual(r.missing, []);
  rp.rounds = [{ date: '2025-06-11' }, { date: '2025-04-16' }, { date: '2025-04-16' }];
  r = G.fillForm(clinicXml(), 'clinic', 'main', rp);
  assert.equal(textAt(r.xml, 'T0.C11.P0'), '2일');
  assert.equal(textAt(r.xml, 'T0.C15.P0'), '2025.04.16, 2025.06.11', '날짜 순으로 한 번씩');
  rp.rounds = [{ date: '2025-02-30' }];
  assert.equal(textAt(G.fillForm(clinicXml(), 'clinic', 'main', rp).xml, 'T0.C11.P0'), X.BLANK, '있을 수 없는 날짜만 있으면 모르는 값 — 밑줄');
});

test('현장클리닉 — 전후 비교가 4줄을 넘으면 effectsOver 로 알린다(조용히 빠지지 않는다)', () => {
  const eff = (effects) => G.fillForm(clinicXml(), 'clinic', 'main', clinicReport(3, { summary: Object.assign(clinicReport(3).summary, { effects }) }));
  assert.deepEqual(eff('1 → a\n2 → b\n3 → c\n4 → d\n5 → e\n\n6 → f').effectsOver, { max: 4, have: 6 });
  assert.equal(eff('1 → a\n2 → b\n3 → c\n4 → d').effectsOver, null);
  assert.equal(eff('').effectsOver, null);
  assert.equal(eff(undefined).effectsOver, null);
  assert.equal(G.fillForm(northXml(), 'cci-north', 'main', report()).effectsOver, null, '다른 양식은 이 알림이 없다');
});

test('현장클리닉 — 비어 있는 값은 밑줄(모르는 값), 시간 칸은 빈칸(보고서에 없다)', () => {
  const rp = clinicReport(3); rp.summary = {}; rp.company = {}; rp.consultantOrg = ''; delete rp.field; delete rp.consultant;
  const r = G.fillForm(clinicXml(), 'clinic', 'main', rp);
  assert.deepEqual(r.left, []); assert.deepEqual(r.unknown, []); assert.deepEqual(r.missing, []);
  ['T0.C1.P0', 'T0.C3.P0', 'T0.C5.P0', 'T0.C7.P0', 'T0.C9.P0', 'T0.C13.P0', 'T1.C0.P0', 'T3.C3.P0', 'T3.C5.P0', 'T3.C7.P0', 'T5.C0.P0']
    .forEach((a) => assert.equal(textAt(r.xml, a), X.BLANK, a + ' — 모르는 값은 밑줄(지어내지 않는다)'));
  assert.equal(textAt(r.xml, 'T2.C6.P0'), X.BLANK, '담당자 이름을 모르면 밑줄');
  assert.equal(textAt(r.xml, 'T2.C8.P0'), ' ');
  assert.equal(textAt(r.xml, 'T4.C5.P0'), ' ');
});

/* ── 현장클리닉 수행계획서(별지 11) (2026-10-12) ──
 * 합성 XML — 별지11 을 한글로 변환한 단독 양식의 «주소 꼴»(T0 한 표, 칸 C0~C76)만 흉내 낸다. 애로사항 칸(C21)은 « ①»·« ②»·« ③» 세 문단,
 * 일정 칸 날짜는 «월   일»(공백 셋), 체크 칸(C64·C71·C74)·서명줄(C76)은 원문 그대로 남아야 하는 자리다. 값은 다라정밀·홍길동(합성). */
function planXml() {
  const 일정 = () => ['월   일', null, null, null, null, null, null, null];
  const cells = ['지원기업명', null, '추천 분야', '세분류', '세세분류', '지원 분야', '세분류', '세세분류', '업종(업태)', null, '주 생산품', null,
    '지원기업 담당자명', null, '직 위', null, '회사전화번호', null, '휴대폰', null, '애로사항', [' ①', ' ②', ' ③'],
    ['테마', '(진단결과 해결과제)'], null, '계약금액', null, ['추천', 'MD'], null, '지원일수', null, '지원단 소속', null, '지원단 명', null,
    '자문내용', '일정', ['유형', '(현장/자료조사)'], '내용', '예상산출물', ...일정(), ...일정(), ...일정(),
    ['추천 MD ', '준수 여부'], '  □Yes     □No', ['추천 MD ', '초과사유'], null, '지원기업사업자등록증 사본', null, ['3일 초과', '지원대상 확인'],
    '수출기업', ' □Yes     □No', '(Yes-첨부파일 필수)', '창업기업', ' □Yes     □No', '(Yes-첨부파일 필수)',
    ['  상기와 같이 20  년도 중소기업지원 비즈니스지원단 현장클리닉사업 수행계획서를 제출합니다. ', null, '년    월    일 ',
      '지원단 명 :         (서명 또는 인)지원기업명 :         (서명 또는 인)', null, '중소벤처기업부장관 귀하']];
  return SEC(P(EMPTY), P(RUN('【별지 11】')), P(RUN('현장클리닉 수행 계획서')), P(EMPTY), tbl(...cells));
}
const PLAN_ALL = [{ at: 'T0.C1.P0', tok: '업체명' }, { at: 'T0.C9.P0', tok: '업종' }, { at: 'T0.C13.P0', tok: '담당자' }, { at: 'T0.C15.P0', tok: '직위' },
  { at: 'T0.C17.P0', tok: '전화' }, { at: 'T0.C21.P0', tok: '애로1' }, { at: 'T0.C21.P1', tok: '애로2' }, { at: 'T0.C21.P2', tok: '애로3' },
  { at: 'T0.C23.P0', tok: '테마' }, { at: 'T0.C29.P0', tok: '지원일수' }, { at: 'T0.C31.P0', tok: '소속' }, { at: 'T0.C33.P0', tok: '지원단명' }];
for (let k = 0; k < 3; k++) {
  const b = 39 + 8 * k, n = k + 1;
  PLAN_ALL.push({ at: 'T0.C' + b + '.P0', tok: '계획일' + n }, { at: 'T0.C' + (b + 1) + '.P0', tok: '계획유형' + n });
  ['a', 'b', 'c'].forEach((x, i) => PLAN_ALL.push({ at: 'T0.C' + (b + 2 + 2 * i) + '.P0', tok: '계획내용' + n + x }, { at: 'T0.C' + (b + 3 + 2 * i) + '.P0', tok: '계획산출' + n + x }));
}
const planReport = (n, over) => {
  const r = clinicReport(n, over);
  r.company = Object.assign({}, r.company, { bizType: '금속가공', contactTitle: '총무팀 대리', tel: '041-000-0000' });
  r.summary.inquiryDiag = '애로 첫 줄\n애로 둘째 줄\n애로 셋째 줄';
  return r;
};
const planFill = (rp, xml) => G.fillForm(xml || planXml(), 'clinic', 'plan', rp);
const planClean = (r) => { assert.deepEqual(r.missing, []); assert.deepEqual(r.unknown, []); assert.deepEqual(r.left, []); assert.doesNotMatch(r.xml, /{{|}}/); };

test('수행계획서 — FORMS.clinic.files.plan 지도가 위 계획과 같고 별지14 와는 공통 표지 이름뿐', () => {
  const f = G.FORMS.clinic;
  assert.deepEqual(f.files.plan.set, PLAN_ALL);
  const pt = f.files.plan.set.map((r) => r.tok);
  assert.equal(new Set(pt).size, pt.length, '같은 표지를 두 칸에 쓰면 한 값이 두 번 들어간다');
  assert.deepEqual(pt.filter((t) => CLINIC_TOKS.includes(t)).sort(), ['담당자', '소속', '업체명', '지원단명', '테마']);
  assert.deepEqual(f.rounds, { min: 1, max: 3 }, '회차 한도는 그대로');
  assert.deepEqual(f.files.main.set.map((r) => r.tok), CLINIC_TOKS, '별지14 지도는 그대로');
  /* 지도 주소가 합성 양식에 있고 표지가 칸마다 한 번씩 박힌다 */
  const xml = planXml(), addrs = clAddrs(xml);
  f.files.plan.set.forEach((r) => assert.ok(clHas(addrs, clRuleAddr(r)), '양식에 없는 주소: ' + clRuleAddr(r)));
  assert.equal(textAt(xml, 'T0.C39.P0'), '월   일'); assert.equal(textAt(xml, 'T0.C21.P1'), ' ②');
  const tk = G.tokenize(xml, 'clinic', 'plan');
  pt.forEach((t) => assert.equal(tk.split('{{' + t + '}}').length - 1, 1, '표지 {{' + t + '}} 가 한 번씩 박혀야 한다'));
  /* 헛돌지 않는다 — 일정 묶음 하나가 빠진 양식이면 검사가 실제로 알린다 */
  const noTbl = SEC(P(EMPTY), P(RUN('【별지 11】')));
  assert.ok(planFill(planReport(3), noTbl).missing.length > 0, '칸이 빠진 양식인데 missing 이 비면 검사가 헛도는 것이다');
});

test('수행계획서 — 회차 3개: 값이 제 칸에 들어가고 «월   일»·애로 «①»·원문 이름표는 그대로/채워진다', () => {
  const rp = planReport(3);
  rp.rounds.forEach((r, i) => { r.visit = [true, false, undefined][i]; });          // 입력 차례 06-11(현장) · 04-16(자료조사) · 05-07(모름)
  rp.rounds[0].advice = ''; rp.rounds[0].diagnosis = '진단만';                      // 06-11 — 자문 없으면 진단으로
  rp.rounds[2].advice = ''; rp.rounds[2].diagnosis = ''; rp.rounds[2].inquiry = '문의만'; // 05-07 — 진단도 없으면 문의
  const xml = planXml(), r = planFill(rp, xml);
  planClean(r); assert.equal(r.short, null); assert.equal(r.over, null);
  assert.equal(textAt(r.xml, 'T0.C1.P0'), '다라정밀');
  assert.equal(textAt(r.xml, 'T0.C9.P0'), '금속가공');
  assert.equal(textAt(r.xml, 'T0.C13.P0'), '홍길동');
  assert.equal(textAt(r.xml, 'T0.C15.P0'), '총무팀 대리');
  assert.equal(textAt(r.xml, 'T0.C17.P0'), '041-000-0000');
  assert.equal(textAt(r.xml, 'T0.C21.P0'), ' ① 애로 첫 줄');
  assert.equal(textAt(r.xml, 'T0.C21.P1'), ' ② 애로 둘째 줄');
  assert.equal(textAt(r.xml, 'T0.C21.P2'), ' ③ 애로 셋째 줄');
  assert.equal(textAt(r.xml, 'T0.C23.P0'), '취업규칙 정비');
  assert.equal(textAt(r.xml, 'T0.C29.P0'), '3일');
  assert.equal(textAt(r.xml, 'T0.C31.P0'), '푸른노무법인');
  assert.equal(textAt(r.xml, 'T0.C33.P0'), '이푸른');
  /* 일정 3묶음 — 날짜 순(04-16 → 05-07 → 06-11), «월   일» 원문은 남지 않는다 */
  assert.equal(textAt(r.xml, 'T0.C39.P0'), '4월 16일'); assert.equal(textAt(r.xml, 'T0.C47.P0'), '5월 7일'); assert.equal(textAt(r.xml, 'T0.C55.P0'), '6월 11일');
  assert.equal(count(r.xml, '월   일'), 0, '«월   일» 자리표시가 남았다');
  assert.deepEqual(['C40', 'C48', 'C56'].map((c) => textAt(r.xml, 'T0.' + c + '.P0')), ['자료조사', ' ', '현장'], '방문 여부를 모르면 빈칸');
  assert.equal(textAt(r.xml, 'T0.C41.P0'), '자문2025-04-16', '내용 첫 줄은 자문');
  assert.equal(textAt(r.xml, 'T0.C49.P0'), '문의만', '자문·진단이 없으면 문의');
  assert.equal(textAt(r.xml, 'T0.C57.P0'), '진단만', '자문이 없으면 진단');
  /* 나머지 내용·산출물 줄은 빈칸 한 칸(밑줄 아님) */
  for (let k = 0; k < 3; k++) {
    const b = 39 + 8 * k;
    [b + 3, b + 4, b + 5, b + 6, b + 7].forEach((c) => assert.equal(textAt(r.xml, 'T0.C' + c + '.P0'), ' ', 'T0.C' + c));
  }
  /* 보고서에 없는 값·체크 칸·서명 줄은 원문 그대로 */
  ['T0.C11.P0', 'T0.C19.P0', 'T0.C25.P0', 'T0.C27.P0', 'T0.C66.P0', 'T0.C68.P0'].forEach((a) => assert.equal(textAt(r.xml, a), textAt(xml, a), a + ' — 안 건드린다'));
  ['T0.C64.P0', 'T0.C71.P0', 'T0.C74.P0', 'T0.C76.P0', 'T0.C76.P2', 'T0.C76.P3', 'T0.C76.P5', 'T0.C0.P0', 'T0.C20.P0', 'T0.C34.P0', 'T0.C63.P1']
    .forEach((a) => assert.equal(textAt(r.xml, a), textAt(xml, a), a + ' — 원문 그대로'));
  assert.equal(X.scan(r.xml).length, X.scan(xml).length, '문단 수가 바뀌면 안 된다');
});

test('수행계획서 — 일정 묶음 한 칸에 내용은 첫 줄(a)에만, 같은 묶음의 b·c 와 산출물 줄은 빈칸', () => {
  const V = G.buildValues(planReport(1), 'clinic');
  assert.equal(V['계획내용1a'], '자문2025-06-11'); assert.equal(V['계획내용1b'], ' '); assert.equal(V['계획내용1c'], ' ');
  ['a', 'b', 'c'].forEach((x) => assert.equal(V['계획산출1' + x], ' ', '예상산출물은 보고서에 없다 — 빈칸'));
  assert.equal(V['계획일1'], '6월 11일'); assert.equal(V['계획유형1'], '현장');
  assert.equal(V['업종'], '금속가공'); assert.equal(V['직위'], '총무팀 대리'); assert.equal(V['전화'], '041-000-0000');
  assert.equal(V['지원일수'], '1일');
});

test('수행계획서 — 회차 0·1·2개: 안 쓴 묶음은 빈칸 한 칸, 모자람 알림, 지원일수는 서로 다른 날짜 수', () => {
  const emptyFrom = (xml, n) => {
    for (let k = n; k < 3; k++) for (let o = 0; o < 8; o++) assert.equal(textAt(xml, 'T0.C' + (39 + 8 * k + o) + '.P0'), ' ', '묶음 ' + (k + 1) + ' 칸 ' + o);
  };
  const r0 = planFill(planReport(0)); planClean(r0); emptyFrom(r0.xml, 0);
  assert.deepEqual(r0.short, { need: 1, have: 0 });
  assert.equal(textAt(r0.xml, 'T0.C29.P0'), X.BLANK, '회차가 없으면 지원일수는 모르는 값 — 밑줄');
  assert.equal(count(r0.xml, '월   일'), 0);
  const r1 = planFill(planReport(1)); planClean(r1); emptyFrom(r1.xml, 1);
  assert.equal(r1.short, null); assert.equal(textAt(r1.xml, 'T0.C29.P0'), '1일'); assert.equal(textAt(r1.xml, 'T0.C39.P0'), '6월 11일');
  const r2 = planFill(planReport(2)); planClean(r2); emptyFrom(r2.xml, 2);
  assert.equal(textAt(r2.xml, 'T0.C29.P0'), '2일'); assert.equal(textAt(r2.xml, 'T0.C39.P0'), '4월 16일'); assert.equal(textAt(r2.xml, 'T0.C47.P0'), '6월 11일');
});

test('수행계획서 — 같은 날 두 회차는 1일(별지14 총수행일수와 같은 값), 일정 묶음은 회차마다 한 칸', () => {
  const rp = planReport(3);
  rp.rounds = [{ date: '2025-04-16', visit: true, advice: '오전' }, { date: '2025-04-16', visit: true, advice: '오후' }];
  const p = planFill(rp); planClean(p);
  assert.equal(textAt(p.xml, 'T0.C29.P0'), '1일', '1일 1개 지원기업 — 같은 날은 하루');
  assert.equal(textAt(p.xml, 'T0.C39.P0'), '4월 16일'); assert.equal(textAt(p.xml, 'T0.C47.P0'), '4월 16일', '묶음은 회차마다');
  assert.equal(textAt(p.xml, 'T0.C41.P0'), '오전'); assert.equal(textAt(p.xml, 'T0.C49.P0'), '오후');
  assert.equal(textAt(p.xml, 'T0.C55.P0'), ' ');
  const m = G.fillForm(clinicXml(), 'clinic', 'main', Object.assign(clinicReport(3), { rounds: rp.rounds }));
  assert.equal(textAt(m.xml, 'T0.C11.P0'), '1일', '별지14 총수행일수도 같다');
  rp.rounds = [{ date: '2025-06-11' }, { date: '2025-04-16' }, { date: '2025-04-16' }];
  assert.equal(G.buildValues(rp, 'clinic')['지원일수'], '2일');
  assert.equal(G.buildValues(rp, 'clinic')['지원일수'], G.buildValues(rp, 'clinic')['총수행일수']);
  rp.rounds = [{ date: '2025-02-30' }];
  assert.equal(G.buildValues(rp, 'clinic')['지원일수'], '', '있을 수 없는 날짜만 있으면 모르는 값');
});

test('수행계획서 — 회차 4개는 셋째까지만 쓰고 넘침을 알린다, 있을 수 없는 날짜는 밑줄', () => {
  const rp = planReport(3);
  rp.rounds.push({ date: '2025-08-14', visit: true, inquiry: '넷째 문의', diagnosis: '', advice: '넷째 자문', result: '', next: '' });
  const r = planFill(rp);
  assert.deepEqual(r.over, { max: 3, have: 4 }); planClean(r);
  assert.ok(!textAll(r.xml).includes('넷째'), '양식 한도(3)까지만 쓴다');
  assert.ok(!textAll(r.xml).includes('8월 14일'));
  assert.equal(textAt(r.xml, 'T0.C29.P0'), '3일');
  const bad = planReport(1); bad.rounds = [{ date: '2025-02-30', visit: true, advice: '자문' }];
  assert.equal(textAt(planFill(bad).xml, 'T0.C39.P0'), X.BLANK, '있을 수 없는 날짜는 지어내지 않고 밑줄');
});

test('수행계획서 — 애로사항 줄 1·2·3·4개(빈 줄 제외, CRLF·공백 정리), 줄이 없으면 번호만', () => {
  const lines = (s) => { const rp = planReport(3); rp.summary.inquiryDiag = s; const r = planFill(rp); planClean(r);
    return ['P0', 'P1', 'P2'].map((p) => textAt(r.xml, 'T0.C21.' + p)); };
  assert.deepEqual(lines('가'), [' ① 가', ' ②', ' ③']);
  assert.deepEqual(lines('가\r\n\r\n  나  \r\n'), [' ① 가', ' ② 나', ' ③']);
  assert.deepEqual(lines('가\n나\n다'), [' ① 가', ' ② 나', ' ③ 다']);
  assert.deepEqual(lines('가\n나\n다\n라'), [' ① 가', ' ② 나', ' ③ 다'], '넷째 줄부터는 양식에 칸이 없다 — 별지14 애로사항 칸에는 전부 들어간다');
  assert.deepEqual(lines(''), [' ①', ' ②', ' ③']);
  assert.deepEqual(lines(undefined), [' ①', ' ②', ' ③']);
});

test('수행계획서 — 비어 있는 값은 밑줄(모르는 값), 별지14(main) 채우기는 그대로', () => {
  const rp = planReport(3); rp.summary = {}; rp.company = {}; rp.consultantOrg = ''; delete rp.consultant;
  const r = planFill(rp); planClean(r);
  ['T0.C1.P0', 'T0.C9.P0', 'T0.C13.P0', 'T0.C15.P0', 'T0.C17.P0', 'T0.C23.P0', 'T0.C31.P0', 'T0.C33.P0'].forEach((a) =>
    assert.equal(textAt(r.xml, a), X.BLANK, a + ' — 모르는 값은 밑줄'));
  assert.deepEqual(['P0', 'P1', 'P2'].map((p) => textAt(r.xml, 'T0.C21.' + p)), [' ①', ' ②', ' ③']);
  /* 별지14 쪽 — plan 값을 새로 만들어도 main 이 찍는 값·결과는 같다 */
  const m = G.fillForm(clinicXml(), 'clinic', 'main', clinicReport(3));
  assert.deepEqual(m.missing, []); assert.deepEqual(m.left, []); assert.deepEqual(m.unknown, []);
  assert.equal(textAt(m.xml, 'T2.C4.P0'), '2025.04.16');
  assert.match(rawAt(m.xml, 'T1.C0.P0'), /애로 첫줄<hp:lineBreak\/>애로 둘째줄/, '별지14 애로사항 칸은 줄 전체 그대로');
});

test('현장클리닉 — 간단형 세 양식의 buildValues 는 그대로(clinic 분기가 새지 않는다)', () => {
  const BASE = JSON.parse('{"cci-north":{"업체명":"가나상사","사업자번호":"123-45-67890","대표자":"김가나","업종":"제조업","소재지":"충남 천안시 서북구 가나로 1","근로자수":"12명","담당자":"홍길동","담당부서직위":"대리","일자1":"2025년 4월 16일","방문체크1":"■방문 □사무활동","수행내역1":"문의: 문의2025-04-16\\n진단: 진단2025-04-16\\n자문: 자문2025-04-16\\n성과: 성과2025-04-16\\n향후: 향후2025-04-16","일자2":"2025년 5월 7일","방문체크2":"■방문 □사무활동","수행내역2":"문의: 문의2025-05-07\\n진단: 진단2025-05-07\\n자문: 자문2025-05-07\\n성과: 성과2025-05-07\\n향후: 향후2025-05-07","일자3":"2025년 6월 11일","방문체크3":"■방문 □사무활동","수행내역3":"문의: 문의2025-06-11\\n진단: 진단2025-06-11\\n자문: 자문2025-06-11\\n성과: 성과2025-06-11\\n향후: 향후2025-06-11","문의진단종합":"요청 첫줄\\n요청 둘째줄","결과종합_검토":"연장근로·휴가 규정","결과종합_조치":"개정안 확정","산출물목록":"#1 취업규칙 개정안\\n#2 임금체계 검토 의견서","기타":"없음","작성일":"2025년 5월 10일","상담역줄":"이푸른","대표자서명줄":"김가나"},"cci-seosan":{"업체명":"가나상사","사업자번호":"123-45-67890","업종":"제조업","소재지":"충남 천안시 서북구 가나로 1","근로자수":"12명","근무형태":"주간근무","담당부서":"총무팀","담당직위":"대리","담당자":"홍길동","연락처":"000-000-0000","팩스":"","이메일":"hong@example.com","상담분야":"인사노무","상담일시":"2025.04.16","요청진단":"요청 첫줄\\n요청 둘째줄","자문결과":"자문 결과 첫줄\\n자문 결과 둘째줄","작성일":"2025년 5월 10일","상담역줄":"이푸른","업체담당자줄":"홍길동","회차":[{"방문일":"2025.04.16","회차명":"1회차","문의":"문의2025-04-16","진단":"진단2025-04-16","자문":"자문2025-04-16"},{"방문일":"2025.05.07","회차명":"2회차","문의":"문의2025-05-07","진단":"진단2025-05-07","자문":"자문2025-05-07"},{"방문일":"2025.06.11","회차명":"3회차","문의":"문의2025-06-11","진단":"진단2025-06-11","자문":"자문2025-06-11"}]},"techguard":{"분야_사전예방":true,"분야_스타트업":false,"업체명":"가나상사","지원일1":"4/16(수)","지원일2":"5/7(수)","지원일3":"6/11(수)","지원일4":" ","지원일5":" ","지원일6":" ","지원일7":" ","자문내용":"자문 결과 첫줄\\n자문 결과 둘째줄","총평":"총평 한 줄","대표자서명줄":"김가나","담당자서명줄":"홍길동","상담역줄":"이푸른","회차":[{"자문일":"2025년 4월 16일","문제점":"진단2025-04-16","자문":"자문2025-04-16","성과":"성과2025-04-16","향후":"향후2025-04-16"},{"자문일":"2025년 5월 7일","문제점":"진단2025-05-07","자문":"자문2025-05-07","성과":"성과2025-05-07","향후":"향후2025-05-07"},{"자문일":"2025년 6월 11일","문제점":"진단2025-06-11","자문":"자문2025-06-11","성과":"성과2025-06-11","향후":"향후2025-06-11"}]}}');
  ['cci-north', 'cci-seosan', 'techguard'].forEach((k) => assert.deepEqual(G.buildValues(report2(3), k), BASE[k], k));
  assert.deepEqual(Object.keys(G.FORMS).sort(), ['cci-north', 'cci-seosan', 'clinic', 'techguard']);
  assert.deepEqual(G.FORMS['cci-north'].rounds, { min: 3, max: 3 });
});
