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

/* ══ 화면 (목업 https://claude.ai/artifact/DN7amujqijNxJKpyDDNnDu 승인 — 대표 「목업대로 진행해라」 2026-10-19) ══ */

/* 🏥 띠를 «실제로 그려» 본다 — h 를 흉내 내어 나무를 글자로 펼친다. 세 번째 useState(목록을 연 사람)만 P-1 로 연다. */
function 띠를그린다(items, contracts) {
  const store = { app_settings: { fiscalYearStart: '01-01' }, contracts: contracts || [] };
  let n = 0;
  const w = Object.assign(ctx, {
    dbGet: (k, d) => (k in store ? store[k] : d), todayYMD: () => '2026-10-19',
    consTypeDayFee: fee, consTypeDayOpt: () => ({ fee: 350000, unit: '일', noVat: false }),
    useState: (v) => [++n === 3 ? 'P-1' : v, () => {}],
    h(tag, props) { return { tag, props: props || {}, kids: Array.prototype.slice.call(arguments, 2) }; },
  });
  vm.runInContext(ERP_RAW.slice(ERP_RAW.indexOf('var UNIT_PROGS = {'), ERP_RAW.indexOf('function ClinicDayCards(')) + '\n'
    + cutFn(ERP, 'function ClinicDayCards('), w);
  w.__props = { items, types: TYPES, userName: () => '홍길동', listMode: true, onPick() {}, onPatch() {} };
  return JSON.stringify(vm.runInContext('ClinicDayCards(__props)', w));
}

test('⑨ 🏥 띠 — 칩에 «📈 성과추적 N 제외», 말풍선에 까닭, 목록에 꼬리표 (숨기지 않는다)', () => {
  const html = 띠를그린다([
    C({ id: 'a', no: '현클-1', companyName: '가나산업', consultDays: 3 }),
    C({ id: 'b', no: '현클-2', companyName: '다라전자', consultDays: 2, perfTrack: true }),
  ]);
  assert.match(html, /📈 성과추적 1 제외/, '전체 칩에 뺀 건수가 안 보입니다');
  assert.match(html, /📈 성과추적관리 1건은 연간 셈에서 뺐습니다/, '말풍선에 까닭이 없습니다');
  assert.match(html, /📈 성과추적 · 셈 제외/, '목록에 빠진 건의 꼬리표가 없습니다');
  assert.match(html, /현클-2/, '빠진 건이 목록에서 사라졌습니다');
  assert.match(html, /연간 셈에서 뺌/, '빠진 건의 일수 칸에 까닭(말풍선)이 없습니다');
  assert.match(html, /"3\/30일"|3\/30일/, '연간 셈은 3일 — 성과추적관리 2일이 더해지면 안 됩니다');
  /* 표시가 없으면 아무것도 안 붙는다 — 잔소리를 만들지 않는다 */
  const plain = 띠를그린다([C({ id: 'a', no: '현클-1', consultDays: 3 })]);
  assert.doesNotMatch(plain, /성과추적/);
});

test('⑨ 띠 목록의 「구분」 칸은 꼬리표가 한 줄에 들 만큼 넓다(한 칸 한 줄)', () => {
  const ui = cutFn(ERP, 'function ClinicDayCards(');
  const w = ui.match(/width: i === 2 \? '(\d+)px'/);
  assert.ok(w, '구분 칸의 폭을 못 찾았습니다');
  /* 11px 글씨 「📈 성과추적 · 셈 제외」 + 꼬리표 안쪽 여백 ≈ 125px — 그보다 좁으면 … 로 잘린다 */
  assert.ok(Number(w[1]) >= 125, '구분 칸 ' + w[1] + 'px — 성과추적 꼬리표가 잘립니다');
});

