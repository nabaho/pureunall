'use strict';
/* 인사관리 급여·성과급·연차 엑셀 통합 자동반영·담당자검수 및 3개 대시보드 즐겨찾기 상단고정 검사
 * 실행: node --test tests/hr-excel-auto-ui.test.js
 * ★ 지어낸 자료(가나상사·다라물류·직원 가나다/라마바 등)만 쓰며 실제 인명·주민번호·거래처를 넣지 않는다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');
const { finRuleSrc } = require('./fin-one-rule-src');
const { stripJs } = require('./strip-comments');
const Sync = require('../js/pu-hr-excel-sync.js');

const ROOT = path.join(__dirname, '..');
const RAW = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
const SRC = RAW.replace(/\r\n/g, '\n');

function erpBox() {
  const ctx = {
    String, Number, Boolean, Array, Object, Math, Date, JSON, RegExp,
    parseInt, parseFloat, isNaN, isFinite, console,
    isPayrollLocked: (ym) => ctx._locked.indexOf(ym) >= 0,
    todayYMD: () => '2026-10-15',
    _locked: [],
    window: {}
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(
    finRuleSrc(SRC) + '\n' +
    cutFn(SRC, 'function erpPerfMonthOf(') + '\n' +
    cutFn(SRC, 'function erpPerfCounts(') + '\n' +
    cutFn(SRC, 'function erpNextOpenYM(') + '\n' +
    cutFn(SRC, 'function payLedgerSheetRecs('),
    ctx
  );
  return ctx;
}

test('① 인센티브 시트 파싱 — 상여구분 귀속월(9월 말 입금 → 10월 귀속)·연말경계·비율·업체분리·공급가액 역산·빈 줄 제외', () => {
  const rows = [
    ['가상노무법인 월별 상여내역'],
    ['상여구분', '입금일', '항목', '입금금액', '부가세 제외', '성과금 비율', '금액', '수령인', '비고', '', '성명', '가나다', '라마바', '계'],
    ['10월', '2026-09-30', '가나상사_인사노무컨설팅(임금조정)', 2200000, 2000000, 0.15, 300000, '가나다', '이월귀속', '', '10월', 300000, 130000, 430000],
    ['10월', '2026-10-29', '다라복지기금 시범사업 신청 수수료', '', 1000000, '13%', 130000, '라마바', '', '', '', '', '', ''],
    ['1월', '2026-12-29', '마바테크_산재 성공보수', 1100000, 1000000, '15%', 150000, '가나다', '연말경계'],
    ['1월', '2026-10-31', '사아기업_미정산건', 500000, 454545, '0%', '-', '가나다', ''],
    ['1월', '', '', '', '', '0%', '-', '', '']
  ];
  const parsed = Sync.parseIncentiveSheet(rows, { fallbackYear: 2026 });
  assert.equal(parsed.headerFound, true);
  assert.equal(parsed.rows.length, 3, '빈 서식 줄과 오른쪽 요약표는 행으로 잡히면 안 됩니다');
  assert.ok(parsed.skippedZero >= 1);

  const r0 = parsed.rows[0];
  assert.equal(r0.date, '2026-09-30');
  assert.equal(r0.perfYM, '2026-10', '9월 30일 입금이어도 상여구분이 10월이면 2026-10 귀속이어야 합니다');
  assert.equal(r0.companyName, '가나상사');
  assert.equal(r0.kind, '인사노무컨설팅(임금조정)');
  assert.equal(r0.pct, 15);
  assert.equal(r0.perfAmount, 300000);
  assert.equal(r0.hasVat, true);

  const r1 = parsed.rows[1];
  assert.equal(r1.payAmount, 1000000, '입금금액 칸이 비어 있으면 부가세 제외 공급가액으로 보완합니다');
  assert.equal(r1.pct, 13);
  assert.equal(r1.companyName, '다라복지기금');

  const r2 = parsed.rows[2];
  assert.equal(r2.perfYM, '2027-01', '12월 입금의 1월 상여구분은 다음 해 1월 귀속이어야 합니다');
});

test('② 인센티브 자동반영 계획·적용 — 재무 입금 자동연결은 매출을 건드리지 않고, 미등록 건은 매출 제외(perf-adjust)로 생성한다', () => {
  const E = erpBox();
  const users = [
    { sid: 'U-1', name: '가나다', status: 'active' },
    { sid: 'U-2', name: '라마바', status: 'active' },
    { sid: 'U-3A', name: '동명이', status: 'active' },
    { sid: 'U-3B', name: '동명이', status: 'active' }
  ];
  const existingFi = [
    {
      id: 'fi-rev-1',
      date: '2026-09-30',
      companyName: '(주)가나상사',
      kind: '인사노무컨설팅',
      sourceKind: 'consulting',
      amount: 2200000,
      perfBaseAmount: 2000000,
      perfShares: []
    },
    {
      id: 'fi-legacy-inc',
      date: '2026-09-28',
      companyName: '사아공단',
      kind: '직장 내 괴롭힘 조사',
      sourceKind: 'incentive',
      amount: 4000000,
      perfShares: [{ sid: 'U-2', name: '라마바', pct: 20, amount: 727272 }]
    }
  ];
  const parsedRows = [
    {
      rowNo: 3, ymLabel: '10월', perfYM: '2026-10', date: '2026-09-30',
      rawItem: '가나상사_인사노무컨설팅', companyName: '가나상사', kind: '인사노무컨설팅',
      payAmount: 2200000, supplyAmount: 2000000, pct: 15, perfAmount: 300000, recipientName: '가나다', hasVat: true
    },
    {
      rowNo: 4, ymLabel: '10월', perfYM: '2026-10', date: '2026-10-15',
      rawItem: '자차물산_체당금 수수료', companyName: '자차물산', kind: '체당금 수수료',
      payAmount: 1100000, supplyAmount: 1000000, pct: 15, perfAmount: 150000, recipientName: '가나다', hasVat: true
    },
    {
      rowNo: 5, ymLabel: '10월', perfYM: '2026-10', date: '2026-09-28',
      rawItem: '사아공단_직장 내 괴롭힘 조사', companyName: '사아공단', kind: '직장 내 괴롭힘 조사',
      payAmount: 4000000, supplyAmount: 3636364, pct: 20, perfAmount: 727272, recipientName: '라마바', hasVat: true
    },
    {
      rowNo: 6, ymLabel: '10월', perfYM: '2026-10', date: '2026-10-20',
      rawItem: '카타상회_자문', companyName: '카타상회', kind: '자문',
      payAmount: 550000, supplyAmount: 500000, pct: 10, perfAmount: 50000, recipientName: '동명이', hasVat: true
    },
    {
      rowNo: 7, ymLabel: '8월', perfYM: '2026-08', date: '2026-08-20',
      rawItem: '파하기업_컨설팅', companyName: '파하기업', kind: '컨설팅',
      payAmount: 1100000, supplyAmount: 1000000, pct: 15, perfAmount: 150000, recipientName: '가나다', hasVat: true
    }
  ];

  const plans = Sync.planIncentiveSync(parsedRows, {
    users,
    financeIncomes: existingFi,
    lockedPayrollMonths: ['2026-08']
  });

  assert.equal(plans[0].status, 'auto_link', '날짜·금액·업체가 일치하는 무배분 재무 입금은 자동 연결 대상이어야 합니다');
  assert.equal(plans[0].action, 'link_income');
  assert.equal(plans[0].checked, true);

  assert.equal(plans[1].status, 'auto_perf_only', '재무 입금에 없는 건은 매출 제외 성과 전용(perf-adjust) 자동 반영이어야 합니다');
  assert.equal(plans[1].checked, true);

  assert.equal(plans[2].action, 'fix_perf_ym', '옛 날짜달 기준 인센티브 줄은 귀속월 보정으로 잡아야 합니다');
  assert.equal(plans[2].checked, true);

  assert.equal(plans[3].status, 'needs_review', '동명이인은 자동 배정하지 않고 담당자 검토로 보류해야 합니다');
  assert.equal(plans[3].checked, false);

  assert.equal(plans[4].status, 'needs_review', '마감된 급여월은 자동으로 건드리지 않고 담당자 검토로 보류해야 합니다');
  assert.equal(plans[4].checked, false);
  assert.equal(plans[4].action, 'perf_only_next_open');

  /* 자동 승인된 3건 적용 검증 */
  E._locked = ['2026-08'];
  const built = Sync.buildIncentiveUpserts(plans, {
    users,
    financeIncomes: existingFi,
    nextOpenYM: (ym) => E.erpNextOpenYM(ym),
    actorName: '검수담당'
  });

  assert.equal(built.linkedCount, 2, '기존 입금 연결 1건 + 옛 인센티브 귀속월 보정 1건');
  assert.equal(built.createdCount, 1, '신규 성과 전용 레코드 1건');

  const linkedRev = built.upserts.find((x) => x.id === 'fi-rev-1');
  assert.equal(linkedRev.amount, 2200000, '원본 재무 입금의 매출 금액은 1원도 바뀌면 안 됩니다');
  assert.equal(E.erpIncomeIsRevenue(linkedRev), true, '원본 매출 입금은 여전히 매출이어야 합니다');
  assert.equal(E.erpPerfMonthOf(linkedRev), '2026-10', '9월 입금이라도 10월 귀속으로 연결되어야 합니다');
  assert.equal(linkedRev.perfShares.length, 1);
  assert.equal(linkedRev.perfShares[0].sid, 'U-1');
  assert.equal(linkedRev.perfShares[0].amount, 300000);

  const fixedLegacy = built.upserts.find((x) => x.id === 'fi-legacy-inc');
  assert.equal(E.erpPerfMonthOf(fixedLegacy), '2026-10');
  assert.equal(fixedLegacy.sourceKind, 'perf-adjust', '옛 sourceKind:incentive 줄은 귀속월 보정 시 perf-adjust 로 전환해 재무 매출 이중집계를 막아야 합니다');
  assert.equal(E.erpIncomeIsRevenue(fixedLegacy), false);

  const createdPerfOnly = built.upserts.find((x) => x.id !== 'fi-legacy-inc' && x.sourceKind === 'perf-adjust');
  assert.ok(createdPerfOnly, '성과 전용 레코드가 생성되어야 합니다');
  assert.equal(E.erpIncomeIsRevenue(createdPerfOnly), false, '★ 성과 전용 레코드가 재무 매출로 잡히면 이중 집계됩니다');
  assert.equal(E.erpPerfCounts(createdPerfOnly, true), true, '급여·성과 계산에는 정상 반영되어야 합니다');
  assert.equal(E.erpPerfMonthOf(createdPerfOnly), '2026-10');

  /* 담당자가 마감월 건을 «다음 열린 달 조정 이월»로 체크해 반영하면 열린 달로 넘어간다 */
  plans[4].checked = true;
  const builtLocked = Sync.buildIncentiveUpserts([plans[4]], {
    users,
    financeIncomes: existingFi,
    nextOpenYM: (ym) => E.erpNextOpenYM(ym)
  });
  assert.equal(builtLocked.createdCount, 1);
  assert.equal(builtLocked.upserts[0].perfYM, '2026-10', '마감된 2026-08 대신 열린 달로 이월되어야 합니다');
});

