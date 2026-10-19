'use strict';
/* 📈 현장클리닉 «성과추적관리» — 연간 수행일수·건수에서 뺀다 (대표 지시 2026-10-19)
   「현장클리닉에서 성과추적관리 사업의 경우 년간 수행일수에 포함되지 않는다
     그부분 반영해주고 체크표시 할 수 있게하고 카운팅에 들어가지 않게 해달라.」

   못 박는 것(규칙) — 실제 pu-erp.html·clinic-intake.html 의 함수를 잘라 «돌려» 본다:
   ① 표시(perfTrack)된 현장클리닉 건은 수행 건수·일수에서 빠진다 — 컨설팅관리(수행)·계약관리(예정) 둘 다
   ② 빠진 건은 지우지 않고 목록에 «성과추적» 줄로 남는다(숨기지 않는다) · 몇 건 뺐는지 따로 센다
   ③ 「⚠ 확인 필요」에도 안 올라온다 — 셈에 안 드는 건의 일수를 정할 까닭이 없다
   ④ 현장클리닉 사업의 표시다 — 기술보호 셈은 표시가 붙어 있어도 그대로(두 사업을 합치지 않는다)
   ⑤ 계약창 «이 계약까지»에 더하지 않는다
   ⑥ 계약관리 → 컨설팅관리 이관 때 표시가 따라간다
   ⑦ 중진공 「신청경로」 칸이 정확히 「성과추적관리」일 때만 켠다 — 「성과추적」이 들어 있다고 켜지 않는다
   ⑧ 중진공 즐겨찾기 단추가 「신청경로」를 읽어 보낸다 — 두 파일의 글자가 같다
   이름은 모두 가짜다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const ERP_RAW = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const ERP = stripJs(ERP_RAW);
const INTAKE_RAW = fs.readFileSync(path.join(ROOT, 'clinic-intake.html'), 'utf8').replace(/\r\n/g, '\n');
const line = (src, head) => { const m = src.match(new RegExp('^' + head + '.*$', 'm')); assert.ok(m, head + ' 줄이 없습니다'); return m[0]; };

/* ── 셈 함수들을 원본 그대로 싣는다 ── */
const ctx = { Object, Array, String, JSON, Math, Date, parseInt, window: {} };
vm.createContext(ctx);
vm.runInContext([
  line(ERP_RAW, 'var CONS_ROLE_SEED = '),
  line(ERP_RAW, 'var CLINIC_PLAN_STATUS = '),
  line(ERP_RAW, 'var CLINIC_SKIP_REASON = '),
  line(ERP_RAW, 'var CLINIC_PERF_ROUTE = '),
].concat(['consNameKey', 'consTypeRole', 'consRoleOf', 'clinicFyRange', 'clinicIsType', 'techIsType', 'clinicIsPerf',
  'clinicFeeDays', 'clinicDaysOf', 'clinicDayCards'].map((n) => cutFn(ERP, 'function ' + n + '('))).join('\n'), ctx);

const TYPES = [
  { code: 'consulting-x1', name: '현장클리닉', role: 'clinic' },
  { code: 'consulting-x2', name: '통합기술보호지원단', role: 'tech' },
];
const fee = (code) => (code === 'consulting-x1' ? 350000 : code === 'consulting-x2' ? 300000 : 0);
const FY = ctx.clinicFyRange('01-01', '2026-10-19', 0);
const C = (o) => Object.assign({ typeCode: 'consulting-x1', managerMain: 'P-1', startDate: '2026-06-01' }, o);
const K = (o) => Object.assign({ kinds: ['consulting'], typeCodes: { consulting: 'consulting-x1' }, managerMain: 'P-1', status: 'review', signDate: '2026-09-20' }, o);
const DE = (x) => JSON.parse(JSON.stringify(x));

test('① 수행 쪽 — 표시된 건은 건수·일수에서 빠지고 «몇 건 뺐는지»는 따로 센다', () => {
  const r = ctx.clinicDayCards([
    C({ id: 'a', no: '현클-1', consultDays: 3 }),
    C({ id: 'b', no: '현클-2', consultDays: 2, perfTrack: true }),
    C({ id: 'c', no: '현클-3', consultDays: 3, status: 'closed', closedReason: '정상 종료' }),
  ], [], TYPES, FY, fee);
  assert.equal(r.by['P-1'].cnt, 2, '성과추적관리 건이 수행 건수에 들어갔습니다');
  assert.equal(r.by['P-1'].days, 6, '성과추적관리 건의 일수가 연간 수행일수에 들어갔습니다');
  assert.equal(r.by['P-1'].perf, 1);
  assert.equal(r.total.cnt, 2); assert.equal(r.total.days, 6); assert.equal(r.total.perf, 1);
});

