/* 폰 화면 점검 — 기업정보함(pu-cards.html) 자료·화면
 *
 * ⚠ 자료는 모두 지어낸다 — 사람은 「점검○○」, 업체는 「(주)가나다라…」. 실제 고객·직원·번호 없음.
 *   전화는 010-0000-xxxx, 사업자번호는 000-00-xxxxx 꼴로 «있을 수 없는» 번호만 쓴다.
 * ⚠ 표가 «꽉 찼을 때»를 본다 — 명함 32장·사업자등록증 28장·이알피 업체 30곳·사건 30건(근로자 50명, 집단·혼자 섞음).
 *
 * 자료 꼴은 pu-cards.html 이 읽는 그대로다:
 *   pucards/items/{id}  = {id, kind:'card'|'biz', name, company, title, dept, mobile, email, companyTel, bizno, ceo, …}
 *   data/companies      = {v:[{id, name, bizNo, typeCode, managerMain(sid), status, ceo, phone, …}]}   (ErpMatch.load)
 *   data/cases/v        = [{id, bizNo, companyName, typeName, caseNo, status, workers:[{id, name, phone}]}]
 *   mailbox/…           = 메일(받은 30·업무 칸 12·보낸 10통, 절반은 처음 보는 주소) — 📥 연락처 정리와 메일 화면이 읽는다
 * mail.js 가 이 파일의 data 를 함께 쓴다(같은 pu-cards.html 이다).
 * ⚠ 서랍·자료함 같은 메일 화면은 mail.js 의 views 에 있다.
 */
'use strict';

const DAY = 864e5;
const NOW = Date.now();

const 업체 = [
  '(주)가나다라마바사아자차카타파하종합건설',
  '가나상사',
  '(유)다라마바정밀기계공업',
  '주식회사 사아자차카타물류서비스',
  '(재)파하가나복지재단',
  '나다라 의료법인 점검병원',
  '마바사테크',
  '(주)아자차 글로벌 인터내셔널 홀딩스',
  '카타파 식품',
  '하가나다 협동조합',
  '(주)라마바사 반도체 장비',
  '점검유통',
  '가나다 농업회사법인 유한회사',
  '(주)차카타 소프트웨어 연구소',
];
const 이름 = ['점검가', '점검나', '점검다', '점검라', '점검마바사아', '점검바', '점검사', '점검아자', '점검차', '점검카'];
const 직책 = ['대표이사', '인사팀장', '경영지원본부 총무·인사파트 책임매니저', '과장', '사원', '전무이사', '노무담당', ''];
const 부서 = ['인사총무팀', '', '경영지원본부', '재무회계팀', '생산관리부 제2공장 품질보증과'];
const 업태 = ['건설업', '도매 및 소매업', '제조업', '운수 및 창고업', '보건업 및 사회복지 서비스업'];
const 종목 = ['종합건설', '산업용 기계 및 장비 도매', '반도체 제조용 기계 제조업', '화물운송 중개·대리 및 관련 서비스업', '일반병원'];
const 유형 = ['자문', '급여', '자문', '노조', '기금', '', '자문'];
const 담당 = ['P001', 'P002', 'P003', 'P002', ''];
const pad = (n, w) => String(n).padStart(w, '0');
const bizno = (i) => '000-00-' + pad(10000 + i * 37, 5);

