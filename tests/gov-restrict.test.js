'use strict';
/* 공고의 «지역 제한·업종 제한» 표시 (대표 지시 2026-10-19 「지역제한이나 업종제한이 있는 경우 이부분도 표시해달라」)
   나라장터: 목록은 제한 «여부»만 주고 이름은 따로 부르는 두 서비스에 있다. 기업마당: 해시태그·제목 [대괄호]에서 지역을 읽는다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../js/gov-g2b.js');

const ok = (items) => ({ response: { header: { resultCode: '00' }, body: { items: items, totalCount: String(items.length) } } });

test('★ 목록 칸에서 업종제한 여부·공동수급 의무지역을 읽는다 — 없으면 빈 값(지어내지 않는다)', () => {
  const p = G.parse(ok([
    { bidNtceNo: '1', bidNtceOrd: '00', bidNtceNm: 'a', indstrytyLmtYn: 'Y', jntcontrctDutyRgnNm1: '충청남도', jntcontrctDutyRgnNm2: '세종특별자치시' },
    { bidNtceNo: '2', bidNtceOrd: '00', bidNtceNm: 'b', indstrytyLmtYn: 'N' }
  ]));
  assert.equal(p.rows[0].indY, 'Y'); assert.equal(p.rows[0].jnt, '충청남도 · 세종특별자치시');
  assert.equal(p.rows[1].indY, ''); assert.equal(p.rows[1].jnt, '');
});

test('★ 상세 주소 — 공고번호에서 차수(-00)를 떼고, 서비스는 지역/면허 둘, 열쇠는 한 번만 인코딩', () => {
  const r = G.detailUrl({ key: 'K+/=', no: '20261012345-00', kind: 'rgn' });
  assert.match(r, /\/getBidPblancListInfoPrtcptPsblRgn\?/); assert.match(r, /bidNtceNo=20261012345(&|$)/); assert.doesNotMatch(r, /-00/);
  assert.match(r, /serviceKey=K%2B%2F%3D/); assert.match(r, /inqryDiv=2/);
  assert.match(r, /bidNtceOrd=00(&|$)/, '차수가 빠지면 나라장터가 «필수값 입력 에러»를 HTTP 200 으로 돌려준다(2026-10-24 실측)');
  assert.match(G.detailUrl({ key: 'K', no: 'R26BK01782511-001', kind: 'lic' }), /\/getBidPblancListInfoLicenseLimit\?.*bidNtceNo=R26BK01782511&bidNtceOrd=001/);
  assert.match(G.detailUrl({ key: 'K', no: 'R26BK01782511', kind: 'rgn' }), /bidNtceOrd=000/, '차수를 모르면 000');
});

test('★ 상세 응답 풀기 — 지역 이름·면허 이름을 모으고 겹침은 한 번만 · 한 건만 와도(객체) · 오류는 말한다', () => {
  assert.deepEqual(G.parseDetail(ok([{ prtcptPsblRgnNm: '충청남도' }, { prtcptPsblRgnNm: '충청남도' }, { prtcptPsblRgnNm: '세종특별자치시' }]), 'rgn').names, ['충청남도', '세종특별자치시']);
  assert.deepEqual(G.parseDetail({ response: { header: { resultCode: '00' }, body: { items: { item: { prtcptPsblRgnNm: '대전광역시' } } } } }, 'rgn').names, ['대전광역시']);
  const l = G.parseDetail(ok([{ lcnsLmtNm: '정보통신공사업', permsnIndstrytyList: '소프트웨어사업자' }]), 'lic');
  assert.deepEqual(l.names, ['정보통신공사업', '소프트웨어사업자']);
  assert.equal(G.parseDetail(ok([]), 'rgn').ok, true); assert.deepEqual(G.parseDetail(ok([]), 'rgn').names, []);
  const bad = G.parseDetail({ OpenAPI_ServiceResponse: { cmmMsgHeader: { returnAuthMsg: 'SERVICE_ACCESS_DENIED_ERROR' } } }, 'rgn');
  assert.equal(bad.ok, false); assert.match(bad.err, /DENIED/);
  assert.equal(G.parseDetail(null, 'rgn').ok, false);
});

test('★★★ 실호출 응답(2026-10-24) — 오류 모양(ResponseError 08)은 «오류»다 «빈 결과»가 아니다 · 진짜 지역·면허 응답은 그대로 읽는다', () => {
  /* 차수를 빠뜨렸을 때 나라장터가 HTTP 200 으로 준 그대로 */
  const missing = { 'nkoneps.com.response.ResponseError': { header: { resultCode: '08', resultMsg: '필수값 입력 에러' } } };
  const e = G.parseDetail(missing, 'rgn');
  assert.equal(e.ok, false); assert.match(e.err, /필수값 입력 에러/); assert.deepEqual(e.names, []);
  assert.equal(G.parseDetail({}, 'rgn').ok, false, '모르는 모양을 정상으로 읽으면 «제한 없음»이 굳는다');
  assert.equal(G.parseDetail({ 'nkoneps.com.response.ResponseError': { header: { resultCode: '03', resultMsg: '데이터 없음' } } }, 'lic').ok, true, '데이터 없음은 제한 없는 공고');
  /* 진짜 응답 — 지역은 시군까지, 면허는 「정보통신공사업/0036」 꼴 */
  const rg = G.parseDetail({ response: { header: { resultCode: '00', resultMsg: '정상' }, body: { items: [{ bidNtceNo: 'R26BK01782511', bidNtceOrd: '000', lmtSno: '1', prtcptPsblRgnNm: '충청남도 공주시', rgstDt: '2026-10-21 06:34:24', bsnsDivNm: '용역' }], numOfRows: 100, pageNo: 1, totalCount: 1 } } }, 'rgn');
  assert.deepEqual(rg.names, ['충청남도 공주시']);
  const lc = G.parseDetail({ response: { header: { resultCode: '00', resultMsg: '정상' }, body: { items: [{ bidNtceNo: 'R26BK01776715', bidNtceOrd: '000', lmtGrpNo: '1', lmtSno: '1', lcnsLmtNm: '정보통신공사업/0036', permsnIndstrytyList: '', indstrytyMfrcFldList: '', bsnsDivNm: '물품' }] } } }, 'lic');
  assert.deepEqual(lc.names, ['정보통신공사업/0036'], '비어 오는 칸은 안 담는다');
});

