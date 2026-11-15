/* 계약서등관리(docs-esign.html) 폰 점검 자료 — 모두 지어낸 것이다. */
'use strict';
const T0 = Date.UTC(2026, 8, 1, 1, 0, 0);
/* 한 줄 대괄호 안에 회사 표기어를 두면 「글자 묶음」 검사(company-name-normalize)가 정규식으로 오인한다 — 줄을 나눠 적는다 */
const 회사 = [
  '(주)가나다라마바사아자차카타파하정밀기계', '점검테크(주)',
  '주식회사 점검건설',
  '(주)점검푸드', '점검물류', '(주)가나다전자',
];
const co = {}, co_docs = {}, co_recs = {}, originals = {};
for (let i = 0; i < 28; i++) {
  const key = 'n점검' + i;
  co[key] = { name: 회사[i % 회사.length] + ' ' + (i + 1), n: i % 4, r: i % 3, bz: i % 2 ? String(1000000000 + i * 7919) : undefined, lastAt: T0 + i * 864e5 };
  if (i < 3) {
    co_docs[key] = {}; co_recs[key] = {};
    for (let j = 0; j < 6; j++) {
      co_docs[key]['d' + j] = { fileId: 'f' + i + '_' + j, title: ['노무자문 계약서', '급여아웃소싱 계약서', '정부지원 컨설팅 위임장'][j % 3] + ' (가나다라마바사 ' + j + ')', date: '2026-0' + (j % 9 + 1) + '-1' + j, src: ['upload', 'photo', 'folder'][j % 3], at: T0 + j * 864e5, by: 'pa-uid-1', byName: '점검대표' };
      co_recs[key]['r' + j] = { date: '2026-0' + (j % 9 + 1) + '-0' + (j + 1), kind: ['노무자문', '급여', '정부지원'][j % 3], amount: 330000 * (j + 1), payDay: '25', tax: '계산서', staff: '점검노무', note: '긴 메모 가나다라마바사아자차카타파하 ' + j, src: 'manual', at: T0 + j * 3600e3, by: 'pa-uid-1', byName: '점검대표' };
    }
  }
}
/* 사건계약이 많은 회사 — 기록(파일 없음)과 파일(기록 없음)이 엇갈려 갈래 카드가 10줄을 넘는다(대표 폰 갈무리 2026-10-18 과 같은 꼴, 지어낸 자료) */
co['n점검사건'] = { name: '점검사건많은회사', n: 5, r: 5, lastAt: T0 };
co_recs['n점검사건'] = {}; co_docs['n점검사건'] = {};
for (let j = 0; j < 5; j++) {
  co_recs['n점검사건']['r' + j] = { date: '2025-0' + (j + 1) + '-05', kind: '사건', src: 'import', at: T0 + j * 3600e3, by: 'pa-uid-1', byName: '점검대표' };
  co_docs['n점검사건']['d' + j] = { fileId: 'fs' + j, title: ['위임장(중노위)', '위임약정서', '위임장(회사)'][j % 3] + '-점검사건많은회사', date: '2025-0' + (j + 1) + '-05', src: 'folder', at: T0 + j * 864e5, by: 'pa-uid-1', byName: '점검대표' };
}
for (let i = 0; i < 30; i++) originals['o' + String(i).padStart(3, '0')] = { name: '점검_계약서_가나다라마바사아자차카타파하_' + i + (i % 3 ? '.pdf' : '.hwp'), size: 120000 + i * 4096, type: i % 3 ? 'application/pdf' : 'application/x-hwp', sha256: 'h' + i, path: 'pu_docs/originals/o' + i + '/x', at: T0 + i * 3600e3, by: 'pa-uid-1', byName: '점검대표' };
const cases = {};
for (let i = 0; i < 26; i++) cases['c' + String(i).padStart(3, '0')] = { meta: { title: '집단체불 위임 사건 ' + (i + 1) + (i % 4 === 0 ? ' — 가나다라마바사아자차카타파하 공장 임금체불' : ''), company: 회사[i % 회사.length], status: i % 3 ? 'active' : 'closed', createdAt: T0 + i * 864e5 }, submissions: Object.fromEntries(Array.from({ length: i % 5 }, (_, k) => ['s' + k, { at: T0 }])) };
/* 💼 지난 견적·계약(견적·계약 자동화 계획 1) — 지어낸 회사·금액. 긴 회사 이름·긴 과업 내용(한 칸 한 줄·… 확인), 금액 못 읽은 건(확인 필요),
   담당 확정(대표 uid)·추정(이름만)을 섞는다. 금액 자리는 «대표(점검대표)가 읽는» 모양이다 — 권한 없는 화면은 시험(tests/quotes-view.test.js)이 지킨다. */
