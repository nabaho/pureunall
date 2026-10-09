'use strict';
/* 정부사업신청 › 📅 발주 예정 — 나라장터 발주계획(15129462) · 사전규격(15129437) 순수 모듈 (2026-10-09)
   칸 이름·요청 변수는 공공데이터포털 원문(오픈API 명세)에서 옮겼다. 네트워크를 안 쓴다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/gov-plan.js');
const G = require('../js/gov-g2b.js');

test('★★ 발주계획 주소 — /ao/OrderPlanSttusService 용역 검색 · 발주년월 · 게시일시 · json', () => {
  const u = P.planUrl({ key: 'ab+c/d=', ymFrom: '202601', ymTo: '202712', from: new Date(2026, 0, 1), to: new Date(2026, 1, 1), page: 2 });
  assert.ok(u.startsWith('https://apis.data.go.kr/1230000/ao/OrderPlanSttusService/getOrderPlanSttusListServcPPSSrch?'), u);
  assert.match(u, /serviceKey=ab%2Bc%2Fd%3D&/); assert.match(u, /type=json/);
  assert.match(u, /orderBgnYm=202601&orderEndYm=202712/);
  assert.match(u, /inqryBgnDt=202601010000&inqryEndDt=202602012359/);
  assert.match(u, /pageNo=2&numOfRows=999/);
  assert.match(P.planUrl({ key: 'ab%2Bc' }), /serviceKey=ab%2Bc&/, '이미 인코딩된 열쇠를 또 인코딩했다');
});
test('★★ 사전규격 주소 — /ao/HrcspSsstndrdInfoService 용역 · inqryDiv=1(접수일시)', () => {
  const u = P.specUrl({ key: 'K', from: new Date(2026, 8, 9), to: new Date(2026, 9, 9) });
  assert.ok(u.startsWith('https://apis.data.go.kr/1230000/ao/HrcspSsstndrdInfoService/getPublicPrcureThngInfoServcPPSSrch?'));
  assert.match(u, /inqryDiv=1&inqryBgnDt=202609090000&inqryEndDt=202610092359/);
});
test('★★ 긴 기간은 31일씩 — 빈틈도 겹침도 없이 끝날까지', () => {
  const w = P.windows(new Date(2026, 0, 1), new Date(2026, 9, 9, 15), 31);
  assert.equal(w.length, 10);
  assert.equal(P.ymd(w[0][0]), '2026-01-01'); assert.equal(P.ymd(w[0][1]), '2026-01-31');
  for (let i = 1; i < w.length; i++) assert.equal(w[i][0] - w[i - 1][1], 86400000, '빈틈·겹침');
  assert.equal(P.ymd(w[w.length - 1][1]), '2026-10-09');
  assert.deepEqual(P.windows(new Date(2026, 5, 1), new Date(2026, 4, 1)), [], '거꾸로면 빈 목록');
  assert.equal(P.windows(new Date(2026, 9, 1), new Date(2026, 9, 9)).length, 1);
});
test('★ 입찰공고번호 목록 — 차수 떼고 · 쉼표·빈칸 · 겹침 없이', () => {
  assert.deepEqual(P.bidsOf('R26BK01759874-000, R26BK01759875,R26BK01759874-001'), ['R26BK01759874', 'R26BK01759875']);
  assert.deepEqual(P.bidsOf('20160530525, 20160505996'), ['20160530525', '20160505996']);
  assert.deepEqual(P.bidsOf(''), []); assert.deepEqual(P.bidsOf(null), []); assert.deepEqual(P.bidsOf(['A1-000', 'A2']), ['A1', 'A2']);
});
test('★ 발주년월 — 「3」·「03」·「202611」 어느 꼴도, 모르면 빈칸(지어내지 않는다)', () => {
  assert.equal(P.ymOf('2026', '3'), '2026-03'); assert.equal(P.ymOf('2026', '03'), '2026-03');
  assert.equal(P.ymOf('2026', '202611'), '2026-11'); assert.equal(P.ymOf(2026, 12), '2026-12');
  assert.equal(P.ymOf('2026', '13'), ''); assert.equal(P.ymOf('', '3'), ''); assert.equal(P.ymOf('2026', ''), '');
});
const PLAN_IT = { orderPlanUntyNo: 'R26DD00012345', bizNm: '2026년 직무분석 및 조직진단 용역', orderInsttNm: '한국○○공단', totlmngInsttNm: '고용노동부',
  orderYear: '2026', orderMnth: '11', sumOrderAmt: '45000000', cntrctMthdNm: '협상에의한계약', prcrmntMethd: '자체조달',
  deptNm: '기획조정실', ofclNm: '홍길동', telNo: '052-000-0000', bidNtceNoList: '', nticeDt: '2026-02-03 10:00:00', chgDt: '2026-02-03 10:00:00' };
const SPEC_IT = { bfSpecRgstNo: '1234567', prdctClsfcNoNm: '인사평가체계 개선 컨설팅 용역', orderInsttNm: '○○시', rlDminsttNm: '○○시 시설관리공단',
  asignBdgtAmt: '30000000', rcptDt: '2026-10-07 09:00:00', opninRgstClseDt: '2026-10-14 18:00:00', ofclNm: '김담당', ofclTelNo: '041-000-0000',
  specDocFileUrl1: 'https://www.g2b.go.kr:8082/ep/co/fileDownload.do?fileTask=PS&fileSeq=1234567::1',
  specDocFileUrl2: 'https://www.g2b.go.kr:8082/ep/co/fileDownload.do?fileTask=PS&fileSeq=1234567::1',
  specDocFileUrl3: 'javascript:alert(1)', bidNtceNoList: '' };
const env = (items, total) => ({ response: { header: { resultCode: '00' }, body: { totalCount: total == null ? (Array.isArray(items) ? items.length : 1) : total, items } } });
test('★★★ 응답 풀기 — 칸 이름은 원문 명세 그대로 · items 가 배열·하나·없음', () => {
  const a = P.parse(env([PLAN_IT]), 'plan');
  assert.equal(a.ok, true); assert.equal(a.total, 1);
  assert.deepEqual(a.rows[0], { kind: 'plan', no: 'R26DD00012345', nm: '2026년 직무분석 및 조직진단 용역', org: '한국○○공단', top: '고용노동부',
    ym: '2026-11', prc: 45000000, mthd: '협상에의한계약', how: '자체조달', dept: '기획조정실', ofcl: '홍길동', tel: '052-000-0000',
    bids: [], postDt: '2026-02-03 10:00:00', chgDt: '2026-02-03 10:00:00' });
  assert.equal(P.parse(env({ item: PLAN_IT }, 1), 'plan').rows.length, 1);
  assert.equal(P.parse(env(''), 'plan').rows.length, 0);
  const s = P.parse(env([SPEC_IT]), 'spec').rows[0];
  assert.equal(s.no, 'S1234567'); assert.equal(s.kind, 'spec'); assert.equal(s.org, '○○시 시설관리공단', '실수요기관 먼저');
  assert.equal(s.closeDt, '2026-10-14 18:00:00'); assert.equal(s.prc, 30000000);
  assert.deepEqual(s.files, ['https://www.g2b.go.kr:8082/ep/co/fileDownload.do?fileTask=PS&fileSeq=1234567::1'], '겹친 파일·javascript 주소');
  const noNo = Object.assign({}, PLAN_IT, { orderPlanUntyNo: '', orderInsttCd: 'B551505', orderPlanSno: '7' });
  assert.equal(P.parse(env([noNo]), 'plan').rows[0].no, 'PB551505-2026-7', '통합번호가 없으면 기관·해·순번으로');
  assert.equal(P.parse(env([{ bizNm: '번호 없음' }]), 'plan').rows.length, 0, '번호 없는 줄은 버린다');
});
test('★★★ 활용신청 승인 전 — 「서비스 접근거부」를 «무엇을 기다리는지»로 바꿔 말한다', () => {
  const o = P.parse({ OpenAPI_ServiceResponse: { cmmMsgHeader: { errMsg: 'SERVICE_ACCESS_DENIED_ERROR', returnAuthMsg: '서비스 접근거부', returnReasonCode: '20' } } }, 'plan');
  assert.equal(o.ok, false);
  assert.match(P.errSay('발주계획', o), /^발주계획: 아직 못 받습니다 — 공공데이터포털 «활용신청 승인»을 기다리는 중/);
  assert.equal(P.errSay('사전규격', P.parse({ response: { header: { resultCode: '07', resultMsg: '입력범위값 초과 에러' } } }, 'spec')), '사전규격: 입력범위값 초과 에러');
  assert.equal(P.parse(null).ok, false);
});
const judge = (r) => G.judge(r, G.KEYWORDS_DEFAULT);
test('★★★ 합치기 — 공고 모아보기와 «같은» 찾는 말로 거른다 · 이미 있는 줄은 공고 사실만 바꾸고 ★·숨김은 지킨다', () => {
  const [a, b] = P.parse(env([PLAN_IT, Object.assign({}, PLAN_IT, { orderPlanUntyNo: 'X2', bizNm: '도로 포장 보수공사 설계용역' })]), 'plan').rows;
  const m1 = P.merge([], [a, b], judge, 'T1');
  assert.equal(m1.added, 1); assert.equal(m1.unmatched, 1);
  assert.equal(m1.list[0].kw.split(',').sort().join(','), '조직진단,직무분석'); assert.equal(m1.list[0].savedAt, 'T1');
  m1.list[0].star = true; m1.list[0].hidden = true;
  const later = Object.assign({}, a, { bids: ['R26BK01800000'], prc: 47000000 });
  const m2 = P.merge(m1.list, [later], judge, 'T2');
  assert.equal(m2.updated, 1); assert.equal(m2.added, 0);
  const r = m2.list[0];
  assert.deepEqual(r.bids, ['R26BK01800000'], '공고가 나오면 번호가 붙는다'); assert.equal(r.prc, 47000000);
  assert.equal(r.star, true); assert.equal(r.hidden, true); assert.equal(r.savedAt, 'T1', '사람이 한 것·처음 받은 때를 지켰다');
  assert.equal(P.merge(m2.list, [later], judge, 'T3').updated, 0, '바뀐 것이 없으면 안 센다');
  assert.equal(P.merge([], [a], () => [], 'T').added, 0, '찾는 말에 안 걸리면 안 담는다');
});
test('★★★ 지금 어디쯤 — 공고 나옴 · 공고 임박(의견 마감) · 이번/다음 달 · 몇 달 뒤 · 예정월 지남 · 모름', () => {
  const t = '2026-10-09';
  assert.equal(P.state({ kind: 'plan', ym: '2026-05', bids: ['A'] }, t).k, 'posted');
  assert.deepEqual(P.state({ kind: 'spec', closeDt: '2026-10-14 18:00:00', bids: [] }, t), { k: 'spec', label: '🔔 공고 임박 · 의견 마감 10.14' });
  assert.equal(P.state({ kind: 'plan', ym: '2026-10', bids: [] }, t).label, '⏳ 이번 달 발주 예정');
  assert.equal(P.state({ kind: 'plan', ym: '2026-11' }, t).label, '⏳ 다음 달 발주 예정');
  assert.equal(P.state({ kind: 'plan', ym: '2027-02' }, t).label, '4개월 뒤 발주 예정');
  assert.equal(P.state({ kind: 'plan', ym: '2026-07' }, t).k, 'late');
  assert.equal(P.state({ kind: 'plan', ym: '' }, t).k, 'unknown');
  assert.equal(P.state({ kind: 'plan', ym: '2027-01' }, '2026-12-20').label, '⏳ 다음 달 발주 예정', '해가 바뀌는 달');
});
test('★★ 공고 모아보기의 그 공고와 잇기 — 번호(차수 뗀 것)로', () => {
  const feed = [{ id: 'G1', no: 'R26BK01800000-000' }, { id: 'G2', no: 'R26BK01800001-001' }, { id: 'G3', no: 'X' }];
  assert.deepEqual(P.linked({ bids: ['R26BK01800000'] }, feed).map((f) => f.id), ['G1']);
  assert.deepEqual(P.linked({ bids: [] }, feed), []); assert.deepEqual(P.linked({}, null), []);
});
test('★★ 오래된 것 덜기 — 예정월 13달 넘게 지난 계획·접수 120일 넘은 사전규격 · ★ 관심은 남긴다', () => {
  const l = [{ no: 'a', kind: 'plan', ym: '2025-08' }, { no: 'b', kind: 'plan', ym: '2025-09' }, { no: 'c', kind: 'plan', ym: '2024-01', star: true },
    { no: 'd', kind: 'spec', rcptDt: '2026-06-01 09:00:00' }, { no: 'e', kind: 'spec', rcptDt: '2026-06-30 09:00:00' }, null];
  assert.deepEqual(P.prune(l, '2026-10-09').map((r) => r.no), ['b', 'c', 'e']);
});
