'use strict';
/* 중진공 현장클리닉 → 푸른이알피 «계약 등록 요청» (대표 지시 2026-10-07 「목업」→「진행해라」)

   지키는 것
   ① 중진공 화면에서 «보이는 표»만 읽는다 — 칸 이름 옆 칸, 진행 단계는 색이 칠해진 것
   ② 회사 정보를 못 찾으면 창을 안 연다 · 값은 우리 창의 출처(origin)로만 보낸다
   ③ 받는 창은 smes.go.kr 에서 온 메시지만 믿는다
   ④ 요청은 data/contract_requests 한 줄뿐 — 계약(data/contracts)에 직접 쓰지 않는다
   ⑤ 대표자 휴대폰은 사람이 체크했을 때만 · 일수·선정일은 사람이 적은 것만(기본값 금지)
   ⑥ 계약관리: 사람이 적은 일수만 「1일 단가 × 일수」로 금액을 낸다 — 비면 안 채운다
   ⑦ 이 창은 이알피의 딸린 화면으로 등록부에 있다 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripJs } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'clinic-intake.html'), 'utf8');
const ERP = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');

function cutFrom(src, head) {
  const at = src.indexOf(head);
  assert.ok(at >= 0, head + ' 이 없습니다');
  let d = 0;
  for (let i = src.indexOf('{', at); i < src.length; i++) {
    if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) return src.slice(at, i + 1); }
  }
  throw new Error(head);
}
const cut = (n) => cutFrom(SRC, 'function ' + n + '(');
const lib = (extra) => {
  const ctx = Object.assign({ Date, Math, JSON, encodeURIComponent, URL }, extra || {});
  vm.createContext(ctx);
  vm.runInContext(['smesClip', 'bookmarkletHref', 'clinicNorm', 'clinicTypeOf', 'clinicRequest'].map(cut).join('\n')
    + '\nvar SMES_ORIGIN = ' + SRC.match(/var SMES_ORIGIN = (\/.*\/);/)[1] + ';', ctx);
  return ctx;
};

/* 중진공 화면 흉내 — 칸 이름(th)과 값(td)이 옆에 붙은 표 + 진행 단계 띠 */
function fakePage(rows, stages, active) {
  const cells = [];
  rows.forEach(([k, v]) => {
    const val = { innerText: v };
    const key = { innerText: k, nextElementSibling: val };
    cells.push(key, val);
  });
  const stageEls = stages.map((t) => ({ innerText: t, _bg: t === active ? 'rgb(30, 58, 95)' : 'rgba(0, 0, 0, 0)' }));
  const sent = [], alerts = [], listeners = [];
  const win = {
    open: (url, name) => { win._opened = { url, name }; return { postMessage: (m, o) => sent.push({ m, o }) }; },
    addEventListener: (t, f) => listeners.push(f), removeEventListener() {},
    getComputedStyle: (el) => ({ backgroundColor: el._bg || '' }),
  };
  const ctx = lib({
    document: { querySelectorAll: (sel) => (sel === 'th,td,dt' ? cells : stageEls) },
    window: win, alert: (m) => alerts.push(m),
    setInterval: (fn) => { for (let i = 0; i < 3; i++) fn(); return 1; }, clearInterval() {},
  });
  return { ctx, sent, alerts, win };
}
const ROWS = [['컨설팅지역', '충남'], ['지원기업명', '(주)가나상사'], ['대표자 휴대폰번호', '010-0000-0000'], ['대표자성명', '홍길동'],
  ['사업자등록번호', '123-81-00001'], ['본사주소', '31000\n충청남도 ○○시 ○○로 00'], ['본사전화', '041-000-0000'],
  ['e-mail주소', 'sales@example.com'], ['업태(업종)', '제조업(10~34)'], ['주생산품', '전자기기'], ['매출액', '3382 백만원'], ['상시근로자수', '26 명']];
const STAGES = ['현장클리닉추천', '현장클리닉승인', '자문위원선정', '수행계획서승인', '현장지도결과서승인', '자문료지급대기', '자문료지급'];