const 견적 = [
  ['quote', 'hr_consult', '(주)가나다라마바사아자차카타파하정밀기계', '2026-11-03', '직무분석 및 직무기술서 작성, 임금체계 개편안 제시, 노사협의회 설명회 지원', '3개월', 30, 'fq1', '점검담당', 4000000, 'excl', ''],
  ['contract', 'advice', '점검테크(주)', '2026-10-20', '월 자문', '12개월', 120, '', '', 1200000, 'incl', 'pa-uid-1'],
  ['quote', 'investigation', '주식회사 점검건설', '2026-10-01', '', '', undefined, 'fq3', '', undefined, '', ''],
  ['quote', 'education', '(주)점검푸드', '2026-09-15', '성희롱예방교육', '1회', 45, '', '', 500000, 'excl', ''],
  ['contract', 'case', '점검물류', '2026-09-02', '부당해고 구제신청 대리', '', undefined, '', '', 3000000, 'incl', ''],
  ['quote', 'safety', '(주)가나다전자', '2026-08-20', '산업안전 컨설팅', '6개월', 210, 'fq6', '', 6000000, 'excl', ''],
  ['quote', 'hr_consult', '점검테크(주)', '2026-08-11', '', '', undefined, '', '', undefined, '', ''],
  ['quote', 'fund', '(주)점검푸드', '2026-08-06', '사내근로복지기금 설립 컨설팅', '4개월', 45, '', '', 8000000, 'excl', ''],
];
const pu_quotes = {}, pu_quote_amt = {};
견적.forEach((r, i) => {
  const id = '-Oq점검견적' + String(i + 1).padStart(2, '0');
  const rec = { id, entityType: 'Document', doc: r[0], type: r[1], co: r[2], coKey: r[2].toLowerCase(), date: r[3],
    src: { how: 'mail', slug: 'Sent Messages-점검', key: 'k' + i }, srcKey: 'Sent Messages-점검|k' + i,
    review: r[9] === undefined ? 'check' : 'ok', by: 'pa-uid-1', createdAt: T0 + i, updatedAt: T0 + i };
  if (r[4]) rec.scope = r[4];
  if (r[5]) rec.period = r[5];
  if (r[6] !== undefined) rec.staff = r[6];
  if (r[7]) rec.fileId = r[7];
  if (r[8]) rec.ownerGuess = r[8];
  pu_quotes[id] = rec;
  if (r[9] !== undefined) pu_quote_amt[id] = { amount: r[9], vat: r[10], owner: r[11], by: 'pa-uid-1', at: T0 + i };
});
module.exports = {
  data: { pu_docs: { co, co_docs, co_recs, originals }, esign: { cases }, pu_quotes, pu_quote_amt },
  views: [
    { name: 'quotes', run: async (p) => { await p.click('.side [data-pane=quotes]'); } },
    { name: 'pick', run: async (p) => { await p.click('#formsRoot tbody tr:nth-child(2) td:nth-child(3)'); } },
    { name: 'fill', run: async (p) => { await p.click('text=찾아서 채우기'); }, back: async (p) => { await p.keyboard.press('Escape'); } },
    { name: 'esign', run: async (p) => { await p.evaluate(() => { location.hash = '#esign'; showPane('esign'); }); } },
    { name: 'co', run: async (p) => { await p.click('.side [data-pane=co]'); } },
    /* 사건계약이 많은 회사 — 폰은 회사 목록이 접혀 있어 「회사 바꾸기」로 펼쳐 고른다 */
    { name: 'co-case', run: async (p) => { await p.click('.side [data-pane=co]'); await p.click('.pod-pickbtn'); await p.click('.pod-co-ls button:has-text("점검사건많은회사")'); } },
    { name: 'arc', run: async (p) => { await p.click('.side [data-pane=arc]'); } },
  ],
};
