/* 회생광고(rehab-ad.html) 폰 점검 자료 — 모두 지어낸 것이다(실제 회사·사람·사건 아님). */
'use strict';
const 법원 = [
  ['000210', '서울회생법원'], ['000410', '수원회생법원'], ['000510', '대전지방법원'],
  ['000610', '대구지방법원'], ['000710', '부산회생법원'], ['000810', '광주지방법원'],
];
const 지역 = [['서울', '강남구'], ['경기', '화성시'], ['대전', '유성구'], ['대구', '달서구'], ['부산', '해운대구'], ['광주', '광산구'], ['충남', '서산시']];
const 단계 = ['금지명령', '금지명령', '금지명령', '개시', '인가', '파산선고', '종결', '폐지·기각'];
const 이름 = ['(주)가나다라마바사아자차카타파하정밀기계제작소', '점검테크(주)', '주식회사 점검건설산업개발', '(주)점검푸드', '점검물류 주식회사',
  '(주)가나다전자부품', '점검에너지솔루션(주)', '(주)점검바이오메디컬', '점검섬유', '(주)가나다라마바사인테리어디자인그룹'];
const notices = {}, marks = {}, info = {};
for (let i = 0; i < 44; i++) {
  const id = 'RN' + String(i + 1).padStart(4, '0');
  const [cc, cn] = 법원[i % 법원.length];
  const [sido, sgg] = 지역[i % 지역.length];
  const stage = 단계[i % 단계.length];
  const bk = stage === '파산선고';
  const day = String(17 - (i % 25)).padStart(2, '0');
  const mon = (17 - (i % 25)) > 0 ? '10' : '09';
  const d = mon === '10' ? `2026-10-${day}` : `2026-09-${String(30 + (17 - (i % 25))).padStart(2, '0')}`;
  notices[id] = {
    id, debtorName: 이름[i % 이름.length] + (i >= 10 ? ' ' + (i + 1) : ''), courtCode: cc, courtName: cn, division: '제' + (i % 4 + 1) + '파산부',
    caseNo: '2026회합' + (100000 + i * 37), caseType: bk ? '파산' : (i % 5 === 0 ? '간이회생' : '회생'), kind: bk ? 'bankruptcy' : 'rehab',
    stage, noticeDate: d, noticeTitle: bk ? '파산선고 공고' : '포괄적 금지명령 공고',
    sido, sigungu: sgg, zip: String(10000 + i * 113), address: `${sido} ${sgg} 점검로 ${i + 1}길 ${i * 3 + 1}, 점검빌딩 ${i % 9 + 1}층`,
    dlvAddress: i % 4 === 0 ? `${sido} ${sgg} 점검법조로 ${i + 2} 점검법률사무소` : '', counsel: i % 4 === 0 ? '변호사 점검대리' : '',
    events: [{ t: bk ? '파산선고' : '포괄적 금지명령', d }],
  };
  if (i % 3 === 0) info[id] = { phones: ['02-000-' + String(1000 + i)], faxes: i % 2 ? ['02-000-' + String(2000 + i)] : [], emails: i % 6 === 0 ? ['info' + i + '@example.com'] : [], homepage: i % 9 === 0 ? 'https://example.com/' + i : '', confidence: i % 9 === 3 ? 'low' : 'high', sources: ['홈페이지'], checkedAt: 1760700000000, status: 'found', note: i % 9 === 3 ? '같은 이름의 다른 회사일 수 있습니다' : '' };
  const st = ['new', 'new', 'send', 'hold', 'skip', 'sent', 'new'][i % 7];
  if (st !== 'new' || i % 5 === 1) marks[id] = { id, status: st, star: i % 5 === 1, sendLog: st === 'sent' ? [{ d: '2026-10-1' + (i % 8), m: '우편', r: i % 2 ? '문의' : '' }] : [], contact: i % 8 === 2 ? { ceo: '점검대표' + i } : {} };
}
module.exports = {
  data: {
    rehab_ad: {
      notices, marks, info,
      runs: { '2026-10-18': { added: 6, errors: [] } },
      auto: { settings: { enabled: false, dailyCap: 5 }, preview: { at: 1760700000000, items: [{ name: '점검테크(주)', email: 'ceo@example.com', ceo: '점검대표', willSend: false }], skipped: [{ name: '(주)점검푸드', reason: '메일 없음' }] } },
    },
  },
  views: [
    { name: 'more', run: async (p) => { await p.click('#moreBtn'); }, back: async (p) => { await p.click('#moreBtn'); } },
    { name: 'info', run: async (p) => { await p.click('#infoBtn'); await p.click('#autoSum'); }, back: async (p) => { await p.click('#infoBtn'); } },
    { name: 'sel', run: async (p) => { const c = await p.$$('#rows input[data-ck]'); for (const x of c.slice(0, 3)) await x.click(); } },
    { name: 'detail', run: async (p) => { await p.click('#rows tr:nth-child(2) td.co'); } },
  ],
};
