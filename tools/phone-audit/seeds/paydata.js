/* 폰 화면 점검 — 급여데이터함(pu-paydata.html) 자료·화면
 *
 * ⚠ 자료는 모두 지어낸다 — 사람은 「점검○○」, 업체는 「(주)가나다라…」, 메일은 example.test.
 *   실제 고객·직원·주민번호·금액 없음.
 * ⚠ 목록이 «꽉 찼을 때»를 본다 — 내 담당 사업장 30곳, 메일 32건(보낸 곳 여럿·답장 이어짐),
 *   대기 8건, 서랍 한 곳에 28건(긴 파일 이름·여러 종류).
 *
 * 자료 꼴은 js/pu-paydata-store.js 가 읽는 그대로다:
 *   data/companies           = {v:[{id, 업체명, typeCode:'급여', status:'active', managerMain, managerSubs, contacts}], u}
 *   paydata/owners/{uid}     = {name, email, lastAt}
 *   paydata/arrivals/{coId}/{YYYYMM|keep}/{kind}/{id} = 시각 · …/last · …/vals
 *   paydata/u/{uid}/pending/{id}       = pendingRecord
 *   paydata/u/{uid}/items/{slot}/{id}  = itemRecord
 *   paydata/pending_shared/{id}        = pendingRecord (from:'mail', note:'메일 <주소> · <제목>')
 */
'use strict';

const DAY = 864e5;
const NOW = Date.now();
const d = new Date(NOW + 9 * 3600e3);
const SLOT = String(d.getUTCFullYear()) + String(d.getUTCMonth() + 1).padStart(2, '0');   // 이번 달 칸

const UID = 'pa-uid-1';

const 이름 = [
  '(주)가나다라마바사아자차카타파하종합건설 본사',
  '가나상사',
  '(유)다라마바정밀기계공업',
  '주식회사 사아자차카타물류서비스 평택센터',
  '(재)파하가나복지재단',
  '나다라 의료법인 점검병원',
  '마바사테크',
  '(주)아자차 글로벌 인터내셔널 홀딩스',
  '카타파 식품',
  '하가나다 협동조합',
  '(주)라마바사 반도체 장비',
  '점검유통',
  '(주)가나 아산점',
  '다라 프랜차이즈 본부',
  '(주)마바 건축사사무소',
  '사아 어린이집',
  '자차 요양원',
  '(주)카타 정보통신',
  '파하 산업개발',
  '가나다 세무회계',
  '(사)라마 장애인복지협회',
  '바사 호텔앤리조트',
  '(주)아자 플라스틱',
  '차카 운수',
  '타파 의원',
  '하가 디자인',
  '(주)나다 엔지니어링',
  '라마 베이커리',
  '바사아 물산',
  '(주)자차카 바이오텍 연구소',
];

const companies = 이름.map((n, i) => ({
  id: 'PAC' + String(i + 1).padStart(3, '0'),
  업체명: n,
  typeCode: '급여',
  status: 'active',
  managerMain: i % 7 === 6 ? 'P002' : 'P001',
  managerSubs: i % 7 === 6 ? ['P001'] : (i % 3 === 0 ? ['P003'] : []),
  contacts: [{ name: '점검담당' + (i + 1), position: '총무팀장', email: 'pa-co' + (i + 1) + '@example.test', isPrimary: true }],
}));
/* 급여가 아닌 곳 둘 — 목록에서 빠지는지도 함께 본다 */
companies.push({ id: 'PAC900', 업체명: '(주)점검자문 전용', typeCode: '자문', status: 'active', managerMain: 'P001', managerSubs: [] });

const KINDS = ['attend', 'ledger', 'etc', 'output'];
const arrivals = {};
const items = { [SLOT]: {}, keep: {} };
const 파일 = [
  ['2026년 10월 근태기록부(생산직·사무직 전체)_최종_수정본.xlsx', 'attend'],
  ['10월 급여대장.xlsx', 'ledger'],
  ['IMG_2841.jpg', 'etc'],
  ['근로계약서_점검가나다_정규직.pdf', 'contract'],
  ['연장근로 내역(9.21~10.20).xlsx', 'attend'],
  ['신규입사자 명단 및 인적사항 변경 요청.hwp', 'etc'],
  ['임금명세서_검토용.pdf', 'output'],
  ['10월 상여금 지급 대상자.xlsx', 'ledger'],
];