test('① 예정 쪽 — 계약관리의 이관 전 계약도 표시되면 예정 건수·일수에서 빠진다', () => {
  const r = ctx.clinicDayCards([], [
    K({ id: 'k1', contractNo: '계약-1', consultDays: 3 }),
    K({ id: 'k2', contractNo: '계약-2', consultDays: 2, perfTrack: true }),
  ], TYPES, FY, fee);
  assert.equal(r.by['P-1'].planCnt, 1, '성과추적관리 계약이 예정 건수에 들어갔습니다');
  assert.equal(r.by['P-1'].planDays, 3, '성과추적관리 계약의 일수가 예정 일수에 들어갔습니다');
  assert.equal(r.by['P-1'].perf, 1);
  assert.equal(r.total.planCnt, 1); assert.equal(r.total.perf, 1);
});

test('② 숨기지 않는다 — 목록에 «성과추적» 줄로 일수와 함께 남는다(금액은 넣지 않는다)', () => {
  const r = ctx.clinicDayCards([C({ id: 'b', no: '현클-2', companyName: '가나산업', consultDays: 2, perfTrack: true })],
    [K({ id: 'k2', contractNo: '계약-2', companyName: '다라전자', consultDays: 3, perfTrack: true })], TYPES, FY, fee);
  const rows = DE(r.by['P-1'].rows);
  assert.equal(rows.length, 2, '빠진 건이 목록에서 사라졌습니다 — 까닭이 안 보입니다');
  rows.forEach((x) => {
    assert.equal(x.st, 'perf', '구분: ' + x.st);
    assert.ok(!('fee' in x) && !('balanceFee' in x) && !('amount' in x), '목록에는 금액을 넣지 않는다(대표 2026-10-05)');
  });
  assert.deepEqual(rows.map((x) => x.days).sort(), [2, 3], '일수는 지우지 않고 보여 준다');
});

test('③ 「⚠ 확인 필요」에 안 올라온다 — 끝났는데 사유가 없어도, 일수를 금액으로만 짐작해도', () => {
  const r = ctx.clinicDayCards([
    C({ id: 'p1', status: 'closed', consultDays: 2, perfTrack: true }),
    C({ id: 'p2', status: 'closed', closedReason: '정상 종료', balanceFee: 770000, balanceFeeVatIncluded: true, perfTrack: true }),
    C({ id: 'n1', status: 'closed', consultDays: 2 }),
  ], [], TYPES, FY, fee);
  assert.deepEqual(Array.from(r.check, (x) => x.rec.id), ['n1'], '성과추적관리 건이 확인 필요에 올라왔습니다');
  assert.equal(r.by['P-1'].zero.length, 0);
});

test('③ 「미수행 종료」가 먼저다 — 둘 다면 미수행 종료로 한 번만 센다', () => {
  const r = ctx.clinicDayCards([C({ id: 's', status: 'closed', closedReason: ctx.CLINIC_SKIP_REASON, perfTrack: true })], [], TYPES, FY, fee);
  assert.equal(r.by['P-1'].skip, 1);
  assert.equal(r.by['P-1'].perf, 0);
  assert.equal(r.by['P-1'].rows.length, 1);
});

test('④ 현장클리닉 사업의 표시다 — 기술보호 셈은 표시가 붙어 있어도 그대로 센다', () => {
  const items = [C({ id: 't', typeCode: 'consulting-x2', consultDays: 2, perfTrack: true })];
  const contracts = [K({ id: 'kt', typeCodes: { consulting: 'consulting-x2' }, consultDays: 1, perfTrack: true })];
  const r = ctx.clinicDayCards(items, contracts, TYPES, FY, fee, ctx.techIsType, 3);
  assert.equal(r.by['P-1'].cnt, 1, '기술보호 건이 성과추적관리 표시로 빠졌습니다 — 두 사업을 합치면 안 됩니다');
  assert.equal(r.by['P-1'].days, 2);
  assert.equal(r.by['P-1'].planCnt, 1);
  assert.equal(r.by['P-1'].perf, 0);
  assert.equal(ctx.clinicIsPerf({ perfTrack: true }, 'consulting-x2', TYPES), false);
  assert.equal(ctx.clinicIsPerf({ perfTrack: true }, 'consulting-x1', TYPES), true);
  assert.equal(ctx.clinicIsPerf({}, 'consulting-x1', TYPES), false, '표시가 없으면 셈에 든다');
});