test('③ 급여대장 시트 파싱·검수 — 주민번호 열 없는 2줄 머리글·업무비용·미매칭 직원 보존·성과금 이중합산 방지', () => {
  const E = erpBox();
  const users = [
    { sid: 'U-1', name: '가나다', rrn: '' },
    { sid: 'U-2', name: '라마바', rrn: '' }
  ];
  const rawRows = [
    ['2026년 10월 급여대장'],
    ['계산기간 : 2026-10-01 ~ 2026-10-31 / 지급일 : 2026-11-05'],
    ['연번', '성명', '통상시급', '소정근로시간', '월급', '업무분담수당', '식대(비과세)', '차량유지비(비과세)', '성과금', '지급액', '과세임금', '공제내역', '', '', '', '', '', '공제총액', '실수령액', '업무비용'],
    ['', '', '', '', '기본급', '', '', '', '', '', '', '소득세', '지방소득세', '국민연금', '건강보험', '장기요양', '고용보험', '', '', ''],
    [1, '가나다', 15072, 209, 3150000, 0, 200000, 200000, 300000, 3850000, 3450000, 120000, 12000, 140000, 110000, 14000, 30000, 426000, 3424000, 68800],
    [2, '라마바', 14354, 209, 3000000, 300000, 0, 0, 150000, 3450000, 3450000, 110000, 11000, 135000, 107000, 14000, 31000, 408000, 3042000, 0],
    [3, '미등록자', 12000, 209, 2500000, 0, 0, 0, 0, 2500000, 2500000, 40000, 4000, 112500, 89870, 11800, 22500, 280670, 2219330, 15000],
    ['합계', '', '', '', 8650000, 300000, 200000, 200000, 450000, 9800000, 9400000, 270000, 27000, 387500, 306870, 39800, 83500, 1114670, 8685330, 83800]
  ];

  assert.equal(Sync.extractSheetPaidDate(rawRows), '2026-11-05');

  const parsed = E.payLedgerSheetRecs(rawRows, '2026-10', users);
  assert.equal(parsed.header, true, '주민번호 열이 없어도 성명+기본급+지급액 머리글을 인식해야 합니다');
  assert.equal(parsed.recs.length, 2);
  assert.equal(JSON.stringify(parsed.nomatch), JSON.stringify(['미등록자']));
  assert.equal(parsed.unmatchedRecs.length, 1, '미매칭 이름 행도 금액 원본을 보존해 검수 창에서 직원을 고를 수 있어야 합니다');
  assert.equal(parsed.unmatchedRecs[0].baseSalary, 2500000);
  assert.equal(parsed.unmatchedRecs[0].businessExpense, 15000);

  const r0 = parsed.recs[0];
  assert.equal(r0.nonTaxableMeal, 200000);
  assert.equal(r0.nonTaxableCar, 200000);
  assert.equal(r0.bonus, 300000);
  assert.equal(r0.businessExpense, 68800);

  /* 인센티브 계획에서 가나다=300,000원(일치), 라마바=200,000원(불일치: 급여대장은 150,000원) 시나리오 */
  const incPlans = [
    { empSid: 'U-1', checked: true, action: 'perf_only', status: 'auto_perf_only', row: { perfYM: '2026-10', perfAmount: 300000 } },
    { empSid: 'U-2', checked: true, action: 'perf_only', status: 'auto_perf_only', row: { perfYM: '2026-10', perfAmount: 200000 } }
  ];
  const payPlans = Sync.planPayrollSync([{ ym: '2026-10', rawRows, parsed }], {
    users,
    payrollMonthly: [],
    financeIncomes: [],
    incentivePlans: incPlans,
    lockedPayrollMonths: []
  });

  assert.equal(payPlans.length, 3);
  assert.equal(payPlans[0].status, 'auto_new');
  assert.equal(payPlans[0].checked, true);
  assert.equal(payPlans[0].rec.paidDate, '2026-11-05');
  assert.equal(payPlans[0].rec.bonusIsPerf, true, '인센티브 합계와 급여대장 성과금이 같으면 bonusIsPerf=true 로 이중 합산을 막아야 합니다');
  assert.equal(payPlans[0].applyExpenseAsReimb, true);

  assert.equal(payPlans[1].status, 'needs_review', '인센티브 합계와 급여대장 성과금이 다르면 담당자 검토로 분류해야 합니다');
  assert.equal(payPlans[1].checked, false);

  assert.equal(payPlans[2].status, 'needs_review', '미등록 직원 행도 누락되지 않고 검수 대상에 올라야 합니다');
  assert.equal(payPlans[2].checked, false);
  assert.equal(payPlans[2].rec.netPay, 2219330);
});

