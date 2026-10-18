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
for (let i = 0; i < 30; i++) originals['o' + String(i).padStart(3, '0')] = { name: '점검_계약서_가나다라마바사아자차카타파하_' + i + (i % 3 ? '.pdf' : '.hwp'), size: 120000 + i * 4096, type: i % 3 ? 'application/pdf' : 'application/x-hwp', sha256: 'h' + i, path: 'pu_docs/originals/o' + i + '/x', at: T0 + i * 3600e3, by: 'pa-uid-1', byName: '점검대표' };
const cases = {};
for (let i = 0; i < 26; i++) cases['c' + String(i).padStart(3, '0')] = { meta: { title: '집단체불 위임 사건 ' + (i + 1) + (i % 4 === 0 ? ' — 가나다라마바사아자차카타파하 공장 임금체불' : ''), company: 회사[i % 회사.length], status: i % 3 ? 'active' : 'closed', createdAt: T0 + i * 864e5 }, submissions: Object.fromEntries(Array.from({ length: i % 5 }, (_, k) => ['s' + k, { at: T0 }])) };
module.exports = {
  data: { pu_docs: { co, co_docs, co_recs, originals }, esign: { cases } },
  views: [
    { name: 'pick', run: async (p) => { await p.click('#formsRoot tbody tr:nth-child(2) td:nth-child(3)'); } },
    { name: 'fill', run: async (p) => { await p.click('text=찾아서 채우기'); }, back: async (p) => { await p.keyboard.press('Escape'); } },
    { name: 'esign', run: async (p) => { await p.evaluate(() => { location.hash = '#esign'; showPane('esign'); }); } },
    { name: 'co', run: async (p) => { await p.click('.side [data-pane=co]'); } },
    { name: 'arc', run: async (p) => { await p.click('.side [data-pane=arc]'); } },
  ],
};