test('★★ enrich — 나라장터 줄에만 붙이고, 한 번 본 줄(lk)·다른 출처는 건드리지 않는다', async () => {
  const rows = [{ no: '100-00', src: '나라장터' }, { no: '200-00', src: '나라장터', lk: '2', rgn: '옛값' }, { no: 'BIZ1', src: '기업마당' }];
  const urls = [];
  const get = async (u) => { urls.push(u); return ok(/PsblRgn/.test(u) ? [{ prtcptPsblRgnNm: '충청남도' }] : [{ lcnsLmtNm: '정보통신공사업' }]); };
  const sum = await G.enrich(rows, get, { key: 'K' });
  assert.equal(sum.asked, 1); assert.equal(sum.done, 1);
  assert.equal(rows[0].rgn, '충청남도'); assert.equal(rows[0].ind, '정보통신공사업'); assert.equal(rows[0].lk, '2');
  assert.equal(rows[1].rgn, '옛값'); assert.equal(rows[2].rgn, undefined);
  assert.equal(urls.length, 2, '공고 하나에 두 번(지역·면허)만 부른다');
});

test('★★ enrich — 제한이 «없는» 공고도 lk 를 남긴다(다시 안 부른다) · 칸은 비워 둔다', async () => {
  const rows = [{ no: '1-00', src: '나라장터' }];
  const sum = await G.enrich(rows, async () => ok([]), { key: 'K' });
  assert.equal(rows[0].lk, '2'); assert.equal(rows[0].rgn, undefined); assert.equal(rows[0].ind, undefined); assert.equal(sum.done, 1);
});

test('★★★ enrich — 둘 다 못 받으면(승인 전·통신 오류) lk 를 «남기지 않는다» — 승인 뒤 다시 본다 · 던지지 않는다', async () => {
  const rows = [{ no: '1-00', src: '나라장터' }, { no: '2-00', src: '나라장터' }];
  const sum = await G.enrich(rows, async () => { throw new Error('net'); }, { key: 'K' });
  assert.equal(sum.failed, 2); assert.equal(sum.done, 0);
  assert.equal(rows[0].lk, undefined); assert.equal(rows[1].lk, undefined);
  const denied = async () => ({ OpenAPI_ServiceResponse: { cmmMsgHeader: { returnAuthMsg: 'SERVICE_ACCESS_DENIED_ERROR' } } });
  const r2 = [{ no: '3-00', src: '나라장터' }];
  await G.enrich(r2, denied, { key: 'K' }); assert.equal(r2[0].lk, undefined);
});

test('★ enrich — 하루 상한(max)을 지킨다', async () => {
  const rows = []; for (let i = 0; i < 10; i++) rows.push({ no: i + '-00', src: '나라장터' });
  const sum = await G.enrich(rows, async () => ok([]), { key: 'K', max: 4 });
  assert.equal(sum.asked, 4); assert.equal(rows.filter((r) => r.lk).length, 4);
});