test('① 보이는 표를 읽고, 칠해진 단계를 고른다', () => {
  const p = fakePage(ROWS, STAGES, '자문위원선정');
  p.ctx.smesClip('https://nabaho.github.io/pureunall/clinic-intake.html');
  assert.equal(p.alerts.length, 0, p.alerts.join(' / '));
  assert.equal(p.win._opened.url, 'https://nabaho.github.io/pureunall/clinic-intake.html');
  assert.ok(p.sent.length >= 1, '값을 건네지 않았습니다');
  const { m, o } = p.sent[0];
  assert.equal(o, 'https://nabaho.github.io', '값은 우리 창의 출처로만 보내야 합니다(* 금지)');
  assert.equal(m.type, 'pu-smes-clinic');
  assert.equal(m.data.name, '(주)가나상사');
  assert.equal(m.data.bizNo, '123-81-00001');
  assert.equal(m.data.ceo, '홍길동');
  assert.equal(m.data.stage, '자문위원선정', '진행 단계를 못 골랐습니다');
  assert.equal(m.data.mobile, '010-0000-0000', '띄어 쓴 칸 이름도 읽어야 합니다');
});

test('② 회사 정보를 못 찾으면 창을 안 연다', () => {
  const p = fakePage([['컨설팅지역', '충남']], STAGES, '');
  p.ctx.smesClip('https://nabaho.github.io/pureunall/clinic-intake.html');
  assert.equal(p.win._opened, undefined, '엉뚱한 화면에서 빈 창을 열면 안 됩니다');
  assert.equal(p.alerts.length, 1);
});

