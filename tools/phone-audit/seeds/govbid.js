/* 정부사업신청(gov.html) 폰 점검 자료 — 모두 지어낸 것이다. 공고·발주 예정은 이 기기 저장소(gov3_*)에 둔다. */
'use strict';
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const addDays = (n) => new Date(Date.now() + 9 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
const 기관 = ['한국가나다라마바사아자차카타파하진흥원', '점검시설관리공단', '서울특별시 점검구청', '점검고용노동지청', '한국점검공사', '점검테크노파크'];
const 이름 = ['2026년 노무관리 컨설팅 용역', '직무분석 및 임금체계 개편 컨설팅(가나다라마바사아자차카타파하 사업)', '근로시간 단축 지원 컨설팅', '조직진단 및 인력운영 효율화 연구용역', '노사관계 개선 컨설팅', '공공기관 인사제도 개선'];
const feed = [];
for (let i = 0; i < 32; i++) {
  const d = (i % 9) * 4 - 6;
  feed.push({ id: 'G' + String(i + 1).padStart(4, '0'), no: 'R26BK' + String(1000000 + i * 37) + '-000', src: ['나라장터', '알리오', '기업마당'][i % 3],
    type: ['새 공고', '관심', '지원함', '지나감', '새 공고'][i % 5], nm: 이름[i % 이름.length] + (i >= 6 ? ' ' + (i + 1) : ''), org: 기관[i % 기관.length], ntce: 기관[(i + 1) % 기관.length],
    openDt: addDays(-10) + ' 10:00', closeDt: addDays(d) + ' 18:00', prc: i % 4 === 3 ? 0 : 12000000 * (i + 1) + 3456789, mthd: i % 6 === 2 ? '수의계약' : '일반경쟁', kw: ['노무', '임금', '컨설팅', '조직진단'][i % 4],
    url: 'https://example.com/g' + i, savedAt: addDays(-(i % 7)) + 'T09:00:00', hidden: i % 11 === 10 });
}
/* 📍 대전·세종·충남·충북 탭(2026-11-16, 세종은 11-17)이 «그 지역 것»을 골라 그리는지 보려는 줄 — 기관·참가 가능 지역·제목에 지역이 적힌 것(모두 지어낸 이름).
   「세종문화…」 줄은 세종시가 아니라 빠져야 하는 줄이다. */
const 지역줄 = [
  ['나라장터', '세종특별자치시 점검공단', '', '점검공단 인사·노무 제도 개선 컨설팅', 7],
  ['나라장터', '세종문화점검회관', '', '세종문화점검회관 조직진단 용역(지역 아님)', 8],
  ['나라장터', '충청남도 점검군', '', '2026년 점검군 노무관리 진단 컨설팅 용역(가나다라마바사아자차카타파하 사업장)', 5],
  ['나라장터', '한국점검공사', '충청남도 · 세종특별자치시', '직무분석 및 임금체계 개편 컨설팅 — 참가 지역 제한', 12],
  ['알리오', '대전광역시 점검공단', '', '외부 전문위원(공인노무사) 공개모집', 2],
  ['기업마당', '중소벤처점검부', '대전', '[대전] 소상공인 노무 상담 지원사업 모집 공고', 20],
  ['나라장터', '충북점검진흥원', '', '근로시간 단축 컨설팅 연구용역', -4],
  ['나라장터', '한국점검원', '', '디지털 대전환 점검 컨설팅(지역 아님)', 9]
];
지역줄.forEach(([src, org, rgn, nm, d], i) => {
  feed.push({ id: 'G' + String(33 + i).padStart(4, '0'), no: 'R26RG' + String(2000000 + i * 41) + '-000', src, type: d < 0 ? '지나감' : '새 공고', nm, org, ntce: org,
    openDt: addDays(-7) + ' 10:00', closeDt: addDays(d) + ' 18:00', prc: 23000000 + i * 4567891, mthd: '일반경쟁', kw: '노무', rgn: rgn || undefined,
    url: 'https://example.com/rg' + i, savedAt: addDays(-(i % 4)) + 'T09:00:00', hidden: false });
});
/* 🤖 AI 사업 탭(2026-11-19)이 그리는 줄 — 찾는 말에는 안 걸리고 AI 갈래로만 걸린 줄(kw 빔 · ai 표시) + 노무 말에도 걸린 AI 줄.
   「AI 기반 … 감시 구축」은 AI 갈래가 아니라 원래 안 담기는 줄이라 넣지 않는다(모두 지어낸 이름) */
const AI줄 = [
  ['기업마당', '점검정보산업진흥원', '', '2027년 AI바우처 지원사업 공급기업 등록 안내(가나다라마바사아자차카타파하)', 6, 'voucher'],
  ['기업마당', '중소벤처점검부', '', '2027년 중소기업 스마트서비스 지원사업 공고', 15, 'smart'],
  ['나라장터', '점검테크노파크', '', '2027년 스마트공장 구축 및 고도화 지원사업 운영 용역', 10, 'factory'],
  ['기업마당', '점검노동부', '노무,인사', '영세사업장 인사노무관리체계 구축 지원사업 공급기업 모집', 21, 'hr'],
  ['나라장터', '점검진흥원', '', '소상공인 AX 전환 지원사업 운영 용역', -3, 'ai']
];
AI줄.forEach(([src, org, kw, nm, d, ai], i) => {
  feed.push({ id: 'G' + String(41 + i).padStart(4, '0'), no: 'R26AI' + String(3000000 + i * 43) + '-000', src, type: d < 0 ? '지나감' : '새 공고', nm, org, ntce: org,
    openDt: addDays(-5) + ' 10:00', closeDt: addDays(d) + ' 18:00', prc: 0, mthd: '', kw, ai,
    url: 'https://example.com/ai' + i, savedAt: addDays(-(i % 3)) + 'T09:00:00', hidden: false });
});
/* 📁 지난 공고 하위 탭(2026-11-19) — 몰아 받은 지난해 AI 공고(r.back) · 공고일이 해마다 다르게(연도별 건수 확인용) */
[['기업마당', '점검정보산업진흥원', '2025년 AI바우처 지원사업 공급기업 등록 안내', -360, -330, 'voucher'],
 ['나라장터', '점검테크노파크', '2025년 스마트공장 구축 지원사업 운영 용역', -300, -280, 'factory'],
 ['기업마당', '중소벤처점검부', '2024년 중소기업 스마트서비스 지원사업 공고', -700, -680, 'smart']].forEach(([src, org, nm, open, close, ai], i) => {
  feed.push({ id: 'G' + String(51 + i).padStart(4, '0'), no: 'R26PS' + String(4000000 + i * 47) + '-000', src, type: '지나감', nm, org, ntce: org,
    openDt: addDays(open) + ' 10:00', closeDt: addDays(close) + ' 18:00', prc: 0, mthd: '', kw: '', ai, back: 1,
    url: 'https://example.com/ps' + i, savedAt: addDays(-1) + 'T09:00:00', hidden: false });
});
const plan = [];
for (let i = 0; i < 26; i++) {
  const ym = addDays((i % 8) * 30 - 60).slice(0, 7);
  plan.push({ no: 'P26' + String(5000 + i), kind: i % 5 === 0 ? 'spec' : 'plan', nm: 이름[(i + 2) % 이름.length] + ' 발주계획 ' + (i + 1), org: 기관[(i + 3) % 기관.length], top: '점검부',
    ym: i % 5 === 0 ? '' : ym, rcptDt: i % 5 === 0 ? addDays(-(i % 4)) + ' 09:00' : '', prc: 50000000 + i * 7777777, mthd: i % 4 === 1 ? '수의계약' : '제한경쟁', dept: '점검과', ofcl: '점검주무관', tel: '02-000-' + (1000 + i), kw: '노무', star: i % 6 === 0, bids: [] });
}
const hits = {};
for (let i = 0; i < 28; i++) hits['h' + i] = { key: 'h' + i, title: (i % 2 ? '[채용] ' : '[공지] ') + '외부 전문가(공인노무사) 위촉 모집 공고 — 가나다라마바사아자차카타파하 ' + (i + 1), date: addDays(-(i % 10)), org: 기관[i % 기관.length], board: i % 2 ? 'kcplaa_job' : 'pub_' + (i % 5), url: 'https://example.com/r' + i, per: '' };
/* 지역 기관 게시판(서버 번호 그대로) 글 + 전국 게시판이지만 제목에 지역이 적힌 글 */
[['djtp', '대전테크노파크 사업공고', '2027년 점검 전문가 인력풀(노무·인사) 모집', 9],
 ['chungnam', '충청남도 도정공고', '점검위원회 위원(공인노무사) 공개모집', 3],
 ['cri', '충북연구원 공지사항', '외부 자문위원 위촉 공고', -2],
 ['nosa', '노사발전재단 사업공고/모집', '2027 충북 지역 일터혁신 컨설턴트 모집', 14]].forEach(([board, boardName, title, d], i) => {
  hits['rg' + i] = { key: 'rg' + i, title, date: addDays(-i), board, boardName, href: 'https://example.com/rg-h' + i, per: { to: addDays(d) } };
});
/* 🤖 AI 사업 쪽 모집 글 — 데이터바우처 게시판(서버 번호 voucher) · 공단 AI훈련코치(기관 hrdkai) */
[['voucher', '', '데이터산업진흥원 알림', '2027 데이터 공급기업 풀 평가위원 모집', 8],
 ['hrdk', 'hrdkai', 'HRD 전문가 인력풀 신청공고', '중소기업 AI훈련확산센터 AI훈련코치 모집', 11]].forEach(([board, org, boardName, title, d], i) => {
  hits['ai' + i] = { key: 'ai' + i, title, date: addDays(-i), board, org, boardName, href: 'https://example.com/ai-h' + i, per: { to: addDays(d) } };
});
/* 📮 오늘의 요약(2026-11-22) — 서버(govDigestKakao)가 gov_digest/last·status 에 쓰는 모양 그대로. 카톡 «전체 보기»(gov.html?digest=1)가 여는 팝업을 그려 보려는 자료(모두 지어낸 것) */
const DIGEST = { last: { at: Date.now() - 3600e3, today, mode: 'live', counts: { rows: 121, hits: 52, soleOut: 7 }, fresh: 3, remind: 1, sections: [
  { key: 'rgn', title: '🧑‍💼 컨설턴트·위원 모집 — 대전·세종·충남·충북 (+공인노무사회 전국)', items: [
    { id: 'hit:rg1', title: '점검위원회 위원(공인노무사) 공개모집 — 가나다라마바사아자차카타파하', org: '충청남도 도정공고', due: '~' + addDays(3).slice(5).replace('-', '.') + ' · D-3', days: 3, why: ['📍 충남', '지역 기관 게시판 — 충남'], url: 'https://example.com/rg-h1', groups: ['충남'], isNew: false, isSoon: true },
    { id: 'hit:rg2', title: '직장 내 괴롭힘 사건 외부 조사자 선임 공고', org: '공인노무사회 채용', due: '수시(사람이 정해지면 마감)', why: ['전국 · 공인노무사회 게시판'], url: 'https://example.com/rg-h2', groups: [], isNew: true, isSoon: false }] },
  { key: 'main', title: '📋 정부사업 공고 — 노무사·노무컨설팅 쪽', items: [
    { id: 'feed:R26BK1', title: '2026년 일터혁신 상생컨설팅 지원사업 기업 모집 공고', org: '한국점검협회컨설팅', due: '~' + addDays(8).slice(5).replace('-', '.') + ' · D-8', days: 8, why: ['걸린 낱말 일터혁신·컨설팅'], url: 'https://example.com/g1', groups: [], isNew: true, isSoon: false },
    { id: 'feed:R26BK2', title: '위험 주소 시험 — javascript 주소는 링크로 걸리지 않는다', org: '점검기관', due: '마감 모름', why: [], url: 'javascript:alert(1)', groups: [], isNew: true, isSoon: false }] },
  { key: 'ai', title: '🤖 AI 사업 (전국)', items: [] }] },
  status: { at: Date.now() - 3600e3, today, mode: 'live', ok: false, error: 'not-connected' } };
module.exports = {
  localStorage: { gov3_feed: JSON.stringify(feed), gov3_plan: JSON.stringify(plan), gov3_key_data: '점검열쇠', gov3_key_biz: '점검열쇠2', gov3_last: today, gov3_plan_since: today, gov3_plan_at: today + 'T07:40:00' },
  data: { gov_digest: DIGEST, gov_watch: { hits, last: { at: Date.now() - 3600e3, checked: 24, errors: [{ board: 'pub_3', name: '점검공단', why: 'HTTP 503' }] } } },
  views: [
    { name:'application-handoff',run:async(p)=>{
      await p.evaluate(()=>{localStorage.setItem('cm3_owner_uid','pa-uid-1');toForm(get('feed')[0].id);});
      await p.waitForSelector('#apDialog[open]',{timeout:25000});
      if(!(await p.locator('#apHeading').textContent()).includes('지원 준비'))throw new Error('정부사업신청에서 경력관리로 연결되지 않음');
    },back:async(p)=>{await p.goto(new URL('gov.html',p.url()).href);await p.waitForTimeout(1500);} },

    { name:'application-pick',run:async(p)=>{await p.evaluate(()=>pickOpen());},back:async(p)=>{await p.evaluate(()=>popClose());} },
    { name: 'sel', run: async (p) => { for (const k of [1, 2, 3]) await p.click('#tb tr:nth-child(' + k + ') input.row-chk'); } },
    { name: 'pop', run: async (p) => { await p.click('#tb tr:nth-child(2) td.nm'); }, back: async (p) => { await p.evaluate(() => popClose()); } },
    { name: 'plan', run: async (p) => { await p.click('#tbPlan'); } },
    { name: 'rec', run: async (p) => { await p.click('#tbRec'); } },
    { name: 'recpub', run: async (p) => { await p.evaluate(() => recSub('pub')); } },
    { name: 'rechist', run: async (p) => { await p.evaluate(() => recSub('hist')); } },
    { name: 'rgn', run: async (p) => { await p.click('#tbRgn'); } },
    { name: 'rgnsel', run: async (p) => { for (const k of [1, 2]) await p.click('#rgnTb tr:nth-child(' + k + ') input.row-chk'); } },
    { name: 'ai', run: async (p) => { await p.click('#tbAi'); } },
    { name: 'aisel', run: async (p) => { for (const k of [1, 2]) await p.click('#aiTb tr:nth-child(' + k + ') input.row-chk'); } },
    { name: 'aipast', run: async (p) => { await p.evaluate(() => lensSub('ai', 'past')); } },
    { name: 'digest', run: async (p) => { await p.evaluate(() => digestOpen()); await p.waitForSelector('#pop.on .pk-row', { timeout: 25000 }); }, back: async (p) => { await p.evaluate(() => popClose()); } },
  ],
};