const items = {};
/* 명함 32장 — 긴 이름·긴 직책·빈 칸(연락처 부족)을 섞는다 */
for (let i = 0; i < 32; i++) {
  const id = 'pa-card-' + pad(i, 3);
  const co = 업체[i % 업체.length];
  const it = {
    id, kind: 'card', name: 이름[i % 이름.length] + (i >= 10 ? String(i) : ''),
    company: co, title: 직책[i % 직책.length], dept: 부서[i % 부서.length],
    mobile: i % 7 === 3 ? '' : '010-0000-' + pad(1000 + i, 4),
    email: i % 7 === 3 ? '' : 'pa' + i + '@example.invalid',
    companyTel: i % 3 === 0 ? '02-0000-' + pad(2000 + i, 4) : '',
    owner: ['점검대표', '점검노무', ''][i % 3],
    /* 지어낸 주소 — 상세의 「📍 주소 → 지도」·「복사」를 보려고 (2026-10-27) */
    companyAddr: i % 4 === 1 ? '' : '점검시 점검구 점검로 ' + (10 + i) + ', ' + (i % 5 + 1) + '층',
    thumb: '', createdAt: NOW - i * 0.7 * DAY, updatedAt: NOW - i * 0.7 * DAY,
  };
  if (i % 9 === 0) it.fav = true;
  if (i % 11 === 5) it.memo = '지난번 상담 때 취업규칙 개정 얘기 — 다음 달 다시 연락';
  items[id] = it;
}
/* 사업자등록증 28장 */
for (let i = 0; i < 28; i++) {
  const id = 'pa-biz-' + pad(i, 3);
  const co = 업체[i % 업체.length] + (i >= 업체.length ? ' 제' + (i - 업체.length + 2) + '사업장' : '');
  items[id] = {
    id, kind: 'biz', company: co, ceo: 이름[(i + 3) % 이름.length], bizno: bizno(i),
    corpno: i % 2 ? '000000-' + pad(1000000 + i, 7) : '',
    bizType: 업태[i % 업태.length], bizItem: 종목[i % 종목.length],
    companyTel: i % 4 === 1 ? '' : '031-000-' + pad(3000 + i, 4),
    address: '점검시 점검구 가나다로 ' + (100 + i) + '번길 ' + (i + 1) + ', 점검빌딩 ' + (i % 5 + 2) + '층',
    openDate: '20' + pad(10 + (i % 15), 2) + '-0' + (1 + i % 9) + '-1' + (i % 9),
    thumb: '', createdAt: NOW - i * 1.3 * DAY, updatedAt: NOW - i * 1.3 * DAY,
  };
}

/* 이알피 업체 30곳 — 사업자번호로 등록증과 이어진다 */
const companies = [];
for (let i = 0; i < 30; i++) {
  const nm = i < 28 ? items['pa-biz-' + pad(i, 3)].company : 업체[i % 업체.length] + ' 신규';
  companies.push({
    id: 'co-pa-' + pad(i, 3), name: nm, bizNo: i < 28 ? bizno(i) : '',
    typeCode: 유형[i % 유형.length], managerMain: 담당[i % 담당.length],
    managerSubs: i % 5 === 0 ? ['P003'] : [],
    status: i % 9 === 4 ? 'terminated' : 'active',
    ceo: items['pa-biz-' + pad(Math.min(i, 27), 3)].ceo,
    phone: '031-000-' + pad(3000 + i, 4),
    contractStartDate: '2026-0' + (1 + i % 9) + '-01', contractEndDate: '2027-0' + (1 + i % 9) + '-01',
    contacts: [{ name: 이름[i % 이름.length], email: 'pa' + i + '@example.invalid', phone: '010-0000-' + pad(1000 + i, 4) }],
  });
}

/* 이알피 사건 30건 — 근로자 화면(👷)은 여기서만 사람이 생긴다 */
const 사건이름 = ['부당해고구제신청(노사)', '임금퇴직금기타체불노동부대리', '산업재해등사건대리', '직장 내 괴롭힘 진정 대리 및 조사 입회'];
const cases = [];
let wn = 0;
for (let i = 0; i < 30; i++) {
  const ws = [];
  const nW = i % 3 === 0 ? 3 : 1;     // 집단(3명)과 혼자 걸린 사건을 섞는다
  for (let j = 0; j < nW; j++) {
    wn++;
    ws.push({ id: 'w-pa-' + pad(wn, 3), name: '점검근로' + wn, phone: '010-0000-' + pad(5000 + wn, 4),
      position: ['생산직', '사무직', '현장소장(건설기계 운전)'][j], hireDate: '2024-0' + (1 + j) + '-02',
      isPrimary: j === 0 });
  }
  cases.push({
    id: 'case-pa-' + pad(i, 3), bizNo: bizno(i % 28), companyName: items['pa-biz-' + pad(i % 28, 3)].company,
    typeName: 사건이름[i % 사건이름.length], caseNo: '사건-2026-' + (100 + i),
    status: i % 4 === 3 ? 'done' : 'progress', createdAt: NOW - i * 3 * DAY, workers: ws,
  });
}