test('⑤ 계약창 «이 계약까지» — 성과추적관리 계약은 더하지 않는다', () => {
  const store = {
    app_settings: { fiscalYearStart: '01-01' },
    consultings: [C({ id: 'a', consultDays: 3 })],
    contracts: [K({ id: 'k1', consultDays: 3 })],
  };
  const h = { dbGet: (k, d) => (k in store ? store[k] : d), todayYMD: () => '2026-10-19', consTypeDayFee: fee };
  Object.assign(ctx, h);
  vm.runInContext('var UNIT_PROGS = ' + ERP_RAW.slice(ERP_RAW.indexOf('var UNIT_PROGS = ') + 'var UNIT_PROGS = '.length).match(/^\{[\s\S]*?\n\};/)[0]
    + '\n' + cutFn(ERP, 'function clinicContractHint('), ctx);
  const f = { id: 'new', managerMain: 'P-1', kinds: ['consulting'], typeCodes: { consulting: 'consulting-x1' }, consultDays: 2 };
  const plain = ctx.clinicContractHint(f, TYPES);
  assert.equal(plain.nextCnt, 3); assert.equal(plain.nextDays, 8); assert.equal(plain.perf, false);
  const perf = ctx.clinicContractHint(Object.assign({}, f, { perfTrack: true }), TYPES);
  assert.equal(perf.perf, true);
  assert.equal(perf.nextCnt, 2, '성과추적관리 계약을 «이 계약까지» 건수에 더했습니다');
  assert.equal(perf.nextDays, 6, '성과추적관리 계약의 일수를 «이 계약까지»에 더했습니다');
  /* 예정 쪽에 같은 표시의 다른 계약이 있어도 빠진다 */
  store.contracts.push(K({ id: 'k2', consultDays: 4, perfTrack: true }));
  assert.equal(ctx.clinicContractHint(f, TYPES).nextDays, 8);
});

test('⑥ 이관 — 계약의 표시가 컨설팅관리로 따라간다(안 넘기면 이관하는 순간 셈에 다시 든다)', () => {
  const tc = cutFn(ERP, 'function transferContract(');
  assert.match(tc, /perfTrack:[^,\n]*contract\.perfTrack/, '이관하는 컨설팅에 perfTrack 을 안 넘깁니다');
  assert.match(tc, /perfTrack:[^,\n]*kindV === 'consulting'/, '컨설팅이 아닌 사업(기금·기타)에 표시를 넘기면 안 됩니다');
  /* 새 계약의 빈 서식에 칸이 있다 — 없으면 체크박스가 «켜져 있지도 꺼져 있지도 않은» 값으로 시작한다 */
  assert.match(ERP, /consultDays:0,[\s\S]{0,200}perfTrack:false,/, '빈 계약 서식에 perfTrack 칸이 없습니다');
});

test('⑦ 중진공 요청 → 계약 — 「신청경로」 칸 글자가 정확히 「성과추적관리」일 때만 켠다', () => {
  const c2 = { consTypeDayOpt: () => ({ fee: 350000, unit: '일', noVat: false }) };
  vm.createContext(c2);
  vm.runInContext(line(ERP_RAW, 'var CLINIC_PERF_ROUTE = ') + '\n' + cutFn(ERP, 'function consDayAmount(') + '\n' + cutFn(ERP, 'function ctReqHumanFill('), c2);
  const blank = () => ({ typeCodes: { consulting: 'consulting-x1' }, signDate: '2026-10-01', startDate: '', note: '🏥 중진공 현장클리닉에서 등록' });
  const on = (route, source) => c2.ctReqHumanFill(blank(), { source: source || 'smes', smes: { route: route } });
  assert.equal(on('성과추적관리').perfTrack, true);
  assert.equal(on(' 성과추적 관리 ').perfTrack, true, '띄어쓰기만 다른 같은 글자');
  assert.match(on('성과추적관리').note, /성과추적관리/, '왜 셈에서 빠졌는지 비고에 남긴다');
  ['성과추적', '성과추적관리 신청', '기업 성과추적관리', '일반', '', undefined].forEach((r) =>
    assert.ok(!on(r).perfTrack, '「' + r + '」 로 켰습니다 — 글자가 정확히 같을 때만 켭니다(짐작 금지)'));
  assert.ok(!on('성과추적관리', 'photo').perfTrack, '사진첩 요청에는 이 칸이 없습니다');
  assert.ok(!c2.ctReqHumanFill(blank(), { source: 'smes' }).perfTrack, 'smes 칸이 없는 옛 요청');
  /* 계약관리가 실제로 이 길을 탄다 */
  assert.match(cutFn(ERP, 'async function processOneContractRequest('), /ctReqHumanFill\(ctReqForm\(req\), req\)/);
});