test('⑩ 계약창 — 현장클리닉 유형일 때만 유형 고르개 «바로 옆» 알약으로 켜고 끈다', () => {
  const cm = cutFn(ERP, 'function ContractModal(');
  const a = cm.indexOf("className:'pu-w-type'"), b = cm.indexOf('briefInput(kindV)', a);
  assert.ok(a >= 0 && b > a, '컨설팅 첫 줄(유형 고르개 → 업무 요약)을 못 찾았습니다');
  const row = cm.slice(a, b);
  assert.match(row, /clinicIsType\(_selType, typesArr\) && h\('label'/, '알약이 유형 옆에 없거나, 현장클리닉이 아닐 때도 뜹니다');
  assert.match(row, /checked:!!f\.perfTrack/, '알약이 perfTrack 을 보여 주지 않습니다');
  assert.match(row, /perfTrack:on/, '알약을 눌러도 perfTrack 이 바뀌지 않습니다');
  assert.match(row, /성과추적관리/);
});

test('⑩ 계약창 실적 줄 — 성과추적관리 계약이면 «이 계약까지» 대신 까닭을 적는다', () => {
  const cm = cutFn(ERP, 'function ContractModal(');
  const at = cm.indexOf('clinicContractHint(f,');
  assert.ok(at >= 0);
  const hintUi = cm.slice(at, cm.indexOf('})(),', at));
  assert.match(hintUi, /hint\.perf \?[^:]*이 계약은 📈 성과추적관리 · 셈 제외/, '빠진 까닭이 실적 줄에 없습니다');
  assert.match(hintUi, /hint\.perf \? null : h\('b', null, hint\.nextCnt/, '성과추적관리 계약인데 «이 계약까지» 숫자를 보입니다');
});

test('⑪ 컨설팅 수정창 — 현장클리닉일 때만 체크 칸이 있고 perfTrack 을 켜고 끈다', () => {
  const pe = cutFn(ERP, 'function ProjectEditModal(');
  const at = pe.indexOf('clinicIsType(f.typeCode, props.types) && h(');
  assert.ok(at >= 0, '컨설팅 수정창에 성과추적관리 칸이 없거나 현장클리닉 조건이 없습니다(기금·기타에도 뜹니다)');
  const fld = pe.slice(at, pe.indexOf("'관리번호'", at));
  assert.match(fld, /type:'checkbox', checked:!!f\.perfTrack/);
  assert.match(fld, /perfTrack:on/);
  assert.match(fld, /연간 수행일수·건수 셈에서 뺍니다/, '무엇이 바뀌는지 칸 옆에 적는다');
  const typeAt = pe.indexOf("'유형 (변경 시");
  assert.ok(typeAt >= 0 && typeAt < at, '체크 칸은 유형 고르개 아래에 둔다');
});


/* ══ «중복 아님» · 「현장클리닉 · 성과추적」 표시 (대표 지시 2026-10-20
     「성과추적관련 체크할 수 있게 해달라 그래야 별도 관리되고 중복안된다. 그리고 현장클리닉 성과추적 표시도 해라 중복아님도 확인되게」) ══ */
function dupCtx() {
  const c = { console, Object, Array, String, Number, JSON, Math, parseInt, window: {}, __store: {} };
  c.dbGet = (k, d) => (Object.prototype.hasOwnProperty.call(c.__store, k) ? c.__store[k] : d);
  c.dbSet = (k, v) => { c.__store[k] = v; };
  vm.createContext(c);
  const seg = (a, b) => { const i = ERP_RAW.indexOf(a), j = ERP_RAW.indexOf(b, i); assert.ok(i >= 0 && j > i, a); return ERP_RAW.slice(i, j); };
  vm.runInContext(seg('var BIZ_CASE_SEED = [', 'var CONSULTING_DEMO_SEED'), c);                 // 유형 씨앗(현장클리닉 cons-clinic)
  vm.runInContext(seg('var CONTRACT_KINDS = [', '// 종류별 세부 분류 라벨'), c);
  vm.runInContext(seg('function getKindTypes(kindV, includeHidden){', '// ============ 과거 회사 통합 검색'), c);   // 유형 역할·clinicIsPerf 포함
  vm.runInContext(seg('// ============ 계약의 세부 종류', '// 계약번호 자동 생성'), c);           // 중복 판정·훑기
  vm.runInContext(['erpCoAddrKey', 'erpSameCompany', 'erpContractDupBlock'].map((n) => cutFn(ERP, 'function ' + n + '(')).join('\n'), c);
  return c;
}
const D = dupCtx();
const CO = { name: '(주)가나산업', bizNo: '123-81-00001' };
const KC = (o) => Object.assign({ kinds: ['consulting'], typeCodes: { consulting: 'cons-clinic' }, companyName: CO.name, bizNo: CO.bizNo, company: CO, status: 'review' }, o);

test('⑫ 중복 판정 — 성과추적 ↔ 원래 현장클리닉은 «별도 건(중복 아님)», 같은 쪽끼리는 그대로 중복', () => {
  const v1 = D.contractDupVerdict(KC({ id: 'old' }), KC({ perfTrack: true }));
  assert.equal(v1.verdict, 'diff', '성과추적 계약이 원래 현장클리닉과 중복으로 잡힙니다');
  assert.deepEqual(Array.from(v1.perf), ['consulting'], '왜 중복이 아닌지(perf)를 돌려주지 않습니다');
  assert.equal(D.contractDupVerdict(KC({ id: 'old', perfTrack: true }), KC({})).verdict, 'diff', '거꾸로(기존이 성과추적)도 별도 건');
  assert.equal(D.contractDupVerdict(KC({ id: 'old', perfTrack: true }), KC({ perfTrack: true })).verdict, 'dup', '★ 성과추적끼리는 여전히 중복이다');
  assert.equal(D.contractDupVerdict(KC({ id: 'old' }), KC({})).verdict, 'dup', '★ 원래 현장클리닉끼리는 여전히 중복이다');
  /* ★ 실제 서버 코드(씨앗이 아닌 consulting-mp0w…)에서도 — 사전(biz_cons_types)으로 현장클리닉을 알아본다 */
  D.__store.biz_cons_types = [{ code: 'consulting-mp0w1084', short: '현장클리', name: '현장클리닉' }];
  const live = { typeCodes: { consulting: 'consulting-mp0w1084' } };
  assert.equal(D.contractDupVerdict(KC(Object.assign({ id: 'old' }, live)), KC(Object.assign({ perfTrack: true }, live))).verdict, 'diff',
    '실제 코드의 현장클리닉에서 성과추적을 못 가릅니다(씨앗 코드만 알아봄)');
  assert.equal(D.contractSubtypeLabel(KC(Object.assign({ perfTrack: true }, live)), 'consulting').label, '현장클리닉 · 📈 성과추적');
  assert.equal(D.erpContractDupBlock(KC(Object.assign({ perfTrack: true }, live)), [KC(Object.assign({ id: 'k' }, live))]).length, 0);
  delete D.__store.biz_cons_types;
  /* 현장클리닉이 아닌 유형에 표시가 남아 있어도 가르지 않는다(기술보호와 합치지 않는다) */
  const tg = { typeCodes: { consulting: 'cons-techguard' } };
  assert.equal(D.contractDupVerdict(KC(Object.assign({ id: 'old' }, tg)), KC(Object.assign({ perfTrack: true }, tg))).verdict, 'dup');
});

test('⑫ 저장을 막는 잣대(erpContractDupBlock) — 성과추적 ↔ 원래 현장클리닉은 막지 않는다', () => {
  const regular = KC({ id: 'k1', contractNo: '계약-1' });
  const perf = KC({ id: 'k2', contractNo: '계약-2', perfTrack: true });
  assert.equal(D.erpContractDupBlock(KC({ perfTrack: true }), [regular]).length, 0, '성과추적 계약을 원래 현장클리닉 때문에 막습니다');
  assert.equal(D.erpContractDupBlock(KC({}), [perf]).length, 0, '원래 현장클리닉을 성과추적 계약 때문에 막습니다');
  assert.equal(D.erpContractDupBlock(KC({}), [regular]).length, 1, '★ 같은 원래 현장클리닉 둘은 여전히 묻는다');
  assert.equal(D.erpContractDupBlock(KC({ perfTrack: true }), [perf]).length, 1, '★ 성과추적 둘은 여전히 묻는다');
  /* 유형을 안 건드려 드롭다운 첫 항목이 골라진 채로 저장해도(typeCodes 빔) 같은 판정 */
  D.__store.biz_cons_types = [{ code: 'cons-clinic', short: '클릭', name: '현장클리닉' }, { code: 'cons-hr', short: '인노', name: '인사노무' }];
  assert.equal(D.erpContractDupBlock({ kinds: ['consulting'], typeCodes: {}, company: CO, perfTrack: true }, [regular]).length, 0,
    '화면에 골라져 있는 유형(첫 항목)으로 판정하지 않습니다');
  delete D.__store.biz_cons_types;
});

test('⑫ 「지난 중복 훑기」 — 성과추적은 원래 현장클리닉과 «다른 묶음»이고 이름표에 성과추적이 붙는다', () => {
  const a = D.dupSweepFacets('contract', KC({ id: 'a' }))[0];
  const b = D.dupSweepFacets('contract', KC({ id: 'b', perfTrack: true }))[0];
  assert.notEqual(a.code, b.code, '같은 묶음이면 훑기가 중복으로 보여 줍니다');
  assert.equal(b.code, D.dupSweepFacets('contract', KC({ id: 'c', perfTrack: true }))[0].code, '★ 성과추적끼리는 같은 묶음(중복이면 잡힌다)');
  assert.match(b.label, /현장클리닉 · 📈 성과추적/);
  assert.doesNotMatch(a.label, /성과추적/);
});

test('⑫ 세부 종류 이름표 — label 에만 「· 📈 성과추적」, name 은 그대로(이름으로 거르는 곳이 있다)', () => {
  const p = D.contractSubtypeLabel(KC({ perfTrack: true }), 'consulting');
  assert.equal(p.label, '현장클리닉 · 📈 성과추적');
  assert.equal(p.name, '현장클리닉', 'name 이 바뀌면 유형 거르개·칩이 성과추적 건을 놓칩니다');
  assert.equal(D.contractSubtypeLabel(KC({}), 'consulting').label, '현장클리닉');
  assert.equal(D.contractSubtypeLabel(KC({ perfTrack: true, typeCodes: { consulting: 'cons-techguard' } }), 'consulting').label, '기술보호울타리');
});

test('⑫ 계약 창 중복 띠 — 겹친 것이 성과추적뿐이면 «별도 건(중복 아님)»이라고 적는다', () => {
  const cm = cutFn(ERP, 'function ContractModal(');
  assert.match(cm, /var perfOnly = worst === 'diff' && dupRows\.some\(function\(r\)\{ return r\.v && r\.v\.perf && r\.v\.perf\.length; \}\);/);
  assert.match(cm, /perfOnly \? '같은 사업장의 현장클리닉 — 📈 성과추적은 별도 건\(중복 아님\)'/, '띠 제목에 까닭이 없습니다');
  assert.match(cm, /var conclusion = perfOnly \? '→ 성과추적관리는[^']*중복이 아닙니다/, '띠 결론에 까닭이 없습니다');
  assert.match(cm, /\(v && v\.perf && v\.perf\.length\) \? '📈 성과추적 — 별도 건\(중복 아님\)'/, '줄마다 붙는 말풍선에 까닭이 없습니다');
});

test('⑬ 「현장클리닉」 옆 «📈 성과추적» — 보드 카드 · 목록 · 폰 카드 · 컨설팅관리 유형 칸', () => {
  /* ★ 실제 서버의 현장클리닉 코드는 씨앗(cons-clinic)이 아니다 — 꼬리표는 types 없이 불리므로 «살아 있는 사전»을 읽어야 한다 */
  const T = Object.assign(ctx, { BIZ_CONS_SEED: [], dbGet: (k, d) => (k === 'biz_cons_types' ? TYPES : d),
    h(tag, props) { return { tag, props: props || {}, kids: Array.prototype.slice.call(arguments, 2) }; } });
  vm.runInContext(line(ERP_RAW, 'var CLINIC_PERF_TIP = ') + '\n' + cutFn(ERP, 'function clinicPerfTag('), T);
  assert.equal(T.clinicPerfTag({}, 'consulting-x1'), null, '표시가 없으면 아무것도 안 그린다');
  assert.equal(T.clinicPerfTag({ perfTrack: true }, 'consulting-x2'), null, '현장클리닉이 아니면 안 그린다');
  const tag = T.clinicPerfTag({ perfTrack: true }, 'consulting-x1');
  assert.equal(tag.kids[0], '📈 성과추적');
  assert.match(tag.props.title, /중복 아님/, '마우스를 올리면 «중복 아님»이 보여야 합니다');
  assert.equal(tag.props.style.whiteSpace, 'nowrap');
  const cmg = cutFn(ERP, 'function ContractManagement(');
  assert.match(cmg, /clinicPerfTag\(c, contractSubtypeCode\(c, 'consulting'\)\)/, '보드 카드에 성과추적 꼬리표가 없습니다');
  assert.match(cmg, /var text = subs\.join\(' \/ '\) \+ \(clinicIsPerf\(c, contractSubtypeCode\(c, 'consulting'\)\) \? ' · 📈 성과추적' : ''\);/, '목록 줄에 없습니다');
  assert.match(cmg, /var mSub = [^;]*clinicIsPerf\(c, contractSubtypeCode\(c, 'consulting'\)\) \? ' · 📈 성과추적' : ''\)/, '폰 카드에 없습니다');
  assert.match(cutFn(ERP, 'function ProjectManagementShared('), /clinicPerfTag\(it, it\.typeCode\)/, '컨설팅관리 유형 칸에 없습니다');
});

test('⑭ 계약 창 — 성과추적관리는 «체크 칸»이 눈에 보인다(숨긴 체크박스 알약이 아니다)', () => {
  const cm = cutFn(ERP, 'function ContractModal(');
  const a = cm.indexOf("className:'pu-w-type'"), b = cm.indexOf('briefInput(kindV)', a);
  const row = cm.slice(a, b);
  const box = row.match(/h\('input', \{ type:'checkbox', checked:!!f\.perfTrack, style:\{([^}]*)\}/);
  assert.ok(box, '성과추적관리 체크 칸이 없습니다');
  assert.doesNotMatch(box[1], /display:'none'/, '체크 칸이 숨겨져 있습니다 — 대표 「체크할 수 있게 해달라」');
});