test('④ 휴가대장(연차대장) 시트 파싱·검수 — 1~12월 열 요약·신규 자동반영·일치 건너뜀·산식 오차 검수', () => {
  const rows = [
    ['2026년 연차휴가 관리대장'],
    ['성명', '발생연차', '1월', '2월', '3월', '8월', '사용일수', '잔여일수', '비고'],
    ['가나다', 15, 0, '', 1, 2.5, 3.5, 11.5, '정상'],
    ['라마바', 15, 1, 0, 0, 0, 1, 14, '기존일치'],
    ['마바사', 15, 2, 0, 0, 0, 2, 10, '산식불일치'],
    ['합계', 45, 3, 0, 1, 2.5, 6.5, 35.5, '']
  ];
  const parsed = Sync.parseLeaveSheet(rows, '휴가대장', 2026);
  assert.equal(parsed.headerFound, true);
  assert.equal(parsed.rows.length, 3);
  assert.equal(parsed.rows[0].monthly, '3월:1, 8월:2.5');

  const users = [
    { sid: 'U-1', name: '가나다', status: 'active' },
    { sid: 'U-2', name: '라마바', status: 'active' },
    { sid: 'U-3', name: '마바사', status: 'active' }
  ];
  const existing = [
    { id: 'lv-u2-2026', year: 2026, sid: 'U-2', name: '라마바', granted: 15, used: 1, remain: 14, monthly: '1월:1', note: '기존일치' }
  ];
  const plans = Sync.planLeaveSync(parsed.rows, { users, leaveLedger: existing });

  assert.equal(plans[0].status, 'auto_new');
  assert.equal(plans[0].checked, true);

  assert.equal(plans[1].status, 'already_synced');
  assert.equal(plans[1].checked, false);

  assert.equal(plans[2].status, 'needs_review', '부여 - 사용 ≠ 잔여 인 행은 자동으로 넣지 않고 검수로 돌려야 합니다');
  assert.equal(plans[2].checked, false);
});

