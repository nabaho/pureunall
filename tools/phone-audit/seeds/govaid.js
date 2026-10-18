/* 정부지원금(pu-govaid.html) 폰 점검 자료 — 모두 지어낸 것이다.
 *
 * 읽는 자리: govaid/programs·prospects·extras·reviews · data/companies/v(업체관리 원장) · pubdata/co(인원)
 * 사업 사전은 앱의 씨앗(js/pu-govaid-seed.js — 공개 사업명 47개)을 그대로 넣고, 그 가운데 몇 개만
 * «확정 + 조건»으로 바꿔 후보가 계산되게 한다. 업체는 「(주)가나다…」 식 지어낸 이름이다.
 */
'use strict';

const path = require('node:path');
const Seed = require(path.join(__dirname, '../../../js/pu-govaid-seed.js'));
const YEAR = Number(new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 4));

const programs = {};
Seed.records().forEach((r, i) => {
  const p = Object.assign({}, r);
  if (i % 3 === 0) {
    p.status = 'confirmed'; p.baseYear = YEAR; p.confirmedBy = 'P001'; p.confirmedAt = Date.now() - i * 864e5;
    p.cond = { headcount: { min: 5, max: i % 2 ? 300 : 50 }, regions: i % 2 ? ['충남', '경기', '서울'] : [], sizes: ['소기업', '중기업'] };
  }
  if (i % 7 === 0) p.starred = true;
  programs[p.id] = p;
});

const 지역 = ['충남 천안시 서북구 점검로 1', '경기 수원시 영통구 점검로 2', '서울 강남구 점검대로 3', '충북 청주시 점검길 4', '부산 해운대구 점검로 5'];
const 이름 = [
  '(주)가나다라마바사아자차카타파하정밀산업', '점검기계(주)', '(주)한빛점검테크놀로지솔루션', '점검식품',
  '(유)가온누리점검물류센터', '(주)바다점검', '점검정밀화학(주) 제2공장', '(주)나래점검',
  '(사)점검사회적협동조합 늘푸른마을', '점검전자', '(주)다온점검엔지니어링앤컨설팅', '점검건설(주)',
  '(주)라온점검', '점검메디칼', '(주)마루점검오토모티브코리아', '점검섬유',
  '(주)사랑점검', '점검산업개발(주) 천안사업장', '(주)아라점검', '점검테크',
  '(주)자람점검바이오헬스케어', '점검농산', '(주)차오름점검', '점검금속(주)',
  '(주)하늘점검스마트팩토리시스템즈', '점검유통', '(주)온새미점검', '점검화학',
];
const companies = 이름.map((name, i) => ({
  id: 'gc' + (i + 1), name, bizNo: '000-00-' + String(20000 + i).slice(-5), address: 지역[i % 지역.length],
  companySize: ['소기업', '중기업', '중견기업', ''][i % 4], status: 'active', ceo: '점검대표' + (i + 1),
}));
const pub = {};
companies.forEach((c, i) => { if (i % 3 !== 2) pub[c.bizNo.replace(/\D/g, '')] = { np: { n: 4 + i * 7, ym: YEAR + '-09' }, ei: { n: 3 + i * 7, ym: YEAR + '-09' } }; });

const prospects = {};
['(예비)점검상사', '(예비)(주)가나점검로보틱스앤오토메이션', '(예비)점검푸드'].forEach((name, i) => {
  const id = 'gpr' + (i + 1);
  prospects[id] = { id, entityType: 'Company', name, bizno: '', headcount: 10 + i * 20, region: '충남', size: '소기업', industry: 'C',
    companyLinkStatus: 'pending', createdAt: Date.now(), updatedAt: Date.now() };
});

const reviews = {};
companies.slice(0, 8).forEach((c, i) => {
  const pid = Object.keys(programs)[i * 3];
  reviews['co_' + c.id] = { [pid]: { decision: ['yes', 'hold', 'no'][i % 3], reason: i % 2 ? '점검 메모 — 상시근로자 수 확인 후 재검토' : '', by: 'P001', at: Date.now() - i * 864e5 } };
});

module.exports = {
  data: {
    govaid: { programs, prospects, extras: {}, reviews },
    data: { companies: { v: companies } },
    pubdata: { co: pub },
  },
  views: [
    { name: 'co-pick', run: async (p) => { await p.click('#coList .li >> nth=0'); } },
    { name: 'grid', run: async (p) => { await p.click('#tabs button[data-tab="grid"]'); } },
    { name: 'prog', run: async (p) => { await p.click('#tabs button[data-tab="prog"]'); } },
    { name: 'prog-pick', run: async (p) => { await p.click('#pList .li >> nth=0'); } },
    { name: 'dict', run: async (p) => { await p.click('#tabs button[data-tab="dict"]'); } },
    { name: 'check', run: async (p) => { await p.click('#tabs button[data-tab="check"]'); } },
  ],
};
