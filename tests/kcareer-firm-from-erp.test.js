'use strict';
/* 🏛 노무법인 정보는 «이알피»에서 온다 (대표 지시 2026-09-13)
   ─────────────────────────────────────────────────────────────
   대표 지시: 「노무법인 등에 대한 정보는 현재 이알피의 내용을 가지고 와라」

   기관 서식에는 인적사항 아래에 「노무법인」 표가 따로 있다 —
   명칭 · 대표 노무사 · 법인번호 · 사업자번호. 이 칸들은 늘 비어 나갔고,
   「사무실 주소」에는 환경설정에 적힌 집 주소가 그대로 나갔다.

   여기서 못 박는 것은 «값»이 아니라 «규칙»이다:
     ① 법인 칸을 알아본다 — 명칭·대표 노무사·법인번호·사업자번호
     ② 「대표자명」(내는 사람)과 「대표 노무사」(법인의 대표)는 «다른 칸»이다
     ③ 사무소 칸은 이알피가 이긴다 (대표 결정) — 주소·사무실 전화·팩스·소속
     ④ 이메일만은 개인이 먼저 — 서식의 E-mail 은 본인에게 연락할 자리다
     ⑤ 천안 본사가 기준이고, 지사 칸이 없던 옛 자료는 위쪽 값으로 물러선다
     ⑥ 이알피 법인정보를 이 앱이 클라우드로 «되올리지» 않는다 (사본일 뿐)
     ⑦ 주민등록번호는 여전히 골라야만 나간다 — 이번 변경이 그 문을 열면 안 된다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripComments } = require('./strip-comments');

const R = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(R, 'kcareer.html'), 'utf8');
const FILL = fs.readFileSync(path.join(R, 'js', 'kcareer-hwpxfill.js'), 'utf8');
const CODE = stripComments(HTML);
const FCODE = stripComments(FILL);

function cutFn(s, decl) {
  const head = s.indexOf(decl);
  assert.notEqual(head, -1, decl + ' 을 찾지 못했습니다');
  let i = s.indexOf('{', head + decl.length), depth = 0;
  for (; i < s.length; i++) { if (s[i] === '{') depth++; else if (s[i] === '}') { depth--; if (!depth) break; } }
  return s.slice(head, i + 1);
}

/* 라벨 사전을 실제로 돌린다 */
function 사전() {
  const ctx = { String, RegExp, console, window: {}, module: { exports: {} } };
  ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(FILL, ctx);
  const X = ctx.window.KcareerHwpxFill || ctx.module.exports;
  assert.ok(X, 'KcareerHwpxFill 을 못 꺼냈습니다');
  return X;
}

/* _cvFillData 의 fields 를 실제로 만들어 본다 — 자료는 흉내 낸다 */
function 채울값(법인, 개인) {
  const ctx = {
    String, Object, Array, Number, JSON, console,
    LS: { get: () => null, set: () => {} }, NS: 'cm3_',
    getProfileInfo: () => 개인 || {},
    get: () => [],
    workPeriod: () => '',
    formatDate: (x) => x || '',
    isAwardType: () => false,
    firmInfo: () => 법인 || {}
  };
  vm.createContext(ctx);
  vm.runInContext(cutFn(CODE, 'function _cvFillData('), ctx);
  return vm.runInContext('_cvFillData()', ctx);
}

const 이알피 = { name: '푸른노무법인', ceo: '홍길동', bizNo: '000-00-00000', corpNo: '000000-0000000',
  addr: '가나도 가나시 가나로 1 가나빌딩 301', tel: '041-000-0001', fax: '041-000-0002',
  email: 'office@example.com' };

test('① 「노무법인」 표의 네 칸을 알아본다', () => {
  const X = 사전();
  assert.equal(X.fieldKeyOf('명 칭'), 'firmName', '「명 칭」을 못 알아봅니다');
  assert.equal(X.fieldKeyOf('대표 노무사'), 'firmCeo');
  assert.equal(X.fieldKeyOf('법인번호'), 'firmCorpNo');
  assert.equal(X.fieldKeyOf('사업자번호'), 'firmBizNo');
});

test('② 「대표자명」(내는 사람)과 「대표 노무사」(법인의 대표)는 다른 칸이다', () => {
  const X = 사전();
  assert.equal(X.fieldKeyOf('대표자명'), 'name', '내는 사람 칸이 법인 대표로 바뀌면 안 됩니다');
  assert.notEqual(X.fieldKeyOf('대표 노무사'), 'name', '법인 대표가 내는 사람 칸으로 가면 안 됩니다');
});

test('③ 네 칸이 «채울 수 있는 열쇠»에 들어 있다 — 알아만 보고 못 채우면 소용없다', () => {
  const X = 사전();
  ['firmName', 'firmCeo', 'firmCorpNo', 'firmBizNo'].forEach((k) => {
    assert.ok(X.FIELD_FILL_KEYS.indexOf(k) >= 0, k + ' 을 채울 수 없습니다');
  });
});