test('★★★ enrich — 예전 «헛 조회» 표시(lk 1)는 다시 본다 · 제대로 본 것(lk 2)만 건너뛴다', async () => {
  const rows = [{ no: '1-00', src: '나라장터', lk: '1' }, { no: '2-00', src: '나라장터', lk: '2', rgn: '대전' }];
  const sum = await G.enrich(rows, async (u) => ok(/PsblRgn/.test(u) ? [{ prtcptPsblRgnNm: '충청남도 공주시' }] : []), { key: 'K' });
  assert.equal(sum.asked, 1); assert.equal(rows[0].lk, '2'); assert.equal(rows[0].rgn, '충청남도 공주시'); assert.equal(rows[1].rgn, '대전');
  assert.equal(G.LK, '2');
});
test('★★★ enrich — 나라장터가 «필수값 입력 에러»(HTTP 200)를 주면 lk 를 «남기지 않는다» — 제한 없음으로 굳히지 않는다', async () => {
  const rows = [{ no: '1-00', src: '나라장터' }];
  const sum = await G.enrich(rows, async () => ({ 'nkoneps.com.response.ResponseError': { header: { resultCode: '08', resultMsg: '필수값 입력 에러' } } }), { key: 'K' });
  assert.equal(rows[0].lk, undefined); assert.equal(sum.failed, 1); assert.equal(sum.done, 0);
});
test('★★ enrich — 지역·면허를 «한 번씩만»(공고당 두 번) 부른다 · 조회구분 2 한 가지', async () => {
  const urls = [];
  await G.enrich([{ no: 'X1-003', src: '나라장터' }], async (u) => { urls.push(u); return ok([]); }, { key: 'K' });
  assert.equal(urls.length, 2); urls.forEach((u) => { assert.match(u, /inqryDiv=2&bidNtceNo=X1&bidNtceOrd=003/); });
});

test('★ 기업마당 지역 — 해시태그·제목 [대괄호]의 시도 이름만 · 줄줄이 여럿이면 전국이라 안 붙인다', () => {
  assert.equal(G.bizRegion('#충남,#컨설팅', '노무 지원'), '충남');
  assert.equal(G.bizRegion('', '[충청남도] 일터혁신 컨설팅'), '충남');
  assert.equal(G.bizRegion('#대전 #세종', '[충북·세종] 사업'), '대전 · 세종 · 충북');
  assert.equal(G.bizRegion('#컨설팅,#노무', '전국 공고'), '');
  assert.equal(G.bizRegion('#서울,#부산,#대구,#인천,#광주,#대전', ''), '', '여섯 곳 넘으면 사실상 전국');
  assert.equal(G.bizRegion('#충남대학교', '충남대 사업'), '', '다른 말 속의 글자는 지역이 아니다');
});

test('★★ merge — 새 줄에 제한 칸을 «있을 때만» 데려간다 · 기업마당은 지역을 붙인다', () => {
  const nara = { src: '나라장터', no: 'N1-00', nm: '노무 컨설팅 용역', inst: '기관', ntce: '기관', openDt: '2026-10-10 09:00:00', closeDt: '2026-10-30 10:00:00',
    prc: 1, mthd: '제한경쟁', url: 'https://g2b.go.kr/x', indY: 'Y', jnt: '충청남도', rgn: '충청남도', ind: '정보통신공사업', lk: '2' };
  const biz = { src: '기업마당', no: 'B1', nm: '노무 컨설팅 지원사업', inst: '기관', ntce: '기관', openDt: '2026-10-10', closeDt: '2026-10-30', tags: '#대전,#노무', url: 'https://bizinfo.go.kr/x' };
  const plain = { src: '나라장터', no: 'N2-00', nm: '노무 컨설팅 용역', inst: '기관', ntce: '기관', openDt: '2026-10-10 09:00:00', closeDt: '2026-10-30 10:00:00', prc: 1, mthd: '', url: '' };
  const m = G.merge([], [nara, biz, plain], ['노무', '컨설팅'], '2026-10-12');
  const by = (no) => m.adds.find((x) => x.no === no);
  assert.equal(by('N1-00').rgn, '충청남도'); assert.equal(by('N1-00').ind, '정보통신공사업'); assert.equal(by('N1-00').indY, 'Y'); assert.equal(by('N1-00').lk, '2');
  assert.equal(by('B1').rgn, '대전');
  ['rgn', 'ind', 'indY', 'jnt', 'lk'].forEach((k) => assert.equal(k in by('N2-00'), false, k + ' 를 빈 값으로 담으면 저장이 부푼다'));
});