/* ── 중진공 쪽: 즐겨찾기 단추(북마클릿)·보내기 창 ── */
function intakeLib(extra) {
  const c = Object.assign({ Date, Math, JSON, encodeURIComponent, URL }, extra || {});
  vm.createContext(c);
  vm.runInContext([line(INTAKE_RAW, 'var PERF_ROUTE = ')].concat(['smesClip', 'clinicNorm', 'clinicRequest', 'clinicPerfRoute']
    .map((n) => cutFn(INTAKE_RAW, 'function ' + n + '('))).join('\n'), c);
  return c;
}
function fakePage(rows) {
  const cells = [];
  rows.forEach(([k, v]) => { const val = { innerText: v }; cells.push({ innerText: k, nextElementSibling: val }, val); });
  const sent = [];
  const win = { open: () => ({ postMessage: (m, o) => sent.push({ m, o }) }), addEventListener() {}, removeEventListener() {}, getComputedStyle: () => ({ backgroundColor: '' }) };
  const c = intakeLib({ document: { querySelectorAll: (sel) => (sel === 'th,td,dt' ? cells : []) }, window: win, alert() {},
    setInterval: (fn) => { fn(); return 1; }, clearInterval() {} });
  return { c, sent };
}

test('⑧ 즐겨찾기 단추가 「신청경로」 칸을 읽어 보낸다 (신청내용 표: 분야 · 신청경로 · 기업종류 …)', () => {
  const p = fakePage([['지원기업명', '(주)가나상사'], ['사업자등록번호', '123-81-00001'], ['분야', '인사/노무'], ['신청경로', '성과추적관리'], ['기업종류', '기타']]);
  p.c.smesClip('https://nabaho.github.io/pureunall/clinic-intake.html');
  assert.ok(p.sent.length, '값을 건네지 않았습니다');
  assert.equal(p.sent[0].m.data.route, '성과추적관리', '신청경로를 못 읽었습니다');
  assert.ok(Number(p.sent[0].m.v) >= 2, '새 단추는 판 번호를 올려야 옛 단추와 가릴 수 있습니다');
  const d = p.c.clinicNorm(p.sent[0].m.data);
  assert.equal(d.route, '성과추적관리');
  const r = p.c.clinicRequest({ managerMain: 'P-001', consultingType: 'consulting-x1', now: 1790000000000,
    company: Object.assign({ name: d.name, bizNo: d.bizNo }, { route: d.route }) }).rec;
  assert.equal(r.smes.route, '성과추적관리', '요청 한 줄에 신청경로가 안 실렸습니다');
  assert.ok(!('perfTrack' in r), '표시를 켜는 곳은 계약관리 한 곳이다 — 요청에서 미리 켜지 않는다');
});

test('⑧ 보내기 창 — 같은 글자로 판단하고, 옛 단추면 «신청경로를 못 읽었다»고 알린다', () => {
  const c = intakeLib();
  assert.equal(c.clinicPerfRoute('성과추적관리'), true);
  assert.equal(c.clinicPerfRoute('성과추적'), false);
  assert.equal(line(INTAKE_RAW, 'var PERF_ROUTE = ').match(/'([^']+)'/)[1], line(ERP_RAW, 'var CLINIC_PERF_ROUTE = ').match(/'([^']+)'/)[1],
    '보내기 창과 계약관리의 글자가 다르면 «셈 제외»라고 보여 주고 실제로는 안 켜진다');
  const js = stripJs(INTAKE_RAW);
  assert.match(js, /S\.ver = Number\(d\.v\)/, '받은 단추의 판을 기억하지 않습니다');
  assert.match(js, /S\.ver < 2 \?/, '옛 단추로 눌렀을 때 알리지 않습니다');
  assert.match(js, /route: S\.data\.route/, '보낼 때 신청경로를 안 싣습니다');
  assert.ok(!/\/\//.test(cutFn(INTAKE_RAW, 'function smesClip(')), '북마클릿에 줄 주석(//)이 있으면 뒤가 통째로 주석이 됩니다');
});
