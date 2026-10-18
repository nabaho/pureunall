/* 뉴스레터(pu-news.html) — 폰 점검용 «지어낸» 자료
 * ⚠ 사람은 「점검○○」, 업체는 「(주)가나다…」 — 실제 이름·주소를 넣지 말 것. 메일은 example.test.
 * 자료 꼴은 pu-news.html 불러오기() 가 읽는 그대로다:
 *   newsletter/issues/<YYYY-MM-wN> = { 상태:'발송'|'초안', 안:{news:[{제목,링크,언론사}],…}, 받는수, 보낸때 }
 *   data/companies/v = [{ id, name, status, typeCode, ceo, primaryContactName/Email/Title/Phone, contacts[] }]
 */
'use strict';

const 성 = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하'];
const 기사 = (i, k) => ({ 갈래: '기사', 제목: '[점검] ' + (i % 3 === 0 ? '아주 긴 제목 — 유급 난임치료휴가 2일에서 4일로 늘리는 남녀고용평등법 개정안 국회 본회의 통과, 내년부터 시행 ' : '최저임금위원회 점검 기사 ') + k,
  링크: 'https://example.test/news/' + i + '-' + k, 언론사: ['점검노동신문', '점검일보', '점검경제'][k % 3] });

/* 지난 회차 26개 — 2026-04 ~ 2026-10 주차 */
const issues = {};
let n = 0;
for (let m = 4; m <= 10 && n < 26; m++) {
  for (let w = 1; w <= 4 && n < 26; w++) {
    if (m === 10 && w >= 3) break;
    const key = '2026-' + String(m).padStart(2, '0') + '-w' + w;
    issues[key] = {
      상태: n % 7 === 6 ? '초안' : '발송',
      안: { news: [기사(n, 1), 기사(n, 2), 기사(n, 3)], policy: [], case: [], hr: [] },
      받는수: 1200 + n * 3,
      보낸때: Date.UTC(2026, m - 1, w * 7, 0, 0, 0),
      batchId: 'b-' + key,
    };
    n++;
  }
}

/* 받는 곳 — 사업장 40곳(담당자·대표자 섞어서, 주소 없는 곳도) */
const 종류 = ['자문', '급여', '노조', '기금'];
const companies = [];
for (let i = 0; i < 40; i++) {
  const 긴 = i % 6 === 0;
  companies.push({
    id: 'co-pa-' + String(i).padStart(3, '0'),
    name: (긴 ? '(주)가나다라마바사아자차카타파하 점검긴이름 제' : '(주)점검' + 성[i % 14] + '산업 제') + (i + 1) + '공장',
    status: i % 9 === 8 ? 'closed' : 'active',
    closedDate: i % 9 === 8 ? '2026-08-01' : '',
    typeCode: 종류[i % 4],
    ceo: '점검대표' + 성[i % 14],
    ceoEmail: i % 5 === 0 ? 'ceo' + i + '@example.test' : '',
    address: '서울특별시 점검구 점검로 ' + (i + 1),
    primaryContactName: i % 7 === 3 ? '' : '점검담당' + 성[(i + 3) % 14],
    primaryContactEmail: i % 7 === 3 ? '' : 'hr' + i + '@example.test',
    primaryContactTitle: i % 2 ? '인사총무팀 선임매니저(급여·4대보험 담당)' : '과장',
    primaryContactPhone: '010-0000-' + String(1000 + i),
    contacts: i % 4 === 0 ? [{ name: '점검둘째' + 성[i % 14], email: 'pay' + i + '@example.test', position: '대리', phone: '010-0000-9' + String(100 + i) }] : [],
  });
}

module.exports = {
  data: {
    newsletter: {
      config: {},
      issues,
      더한분들: {
        f1: { email: 'friend1@example.test', name: '점검지인가', company: '(사)점검협회', 담은날: '2026-03-02', 동의: true },
        f2: { email: 'friend2@example.test', name: '점검지인나', company: '', 담은날: '2025-12-01' },
      },
    },
    data: { companies: { v: companies } },
  },
  views: [
    /* 이번 회차 — 기사가 꽉 찬 모양 */
    { name: 'now-full', run: async (page) => {
        await page.evaluate(() => {
          const k = App.지금열쇠;
          const 안 = { news: [], policy: [], case: [], hr: [] };
          for (let i = 0; i < 5; i++) 안.news.push({ 갈래: '기사', 제목: '[점검] 아주 긴 제목 — 유급 난임치료휴가 2일에서 4일로 늘리는 남녀고용평등법 개정안 통과 ' + i, 링크: 'https://example.test/a' + i, 언론사: '점검노동신문' });
          for (let i = 0; i < 4; i++) 안.policy.push({ 갈래: '자료', 제목: '[점검] 사업주와 인사담당자를 위한 점검 활용가이드 ' + i, 발행처: '고용노동부', 발행일: '2026-10-1' + i, 링크: 'https://example.test/p' + i });
          App.회차들[k] = Object.assign({ 상태: '초안', 안, 우리글: '' }, App.회차들[k] || {}, { 안 });
          App.tab = 'now'; render(); window.scrollTo(0, 0);
        });
      } },
    { name: 'now-scroll', run: async (page) => { await page.evaluate(() => window.scrollTo(0, 600)); } },
    { name: 'past', run: async (page) => { await page.evaluate(() => { App.tab = 'past'; render(); window.scrollTo(0, 0); }); } },
    { name: 'note', run: async (page) => { await page.evaluate(() => { App.tab = 'note'; render(); window.scrollTo(0, 0); }); } },
    { name: 'who', run: async (page) => { await page.evaluate(() => { App.tab = 'who'; render(); window.scrollTo(0, 0); }); } },
    { name: 'who-scroll', run: async (page) => { await page.evaluate(() => window.scrollTo(0, 500)); } },
    { name: 'friend', run: async (page) => { await page.evaluate(() => { App.tab = 'friend'; render(); window.scrollTo(0, 0); }); } },
    { name: 'res', run: async (page) => { await page.evaluate(() => { App.tab = 'res'; render(); window.scrollTo(0, 0); }); }, wait: 2500 },
    { name: 'cfg', run: async (page) => { await page.evaluate(() => { App.tab = 'cfg'; render(); window.scrollTo(0, 0); }); } },
  ],
};