test('④ 법인 값이 그대로 실린다', () => {
  const f = 채울값(이알피, { name: '홍길동' }).fields;
  assert.equal(f.firmName, '푸른노무법인');
  assert.equal(f.firmCeo, '홍길동');
  assert.equal(f.firmCorpNo, '000000-0000000');
  assert.equal(f.firmBizNo, '000-00-00000');
});

test('⑤ 사무소 칸은 «이알피가 이긴다» — 환경설정에 집 주소가 적혀 있어도', () => {
  const 개인 = { addr: '가나도 가나시 살던마을 103동 1303호', phoneWork: '041-999-9999',
    fax: '041-999-9998', org: '옛소속' };
  const f = 채울값(이알피, 개인).fields;
  assert.equal(f.addrWork, 이알피.addr, '사무실 주소가 이알피 것이 아닙니다');
  assert.equal(f.phoneWork, 이알피.tel, '사무실 전화가 이알피 것이 아닙니다');
  assert.equal(f.fax, 이알피.fax, '팩스가 이알피 것이 아닙니다');
  assert.equal(f.org, 이알피.name, '소속이 이알피 것이 아닙니다');
});

test('⑥ 이메일만은 «개인이 먼저» — 서식의 E-mail 은 본인에게 연락할 자리다', () => {
  const f = 채울값(이알피, { email: 'me@example.net' }).fields;
  assert.equal(f.email, 'me@example.net', '개인 메일을 사무소 메일이 덮었습니다');
  const g = 채울값(이알피, {}).fields;
  assert.equal(g.email, 이알피.email, '개인 메일이 없으면 사무소 메일로 가야 합니다');
});

test('⑦ 이알피가 비어 있으면 «오늘까지 되던 것»이 그대로 된다 — 뒷걸음질 금지', () => {
  const 개인 = { addr: '가나도 가나시 가나로 9', phoneWork: '041-111-1111', fax: '041-111-1112', org: '푸른노무법인' };
  const f = 채울값({}, 개인).fields;
  assert.equal(f.addrWork, 개인.addr, '법인정보를 못 읽었다고 사무실 주소가 비면 안 됩니다');
  assert.equal(f.phoneWork, 개인.phoneWork);
  assert.equal(f.fax, 개인.fax);
  assert.equal(f.org, 개인.org);
  assert.equal(f.firmCorpNo, '', '없는 값을 지어내면 안 됩니다');
});

test('⑧ 「현주소」는 집이 먼저다 — 집을 안 적었을 때만 사무소로 간다', () => {
  const a = 채울값(이알피, { addrHome: '가나도 가나시 사는곳 1' }).fields;
  assert.equal(a.addr, '가나도 가나시 사는곳 1', '집 주소를 사무소가 덮었습니다');
  const b = 채울값(이알피, {}).fields;
  assert.equal(b.addr, 이알피.addr, '집을 안 적었으면 사무소 주소로 가야 합니다');
});

test('⑨ 천안 본사가 기준이고, 지사 칸이 없던 옛 자료는 위쪽 값으로 물러선다', () => {
  const ctx = { String, Object, Array };
  vm.createContext(ctx);
  vm.runInContext(cutFn(CODE, 'function firmShape('), ctx);
  ctx.새 = { name: '푸른노무법인', ceo: '홍길동', bizno: '000-00-00000', corpNo: '000000-0000000',
    addr: '옛주소', addrDetail: '옛상세', tel: '041-000-0009', fax: '041-000-0008', email: 'old@example.com',
    branches: { cheonan: { addr: '가나로 1', addrDetail: '가나빌딩 301', tel: '041-000-0001',
      fax: '041-000-0002', email: 'office@example.com' } } };
  const a = vm.runInContext('firmShape(새)', ctx);
  assert.equal(a.addr, '가나로 1 가나빌딩 301', '천안 본사 주소를 써야 합니다');
  assert.equal(a.tel, '041-000-0001');
  ctx.옛 = { name: '푸른노무법인', bizno: '000-00-00000', addr: '가나로 9', tel: '041-000-0009' };
  const b = vm.runInContext('firmShape(옛)', ctx);
  assert.equal(b.addr, '가나로 9', '지사 칸이 없으면 위쪽 값으로 물러서야 합니다');
  assert.equal(b.tel, '041-000-0009');
});

test('⑩ 법인정보 사본을 클라우드로 되올리지 않는다 — 이알피가 진짜다', () => {
  const m = CODE.match(/var\s+FB_SKIP\s*=\s*\[([\s\S]*?)\]/);
  assert.ok(m, 'FB_SKIP 을 찾지 못했습니다');
  const 캐시 = (CODE.match(/var\s+FIRM_CACHE\s*=\s*'([^']+)'/) || [])[1];
  assert.ok(캐시, 'FIRM_CACHE 를 찾지 못했습니다');
  assert.ok(m[1].indexOf("'" + 캐시 + "'") >= 0,
    '법인정보 사본(' + 캐시 + ')이 클라우드로 올라갑니다 — 이알피의 진짜 값을 덮습니다');
});