companies.slice(0, 30).forEach((c, i) => {
  if (i % 3 === 2) return;               // 셋 중 하나는 아직 아무것도 안 왔다(미도착)
  const node = { [SLOT]: { last: NOW - i * 3600e3 } };
  const n = 1 + (i % 5);
  for (let k = 0; k < n; k++) {
    const kind = KINDS[(i + k) % KINDS.length];
    (node[SLOT][kind] = node[SLOT][kind] || {})['A' + i + '_' + k] = NOW - k * 60e3;
  }
  if (i % 4 === 0) node[SLOT].vals = 12 + i;      // 표까지 된 곳
  if (i % 5 === 0) node.keep = { contract: { ['K' + i]: NOW - DAY }, last: NOW - DAY };
  arrivals[c.id] = node;
});

/* 첫 사업장 서랍 — 28건 */
for (let k = 0; k < 28; k++) {
  const f = 파일[k % 파일.length];
  const id = String(NOW - k * 3600e3) + '_' + String(k).padStart(2, '0') + 'pa';
  const slot = f[1] === 'contract' ? 'keep' : SLOT;
  items[slot][id] = {
    filename: (k > 7 ? '(' + (k + 1) + ') ' : '') + f[0],
    file: 'pu_paydata/' + UID + '/' + slot + '/' + id + '.' + f[0].split('.').pop(),
    mime: /xlsx$/.test(f[0]) ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : (/pdf$/.test(f[0]) ? 'application/pdf' : 'image/jpeg'),
    bytes: 20000 + k * 3311, at: NOW - k * 3600e3, by: UID,
    companyId: 'PAC001', companyName: 이름[0], month: slot === 'keep' ? '' : SLOT, kind: f[1],
    from: ['upload', 'mail', 'camera', 'share'][k % 4], note: '', filedAt: NOW - k * 3600e3, filedBy: UID,
  };
}

/* 내 대기 칸 — 사업장·달을 아직 안 정한 것 */
const pending = {};
const 대기이름 = ['KakaoTalk_20261017_093012345.jpg', '근태표 10월분 (가나상사).xlsx', '스캔_0001.pdf',
  '급여자료 송부드립니다 - 다라마바정밀.xlsx', 'IMG_3001.HEIC', '연차사용내역 2026.xlsx', '사진.jpg', '퇴사자 정산 요청서.hwp'];
대기이름.forEach((fn, k) => {
  const id = String(NOW - k * 5 * 3600e3) + '_' + String(k).padStart(2, '0') + 'pd';
  pending[id] = {
    filename: fn, file: 'pu_paydata/' + UID + '/pending/' + id, mime: 'image/jpeg', bytes: 50000 + k * 1000,
    at: NOW - k * DAY * 1.3, by: UID, companyId: k === 1 ? 'PAC002' : '', companyName: k === 1 ? 이름[1] : '',
    month: '', kind: '', from: ['share', 'camera', 'upload'][k % 3], note: '',
  };
});

/* 메일로 온 것(공용 칸) — 보낸 곳 여럿, 같은 대화의 답장, 모르는 주소 */
const shared = {};
const 제목 = ['10월 급여자료 송부드립니다', 'RE: RE: 10월 급여자료 송부드립니다', '[긴급] 중도 퇴사자 정산 요청 및 4대보험 상실신고 관련 문의드립니다',
  'FW: 근태자료', '9월분 연장근로 수정본 다시 보냅니다', 'RE: 임금명세서 확인 부탁드립니다'];
for (let k = 0; k < 32; k++) {
  const known = k % 4 !== 3;
  const ci = k % 9;
  const from = known ? 'pa-co' + (ci + 1) + '@example.test' : 'unknown' + (k % 3) + '@mail.example.test';
  const body = k % 5 === 1;
  const subj = 제목[k % 제목.length];
  const id = 'mail' + String(NOW - k * 7200e3) + '_' + k;
  shared[id] = {
    filename: body ? subj + '.txt' : ['급여자료_' + (k + 1) + '.xlsx', '근태표(10월)_최종.xlsx', '스캔문서_' + k + '.pdf', 'image0' + k + '.jpg'][k % 4],
    file: 'pu_paydata/server/pending/' + id, mime: body ? 'text/plain' : 'application/octet-stream',
    bytes: 1200 + k * 4000, at: NOW - k * 7200e3 - (k > 20 ? 5 * DAY : 0), by: 'server',
    companyId: known && k % 2 === 0 ? companies[ci].id : '', companyName: known && k % 2 === 0 ? 이름[ci] : '',
    month: '', kind: '', from: 'mail', note: '메일 ' + from + ' · ' + subj,
    why: known ? '' : '업체관리에 없는 주소',
  };
}

