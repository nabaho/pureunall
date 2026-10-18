/* 경력관리(kcareer.html) — 폰 점검용 «지어낸» 자료
 * ⚠ 기관·사람은 「점검○○」 — 실제 기록·이름을 넣지 말 것(2026-08-30 에 실제 기록을 파일에서 뺐다).
 * 자료 꼴: 경력관리는 localStorage(cm3_<통>) 에 JSON 배열로 두고, 켤 때 IndexedDB 로 옮겨 담는다(js/kcareer-kv.js).
 *   cm3_wiccok  = [{ id, type, titleVal, org, issuer, issueDate, periodStart, periodEnd }]
 *   cm3_cert    = [{ id, title, org, issuer, date, num, grade, duration }]
 *   cm3_consult = [{ id, type, org, project, agency, main, year, status }]
 *   cm3_case    = [{ id, type, org, project, status, year, amt }]
 */
'use strict';

const 성 = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하'];
const 긴기관 = '(사)한국점검공인노무사회 점검지방고용노동청 노동법률자문위원회';

const wiccok = [];
for (let i = 0; i < 30; i++) {
  wiccok.push({
    id: 'W' + String(i + 1).padStart(3, '0'),
    type: i % 10 === 9 ? '표창' : '위촉장',
    titleVal: i % 4 === 0 ? '노동법률 자문위원 및 직장 내 괴롭힘 외부 조사위원(심의위원회 위원장 겸임)' : '자문위원',
    org: i % 3 === 0 ? 긴기관 : '점검' + 성[i % 14] + '시청',
    issuer: '점검' + 성[(i + 2) % 14] + ' 시장',
    issueDate: '20' + (15 + (i % 11)) + '-0' + ((i % 9) + 1) + '-15',
    periodStart: '20' + (15 + (i % 11)) + '-0' + ((i % 9) + 1) + '-15',
    periodEnd: '20' + (17 + (i % 11)) + '-0' + ((i % 9) + 1) + '-14',
  });
}
const cert = [];
for (let i = 0; i < 26; i++) {
  cert.push({
    id: 'C' + String(i + 1).padStart(3, '0'),
    title: i % 2 ? '점검 직무능력 향상 과정 수료' : (i % 4 === 0 ? '공인노무사 자격(점검 제' + (100 + i) + '회 합격) 및 점검 전문가 인증' : '점검관리사 1급'),
    org: i % 3 ? '한국점검산업인력공단' : 긴기관,
    issuer: '점검원장',
    date: '20' + (12 + (i % 13)) + '-1' + (i % 3) + '-0' + ((i % 9) + 1),
    num: 'PA-' + (20000 + i * 37),
    duration: i % 2 ? String(8 + i) : '',
  });
}
const consult = [];
for (let i = 0; i < 28; i++) {
  consult.push({
    id: 'CO' + String(i + 1).padStart(3, '0'),
    type: ['일터혁신', '노사관계', '인사제도', '임금체계'][i % 4],
    org: i % 5 === 0 ? '(주)가나다라마바사아자차카타파하 점검긴이름 제' + (i + 1) + '공장' : '(주)점검' + 성[i % 14] + '산업',
    project: '직무급 중심 임금체계 개편 및 성과평가 제도 설계 컨설팅 ' + (i + 1) + '차',
    agency: i % 4 === 3 ? '점검노사발전재단' : '',
    main: '점검' + 성[(i + 5) % 14],
    year: String(2018 + (i % 9)),
    status: i % 3 ? '완료' : '진행',
  });
}
const kase = [];
for (let i = 0; i < 26; i++) {
  kase.push({
    id: 'CS' + String(i + 1).padStart(3, '0'),
    type: ['부당해고', '임금체불', '산재', '직장내괴롭힘'][i % 4],
    org: i % 6 === 0 ? '(주)가나다라마바사아자차카타파하 점검긴이름' : '점검' + 성[i % 14] + '물류',
    project: '부당해고 구제신청 사건(점검지방노동위원회) 대리 ' + (i + 1),
    status: i % 2 ? '완료' : '진행',
    year: String(2019 + (i % 8)),
    amt: 1500000 + i * 1234567,
  });
}
const edu = [
  { id: 'E001', school: '점검대학교 대학원', major: '노동법 전공(박사 수료)', degree: '박사', period: '2010.03 ~ 2013.02', graduated: '수료' },
  { id: 'E002', school: '점검대학교', major: '법학과', degree: '학사', period: '2001.03 ~ 2007.02', graduated: '졸업' },
];
const work = [
  { id: 'K001', org: '푸른점검노무법인', dept: '대표노무사실', title: '대표노무사', start: '2014-01-01', end: '' },
  { id: 'K002', org: '(주)가나다라마바사아자차카타파하 점검긴이름', dept: '인사팀', title: '과장', start: '2008-03-01', end: '2013-12-31' },
];

const J = (v) => JSON.stringify(v);
module.exports = {
  localStorage: {
    /* 이 기기에서 «대표로 확인됨» 표식 — 없으면 점검 계정이 직원으로 잠겨 목록이 안 열린다(kcOwnerState) */
    cm3_owner_uid: 'pa-uid-1',
    cm3_wiccok: J(wiccok),
    cm3_cert: J(cert),
    cm3_consult: J(consult),
    cm3_case: J(kase),
    cm3_edu: J(edu),
    cm3_work: J(work),
  },
  views: [
    { name: 'wiccok', run: async (page) => { await page.evaluate(() => { navTile('page-wiccok'); window.scrollTo(0, 0); }); } },
    { name: 'wiccok-list', run: async (page) => { await page.evaluate(() => { const t = document.querySelector('#page-wiccok .dt, #page-wiccok table'); if (t) t.scrollIntoView(); }); } },
    { name: 'license', run: async (page) => { await page.evaluate(() => { navTile('page-license'); window.scrollTo(0, 0); }); } },
    { name: 'consult', run: async (page) => { await page.evaluate(() => { navTile('page-consult'); window.scrollTo(0, 0); }); } },
    { name: 'consult-list', run: async (page) => { await page.evaluate(() => { const t = document.querySelector('#page-consult .dt, #page-consult table'); if (t) t.scrollIntoView(); }); } },
    { name: 'case', run: async (page) => { await page.evaluate(() => { navTile('page-case'); window.scrollTo(0, 0); }); } },
    { name: 'profile1', run: async (page) => { await page.evaluate(() => { navTile('page-profile1'); window.scrollTo(0, 0); }); }, wait: 2500 },
    /* 프로필 1장의 A4 그림 — 폰에서 설정 칸 아래로 쌓였는지(전에는 폭 0 이라 안 보였다) */
    { name: 'profile1-paper', run: async (page) => { await page.evaluate(() => { navTile('page-profile1'); }); await page.waitForTimeout(2000); await page.evaluate(() => { const p = document.getElementById('p1Paper'); if (p) p.scrollIntoView(); }); } },
    { name: 'docbox', run: async (page) => { await page.evaluate(() => { navTile('page-docbox'); window.scrollTo(0, 0); }); } },
    { name: 'resume-hub', run: async (page) => { await page.evaluate(() => { navTile('page-resume-hub'); window.scrollTo(0, 0); }); } },
    { name: 'settings', run: async (page) => { await page.evaluate(() => { navTile('page-settings'); window.scrollTo(0, 0); }); } },
  ],
};