test('북마클릿 — 스스로 다 들고 가고, 줄 주석이 없다', () => {
  const c = lib();
  const href = c.bookmarkletHref('https://nabaho.github.io/pureunall/clinic-intake.html');
  assert.match(href, /^javascript:/);
  const body = decodeURIComponent(href.slice('javascript:'.length));
  assert.match(body, /function smesClip\(intakeUrl\)/);
  assert.match(body, /\)\("https:\/\/nabaho\.github\.io\/pureunall\/clinic-intake\.html"\)$/);
  assert.ok(!/\/\//.test(cut('smesClip')), '줄 주석(//)이 있으면 즐겨찾기 주소에서 뒤가 통째로 주석이 됩니다');
  assert.ok(!/<script|import\(|fetch\(|XMLHttpRequest/.test(cut('smesClip')), '중진공 화면에서 바깥 것을 부르면 안 됩니다');
});

test('③ 받는 창은 중진공에서 온 메시지만 믿는다', () => {
  const re = lib().SMES_ORIGIN;
  ['https://www.smes.go.kr', 'https://smes.go.kr'].forEach((o) => assert.ok(re.test(o), o));
  ['http://www.smes.go.kr', 'https://smes.go.kr.evil.com', 'https://evilsmes.go.kr', 'https://www.smes.go.kr.example'].forEach((o) =>
    assert.ok(!re.test(o), o + ' 를 믿으면 안 됩니다'));
  assert.match(stripJs(SRC), /if \(!SMES_ORIGIN\.test\(ev\.origin\)\) return;/, '출처 검사 없이 받습니다');
});

test('다듬기 — 사업자번호 10자리, 주소 앞 우편번호 떼기', () => {
  const c = lib();
  const d = c.clinicNorm({ name: ' (주)가나상사 ', bizNo: '1238100001', addr: '31000\n충청남도 ○○시', email: '--', workers: '26 명' });
  assert.equal(d.bizNo, '123-81-00001');
  assert.equal(d.bizOk, true);
  assert.equal(d.zipcode, '31000');
  assert.equal(d.address, '충청남도 ○○시');
  assert.equal(d.email, '', '「--」는 빈 값입니다');
  assert.equal(d.workers, 26);
  assert.equal(c.clinicNorm({ bizNo: '123-81' }).bizOk, false);
});

test('현장클리닉 유형 — 하나일 때만 고른다', () => {
  const c = lib();
  assert.equal(c.clinicTypeOf([{ code: 'a', name: '현장클리닉', role: 'clinic' }, { code: 'b', name: '기술보호', role: 'tech' }]).code, 'a');
  assert.equal(c.clinicTypeOf([{ code: 'a', name: '현장클리닉', role: 'clinic' }, { code: 'c', name: '현장클리닉2', role: 'clinic' }]), null,
    '둘이면 찍지 않습니다(사진첩 25장 사고)');
  assert.equal(c.clinicTypeOf([{ code: 'x', name: '현장 클리닉 컨설팅' }]).code, 'x');
});

test('④·⑤ 요청 한 줄 — 빠지면 안 만들고, 휴대폰·일수는 사람이 고른 것만', () => {
  const c = lib();
  const base = { managerMain: 'P-001', consultingType: 'cons-x', by: '홍길동', now: 1790000000000,
    company: { name: '(주)가나상사', bizNo: '123-81-00001', ceo: '홍길동', mobile: '010-0000-0000', stage: '자문위원선정' } };
  ['managerMain', 'consultingType'].forEach((k) => assert.ok(c.clinicRequest(Object.assign({}, base, { [k]: '' })).why, k + ' 없이 만들었습니다'));
  assert.ok(c.clinicRequest(Object.assign({}, base, { company: { name: '가나', bizNo: '123' } })).why, '사업자번호가 짧은데 만들었습니다');
  const r = c.clinicRequest(base).rec;
  assert.equal(r.state, 'pending');
  assert.equal(r.source, 'smes');
  assert.equal(r.smes.stage, '자문위원선정');
  assert.ok(!r.company.contacts, '체크 안 했는데 휴대폰을 보냈습니다');
  assert.ok(!('startDate' in r) && !('consultDays' in r), '비어 있는데 날짜·일수를 채웠습니다(기본값 금지)');
  assert.ok(!('successFee' in r), '금액은 계약관리가 셈합니다');
  const r2 = c.clinicRequest(Object.assign({}, base, { sendMobile: true, startDate: '2026-10-07', consultDays: '3' })).rec;
  assert.equal(r2.company.contacts[0].phone, '010-0000-0000');
  assert.equal(r2.startDate, '2026-10-07');
  assert.equal(r2.consultDays, 3);
  /* 쓰는 곳은 요청 자리뿐 */
  const js = stripJs(SRC);
  assert.match(js, /var REQ_ROOT = 'data\/contract_requests';/);
  assert.match(js, /db\.ref\(REQ_ROOT \+ '\/' \+ r\.rec\.id\)\.set\(r\.rec\)/);
  assert.ok(!/ref\('data\/contracts/.test(js), '계약에 직접 쓰면 계약관리의 검사를 건너뜁니다');
  assert.ok(!/\.(update|remove|push|transaction)\(/.test(js), '요청 한 줄 말고는 아무것도 쓰거나 지우지 않습니다');
});

test('⑥ 계약관리 — 사람이 적은 일수만 「1일 단가 × 일수」', () => {
  const fn = cutFrom(ERP, 'function ctReqHumanFill(');
  const day = cutFrom(ERP, 'function consDayAmount(');
  const ctx = { consTypeDayOpt: () => ({ fee: 350000, unit: '일', noVat: false }) };
  vm.createContext(ctx);
  vm.runInContext(day + '\n' + fn, ctx);
  const blank = () => ({ typeCodes: { consulting: 'cons-x' }, signDate: '2026-10-01', startDate: '' });
  const f0 = ctx.ctReqHumanFill(blank(), { source: 'photo', consultDays: 3, startDate: '2026-10-07' });
  assert.ok(!('successFee' in f0) && f0.startDate === '', '사진첩 요청은 건드리지 않습니다');
  const f1 = ctx.ctReqHumanFill(blank(), { source: 'smes' });
  assert.ok(!('successFee' in f1) && !('consultDays' in f1), '일수를 안 적었는데 금액을 지어냈습니다');
  const f2 = ctx.ctReqHumanFill(blank(), { source: 'smes', consultDays: 3, startDate: '2026-10-07' });
  assert.equal(f2.successFee, 1155000, '350,000 × 3 + 부가세 = 1,155,000');
  assert.equal(f2.dayCalc.days, 3);
  assert.equal(f2.startDate, '2026-10-07');
  const f3 = ctx.ctReqHumanFill(blank(), { source: 'smes', consultDays: 99, startDate: '10/7' });
  assert.ok(!('successFee' in f3) && f3.startDate === '', '터무니없는 일수·날짜 꼴은 버립니다');
  assert.match(stripJs(cutFrom(ERP, 'async function processOneContractRequest(')), /ctReqHumanFill\(ctReqForm\(req\), req\)/,
    '계약관리가 사람이 적은 값을 안 얹습니다');
});

test('⑦ 이알피의 딸린 화면으로 등록돼 있다', () => {
  const O = fs.readFileSync(path.join(ROOT, 'js', 'pu-ontology.js'), 'utf8');
  assert.match(O, /clinic_intake:\{ name:'현장클리닉 보내기', file:'clinic-intake\.html', program:'erp'/);
  assert.match(SRC, /<script src="js\/pu-ontology-write\.js\?v=\d+" data-mode="observe"><\/script>/);
  assert.match(SRC, /<script src="js\/pu-active\.js\?v=\d+"><\/script>/, '안 실으면 60분 뒤 전체 로그아웃이 납니다');
});