test('⑤ 화면 배선 규칙 — 성과관리 귀속월 일치 · 급여관리 성과급 합계 및 합계줄 · 3개 대시보드 별표 상단고정', () => {
  /* 1. 순수 엔진 스크립트가 캐시 번호와 함께 실려 있어야 한다 */
  assert.match(RAW, /<script src="js\/pu-hr-excel-sync\.js\?v=\d+"><\/script>/);

  /* 2. 성과관리(PerfManagement)는 입금일 달이 아니라 erpPerfMonthOf(fi)로 월·연도를 거른다 */
  const perfFn = stripJs(cutFn(SRC, 'function PerfManagement('));
  assert.match(perfFn, /erpPerfMonthOf\(fi\)\s*===\s*ym/, '성과관리가 erpPerfMonthOf 대신 입금일 달로 거르면 급여관리와 성과급이 어긋납니다');
  assert.doesNotMatch(perfFn, /\(fi\.date\s*\|\|\s*''\)\.slice\(0,\s*7\)\s*===\s*ym/);
  assert.match(perfFn, /HrExcelSyncModal/, '성과관리에서 통합 엑셀 자동반영·검수 모달을 열 수 있어야 합니다');
  assert.match(perfFn, /payDirectOnlyList/, '급여대장 수기 상여와 성과관리 불일치를 대조해야 합니다');

  /* 3. 급여관리(PayrollLedger)는 KPI 성과급 합계에 직접 입력 상여(rowPerf)를 포함하고 하단 tfoot 합계줄을 그린다 */
  const payFn = stripJs(cutFn(SRC, 'function PayrollLedger('));
  assert.match(payFn, /perf:\s*t\.perf\s*\+\s*rowPerf/, '수기 상여만 있는 달에 성과급 합계 KPI가 0원으로 나오면 안 됩니다');
  assert.match(payFn, /h\('tfoot'/, '급여대장 표 하단에 열별 합계(tfoot) 줄이 있어야 합니다');
  assert.match(payFn, /HrExcelSyncModal/, '급여관리에서도 통합 엑셀 자동반영·검수 모달을 열 수 있어야 합니다');

  /* 4. 휴가관리 연차대장(LeaveLedgerTab)도 엑셀 검수 모달과 tfoot 합계줄을 갖추고 기존 ID 병합을 유지한다 */
  const leaveFn = stripJs(cutFn(SRC, 'function LeaveLedgerTab('));
  assert.match(leaveFn, /HrExcelSyncModal/);
  assert.match(leaveFn, /h\('tfoot'/);
  assert.match(leaveFn, /leaveLedgerWithIds/);

  /* 5. 좌측 사이드바(Sidebar)는 3개 대시보드 공통으로 2칸 즐겨찾기 탭을 없애고 별표(⭐) 항목만 상단에 올린다 */
  const sbFn = stripJs(cutFn(SRC, 'function Sidebar('));
  assert.doesNotMatch(sbFn, /즐겨찾기\s*\('/, '상단 [전체 / 즐겨찾기(N)] 2칸 전환 셀이 남아 있으면 안 됩니다');
  assert.doesNotMatch(sbFn, /sbView/, '옛 sbView 전환 상태가 남아 있으면 안 됩니다');
  assert.match(sbFn, /'data-sb-pinned':\s*'1'/, '별표 찍은 메뉴가 사이드바 상단 고정 영역에 그려져야 합니다');
  assert.match(sbFn, /puAppHasGroup\(p\.grp\.gid\)/, '이알피·재무관리·인사관리 3개 대시보드 모두 자기 앱 메뉴만 상단 고정에 노출해야 합니다');
  assert.match(sbFn, /!sbQuery\s*&&\s*pinned\.indexOf\(item\.id\)\s*>=\s*0/, '별표로 상단에 올라간 메뉴는 아래 그룹에서 중복 표시되지 않아야 합니다');
});

test('⑥ 인센티브 경계 사례 — 비정상 날짜 거부 · 중복 행 차단 · 기존 perfYM 정리 · 타 직원 공동배분 오염 방지 · 저장 시점 마감·삭제 가드', () => {
  const E = erpBox();
  assert.equal(Sync.fmtDate('2026-13-45'), '', '13월 45일 같은 비정상 날짜는 거부해야 합니다');
  assert.equal(Sync.fmtDate('2026-02-30'), '', '2월 30일 같은 달력 밖 날짜는 거부해야 합니다');
  assert.equal(Sync.fmtDate('2026-99-99'), '');
  assert.equal(Sync.fmtDate('2026-02-28'), '2026-02-28');

  const users = [
    { sid: 'U-1', name: '가나다', status: 'active' },
    { sid: 'U-2', name: '라마바', status: 'active' }
  ];
  const existingFi = [
    /* 10월 1일 입금인데 예전에 perfYM:'2026-09' 가 남아 있던 무배분 입금 */
    {
      id: 'fi-stale-ym',
      date: '2026-10-01',
      perfYM: '2026-09',
      companyName: '가나상사',
      kind: '체당금 수수료',
      sourceKind: 'case',
      amount: 1100000,
      perfBaseAmount: 1000000,
      perfShares: []
    },
    /* 다른 직원(U-2)의 9월 배분이 이미 들어 있는 공동배분 입금 */
    {
      id: 'fi-shared-other-ym',
      date: '2026-09-29',
      perfYM: '2026-09',
      companyName: '다라물류',
      kind: '컨설팅',
      sourceKind: 'consulting',
      amount: 2200000,
      perfBaseAmount: 2000000,
      perfShares: [{ sid: 'U-2', name: '라마바', pct: 10, amount: 200000 }]
    }
  ];

  const dupRow = {
    rowNo: 3, ymLabel: '10월', perfYM: '2026-10', date: '2026-10-01',
    rawItem: '가나상사_체당금 수수료', companyName: '가나상사', kind: '체당금 수수료',
    payAmount: 1100000, supplyAmount: 1000000, pct: 15, perfAmount: 150000, recipientName: '가나다', hasVat: true
  };
  const sharedConflictRow = {
    rowNo: 5, ymLabel: '10월', perfYM: '2026-10', date: '2026-09-29',
    rawItem: '다라물류_컨설팅', companyName: '다라물류', kind: '컨설팅',
    payAmount: 2200000, supplyAmount: 2000000, pct: 15, perfAmount: 300000, recipientName: '가나다', hasVat: true
  };

  const plans = Sync.planIncentiveSync([dupRow, Object.assign({}, dupRow, { rowNo: 4 }), sharedConflictRow], {
    users,
    financeIncomes: existingFi,
    lockedPayrollMonths: []
  });

  assert.equal(plans[0].status, 'auto_link');
  assert.equal(plans[0].checked, true);
  assert.equal(plans[1].status, 'needs_review', '동일 엑셀 내 완전히 같은 중복 행은 자동 체크하지 않고 검수로 보류해야 합니다');
  assert.equal(plans[1].checked, false);
  assert.equal(plans[1].duplicateInBatch, true);

  assert.equal(plans[2].status, 'needs_review', '타 직원 9월 배분이 있는 입금에 10월 귀속 행이 들어오면 자동 연결로 남의 귀속월을 바꾸면 안 됩니다');
  assert.equal(plans[2].action, 'perf_only');
  assert.equal(plans[2].checked, false);

  /* 1) stale perfYM('2026-09')이 있던 10월 1일 입금에 2026-10 귀속 연결 시 stale perfYM 제거 확인 */
  const builtOk = Sync.buildIncentiveUpserts(plans, {
    users,
    financeIncomes: existingFi,
    lockedPayrollMonths: []
  });
  assert.equal(builtOk.upserts.length, 1);
  assert.equal(E.erpPerfMonthOf(builtOk.upserts[0]), '2026-10', '기존에 남아 있던 잘못된 perfYM(2026-09)이 지워져 2026-10 귀속이 되어야 합니다');

  /* 2) 저장 직전에 2026-10 급여월이 마감된 경우 buildIncentiveUpserts 가 즉시 차단 */
  const builtLockedAtSave = Sync.buildIncentiveUpserts(plans, {
    users,
    financeIncomes: existingFi,
    lockedPayrollMonths: ['2026-10']
  });
  assert.equal(builtLockedAtSave.upserts.length, 0);
  assert.equal(builtLockedAtSave.lockedSkipped, 1);
});

test('⑦ 급여·휴가 경계 사례 — 긴·영문 성명 인식 · 주민번호 충돌 보류 · 세금/수당 차이 감지 · 휴가 오류셀 및 기존 연차 차이 보류', () => {
  const E = erpBox();
  const users = [
    { sid: 'U-1', name: '김수한무거북이', rrn: '' },
    { sid: 'U-2', name: 'John Smith', rrn: '' }
  ];
  const rawPay = [
    ['성명', '기본급', '성과금', '지급액', '소득세', '지방소득세', '공제총액', '실수령액'],
    ['김수한무거북이', 3000000, 0, 3000000, 90000, 9000, 99000, 2901000],
    ['John Smith', 3200000, 0, 3200000, 100000, 10000, 110000, 3090000],
    ['신규외국인직원테스트', 2800000, 0, 2800000, 70000, 7000, 77000, 2723000]
  ];
  const parsedPay = E.payLedgerSheetRecs(rawPay, '2026-10', users);
  assert.equal(parsedPay.recs.length, 2, '6글자 초과 한글 이름과 공백 포함 영문 이름도 누락 없이 인식해야 합니다');
  assert.equal(parsedPay.nomatch.length, 1);
  assert.equal(parsedPay.nomatch[0], '신규외국인직원테스트');

  /* 주민번호 충돌(conflicts)이 있거나 기본급·실지급액은 같지만 소득세가 다른 경우 점검 */
  const parsedWithConflict = {
    header: true,
    conflicts: ['김수한무거북이'],
    recs: [
      { empSid: 'U-1', empName: '김수한무거북이', ym: '2026-10', baseSalary: 3000000, grossPay: 3000000, netPay: 2901000, incomeTax: 90000, localIncomeTax: 9000 },
      { empSid: 'U-2', empName: 'John Smith', ym: '2026-10', baseSalary: 3200000, grossPay: 3200000, netPay: 3090000, incomeTax: 120000, localIncomeTax: 12000 }
    ],
    nomatch: [],
    unmatchedRecs: []
  };
  const prevPay = [
    /* U-2는 기본급·총지급·실지급이 같지만 기존 소득세(100,000)와 엑셀 소득세(120,000)가 다름 */
    { id: 'pay-u2', empSid: 'U-2', ym: '2026-10', baseSalary: 3200000, grossPay: 3200000, netPay: 3090000, incomeTax: 100000, localIncomeTax: 10000, status: 'draft' }
  ];
  const payPlans = Sync.planPayrollSync([{ ym: '2026-10', rawRows: rawPay, parsed: parsedWithConflict }], {
    users,
    payrollMonthly: prevPay,
    financeIncomes: [],
    incentivePlans: [],
    lockedPayrollMonths: []
  });
  assert.equal(payPlans[0].status, 'needs_review', '주민번호 충돌 직원은 자동 신규 반영(auto_new)하면 안 됩니다');
  assert.equal(payPlans[0].checked, false);
  assert.equal(payPlans[1].status, 'needs_review', '기본급·실지급액이 같아도 소득세 등 세부 공제가 다르면 already_synced 로 건너뛰면 안 됩니다');
  assert.equal(payPlans[1].checked, false);

  /* 휴가대장 오류 문자열(#VALUE!) 및 기존 연차 차이 행 기본 미체크 검증 */
  const lvRows = [
    ['성명', '발생연차', '사용일수', '잔여일수'],
    ['김수한무거북이', 15, '#VALUE!', 15],
    ['John Smith', 15, 3, 12]
  ];
  const parsedLv = Sync.parseLeaveSheet(lvRows, '휴가대장', 2026);
  assert.equal(parsedLv.rows.length, 2);
  assert.equal(parsedLv.rows[0].invalidCell, true);

  const lvPlans = Sync.planLeaveSync(parsedLv.rows, {
    users,
    leaveLedger: [{ id: 'lv-u2', year: 2026, sid: 'U-2', name: 'John Smith', granted: 15, used: 2, remain: 13, monthly: '', note: '' }]
  });
  assert.equal(lvPlans[0].status, 'needs_review', '엑셀 수식 오류(#VALUE!)가 든 행은 자동 반영하면 안 됩니다');
  assert.equal(lvPlans[0].checked, false);
  assert.equal(lvPlans[1].status, 'needs_review', '기존 연차대장과 값이 다른 행은 담당자 확인 후 반영하도록 기본 미체크여야 합니다');
  assert.equal(lvPlans[1].checked, false);
});

test('⑧ 검수 모달 저장 가드 · 키보드 접근성 · 모바일 카드 전환 · 휴지통 소프트삭제 배선', () => {
  const modalFn = stripJs(cutFn(SRC, 'function HrExcelSyncModal('));
  assert.match(modalFn, /okInc\s*===\s*false/, 'dbUpsertMany 실패(false) 시 성공 토스트를 띄우거나 창을 닫으면 안 됩니다');
  assert.match(modalFn, /okPay\s*===\s*false/, '급여 dbSet 실패(false) 시 중단해야 합니다');
  assert.match(modalFn, /okLv\s*===\s*false/, '연차 dbSet 실패(false) 시 중단해야 합니다');
  assert.match(modalFn, /mergePayPlanUserEdits/, '인센티브 체크를 바꿔도 급여 탭에서 수동 지정한 직원·체크 상태가 보존되어야 합니다');
  assert.match(modalFn, /'aria-modal':\s*'true'/, '검수 모달은 대화상자 접근성 속성을 갖춰야 합니다');
  assert.match(modalFn, /isCompactModal/, '모바일·태블릿 폭에서는 가로 스크롤 없는 카드형 레이아웃으로 전환해야 합니다');

  const perfFn = stripJs(cutFn(SRC, 'function PerfManagement('));
  const clearFn = stripJs(cutFn(perfFn, 'function clearIncentive('));
  assert.doesNotMatch(clearFn, /dbRemoveMany/, '엑셀 성과 정리는 물리 삭제(dbRemoveMany) 대신 휴지통(_deleted:true) 방식을 써야 합니다');
  assert.match(clearFn, /locked_payroll_months/, '마감된 급여월의 성과 기록은 초기화 대상에서 제외해야 합니다');

  const sbFn = stripJs(cutFn(SRC, 'function Sidebar('));
  assert.match(sbFn, /e\.key\s*===\s*'Enter'\s*\|\|\s*e\.key\s*===\s*' '/, '사이드바 즐겨찾기·메뉴 항목은 키보드 Enter/Space 조작을 지원해야 합니다');
});

test('⑨ 2차 무결성 회귀 — 공동배분 fix_perf_ym 오염 차단 · 마감 원본 link_income 차단 · 삭제/되돌림 원본 부활 차단 · 재시도 멱등성 · localTax/월별오류셀/잘못된 입금일 차단', () => {
  const users = [
    { sid: 'U-A', name: '가나다', status: 'active' },
    { sid: 'U-B', name: '라마바', status: 'active' }
  ];

  /* 1) 잘못된 입금일(2026-02-30)은 상여구분(10월)이 있어도 2026-10-01 로 둔갑해 자동 반영되면 안 된다 */
  const badDateParsed = Sync.parseIncentiveSheet([
    ['상여구분', '입금일', '항목', '입금금액', '부가세 제외', '성과금 비율', '금액', '수령인'],
    ['10월', '2026-02-30', '가나상사_컨설팅', 1100000, 1000000, '15%', 150000, '가나다']
  ], { fallbackYear: 2026 });
  assert.equal(badDateParsed.rows.length, 1);
  assert.equal(badDateParsed.rows[0].invalidDate, true);
  const badDatePlans = Sync.planIncentiveSync(badDateParsed.rows, { users, financeIncomes: [] });
  assert.equal(badDatePlans[0].status, 'needs_review');
  assert.equal(badDatePlans[0].action, 'skip');
  assert.equal(badDatePlans[0].checked, false);

  /* 2) 9월 옛 incentive에 B만 있거나 A·B 공동배분일 때 A의 10월 행을 올려도 fix_perf_ym 으로 B의 귀속월을 옮기지 않는다 */
  const onlyBLegacy = [{
    id: 'fi-only-b',
    date: '2026-09-25',
    companyName: '가나상사',
    kind: '체당금수수료',
    sourceKind: 'incentive',
    amount: 2200000,
    perfShares: [{ sid: 'U-B', name: '라마바', pct: 15, amount: 300000 }]
  }];
  const sharedABLegacy = [{
    id: 'fi-shared-ab',
    date: '2026-09-25',
    companyName: '가나상사',
    kind: '체당금수수료',
    sourceKind: 'perf-adjust',
    amount: 2200000,
    perfShares: [
      { sid: 'U-A', name: '가나다', pct: 10, amount: 200000 },
      { sid: 'U-B', name: '라마바', pct: 15, amount: 300000 }
    ]
  }];
  const rowA10 = [{
    rowNo: 3, ymLabel: '10월', perfYM: '2026-10', date: '2026-09-25',
    rawItem: '가나상사_체당금수수료', companyName: '가나상사', kind: '체당금수수료',
    payAmount: 2200000, supplyAmount: 2000000, pct: 10, perfAmount: 200000, recipientName: '가나다', hasVat: true
  }];
  const planOnlyB = Sync.planIncentiveSync(rowA10, { users, financeIncomes: onlyBLegacy });
  assert.notEqual(planOnlyB[0].action, 'fix_perf_ym', 'B만 배분된 9월 레코드를 A의 fix_perf_ym 으로 잡으면 안 됩니다');
  assert.equal(planOnlyB[0].action, 'perf_only');

  const planSharedAB = Sync.planIncentiveSync(rowA10, { users, financeIncomes: sharedABLegacy });
  assert.notEqual(planSharedAB[0].action, 'fix_perf_ym', '공동배분 레코드를 통째로 fix_perf_ym 하면 B의 귀속월까지 이동합니다');
  /* 강제로 fix_perf_ym 계획을 넘겨도 buildIncentiveUpserts 가 공동배분을 차단한다 */
  const forcedSharedRes = Sync.buildIncentiveUpserts([{
    empSid: 'U-A', checked: true, action: 'fix_perf_ym', matchedFi: sharedABLegacy[0], row: rowA10[0]
  }], { users, financeIncomes: sharedABLegacy });
  assert.equal(forcedSharedRes.upserts.length, 0);
  assert.equal(forcedSharedRes.staleSkipped, 1);

  /* 3) 9월 마감 일반입금에 A의 기존 배분이 이미 있을 때 link_income 으로 원본을 10월로 이동시키지 못한다 */
  const lockedRev = [{
    id: 'fi-locked-rev',
    date: '2026-09-25',
    companyName: '가나상사',
    kind: '체당금수수료',
    sourceKind: 'case',
    amount: 2200000,
    perfBaseAmount: 2000000,
    perfShares: [{ sid: 'U-A', name: '가나다', pct: 10, amount: 180000 }]
  }];
  const planLockedOrig = Sync.planIncentiveSync(rowA10, {
    users,
    financeIncomes: lockedRev,
    lockedPayrollMonths: ['2026-09']
  });
  assert.equal(planLockedOrig[0].status, 'needs_review');
  assert.equal(planLockedOrig[0].action, 'perf_only');

  const forcedLinkLocked = Sync.buildIncentiveUpserts([{
    empSid: 'U-A', checked: true, action: 'link_income', matchedFi: lockedRev[0], row: rowA10[0]
  }], { users, financeIncomes: lockedRev, lockedPayrollMonths: ['2026-09'] });
  assert.equal(forcedLinkLocked.upserts.length, 0);
  assert.equal(forcedLinkLocked.lockedSkipped, 1);

  /* 4) 분석 후 연결 대상이 삭제(_deleted)되거나 되돌림(undoneDate)되면 link_income 이 신규 perf-adjust 로 둔갑해 부활하지 않는다 */
  const deletedNow = [Object.assign({}, lockedRev[0], { _deleted: true, perfShares: [] })];
  const undoneNow = [Object.assign({}, lockedRev[0], { undoneDate: '2026-10-02T00:00:00Z', perfShares: [] })];
  const resDeleted = Sync.buildIncentiveUpserts([{
    empSid: 'U-A', checked: true, action: 'link_income', matchedFi: lockedRev[0], row: rowA10[0]
  }], { users, financeIncomes: deletedNow });
  assert.equal(resDeleted.upserts.length, 0);
  assert.equal(resDeleted.createdCount, 0);
  assert.equal(resDeleted.staleSkipped, 1);

  const resUndone = Sync.buildIncentiveUpserts([{
    empSid: 'U-A', checked: true, action: 'link_income', matchedFi: lockedRev[0], row: rowA10[0]
  }], { users, financeIncomes: undoneNow });
  assert.equal(resUndone.upserts.length, 0);
  assert.equal(resUndone.createdCount, 0);
  assert.equal(resUndone.staleSkipped, 1);

  /* 5) 부분 저장 후 재시도 멱등성 — 이미 동일 excelSyncKey 로 저장된 건은 재호출 시 중복 생성하지 않는다 */
  const firstRun = Sync.buildIncentiveUpserts([{
    empSid: 'U-A', checked: true, action: 'perf_only', row: rowA10[0]
  }], { users, financeIncomes: [] });
  assert.equal(firstRun.createdCount, 1);
  const retryRun = Sync.buildIncentiveUpserts([{
    empSid: 'U-A', checked: true, action: 'perf_only', row: rowA10[0]
  }], { users, financeIncomes: firstRun.upserts });
  assert.equal(retryRun.createdCount, 0, '이미 저장된 syncKey 는 재시도해도 중복 생성하면 안 됩니다');

  /* 6) 급여 localTax 차이 및 휴가 1월 #VALUE! 오류셀 감지 */
  const payLocalDiff = Sync.planPayrollSync([{
    ym: '2026-10',
    rawRows: [],
    parsed: {
      header: true,
      conflicts: [],
      recs: [{ empSid: 'U-A', empName: '가나다', ym: '2026-10', baseSalary: 3000000, grossPay: 3000000, netPay: 2900000, incomeTax: 90000, localTax: 99999 }],
      nomatch: [],
      unmatchedRecs: []
    }
  }], {
    users,
    payrollMonthly: [{ id: 'pay-U-A-2026-10', empSid: 'U-A', ym: '2026-10', baseSalary: 3000000, grossPay: 3000000, netPay: 2900000, incomeTax: 90000, localTax: 10000 }],
    financeIncomes: [],
    incentivePlans: []
  });
  assert.equal(payLocalDiff[0].status, 'needs_review', 'localTax 차이를 놓치고 already_synced 로 판정하면 안 됩니다');
  assert.equal(payLocalDiff[0].checked, false);

  const lvMonthErr = Sync.parseLeaveSheet([
    ['성명', '발생연차', '1월', '사용일수', '잔여일수'],
    ['가나다', 15, '#VALUE!', 0, 15]
  ], '휴가대장', 2026);
  assert.equal(lvMonthErr.rows[0].invalidCell, true, '1월 열에 #VALUE! 가 있으면 invalidCell=true 여야 합니다');
  const lvMonthErrPlans = Sync.planLeaveSync(lvMonthErr.rows, { users, leaveLedger: [] });
  assert.equal(lvMonthErrPlans[0].status, 'needs_review');
  assert.equal(lvMonthErrPlans[0].checked, false);
});

test('⑩ 최종 엣지 회귀 — sid 없는 공동배분 차단 · 월별메모+1월오류 동시 감지 · 건별 완료/건너뜀 분리 · 시간기록 실패 재시도 복구 · 확인 ID 교집합', () => {
  const users = [
    { sid: 'U-A', name: '가나다', status: 'active' },
    { sid: 'U-B', name: '라마바', status: 'active' }
  ];

  /* 1) sid 없는 타인 배분({name:'라마바', amount:200000})이 함께 든 9월 incentive에 A의 10월 행을 넣어도 fix_perf_ym 금지 */
  const sidlessCoShare = [{
    id: 'fi-sidless-co',
    date: '2026-09-25',
    companyName: '가나상사',
    kind: '체당금수수료',
    sourceKind: 'incentive',
    amount: 2200000,
    perfShares: [
      { sid: 'U-A', name: '가나다', amount: 150000 },
      { name: '라마바', amount: 200000 }
    ]
  }];
  const rowA10 = [{
    rowNo: 3, ymLabel: '10월', perfYM: '2026-10', date: '2026-09-25',
    rawItem: '가나상사_체당금수수료', companyName: '가나상사', kind: '체당금수수료',
    payAmount: 2200000, supplyAmount: 2000000, pct: 10, perfAmount: 150000, recipientName: '가나다', hasVat: true
  }];
  const plansSidless = Sync.planIncentiveSync(rowA10, { users, financeIncomes: sidlessCoShare });
  assert.notEqual(plansSidless[0].action, 'fix_perf_ym', 'sid 없는 공동배분자가 섞인 9월 레코드를 fix_perf_ym 으로 이동시키면 안 됩니다');
  const forcedSidless = Sync.buildIncentiveUpserts([{
    id: 'inc-plan-0', empSid: 'U-A', checked: true, action: 'fix_perf_ym', matchedFi: sidlessCoShare[0], row: rowA10[0]
  }], { users, financeIncomes: sidlessCoShare });
  assert.equal(forcedSidless.upserts.length, 0);
  assert.equal(forcedSidless.staleSkipped, 1);
  assert.equal(forcedSidless.stalePlanIds['inc-plan-0'], 1);

  /* 2) 월별 사용내역 열이 채워져 있어도 1월 열에 #VALUE! 가 있으면 invalidCell=true 및 needs_review 여야 한다 */
  const lvBoth = Sync.parseLeaveSheet([
    ['성명', '발생연차', '사용일수', '잔여일수', '월별 사용내역', '1월'],
    ['가나다', 15, 0, 15, '정상 메모', '#VALUE!']
  ], '휴가대장', 2026);
  assert.equal(lvBoth.rows[0].invalidCell, true, '월별 사용내역이 있어도 1~12월 열의 오류셀을 놓치면 안 됩니다');
  assert.equal(lvBoth.rows[0].monthly, '정상 메모');
  const lvBothPlans = Sync.planLeaveSync(lvBoth.rows, { users, leaveLedger: [] });
  assert.equal(lvBothPlans[0].status, 'needs_review');
  assert.equal(lvBothPlans[0].checked, false);

  /* 3) 정상 행과 마감/원본삭제 행을 함께 빌드하면 appliedPlanIds 와 lockedPlanIds / stalePlanIds 가 정확히 분리된다 */
  const mixedRes = Sync.buildIncentiveUpserts([
    {
      id: 'p-ok', empSid: 'U-A', checked: true, action: 'perf_only',
      row: { ymLabel: '10월', perfYM: '2026-10', date: '2026-10-05', rawItem: '정상건', companyName: '정상건', kind: '컨설팅', payAmount: 1000000, supplyAmount: 1000000, pct: 10, perfAmount: 100000, recipientName: '가나다' }
    },
    {
      id: 'p-locked', empSid: 'U-A', checked: true, action: 'perf_only',
      row: { ymLabel: '9월', perfYM: '2026-09', date: '2026-09-05', rawItem: '마감건', companyName: '마감건', kind: '컨설팅', payAmount: 1000000, supplyAmount: 1000000, pct: 10, perfAmount: 100000, recipientName: '가나다' }
    },
    {
      id: 'p-stale', empSid: 'U-A', checked: true, action: 'link_income', matchedFi: { id: 'missing-fi' },
      row: { ymLabel: '10월', perfYM: '2026-10', date: '2026-10-06', rawItem: '삭제건', companyName: '삭제건', kind: '컨설팅', payAmount: 1000000, supplyAmount: 1000000, pct: 10, perfAmount: 100000, recipientName: '가나다' }
    }
  ], { users, financeIncomes: [], lockedPayrollMonths: ['2026-09'] });
  assert.equal(mixedRes.upserts.length, 1);
  assert.equal(mixedRes.appliedPlanIds['p-ok'], 1);
  assert.equal(mixedRes.appliedPlanIds['p-locked'], undefined);
  assert.equal(mixedRes.appliedPlanIds['p-stale'], undefined);
  assert.equal(mixedRes.lockedPlanIds['p-locked'], 1);
  assert.equal(mixedRes.stalePlanIds['p-stale'], 1);

  /* 4) 모달 배선 검증: 건별 appliedIncMap 분리, overtime_records 부분 실패 시 paySaved+checked:true 재시도 유지, clearIncentive confirmedIdSet 교집합 */
  const modalFn = stripJs(cutFn(SRC, 'function HrExcelSyncModal('));
  assert.match(modalFn, /appliedIncMap\[p\.id\]/, '성과급 완료 상태는 실제 반영된 appliedPlanIds 건에만 적용해야 합니다');
  assert.match(modalFn, /otPlanIds\[p\.id\][\s\S]*paySaved:\s*true,\s*checked:\s*true/, 'overtime_records 저장 실패 시 해당 급여 계획은 paySaved:true 및 checked:true 로 남아 재시도 시 시간 기록을 복구해야 합니다');
  assert.match(modalFn, /if\s*\(\s*!p\.paySaved\s*\)\s*\{\s*payUpserts\.push\(rec\)/, '재시도 시 이미 급여 본체가 저장된 계획은 시간 기록만 복구 저장해야 합니다');

  const perfFn = stripJs(cutFn(SRC, 'function PerfManagement('));
  const clearFn = stripJs(cutFn(perfFn, 'function clearIncentive('));
  assert.match(clearFn, /confirmedIdSet\[fi\.id\]/, '확인 대화상자 승인 후에는 최초 확인한 대상 ID 집합과 교집합만 휴지통 이동해야 합니다');
});