/* ── 메일 자료 — 메일 화면(mail.js)과 📥 연락처 정리가 읽는다 ── */
const 보낸이 = ['점검가', '(주)가나다라마바사아자차카타파하종합건설 인사총무팀 점검나', '점검다 노무사', '점검라',
  '고용노동부 점검지청 근로개선지도과', '점검마바사아', '(재)파하가나복지재단 사무국', '점검바'];
const 제목 = [
  '10월 임금대장 송부드립니다',
  '[긴급] 부당해고 구제신청 사건 — 지방노동위원회 심문회의 일정 변경 안내 및 추가 자료 제출 요청',
  'RE: 취업규칙 개정안 검토 의견 회신',
  '사내근로복지기금 출연금 관련 문의',
  '(첨부) 4대보험 취득신고서',
  '연차휴가 촉진 통지서 양식 요청드립니다',
  '',
  'FW: 고용노동부 근로감독 사전 자료 요청 (기한 10/25)',
];
const 미리 = [
  '안녕하세요, 10월분 임금대장 첨부와 같이 보내드립니다. 확인 부탁드립니다.',
  '심문회의가 11월 둘째 주로 변경되었습니다. 이유서 보완 자료를 금주 중으로 부탁드립니다.',
  '',
  '출연 한도와 사용 범위에 대해 여쭙고자 합니다.',
];

function msgs(n, base, opt) {
  const o = {};
  for (let i = 0; i < n; i++) {
    const u = base + i;
    const sent = opt && opt.sent;
    o[String(u)] = {
      u, f: 보낸이[i % 보낸이.length], e: ((i % 8 === 3 || i % 2 === 0) ? 'new' + (u % 23) : 'pa' + (i % 9)) + '@example.invalid',   // 절반은 처음 보는 주소(📥 연락처 정리 감)
      t: sent ? 'pa' + (i % 9) + '@example.invalid' : 'p001@pureun.kr', tn: sent ? 보낸이[i % 보낸이.length] : '점검대표',
      s: 제목[i % 제목.length], p: 미리[i % 미리.length],
      d: NOW - i * 0.31 * DAY - (opt && opt.shift || 0),
      r: i % 3 === 0 ? 0 : 1, g: i % 7 === 2 ? 1 : 0, a: i % 4 === 1 ? 2 : 0, w: i % 5 === 3 ? 1 : 0,
    };
  }
  return o;
}

const folders = {
  B_INBOX: { path: 'INBOX', name: 'INBOX', kind: 'inbox', order: 1, total: 30, unseen: 10 },
  B_SENT: { path: 'Sent Messages', name: 'Sent Messages', kind: 'sent', order: 2, total: 10, unseen: 0 },
  B_DRAFT: { path: 'Drafts', name: 'Drafts', kind: 'drafts', order: 3, total: 0, unseen: 0 },
  B_GONG: { path: '6.공공기관(노동부·공단·노동위원회)', name: '6.공공기관(노동부·공단·노동위원회)', kind: 'custom', order: 7, total: 12, unseen: 4 },
  B_TAX: { path: '세금계산서', name: '세금계산서', kind: 'custom', order: 7, total: 0, unseen: 0 },
  B_SPAM: { path: 'Spam', name: 'Spam', kind: 'spam', order: 8, total: 0, unseen: 0 },
  B_TRASH: { path: 'Trash', name: 'Trash', kind: 'trash', order: 9, total: 0, unseen: 0 },
};

