/* 홈페이지 관리(pu-home.html) — 폰 점검용 «지어낸» 자료
 * ⚠ 사람은 「점검○○」, 업체는 「(주)가나다…」 — 실제 이름·업체를 넣지 말 것.
 * 자료 꼴은 pu-home.html loadAll() 이 읽는 그대로다:
 *   homepage/members/<key> = { name, kind, position1, position2, intro, srl, careers[], duties[] }
 *   data/companies = [{ id, name, status, typeCode, monthlyAdvisoryFee }]  (배열 — 업체관리 그대로)
 *   homepage/partners/<companyId> = { posted:true|false }
 */
'use strict';

const 성 = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하'];
const members = {};
for (let i = 0; i < 26; i++) {
  const labor = i % 3 !== 2;
  const careers = [];
  const n = i === 0 ? 18 : (i % 4) + 2;
  for (let k = 0; k < n; k++) {
    careers.push('(사)점검' + 성[k % 14] + '협회 노동법률자문위원회 위원 및 고용노동부 지정 점검 교육기관 외래강사 (20' + (10 + k) + '년~)');
  }
  members['m' + String(i).padStart(2, '0')] = {
    name: '점검' + 성[i % 14] + (i >= 14 ? '둘' : '') ,
    kind: labor ? 'labor' : 'staff',
    position1: labor ? (i % 2 ? '수석노무사' : '파트너 노무사·경영지원본부장') : '사무장',
    position2: labor ? '공인노무사' : '',
    intro: '',
    srl: i % 5 === 4 ? '' : String(9000 + i),
    careers,
    duties: labor ? ['노동사건 대리', '인사노무 자문', '급여 아웃소싱'] : ['사무 지원'],
    sid: i < 3 ? ['P001', 'P002', 'P003'][i] : undefined,
  };
}

const 업체 = [];
const 종류 = ['자문', '급여', '노조', '기금'];
for (let i = 0; i < 40; i++) {
  업체.push({
    id: 'co-pa-' + String(i).padStart(3, '0'),
    name: (i % 6 === 0 ? '(주)가나다라마바사아자차카타파하 점검긴이름 제' : '(주)점검' + 성[i % 14] + '산업 제') + (i + 1) + '공장',
    status: i % 9 === 8 ? 'closed' : (i % 11 === 10 ? 'suboffice' : 'active'),
    typeCode: 종류[i % 4],
    monthlyAdvisoryFee: i % 3 === 0 ? 0 : 330000 + i * 10000,
  });
}
const partners = {};
업체.forEach((c, i) => { if (i % 2 === 0 || i < 30) partners[c.id] = { posted: i % 5 !== 1 }; });

module.exports = {
  data: {
    homepage: {
      members,
      pages: {
        work: { text: '주요업무 본문 — 인사노무 자문, 노동사건 대리, 급여 아웃소싱' },
      },
      partners,
      config: { lineFormat: 'plain' },
    },
    data: { companies: 업체 },
  },
  views: [
    /* 위 띠의 ⋯ (가끔 쓰는 것) — 360px 에서 왼쪽 밖으로 펴지던 자리 */
    { name: 'more', run: async (page) => {
        await page.evaluate(() => { const d = document.querySelector('.appbar details.more'); if (d) d.open = true; });
      },
      back: async (page) => { await page.evaluate(() => { document.querySelectorAll('details.more').forEach(d => { d.open = false; }); }); } },
    /* 구성원 편집칸(경력 18줄) */
    { name: 'member', run: async (page) => {
        await page.evaluate(() => { const e = document.querySelector('.edit'); if (e) e.scrollIntoView(); });
      } },
    /* 편집칸 발(저장·고치기 줄)의 ⋯ — 위로 펴는 칸 */
    { name: 'member-more', run: async (page) => {
        await page.evaluate(() => { const d = document.querySelector('.eft details.more'); if (d) { d.open = true; d.scrollIntoView({ block: 'end' }); window.scrollBy(0, 120); } });
      },
      back: async (page) => { await page.evaluate(() => { document.querySelectorAll('details.more').forEach(d => { d.open = false; }); }); } },
    { name: 'partner', run: async (page) => { await page.evaluate(() => App.go('partner')); await page.evaluate(() => window.scrollTo(0, 0)); } },
    { name: 'partner-list', run: async (page) => {
        await page.evaluate(() => { const e = document.querySelector('.list'); if (e) e.scrollIntoView(); });
      } },
    { name: 'work', run: async (page) => { await page.evaluate(() => App.go('work')); await page.evaluate(() => window.scrollTo(0, 0)); } },
    { name: 'log', run: async (page) => { await page.evaluate(() => App.go('members')); await page.evaluate(() => openChangeLog()); } },
  ],
};