/* 이 달 값 — 첫 사업장 근로자 26명 · 항목 일곱 가지(큰 금액·확인 안 된 칸 섞음) */
const values = { [SLOT]: {} };
const 항목 = ['기본급', '연장근로수당', '야간근로수당', '휴일근로수당', '식대', '차량유지비', '상여금'];
const srcIds = Object.keys(items[SLOT]);
for (let k = 0; k < 26; k++) {
  values[SLOT]['v' + k] = {
    name: '점검근로자' + String(k + 1).padStart(2, '0') + (k % 9 === 4 ? ' (외국인·장기체류)' : ''),
    companyId: 'PAC001', sourceId: srcIds[k % 3], confirmed: k % 4 !== 1, at: NOW - k * 1000,
    pairs: 항목.map((it, j) => ({ item: it, value: String((2860000 + k * 113000 + j * 77000) * (j === 0 ? 1 : 0.1) | 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',') })),
  };
}

/* 휴지통 — 서랍에서 지운 것·대기 칸에서 지운 것 섞음 */
const trash = {};
for (let k = 0; k < 6; k++) {
  trash['t' + k] = {
    filename: k % 2 ? '중복_' + 파일[k][0] : 파일[k][0], companyId: k % 2 ? '' : 'PAC00' + (k + 1),
    companyName: k % 2 ? '' : 이름[k], kind: 파일[k][1], month: SLOT, fromPending: !!(k % 2),
    trashedAt: NOW - k * 9 * DAY, trashedBy: UID, at: NOW - k * 9 * DAY,
  };
}

module.exports = {
  data: {
    data: { companies: { v: companies, u: NOW } },
    paydata: {
      owners: {
        [UID]: { name: '점검대표', email: 'p001@pureun.kr', lastAt: NOW },
        'pa-uid-2': { name: '점검노무', email: 'p002@pureun.kr', lastAt: NOW - DAY },
      },
      arrivals,
      pending_shared: shared,
      u: { [UID]: { pending, items, values, trash } },
    },
  },
  views: [
    /* 사업장 서랍 — 첫 사업장 이름을 눌러 연다 */
    { name: 'drawer', run: async (page) => {
      await page.evaluate(() => App.go('sites'));
      await page.waitForTimeout(300);
      await page.click('#main .row b[onclick^="openColCompany"]');
    } },
    /* 메일로 온 것 */
    { name: 'mail', run: async (page) => { await page.evaluate(() => App.go('mail')); } },
    /* 확인 대기(내 대기 칸) */
    { name: 'pending', run: async (page) => { await page.evaluate(() => App.go('pending')); } },
    /* 이 달 값 — 근로자 × 항목 표 */
    { name: 'values', run: async (page) => {
      await page.evaluate(() => App.go('drawer', { companyId: 'PAC001', companyName: App.companies[0].name, kind: 'attend', query: '' }));
      await page.waitForTimeout(500);
      await page.evaluate(() => App.go('values'));
    } },
    /* 휴지통 */
    { name: 'trash', run: async (page) => { await page.evaluate(() => App.go('trash')); } },
    /* 자리 맡기기(휴가 대리) · 담당자 바꾸기 창 */
    { name: 'deputy', run: async (page) => { await page.evaluate(() => App.go('deputy')); } },
    { name: 'staff', run: async (page) => { await page.evaluate(() => openStaffPicker()); },
      back: async (page) => { await page.evaluate(() => closeStaffPicker()); } },
    /* 서류 보기 — 서랍 첫 줄을 연다(창고가 가짜라 그림은 안 뜬다 — 머리·안내만 본다) */
    { name: 'viewer', run: async (page) => {
      await page.evaluate(() => App.go('drawer', { companyId: 'PAC001', companyName: App.companies[0].name, kind: 'attend', query: '' }));
      await page.waitForTimeout(600);
      await page.click('#main .row b[onclick^="openViewer"]');
    }, back: async (page) => { await page.evaluate(() => closeViewer()); } },
  ],
};
