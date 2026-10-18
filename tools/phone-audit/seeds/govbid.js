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
const plan = [];
for (let i = 0; i < 26; i++) {
  const ym = addDays((i % 8) * 30 - 60).slice(0, 7);
  plan.push({ no: 'P26' + String(5000 + i), kind: i % 5 === 0 ? 'spec' : 'plan', nm: 이름[(i + 2) % 이름.length] + ' 발주계획 ' + (i + 1), org: 기관[(i + 3) % 기관.length], top: '점검부',
    ym: i % 5 === 0 ? '' : ym, rcptDt: i % 5 === 0 ? addDays(-(i % 4)) + ' 09:00' : '', prc: 50000000 + i * 7777777, mthd: i % 4 === 1 ? '수의계약' : '제한경쟁', dept: '점검과', ofcl: '점검주무관', tel: '02-000-' + (1000 + i), kw: '노무', star: i % 6 === 0, bids: [] });
}
const hits = {};
for (let i = 0; i < 28; i++) hits['h' + i] = { key: 'h' + i, title: (i % 2 ? '[채용] ' : '[공지] ') + '외부 전문가(공인노무사) 위촉 모집 공고 — 가나다라마바사아자차카타파하 ' + (i + 1), date: addDays(-(i % 10)), org: 기관[i % 기관.length], board: i % 2 ? 'kcplaa_job' : 'pub_' + (i % 5), url: 'https://example.com/r' + i, per: '' };
module.exports = {
  localStorage: { gov3_feed: JSON.stringify(feed), gov3_plan: JSON.stringify(plan), gov3_key_data: '점검열쇠', gov3_key_biz: '점검열쇠2', gov3_last: today, gov3_plan_since: today, gov3_plan_at: today + 'T07:40:00' },
  data: { gov_watch: { hits, last: { at: Date.now() - 3600e3, checked: 24, errors: [{ board: 'pub_3', name: '점검공단', why: 'HTTP 503' }] } } },
  views: [
    { name: 'sel', run: async (p) => { for (const k of [1, 2, 3]) await p.click('#tb tr:nth-child(' + k + ') input.row-chk'); } },
    { name: 'pop', run: async (p) => { await p.click('#tb tr:nth-child(2) td.nm'); }, back: async (p) => { await p.evaluate(() => popClose()); } },
    { name: 'plan', run: async (p) => { await p.click('#tbPlan'); } },
    { name: 'rec', run: async (p) => { await p.click('#tbRec'); } },
    { name: 'recpub', run: async (p) => { await p.evaluate(() => recSub('pub')); } },
    { name: 'rechist', run: async (p) => { await p.evaluate(() => recSub('hist')); } },
  ],
};
