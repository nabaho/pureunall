/* 폰 점검 — 취업규칙(rules-v2.html · rules.html) 지어낸 자료
 * ⚠ 모두 지어낸 것이다 — 업체는 「(주)가나다라…」, 사람은 「점검○○」.
 * 자리: data/companies (업체관리 원본 꼴 {v:[…]}) · rules_mgmt/library/{docs,human,rounds,run}
 * 표가 «꽉 찼을 때»를 보려고 업체 40곳·서류 90건, 긴 이름·여러 상태를 섞는다. */
'use strict';

const DAY = 864e5;
const T0 = Date.UTC(2026, 8, 30, 1, 0, 0);
const 이름들 = [
  '(주)가나다라마바사아자차카타파하 주식회사 본점', '점검상사', '(주)한빛정밀기계공업', '푸른점검물류 유한회사', '가나식품(주)',
  '(주)다라마건설산업개발', '마바사전자', '(주)아자차 글로벌 로지스틱스 코리아', '카타파의료재단', '(주)하늘점검',
  '점검운수(주)', '(주)누리점검산업', '바다점검수산', '(주)소망점검복지센터', '점검테크(주)',
  '(주)가람점검', '(주)나래점검환경', '다온점검(주)', '(주)라온점검서비스', '마루점검건축사무소',
];
const 업태 = ['제조업', '도소매업', '운수업', '서비스업', '건설업', '보건업 및 사회복지 서비스업', '숙박 및 음식점업', ''];
const 담당 = ['P-001', 'P-002', 'P-003', ''];

const companies = [];
for (let i = 0; i < 40; i++) {
  const nm = 이름들[i % 이름들.length] + (i >= 이름들.length ? ' 제' + (i - 이름들.length + 2) + '공장' : '');
  companies.push({
    id: 'co' + String(i + 1).padStart(3, '0'), name: nm,
    bizNo: '9' + String(10 + i).padStart(2, '0') + '-8' + String(i % 10) + '-' + String(10000 + i * 37).slice(0, 5),
    employmentInsuredCount: [3, 7, 12, 28, 45, 160, 0, 9][i % 8],
    bizType: 업태[i % 업태.length],
    status: i === 17 ? 'closed' : 'active',
    managerMain: 담당[i % 4], managerSubs: i % 5 === 0 ? ['P-002', 'P-003'] : [],
  });
}

const 갈래 = ['규칙본문', '규칙본문', '신구대조표', '신고서', '동의서', '의견청취', '규칙본문', '기타'];
const docs = {}, human = {}, rounds = {};
let n = 0;
for (let i = 0; i < 90; i++) {
  const co = companies[i % 30];
  const id = 'rd' + String(i + 1).padStart(4, '0');
  const kind = 갈래[i % 갈래.length];
  const mailNo = Math.floor(i / 2);
  const date = T0 - (i * 11 % 700) * DAY;
  docs[id] = {
    name: (kind === '규칙본문' ? '취업규칙_' : kind + '_') + co.name.replace(/[()]/g, '') + '_2026년 개정안' + (i % 9 === 0 ? '(최종 신고용)' : '') + (i % 3 === 0 ? '.hwp' : '.pdf'),
    kind, status: i % 13 === 5 ? '보류' : '담김', holdWhy: i % 13 === 5 ? '가림 뒤 남은 개인정보가 있어 담지 않았습니다' : undefined,
    dir: i % 4 === 0 ? '받음' : '보냄',
    mail: { src: 'imap', box: 'INBOX', key: 'm' + mailNo, date, subject: '[푸른노무법인] ' + co.name + ' 취업규칙 개정 검토 요청드립니다' + (i % 5 === 0 ? ' — 회신 부탁드립니다' : '') },
    pii: { count: i % 4 === 0 ? 0 : (i * 7) % 23 },
    file: i % 3 === 0 ? { path: 'rules_lib/' + id + '.hwpx' } : undefined,
    createdAt: date + 1000,
    companyCand: i % 3 === 1 ? [{ companyId: co.id, why: '메일 주소 도메인이 같음' }, { companyId: companies[(i + 7) % 40].id, why: '본문 주소 일치' }] : [],
  };
  if (i % 3 !== 1) human[id] = { id, companyId: co.id, companyLinkStatus: 'linked', linkedBy: 'P001', linkedAt: date + 5000 };
  n++;
}
// 몇 회차는 ★최종본을 정해 둔다
['co001', 'co003', 'co007'].forEach((c, k) => {
  const id = Object.keys(human).find(d => human[d].companyId === c && docs[d].kind === '규칙본문' && docs[d].status === '담김');
  if (!id) return;
  const d = new Date(docs[id].mail.date + 9 * 36e5);
  const rk = 'r' + d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, '0');
  rounds[c + '_' + rk] = { id: c + '_' + rk, companyId: c, roundKey: rk, finalDocId: id, finalBy: 'P001', finalAt: T0 - k * DAY };
});
const text = {};
Object.keys(docs).slice(0, 30).forEach((id) => {
  text[id] = '제1조(목적) 이 규칙은 ' + docs[id].name + ' 의 근로조건을 정한다.\n제2조(적용범위) 이 규칙은 모든 근로자에게 적용한다.\n제3조(근로시간) 1일 8시간, 1주 40시간으로 한다.\n제4조(휴게) 4시간에 30분 이상 준다.\n';
});