const data = {
  pucards: {
    items,
    groups: {
      'pa-g1': { id: 'pa-g1', name: '자문사', order: 1 },
      'pa-g2': { id: 'pa-g2', name: '급여대행 거래처(제조·물류)', order: 2 },
    },
    config: { seeded: { bizFolders: true, profTabs: true, erpTabs: true, closedTab: true, classifyRules: true } },
  },
  data: {
    companies: { v: companies },
    cases: { v: cases },
  },
  mailbox: {
    folders,
    meta: { lastSync: NOW - 600e3, rows: 52 },
    msgs: {
      B_INBOX: msgs(30, 1000),
      B_GONG: msgs(12, 2000, { shift: 0.1 * DAY }),
      B_SENT: msgs(10, 3000, { sent: true }),
    },
  },
};

/* ── 화면 열기 ── 한 페이지에서 차례로 연다(앞 화면에서 열린 창은 back 으로 닫는다) */
const clickFirst = (sel) => async (page) => { await page.locator(sel).first().click({ timeout: 4000 }); };
const esc = async (page) => {
  await page.evaluate(() => {
    document.querySelectorAll('.modalbg.open').forEach((m) => m.classList.remove('open'));
    try { closeDetail(); } catch (e) {}
  });
};

module.exports = {
  data,
  views: [
    { name: 'biz', run: clickFirst('#tabBiz') },
    { name: 'co', run: clickFirst('#tabCo'), wait: 2500 },
    { name: 'codetail', run: clickFirst('#list .row'), wait: 2500, back: async (page) => { await page.evaluate(() => { try { history.back(); } catch (e) {} }); } },
    { name: 'wk', run: clickFirst('#tabWk'), wait: 3000 },
    { name: 'cnt', run: clickFirst('#tabCnt'), wait: 2500 },
    { name: 'card', run: clickFirst('#tabCard') },
    { name: 'detail', run: clickFirst('#list .row'), back: esc },
    /* 명함 상세 — 번호는 걸리고, 이메일·주소 옆에 「복사」 (대표 지시 2026-10-27) */
    { name: 'detail-rows', wait: 1200, run: async (page) => {
      await page.locator('#tabCard').first().click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(1200);
      await page.locator('#list .row').first().click({ timeout: 4000 }); await page.waitForTimeout(800);
      await page.evaluate(() => { const r = document.querySelector('#detailM .daddr'); if (r) r.scrollIntoView({ block: 'center' }); });
    }, back: async (page) => { await page.evaluate(() => { try { closeDetail(); } catch (e) {} }); } },
    /* 명함 상세 — 주소를 누르면 지도 창 (대표 지시 2026-10-27) */
    { name: 'detail-map', wait: 1500, run: async (page) => {
      await page.locator('#tabCard').first().click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(1200);   /* --view 로 이것만 열어도 되게 */
      await page.locator('#list .row').first().click({ timeout: 4000 }); await page.waitForTimeout(800);
      await page.locator('#detailM .daddr').first().click({ timeout: 4000 });
    }, back: async (page) => { await page.evaluate(() => { try { closeAddrMap(); closeDetail(); } catch (e) {} }); } },
    { name: 'sel', run: async (page) => { await page.evaluate(() => toggleSelMode()); await page.locator('#list .row').nth(1).click(); },
      back: async (page) => { await page.evaluate(() => toggleSelMode()); } },
    { name: 'search', run: async (page) => { await page.locator('#appbar .iconbtn').first().click(); await page.fill('#search', '점검'); },
      back: async (page) => { await page.fill('#search', ''); await page.evaluate(() => searchbar.classList.remove('open')); } },
    { name: 'menu', run: async (page) => { await page.evaluate(() => openMenu()); }, back: esc },
  ],
};