test('⑪ 적는 자리는 이알피 한 곳이다 — 이 앱은 읽기만 한다', () => {
  const fn = cutFn(CODE, 'async function loadFirmInfo(');
  assert.ok(/ref\(\s*'data\/company_info'\s*\)/.test(fn), '이알피 법인정보를 읽지 않습니다');
  /* 브라우저 저장(LS.set)은 사본이라 괜찮다 — 막을 것은 «이알피 쪽 쓰기»다 */
  assert.ok(!/ref\([^)]*\)\s*\.\s*(set|update|remove|push)/.test(fn),
    '경력관리가 이알피 법인정보를 고치려 합니다 — 읽기만 해야 합니다');
});

test('⑫ 못 읽어도 멎지 않는다 — 지난번 사본으로 물러선다', async () => {
  const 지난것 = { name: '푸른노무법인', tel: '041-000-0001' };
  const 담김 = {};
  const ctx = {
    String, Object, Array, JSON, console: { warn() {} },
    NS: 'cm3_',
    LS: { get: () => null, set: (k, v) => { 담김[k] = v; } },
    firmInfo: () => 지난것,
    _puUnwrap: (x) => x,
    /* 클라우드가 막혔을 때 — 읽기가 통째로 터진다 */
    fbDb: { ref: () => ({ once: () => Promise.reject(new Error('permission denied')) }) }
  };
  vm.createContext(ctx);
  vm.runInContext(cutFn(CODE, 'function firmShape('), ctx);
  vm.runInContext(cutFn(CODE, 'async function loadFirmInfo('), ctx);
  const got = await vm.runInContext('loadFirmInfo()', ctx);
  assert.equal(got && got.name, '푸른노무법인', '못 읽었다고 빈손으로 오면 안 됩니다');
  assert.equal(got && got.tel, '041-000-0001');
  assert.equal(Object.keys(담김).length, 0, '못 읽은 것을 사본으로 덮으면 안 됩니다');
});

test('⑬ 로그인 전(클라우드 없음)에도 터지지 않는다', async () => {
  const 지난것 = { name: '푸른노무법인' };
  const ctx = { String, Object, Array, JSON, console: { warn() {} }, NS: 'cm3_',
    LS: { get: () => null, set: () => {} }, firmInfo: () => 지난것, _puUnwrap: (x) => x };
  vm.createContext(ctx);
  vm.runInContext('var fbDb=null;', ctx);
  vm.runInContext(cutFn(CODE, 'function firmShape('), ctx);
  vm.runInContext(cutFn(CODE, 'async function loadFirmInfo('), ctx);
  const got = await vm.runInContext('loadFirmInfo()', ctx);
  assert.equal(got && got.name, '푸른노무법인');
});

test('⑬ 주민등록번호는 여전히 «골라야» 나간다 — 이번 변경이 그 문을 열면 안 된다', () => {
  const X = 사전();
  assert.ok(X.FIELD_FILL_KEYS.indexOf('rrn') < 0, '주민등록번호가 자동 채움에 들어갔습니다');
  const d = 채울값(이알피, { rrn: '000000-0000000' });
  assert.equal(d.fields.rrn, undefined, '주민등록번호가 fields 에 담겼습니다');
  assert.equal(d.secrets.rrn, '000000-0000000', 'secrets 에는 남아 있어야 합니다');
});

test('⑭ 손으로 고를 수 있는 목록에도 네 칸이 있다 — 서식이 낯설 때 사람이 짚는 길', () => {
  const m = CODE.match(/var\s+RH_KEYS\s*=\s*\[([\s\S]*?)\n\];/);
  assert.ok(m, 'RH_KEYS 를 찾지 못했습니다');
  ['firmName', 'firmCeo', 'firmCorpNo', 'firmBizNo'].forEach((k) => {
    assert.ok(m[1].indexOf("'" + k + "'") >= 0, k + ' 을 손으로 고를 수 없습니다');
  });
});

test('⑮ 이알피 회사정보에 법인등록번호 칸이 있다 — 없으면 영영 빈칸이다', () => {
  const ERP = stripComments(fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8'));
  const fn = cutFn(ERP, 'function CompanyInfoForm(');
  assert.ok(fn.indexOf('법인등록번호') > 0, '이알피에 법인등록번호 칸이 없습니다');
  assert.ok(/set\(\s*'corpNo'\s*\)/.test(fn), '법인등록번호를 corpNo 로 저장해야 경력관리가 읽습니다');
});
