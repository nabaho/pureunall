/* 노동법 화면이 급여관리에 제대로 물려 있는가 — payroll-os.html
   왜 검사하는가: 화면 3장은 계산을 **직접 하지 않고** 코어(PuLaborCore)를 불러야 한다.
   누군가 급한 마음에 화면에 계산식을 박으면, 사업장 110곳에서 규칙이 갈라진다.
   실행: node tests/labor-screens.test.js */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const H = fs.readFileSync(path.join(ROOT, 'payroll-os.html'), 'utf8');
const CORE = fs.readFileSync(path.join(ROOT, 'js', 'pu-labor-core.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}
function eq(name, got, want) {
  ok(name + ' (=' + want + ')', got === want, '실제 ' + got);
}
function section(t) { console.log('\n── ' + t + ' ──'); }

section('연결 — 코어 로드·메뉴·렌더');
ok('코어 스크립트를 불러온다', /<script src="js\/pu-labor-core\.js\?v=\d+"><\/script>/.test(H));
ok('코어 스크립트가 화면 코드보다 먼저 온다',
  H.indexOf('pu-labor-core.js') < H.indexOf('function screenAttend'));
['attend', 'leave', 'sever'].forEach(function (id) {
  ok('메뉴에 ' + id + ' 있음', H.indexOf("{id:'" + id + "'") > -1);
  ok('render 에 ' + id + ' 분기 있음', H.indexOf("App.screen==='" + id + "'") > -1);
});
['screenAttend', 'screenLeave', 'screenSever'].forEach(function (fn) {
  ok(fn + ' 정의됨', H.indexOf('function ' + fn + '(') > -1);
});

section('규칙은 코어에만 — 화면에 계산식이 박히지 않았는가');
/* 화면 블록만 떼어 본다(코어 파일은 별도라 여기 없다).
   ⚠ 시작점은 달력·근태·연차·퇴직 코드가 모두 들어오도록 노동법 화면 블록의
     첫 줄(var LC = …)로 잡는다. screenAttend 부터 잡으면 그보다 앞에 있는
     달력 코드가 빠져 「코어를 부르는가」 검사가 헛돈다. */
const i0 = H.indexOf('var LC = (typeof PuLaborCore'), i1 = H.indexOf('function render()');
const SCR = H.slice(i0, i1 > i0 ? i1 : H.length);
ok('화면 블록을 찾았다', SCR.length > 500, '길이 ' + SCR.length);
['statutoryAllowances', 'accrueAnnual', 'annualLedger', 'annualUnusedPay',
  'promotionSchedule', 'averageWage', 'severancePay', 'retirementIncomeTax',
  'dcContribution', 'hourlyOrdinary'].forEach(function (fn) {
    ok('화면이 코어의 ' + fn + '() 를 부른다', SCR.indexOf('LC.' + fn + '(') > -1);
  });
// 가산율·연차일수 같은 법정 숫자를 화면에 다시 적으면 안 된다
ok('화면에 가산율 1.5/2.0 을 다시 적지 않았다', !/[^\d.]1\.5\s*\*|\*\s*1\.5|\*\s*2\.0/.test(SCR));
ok('화면에 연차 15/25 를 계산식으로 박지 않았다', !/15\s*\+\s*bonus|Math\.min\(15/.test(SCR));
/* 설명문(note)에는 법 공식을 글로 적어 둔다 — "1일 평균임금 × 30일 × 재직일수/365".
   그건 계산이 아니라 안내다. 안내문은 곱셈기호(×)를 쓰고 코드는 ASCII 별표(*)를
   쓰므로, 별표로만 찾으면 안내문을 오탐하지 않는다. */
ok('퇴직금 30일 공식을 화면에서 계산하지 않았다', !/\*\s*30\b/.test(SCR));

section('화면이 쓰는 기존 도우미가 실제로 있는가');
['function dedupeEmps(', 'function won(', 'function navTo(', 'function dbGet(',
  'function dbSet(', 'function goBack('].forEach(function (fn) {
    ok('도우미 ' + fn.replace('function ', '').replace('(', '') + ' 존재', H.indexOf(fn) > -1);
  });
ok('setAttend·lput·addSever 가 window 에 노출됨',
  /window\.setAttend\s*=/.test(H) && /window\.lput\s*=/.test(H) && /window\.addSever\s*=/.test(H));

section('코어 자체 규율');
ok('코어에 사업장 이름이 박혀 있지 않다(설정 주입식)',
  !/다온원|나라앤드씨|새별|주민정/.test(CORE));
ok('코어는 DOM 을 만지지 않는다',
  !/document\.|window\.addEventListener|innerHTML/.test(CORE));
ok('코어는 Firebase 를 모른다', !/firebase|dbGet|dbSet/.test(CORE));
ok('코어가 node 에서 단독으로 불린다', /module\.exports/.test(CORE));
ok('법 근거가 주석에 적혀 있다',
  /근기법 56조/.test(CORE) && /퇴직급여법/.test(CORE) && /소득세법/.test(CORE));

section('개인정보 — 실데이터가 섞여 들어가지 않았는가');
ok('코어에 주민번호 형태 문자열이 없다', !/\d{6}\s*-\s*\d{7}/.test(CORE));
ok('화면 블록에 직원 실명 시드가 없다', !/LEAVE_LEDGER_SEED/.test(SCR));


section('간이세액표 — 앱 연결');
ok('설정 카드에 간이세액표 가져오기 버튼', H.indexOf('importTaxTable()') > -1);
ok('importTaxTable 정의됨', H.indexOf('function importTaxTable(') > -1);
ok('window 에 노출됨', /window\.importTaxTable\s*=/.test(H));
ok('tax_table 키로 저장한다', /dbSet\('tax_table'/.test(H));
ok('올릴 때 모양을 검사한다(rows 없으면 거부)', /rows 가 없습니다/.test(H));
ok('마지막 구간 상한을 검사한다(높은 급여 누락 방지)', /마지막 구간에 상한이 있습니다/.test(H));
ok('표 없으면 화면이 알린다', /맞는 간이세액표가 없어 소득세를 계산하지 못합니다/.test(H));

section('근태 → 급여 미리보기');
ok('미리보기 표가 있다', H.indexOf('근태 반영 급여 미리보기') > -1);
ok('통합계산은 코어가 한다(LC.monthlyPayroll)', SCR.indexOf('LC.monthlyPayroll(') > -1);
ok('간이세액표를 코어에 넘긴다', /간이세액표: TT/.test(SCR));
ok('최저임금 연도값을 코어에 넘긴다', /최저임금시급: mwH/.test(SCR));
/* 자녀공제 금액은 코어에만 있어야 한다. 화면 설명문은 "12,500"(쉼표)으로 적으므로
   쉼표 없는 숫자로 찾으면 계산식이 박힌 경우만 걸린다. */
ok('화면에 자녀공제 금액을 계산식으로 박지 않았다', !/\b12500\b|\b29160\b|\b20830\b|\b45830\b|\b33330\b/.test(SCR));
ok('코어에 현행(2026.2.27 개정) 자녀공제 금액이 있다', /20830/.test(CORE) && /45830/.test(CORE) && /33330/.test(CORE));
ok('코어가 국세청 산식을 추정하지 않는다고 밝힌다', /산식을 짓지 않는다|산식을 공개하지 않는다/.test(CORE));


section('일별 출퇴근 달력 — 연결');
ok('screenDayCalendar 정의됨', H.indexOf('function screenDayCalendar(') > -1);
ok('근태 화면이 직원 선택 시 달력으로 보낸다', H.indexOf('if (App.emp) return screenDayCalendar();') > -1);
ok('화면 이동에 emp·day 차원이 있다(뒤로가기 동작)',
  /emp:App\.emp/.test(H) && /a\.emp===b\.emp/.test(H) && /App\.day=s\.day/.test(H));
['saveDay', 'delDay', 'clearDays', 'setHolidays'].forEach(function (fn) {
  ok(fn + ' 정의·노출',
    H.indexOf('function ' + fn + '(') > -1 && H.indexOf('window.' + fn + ' = ' + fn) > -1);
});
ok('달력 집계는 코어가 한다(LC.summarizeAttendance)', SCR.indexOf('LC.summarizeAttendance(') > -1);
ok('일별 기록이 손입력을 대신한다(derivedAttend 우선)',
  /var der = derivedAttend\(/.test(SCR) && /var att = der \|\|/.test(SCR));
ok('미리보기도 달력 값을 쓴다', /근태집계: derivedAttend\(/.test(SCR));
ok('같은 날짜는 덮어쓴다(두 줄이면 시간이 두 배로 센다)',
  /filter\(function \(r\) \{ return r\.date !== rec\.date; \}\)/.test(H));
ok('공휴일 없으면 화면이 경고한다', /공휴일을 넣지 않으면/.test(H));
ok('주 12시간 한도 초과를 알린다', /연장근로 주 12시간 한도 초과/.test(H));
ok('달력 값 칸은 읽기전용으로 둔다(두 값이 싸우지 않게)', /달력으로 계산된 값/.test(H));

section('월 이름 읽기 — 실제 시트 이름이 제각각이다');
/* 급여대장 시트 이름은 '3월'·'2026-03'·'23년 7월'·'25.05 새별반찬' 등으로 섞여 온다.
   여기서 연·월을 잘못 읽으면 달력이 안 그려지거나 최저임금 연도가 어긋난다. */
const grabFn = (name) => {
  const i = H.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('못 찾음: ' + name);
  let d = 0, st = false;
  for (let j = i; j < H.length; j++) {
    if (H[j] === '{') { d++; st = true; }
    else if (H[j] === '}') { d--; if (st && d === 0) return H.slice(i, j + 1); }
  }
  throw new Error('괄호 안 닫힘: ' + name);
};
const laborYear = () => '2026';
eval(grabFn('laborYearOfMonth'));
eval(grabFn('laborYearExplicit'));
eval(grabFn('laborMonthNum'));
eval(grabFn('laborYm'));
eq("'2026-03' → 2026년", laborYearOfMonth('2026-03'), '2026');
eq("'2026-03' → 3월", laborMonthNum('2026-03'), 3);
eq("'3월' → 3월", laborMonthNum('3월'), 3);
eq("'3월' → 연도 없으면 올해", laborYearOfMonth('3월'), '2026');
eq("'23년 7월' → 2023년", laborYearOfMonth('23년 7월'), '2023');
eq("'23년 7월' → 7월", laborMonthNum('23년 7월'), 7);
eq("'25.05 새별반찬' → 5월", laborMonthNum('25.05 새별반찬'), 5);
eq('월을 못 읽으면 null (달력 대신 합계 입력 안내)', laborMonthNum('놀봄모종'), null);
eq("'25.05 새별반찬' → 2025년", laborYearOfMonth('25.05 새별반찬'), '2025');
eq("'25.12' → 12월", laborMonthNum('25.12'), 12);
eq('13월 같은 헛값은 안 받는다', laborMonthNum('25.13'), null);
eq("'23년 7월 사계절찬' → 7월", laborMonthNum('23년 7월 사계절찬'), 7);

/* 간이세액표 고르기 — 화면의 taxTableFor 를 **실제로 돌린다**(글자만 찾으면
   기능을 꺼 버려도 통과한다). 내장 표는 2026-03-01 지급분부터다. */
section('간이세액표 고르기 — 내장 표(법제처 별표2) 우선, 옛 달은 올린 표');
eq("'2026-03' → '2026-03'", laborYm('2026-03'), '2026-03');
eq("'25.05 새별반찬' → '2025-05'", laborYm('25.05 새별반찬'), '2025-05');
eq("'3월'(연도 없음) → null — 올해로 메워 표를 고르지 않는다", laborYm('3월'), null);
const PuSimpleTax = require(path.join(ROOT, 'js', 'pu-simpletax.js'));
const LC = require(path.join(ROOT, 'js', 'pu-labor-core.js'));
let FAKE_DB = {};
const dbGet = function (k, d) { return (k in FAKE_DB) ? FAKE_DB[k] : d; };
eval(grabFn('taxTableFor'));
eval(grabFn('builtinTaxSince'));
eq('2026년 4월 → 내장 2026년판', (taxTableFor('2026-04') || {}).시행, '2026-03-01');
eq('2025년 5월·올린 표 없음 → null(소득세 미계산으로 알림)', taxTableFor('25.05 새별반찬'), null);
FAKE_DB = { tax_table: { 연도: '2025', rows: [{ min: 0, max: null, tax: [1] }] } };
eq('2025년 5월·올린 표 있음 → 올린 표', (taxTableFor('25.05 새별반찬') || {}).연도, '2025');
eq('2026년 4월은 올린 표가 있어도 내장 표가 이긴다', (taxTableFor('2026-04') || {}).시행, '2026-03-01');
eq('내장 표 시작일', builtinTaxSince(), '2026-03-01');
ok('내장 표 스크립트를 불러온다', /<script src="js\/pu-simpletax\.js\?v=\d+"><\/script>/.test(H));
ok('미리보기는 달에 맞는 표를 쓴다(taxTableFor)', SCR.indexOf('taxTableFor(App.month)') > -1);
ok('미리보기가 올린 표만 통째로 쓰지 않는다', SCR.indexOf("var TT = dbGet('tax_table'") < 0);
ok('표 고르기는 코어가 한다(LC.pickSimpleTaxTable)', H.indexOf('LC.pickSimpleTaxTable(') > -1);


/* 발송·내보내기 코드 블록만 떼어 본다 — 노동법 화면 블록보다 앞에 있다 */
const j0 = H.indexOf('var PAYSLIP_FN_URL'), j1 = H.indexOf('var LC = (typeof PuLaborCore');
const SCR2 = H.slice(j0, j1 > j0 ? j1 : H.length);
const mCols = /var LEDGER_COLS = \[([\s\S]*?)\];/.exec(H);
const LEDGER_COLS_STR = mCols ? mCols[1] : '';
const LEDGER_HAS_RRN = /주민/.test(LEDGER_COLS_STR);
const REQUIRED_COLS = ['성명', '기본급', '과세총액', '국민연금', '건강보험',
  '고용보험', '소득세', '지방소득세', '공제총액', '실지급액'];

section('명세서 발송 — 밖으로 나가는 행위라 규칙을 못 박는다');
ok('발송 블록을 찾았다', SCR2.length > 500, '길이 ' + SCR2.length);
ok('발송 함수가 있다', H.indexOf('function sendSlipOne(') > -1 && H.indexOf('function sendSlipAll(') > -1);
ok('window 에 노출',
  H.indexOf('window.sendSlipOne = sendSlipOne') > -1 && H.indexOf('window.sendSlipAll = sendSlipAll') > -1);
ok('이미 있는 sendPayslip 함수를 쓴다(주소 규칙을 새로 만들지 않는다)',
  H.indexOf('cloudfunctions.net/sendPayslip') > -1);
ok('로그인 증표(Bearer)를 붙인다 — 없으면 공개 발송기가 된다',
  /Authorization.{0,14}Bearer/.test(SCR2));
ok('★ 확정되지 않은 달은 보내지 않는다', SCR2.indexOf('if (!isLocked(site, month))') > -1);
ok('★ 보내기 전에 사람에게 확인받는다', SCR2.indexOf('confirm(msg)') > -1);
ok('★ 보낸 사실을 남긴다(slip_sent)', SCR2.indexOf("lput('slip_sent'") > -1);
ok('다시 보낼 때 이미 보냈다고 알린다', SCR2.indexOf('이미 ') > -1 && SCR2.indexOf('var prev = sentOf(') > -1);
ok('이메일이 없으면 부르지 않는다(빈 주소 방지)', SCR2.indexOf("indexOf('@') < 0") > -1);
ok('여럿 보낼 때 하나씩 보낸다(한꺼번에 던지지 않는다)', SCR2.indexOf('function next()') > -1);
ok('미확정이면 화면에서 전원 발송 단추를 감춘다', H.indexOf("(draft ? '' : ' <button") > -1);
ok('발송 명단은 인쇄물에 안 나온다(noprint)', H.indexOf('발송 명단 — 이메일을 넣고') > -1 && /noprint[\s\S]{0,300}발송 명단/.test(H));

section('회계프로그램용 엑셀·CSV 내보내기');
ok('xlsx 만들기 도구를 불러온다', /<script src="xlsx_gen\.js\?v=\d+"><\/script>/.test(H));
ok('엑셀·CSV 함수가 있다',
  H.indexOf('function exportLedgerXlsx(') > -1 && H.indexOf('function exportLedgerCsv(') > -1);
ok('window 에 노출',
  H.indexOf('window.exportLedgerXlsx = exportLedgerXlsx') > -1 &&
  H.indexOf('window.exportLedgerCsv = exportLedgerCsv') > -1);
ok('열 목록을 찾았다', LEDGER_COLS_STR.length > 20, LEDGER_COLS_STR.slice(0, 40));
ok('★ 주민번호를 내보내지 않는다', LEDGER_HAS_RRN === false, '열 목록에 주민이 들어 있습니다');
REQUIRED_COLS.forEach(function (c) {
  ok('열에 ' + c + ' 있음', LEDGER_COLS_STR.indexOf(c) > -1);
});
ok('CSV 에 BOM 을 붙인다(엑셀에서 한글 안 깨지게)', SCR2.indexOf('Blob([') > -1 && /charset=utf-8/.test(SCR2));
ok('내보낼 것이 없으면 빈 파일을 만들지 않는다', SCR2.indexOf('내보낼 직원 표가 없습니다') > -1);
ok('더존 전용이라 우기지 않는다(가져오기 매핑을 안내한다)',
  SCR2.indexOf('프로그램마다 가져오기 열 순서가 다르다') > -1);
ok('지급총액이 없으면 실수령+공제로 되살린다', SCR2.indexOf('Number(e.실수령) + Number(e.공제총액)') > -1);

section('번호 + ㅁ 체크 + ★ 별표 저장·기록 및 연차 시간차(시간단위 연차)');
ok('rowMarkBox·toggleRowMark·setMarkFilter·addLeaveHours 정의·노출',
  H.indexOf('function rowMarkBox(') > -1 && H.indexOf('function toggleRowMark(') > -1 &&
  H.indexOf('function setMarkFilter(') > -1 && H.indexOf('function addLeaveHours(') > -1 &&
  H.indexOf('window.toggleRowMark=toggleRowMark') > -1 && H.indexOf('window.addLeaveHours=addLeaveHours') > -1);
ok('체크·별표를 row_marks 키로 저장·기록한다', H.indexOf("dbSet('row_marks'") > -1);
ok('연차 화면에 시간차(h) 열과 +1h/+2h/+4h 단추가 있다',
  SCR.indexOf("'시간차(h)'") > -1 && SCR.indexOf('addLeaveHours(') > -1);
ok('연차 대장에 사용시간을 넘기고 미사용수당에 미사용시간을 넘긴다',
  SCR.indexOf('사용시간: Number(lv.사용시간 || 0)') > -1 && SCR.indexOf('미사용시간: Math.max(0, lg.잔여시간)') > -1);
ok('근태 달력에 반반차(2h)·시간차(시간연차) 유형이 있다',
  SCR.indexOf("key: 'quarter'") > -1 && SCR.indexOf("key: 'hourleave'") > -1);

section('법정 근로자명부(근기법 41·42조) · 10인이하 법정점검 · 근로계약서·취업규칙 자동 검토');
ok('TABS 에 근로자명부(roster)·계약·취업규칙(compliance) 탭이 있다',
  H.indexOf("{id:'roster'") > -1 && H.indexOf("{id:'compliance'") > -1);
ok('screenRoster·screenCompliance 정의·노출',
  H.indexOf('function screenRoster(') > -1 && H.indexOf('function screenCompliance(') > -1 &&
  H.indexOf('window.screenRoster = screenRoster') > -1 && H.indexOf('window.screenCompliance = screenCompliance') > -1);
['evaluateRosterRow', 'evaluateWorkplaceCompliance', 'reviewLaborContract', 'reviewWorkRules',
  'buildStandardContractText', 'buildStandardWorkRulesText'].forEach(function (fn) {
    ok('화면이 코어의 ' + fn + '() 를 부른다', SCR.indexOf('LC.' + fn + '(') > -1);
  });
ok('추출된 계약서 정보를 근로자명부·급여설정에 반영하는 함수가 있다',
  H.indexOf('function applyExtractedContract(') > -1 && H.indexOf('window.applyExtractedContract = applyExtractedContract') > -1);
['evaluateLifecycleAlerts', 'diagnoseNonRegularRisk', 'buildWorkRulesFilingDocs', 'matchEmployerSubsidies',
  'summarizeAnnualSettlement', 'buildContractDeliveryHtml'].forEach(function (fn) {
    ok('화면이 코어의 ' + fn + '() 를 부른다', SCR.indexOf('LC.' + fn + '(') > -1);
  });
ok('근로계약서 전자교부·취업규칙 신고서류 복사·연간 대사표 함수가 노출되어 있다',
  H.indexOf('window.sendContractEmail = sendContractEmail') > -1 &&
  H.indexOf('window.copyWorkRulesFilingDocs = copyWorkRulesFilingDocs') > -1 &&
  H.indexOf('window.copyAnnualSettleTSV = copyAnnualSettleTSV') > -1);
ok('2026 미입력 사업장 푸른메일(수신·발신) 자동수집·입력 엔진 및 요약 패널이 노출되어 있다',
  H.indexOf('js/pu-co-thread.js') > -1 &&
  H.indexOf('window.autoSync2026FromMail = autoSync2026FromMail') > -1 &&
  H.indexOf('window.mailDigestPanelHtml = mailDigestPanelHtml') > -1);

section('시간차 1시간 단위(1h~8h) 선택 및 소정근로시간(5h 등) 최대시간차 상한 관리');
['maxHourLeaveOf', 'hourLeaveOptions', 'normalizeHourLeave'].forEach(function (fn) {
  ok('화면이 코어의 ' + fn + '() 를 부른다', SCR.indexOf('LC.' + fn + '(') > -1);
});
ok('setLeaveHours·setSiteDailyHours·maxHourLeaveFor 정의·노출',
  H.indexOf('function setLeaveHours(') > -1 &&
  H.indexOf('function setSiteDailyHours(') > -1 &&
  H.indexOf('function maxHourLeaveFor(') > -1 &&
  H.indexOf('window.setLeaveHours=setLeaveHours') > -1 &&
  H.indexOf('window.setSiteDailyHours=setSiteDailyHours') > -1);

section('UI 한화면 정리 · 계약/취업규칙 빈 상태 진입 · HTML/CSS 웹 급여대장 런타임 검증');
(function () {
  var vm = require('vm');
  var ctx = {
    console: console, Math: Math, Date: Date, JSON: JSON, Object: Object, Array: Array,
    String: String, Number: Number, Boolean: Boolean, RegExp: RegExp,
    parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN, isFinite: isFinite,
    encodeURIComponent: encodeURIComponent, decodeURIComponent: decodeURIComponent,
    setTimeout: function () {}, clearTimeout: function () {},
    PuLaborCore: LC,
    ROOT: 'payroll_os',
    cache: {
      companies: {
        empty_co: { id: 'empty_co', name: '㈜경보엔지니어링', typeCode: '급여', status: 'active' },
        hanwoo_co: { id: 'hanwoo_co', name: '1일등한우', typeCode: '급여', status: 'active' }
      }
    },
    fbDb: {
      ref: function () {
        return {
          set: function () { return Promise.resolve(); },
          once: function () { return Promise.resolve({ val: function () { return {}; } }); },
          push: function () {}
        };
      }
    },
    me: { email: 'admin@pureun.co.kr' },
    ready: true,
    isAdminUser: true,
    render: function () {},
    localStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
    document: {
      getElementById: function () { return { innerHTML: '', scrollTop: 0, className: '', textContent: '' }; },
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; },
      addEventListener: function () {}
    },
    addEventListener: function () {},
    history: { replaceState: function () {}, pushState: function () {}, back: function () {} },
    location: { search: '', href: 'https://nabaho.github.io/pureunall/payroll-os.html' },
    navigator: { clipboard: { writeText: function () { return Promise.resolve(); } } }
  };
  ctx.window = ctx;
  ctx.self = ctx;
  vm.createContext(ctx);
  var fullAppCode = H.slice(H.indexOf('function dbGet(k,fb)'), H.indexOf('function render()'));
  vm.runInContext(fullAppCode, ctx);

  ctx.payIdx = {
    '1일등한우': [
      { id: 'r1', 월: '2026년 11월', 파일: '2026년 11월_1일등한우_급여대장.xlsx', 신호: 'green', 직원수: 2 }
    ]
  };
  ctx.empBox = {
    'r1': [
      { 순번: 1, 성명: '홍길동', 기본급: 2500000, 과세총액: 2500000, 소득세: 30000, 지방세: 3000, 국민연금: 112500, 건강보험: 88620, 고용보험: 22500, 공제총액: 256620, 실수령: 2243380 },
      { 순번: 2, 성명: '김철수', 기본급: 2500000, 과세총액: 2500000, 소득세: 30000, 지방세: 3000, 국민연금: 112500, 건강보험: 88620, 고용보험: 22500, 공제총액: 256620, 실수령: 2243380 }
    ]
  };

  // 1) 자료가 전혀 없는 빈 사업장에서도 계약·취업규칙(screenCompliance)과 근로자명부(screenRoster)가 에러 없이 열린다
  ctx.App.coId = 'empty_co';
  ctx.App.site = null;
  ctx.App.tab = 'compliance';
  var compEmptyHtml = ctx.screenCompliance();
  ok('자료가 전혀 없는 사업장에서도 계약·취업규칙(screenCompliance) 창이 에러 없이 열린다',
    typeof compEmptyHtml === 'string' && compEmptyHtml.indexOf('계약 · 취업규칙 법정검토') > -1 && compEmptyHtml.indexOf('표준근로계약서 초안') > -1);

  ctx.setCompView('rules');
  var compRulesHtml = ctx.screenCompliance();
  ok('취업규칙이 없어도 취업규칙 서브탭이 표준 취업규칙 초안과 함께 열린다',
    compRulesHtml.indexOf('취업규칙 · 10인 미만 복무규정') > -1 && compRulesHtml.indexOf('표준안 채우기') > -1);

  ctx.App.tab = 'roster';
  ctx.App.site = null;
  var rosterEmptyHtml = ctx.screenRoster();
  ok('직원이 0명인 빈 사업장에서도 근로자명부(screenRoster) 창이 에러 없이 열린다',
    typeof rosterEmptyHtml === 'string' && rosterEmptyHtml.indexOf('법정 근로자명부') > -1);

  // 2) 직원이 있는 사업장에서 계약·취업규칙 전체 서브탭 및 근로자명부가 에러 없이 열린다
  ctx.App.coId = 'hanwoo_co';
  ctx.App.site = '1일등한우';
  ctx.setCompView('all');
  var compFullHtml = ctx.screenCompliance();
  ok('직원이 있는 사업장에서 계약·취업규칙 전체보기가 에러 없이 렌더링된다',
    compFullHtml.indexOf('상용직 간주 위험') > -1 && compFullHtml.indexOf('연간 4대보험·원천세 정산 대사표') > -1);

  var rosterFullHtml = ctx.screenRoster();
  ok('직원이 있는 사업장에서 근로자명부가 생애주기 알림과 함께 에러 없이 렌더링된다',
    rosterFullHtml.indexOf('홍길동') > -1 && rosterFullHtml.indexOf('근로자 생애주기 법정 알림') > -1);

  // 3) 급여 처리(screenPayroll)가 첫 진입 즉시 HTML/CSS 웹 임금대장(KPI 카드 + 월 알약 + 급여표 + 합계행)을 렌더링한다
  ctx.App.tab = 'payroll';
  ctx.App.site = '1일등한우';
  ctx.App.month = null;
  var payHtml = ctx.screenPayroll();
  ok('급여 처리가 엑셀 파일 클릭 없이도 즉시 HTML/CSS 웹 임금대장 표와 KPI 요약을 보여준다',
    payHtml.indexOf('pay-kpis') > -1 && payHtml.indexOf('mpills') > -1 &&
    payHtml.indexOf('<table class="emptbl"') > -1 && payHtml.indexOf('합계 (2명)') > -1);
})();

console.log('\n════════════════════════════════');
console.log('  통과 ' + pass + ' · 실패 ' + fail);
console.log('════════════════════════════════');
process.exit(fail ? 1 : 0);