module.exports = {
  data: {
    data: { companies: { v: companies } },
    rules_mgmt: { library: { docs, human, rounds, text, run: { at: T0, mails: 60, stored: 41, held: 3, dup: 2 } } },
  },
  views: [
    { name: 'site', run: async (page) => { await page.click('#sites tbody tr[data-co]'); } },
    { name: 'lib', run: async (page) => { await page.evaluate(() => { history.pushState(null, '', '#lib'); window.rv2Route(); }); } },
    { name: 'lib-co', run: async (page) => { await page.click('#lib [data-act="view"][data-v="company"]'); } },
    { name: 'tidy', run: async (page) => { await page.click('#lib [data-act="view"][data-v="tidy"]'); } },
    { name: 'topics', wait: 4000, run: async (page) => { await page.evaluate(() => { history.pushState(null, '', '#topics'); window.rv2Route(); }); } },
    /* ✏️ 검토·개정(rules.html)의 💬 묻기 탭 (설계 §13) — 화면 안 «지어낸 샘플 문서»에 지어낸 답 한 줄을 그려 잰다.
       AI 는 안 부른다. ⚠ 다른 화면(rules.html)으로 넘어가므로 «맨 끝»에 둔다 — 뒤에 둔 view 는 rules-v2 를 못 찾는다 */
    { name: 'ask', wait: 2500, run: async (page) => {
      await page.goto(new URL('rules.html', page.url()).href, { waitUntil: 'load', timeout: 45000 });
      await page.waitForTimeout(4000);
      await page.click('#pv-ask');
      await page.evaluate(() => {
        /* global ASK, askDraw */
        ASK.list.unshift({ state: 'ready', q: '본인 결혼하면 며칠 쉬나요?', sent: ['제15조', '제16조', '제17조', '제19조'],
          titles: { '제16조': '경조휴가', '제19조': '배우자 출산전후휴가' },
          answer: '회사는 사원의 결혼·사망 등 경조사에 대하여 별도 기준에 따라 유급 경조휴가를 줍니다.',
          cites: [{ label: '제16조', where: '' }], none: false, dropped: 0, review: { state: 'warn', counts: { '수동확인': 1 }, n: 1 } });
        ASK.list.unshift({ state: 'ready', q: '재택근무 규정 있나요?', sent: ['제8조'], titles: {}, answer: '이 규칙에는 재택근무를 정한 조항이 없습니다.',
          cites: [], none: true, dropped: 0, review: { state: 'before' } });
        askDraw();
      });
    } },
  ],
};
