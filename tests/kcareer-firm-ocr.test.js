'use strict';
/* 법인정보 — 우편번호·계좌 · 법인 서류 OCR · 홈에서 계좌 걷기 (대표 지시 2026-09-28)
   ─────────────────────────────────────────────────────────────
   「내계좌정보는 앞에 나오면 안된다. 법인정보에 계좌번호 넣는 것도 넣어달라.
    신분증 계좌의 형태와 같이 한화면에서 정보 ocr 입력기능 만들어 달라. 우편번호 자동넣기기능도 해달라.」
   ⚠ 앱의 진짜 함수를 vm 에 올려 «돌려» 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const X = require('../js/kcareer-hwpxfill.js');
function 떼기(머리) {
  const i = SRC.indexOf(머리);
  assert.ok(i > 0, 머리 + ' 를 못 찾았습니다');
  let d = 0, started = false;
  for (let p = i; p < SRC.length; p++) {
    const c = SRC[p];
    if (c === '{') { d++; started = true; }
    else if (c === '}') { d--; if (started && d === 0) return SRC.slice(i, p + 1); }
  }
  assert.fail(머리 + ' 의 끝을 못 찾았습니다');
}
const 줄 = (re) => { const m = SRC.match(re); assert.ok(m, re + ' 을 못 찾았습니다'); return m[0]; };
const FIRM_KEYS = (() => {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(줄(/var FIRM_FIELDS=\[[\s\S]*?\]\];/).replace(/^var /, 'var '), ctx);
  return Array.from(ctx.FIRM_FIELDS, (f) => f[0]);      /* ⚠ vm 의 배열은 딴 세상 것이라 deepEqual 이 어긋난다 */
})();

/* 법인정보 세상 — 이알피 사본·여기 자리를 localStorage 흉내로 */
function 세상(이알피, 여기, o) {
  o = o || {};
  const 저장 = {};
  if (이알피) 저장.cm3_firm_info = JSON.stringify(이알피);
  if (여기) 저장.cm3_firm_local = JSON.stringify(여기);
  const 통 = {}, 알림 = [], 파일 = {};
  const ctx = {
    console: { warn() {} }, Date, String, Number, Math, JSON, RegExp, Array, Object, parseInt, Promise,
    NS: 'cm3_', LS: { get: (k) => (k in 저장 ? 저장[k] : null), set: (k, v) => { 저장[k] = String(v); } },
    get: (k) => 통[k] || (통[k] = []), set: (k, v) => { 통[k] = v; },
    _safe: (f) => { try { return f(); } catch (e) { 알림.push('걸림:' + e.message); return null; } },
    toast: (m) => { 알림.push(String(m)); },
    kcIsStaff: () => !!o.staff, kcInboxSubmit: async () => ({ inbox: true }), kcInboxMine: () => {},
    hasOriginal: () => false, dupKey: () => 'k', splitPeriod: () => ['', ''], termEnd: () => '',
    saveFileUnified: async (id, r) => { 파일[id] = r; },
    nextId: (pre, store) => pre + String((통[store] || []).length + 1).padStart(4, '0'),
    wiccokId: () => 'W1'
  };
  vm.createContext(ctx);
  vm.runInContext([줄(/var FIRM_CACHE='firm_info';/), 줄(/var FIRM_LOCAL='firm_local';/),
    줄(/var FIRM_FIELDS=\[[\s\S]*?\]\];/), 'var _firmOcrLast=null;',
    ...['function _firmObj(', 'function firmErp(', 'function firmLocal(', 'function firmInfo(', 'function firmOcrApply(',
      'function firmShape(', 'function kcAddrQuery(', 'function quickParseFilename(', 'async function saveOCRRecord(']
      .map(떼기)].join('\n').replace(/^(\s*)const /gm, '$1var '), ctx);
  return { ctx, 저장, 통, 알림, 파일, 여기: () => JSON.parse(저장.cm3_firm_local || '{}'),
    돌려: (s) => vm.runInContext(s, ctx) };
}

test('★★★ 홈에 «내 계좌»가 안 나온다 — 옛 카드도 걷는다', () => {
  const h = 떼기('function renderHome(');
  assert.ok(!/get\('account'\)/.test(h), '★★★ 홈이 아직 계좌를 읽습니다 — 첫 화면에 계좌번호가 뜹니다');
  assert.ok(!/내 계좌 정보/.test(SRC), '★★ 「내 계좌 정보」 카드가 아직 어딘가에 있습니다');
  assert.match(h, /getElementById\('homeAccCard'\); if\(old\) old\.remove\(\)/, '★ 옛 판이 그려 둔 카드가 남습니다');
  /* 계좌 보관은 신분증·계좌 탭에 그대로 있다 — 없앤 것이 아니다 */
  assert.match(SRC, /id="acOcrZone" data-store="account"/, '★★ 계좌 보관까지 없앴습니다');
});

test('★★ 법인정보에 우편번호·거래 은행·법인 계좌번호·예금주가 있다', () => {
  ['zip', 'bank', 'acctNo', 'acctHolder'].forEach((k) => assert.ok(FIRM_KEYS.includes(k), '★★ ' + k + ' 칸이 없습니다'));
  assert.ok(FIRM_KEYS.indexOf('zip') < FIRM_KEYS.indexOf('addr'), '우편번호는 주소 앞에 둡니다');
});

test('★★★ OCR 이 채우는 칸 목록 = 법인정보 칸 — 어긋나면 읽고도 버린다', () => {
  const 갈래 = 떼기('async function saveOCRRecord(');
  const m = 갈래.match(/var _FIRM_KEYS=\[([^\]]*)\]/);
  assert.ok(m, '★★ 법인 서류 갈래에 칸 목록이 없습니다');
  const 목록 = [...m[1].matchAll(/'([A-Za-z]+)'/g)].map((x) => x[1]);
  assert.deepEqual(목록.slice().sort(), FIRM_KEYS.slice().sort(), '★★★ OCR 칸 목록과 법인정보 칸이 다릅니다');
  /* 판독 사전도 같은 칸을 묻는다 */
  const i = SRC.indexOf('  firm_doc:`'), 사전 = SRC.slice(i, SRC.indexOf('`', i + 12) + 1);
  assert.ok(i > 0, '★★ 법인 서류 판독 사전이 없습니다 — 위촉장 사전으로 읽힙니다');
  const 묻는 = [...사전.matchAll(/"([A-Za-z]+)":/g)].map((x) => x[1]).filter((k) => k !== 'kind');
  assert.deepEqual(묻는.slice().sort(), FIRM_KEYS.slice().sort(), '★★ 판독 사전이 묻는 칸과 법인정보 칸이 다릅니다');
  assert.ok(!/주민/.test(사전), '★★★ 법인 서류 사전이 주민번호를 묻습니다 — 그러면 가리지 않고 보냅니다');
});

test('★★★ «빈 칸만» 채운다 — 적어 둔 값·이알피 값은 덮지 않고 «다르다»고만 말한다', () => {
  const w = 세상({ name: '푸른노무법인', at: 1 }, { tel: '041-000-0001', fax: '041-000 0002' });
  const r = w.돌려(`firmOcrApply({ name:'딴이름', tel:'041-999-9999', fax:'041-0000002', bizNo:'000-00-00000',
    acctNo:'111-222', bank:'하나은행', 없는칸:'x' }, ['name','tel','fax','bizNo','acctNo','bank','없는칸'])`);
  const l = w.여기();
  assert.equal(l.bizNo, '000-00-00000', '★★★ 빈 칸을 안 채웁니다');
  assert.equal(l.acctNo, '111-222'); assert.equal(l.bank, '하나은행');
  assert.equal(l.tel, '041-000-0001', '★★★ 적어 둔 전화를 OCR 이 덮었습니다');
  assert.ok(!('name' in l), '★★★ 이알피 값이 있는 칸을 여기 자리에 베꼈습니다');
  assert.ok(!('없는칸' in l), '★ 법인정보에 없는 칸을 만들었습니다');
  assert.deepEqual([...r.filled].sort(), ['거래 은행', '법인 계좌번호', '사업자등록번호'].sort());
  assert.equal(r.differ.length, 1, '★★ 다른 값을 알리지 않거나, 띄어쓰기만 다른 것까지 다르다고 합니다: ' + JSON.stringify(r.differ));
  assert.match(r.differ[0], /전화 「041-999-9999」/);
});

test('★★ 끌어놓으면 원본을 보관하고 빈 칸을 채운다 · 같은 파일은 한 건 · 직원은 못 바꾼다', async () => {
  const w = 세상(null, {});
  await w.돌려(`saveOCRRecord('firm_doc', { kind:'사업자등록증', name:'푸른노무법인', bizNo:'000-00-00000' },
    { name:'사업자등록증.pdf', size:9 }, 'pdf', 'QUJD')`);
  assert.equal(w.통.firm_docs.length, 1, '★★ 원본 줄이 안 생겼습니다');
  assert.equal(w.통.firm_docs[0].kind, '사업자등록증');
  assert.ok(w.파일.FD0001, '★★ 원본 파일을 안 담았습니다');
  assert.equal(w.여기().bizNo, '000-00-00000', '★★ 읽은 값이 법인정보에 안 들어갔습니다');
  await w.돌려(`saveOCRRecord('firm_doc', { kind:'통장사본', acctNo:'111-222' }, { name:'통장.pdf', size:9 }, 'pdf', 'QUJD')`);
  assert.equal(w.통.firm_docs.length, 2, '★★ 다른 서류가 «같은 서류»로 막혔습니다');
  await w.돌려(`saveOCRRecord('firm_doc', { kind:'통장사본', acctHolder:'푸른노무법인' }, { name:'통장.pdf', size:9 }, 'pdf', 'QUJD')`);
  assert.equal(w.통.firm_docs.length, 2, '★ 같은 파일을 또 넣었는데 쌓였습니다');
  assert.equal(w.여기().acctHolder, '푸른노무법인', '★ 같은 파일을 다시 넣으면 빈 칸을 안 채웁니다');
  const s = 세상(null, {}, { staff: true });
  await s.돌려(`saveOCRRecord('firm_doc', { bizNo:'000-00-00000' }, { name:'a.pdf', size:9 }, 'pdf', 'QUJD')`);
  assert.equal(s.여기().bizNo, undefined, '★★★ 직원이 올린 것이 법인정보를 바꿨습니다');
});

test('★ 못 읽어도 원본은 보관한다 — 법인정보 칸은 안 건드린다', async () => {
  const w = 세상(null, {});
  const p = w.돌려(`quickParseFilename('사업자등록증 스캔.pdf','firm_doc')`);
  assert.ok(p && p._byName, '★ 못 읽으면 원본이 아무 데도 없습니다');
  w.ctx.__p = p;
  await w.돌려(`saveOCRRecord('firm_doc', __p, { name:'사업자등록증 스캔.pdf', size:9 }, 'pdf', 'QUJD')`);
  assert.equal(w.통.firm_docs.length, 1);
  assert.deepEqual(Object.keys(w.여기()), [], '★ 파일 이름만 보고 법인정보를 지어 넣었습니다');
});

test('★★ 이알피가 주는 우편번호·계좌도 받는다 — 묶음(객체)은 글자로 안 박는다', () => {
  const w = 세상();
  const f = w.돌려(`firmShape({ name:'푸른', branches:{ cheonan:{ zipcode:'31100', addr:'천안시' } },
    bank:{ code:'081' }, bankName:'하나은행', accountNo:{ no:'1' }, bankAccount:'222-333', accountHolder:'푸른노무법인' })`);
  assert.equal(f.zip, '31100', '★★ 이알피 지사 우편번호를 안 받습니다');
  /* ⚠ 묶음을 «먼저 고르는 자리»에 둔다 — 뒤에 두면 앞의 글자가 이겨 이 검사가 뜻이 없다(고장넣기로 확인) */
  assert.equal(f.bank, '하나은행', '★★ 묶음(객체)을 은행 이름으로 골랐습니다');
  assert.equal(f.acctNo, '222-333');
  assert.ok(!/object/.test(JSON.stringify(f)), '★★ 「[object Object]」가 서식에 박힙니다');
});

test('★★ 📮 우편번호 — 주소로 «미리 찾아» 열고, 고르면 넣고 저장한다 · 주소는 비었을 때만', async () => {
  const w = 세상(null, { addr: '충남 천안시 서북구 원두정8길 6 두정빌딩 301' });
  assert.equal(w.돌려(`kcAddrQuery('충남 천안시 서북구 원두정8길 6 (두정동) 3층 301호')`), '충남 천안시 서북구 원두정8길 6',
    '★ 건물명·층·호를 안 걷어 검색이 안 걸립니다');
  /* 찾기 — 가짜 화면·가짜 다음 우편번호 */
  const 칸 = { zip: { value: '' }, addr: { value: '충남 천안시 서북구 원두정8길 6 두정빌딩 301' } };
  let 연주소 = null, 저장함 = 0;
  Object.assign(w.ctx, {
    document: { querySelector: (s) => { const m = s.match(/data-firm="(\w+)"/); return m ? 칸[m[1]] || null : null; } },
    window: { daum: { Postcode: function () {} } },
    kcAddrSearch: (q, done) => { 연주소 = q; done({ zipcode: '31100', address: '충남 천안시 서북구 원두정8길 6' }); },
    firmTabSave: () => { 저장함++; }
  });
  w.ctx.daum = w.ctx.window.daum;
  vm.runInContext(떼기('function _kcLoadPostcode(') + '\n' + 떼기('async function firmZipFind('), w.ctx);
  await w.돌려('firmZipFind()');
  assert.match(String(연주소), /원두정8길 6/, '★★ 적힌 주소로 미리 찾지 않습니다 — 처음부터 쳐야 합니다');
  assert.equal(칸.zip.value, '31100', '★★ 고른 우편번호가 안 들어갑니다');
  assert.equal(칸.addr.value, '충남 천안시 서북구 원두정8길 6 두정빌딩 301', '★★ 적어 둔 주소를 짧은 도로명으로 덮었습니다(건물·호수가 사라진다)');
  assert.equal(저장함, 1, '★ 넣고 저장하지 않습니다 — 「자동으로 넣기」가 아닙니다');
  칸.addr.value = ''; 칸.zip.value = '';
  await w.돌려('firmZipFind()');
  assert.equal(칸.addr.value, '충남 천안시 서북구 원두정8길 6', '주소가 비었으면 찾은 주소를 넣습니다');
});

test('★ 📮 단추는 «여기서 적는» 우편번호에만 — 이알피가 준 값이면 못 고치므로 안 둔다', () => {
  const r = 떼기('function renderFirmTab(');
  assert.match(r, /if\(k==='zip' && !ev\)/, '★ 이알피 값에도 찾기 단추가 붙습니다(눌러도 안 바뀝니다)');
  assert.match(r, /onclick="firmZipFind\(\)"/);
  assert.match(떼기('function _kcLoadPostcode('), /if\(window\.daum && daum\.Postcode\) return Promise\.resolve\(\);/,
    '★ 누를 때마다 남의 스크립트를 또 싣습니다');
  /* 부팅 때 싣지 않는다 — <script src> 로 박지 않는다 */
  assert.ok(!/<script[^>]+daumcdn/.test(SRC), '★★ 우편번호 스크립트를 부팅 때 싣습니다 — 누를 때만 받아야 합니다');
});

test('★★ 서식 채우기 — «법인»이라 밝힌 칸만 법인 우편번호·계좌로 본다', () => {
  assert.equal(X.fieldKeyOf('법인계좌번호'), 'firmAcct');
  assert.equal(X.fieldKeyOf('법인 계좌'), 'firmAcct');
  assert.equal(X.fieldKeyOf('사무소 우편번호'), 'firmZip');
  assert.notEqual(X.fieldKeyOf('계좌번호'), 'firmAcct', '★★★ 맨 「계좌번호」를 법인 계좌로 봅니다 — 강사료가 법인 통장으로 적힙니다');
  assert.notEqual(X.fieldKeyOf('우편번호'), 'firmZip', '★★ 맨 「우편번호」를 법인 것으로 봅니다 — 집 주소 우편번호 자리입니다');
  ['firmZip', 'firmAcct'].forEach((k) => {
    assert.ok(X.FIELD_FILL_KEYS.includes(k), k + ' 를 채울 수 없습니다');
    assert.match(SRC, new RegExp("\\['" + k + "','"), '★ 칸 지도에서 ' + k + ' 를 고를 수 없습니다');
  });
  assert.match(떼기('function _cvFillData('), /firmAcct:\[법인\.bank\|\|'', 법인\.acctNo\|\|''\]/, '★★ 법인 계좌를 서식에 안 보냅니다');
});

test('★ 한 화면 — 법인정보 옆에 법인 서류 OCR 칸과 원본 목록', () => {
  const s = SRC.indexOf('id="tab-firm"'), e = SRC.indexOf('<div class="tabpanel" id="tab-staff"', s);
  const 탭 = SRC.slice(s, e);
  assert.match(탭, /class="pi-side"/, '★ 신분증·계좌처럼 한 화면에 나란히 두지 않았습니다');
  assert.match(탭, /class="ocr-zone" id="firmOcrZone" data-store="firm_doc"/, '★★ OCR 칸이 없습니다');
  assert.match(탭, /id="firmDocList"/, '★ 보관한 원본을 볼 곳이 없습니다');
  assert.match(SRC, /const fmZone=document\.getElementById\('firmOcrZone'\);/, '★★★ 칸을 잇지 않아 끌어놓아도 아무 일이 없습니다');
  assert.match(SRC, /'firm': \(\)=>\{[^\n]*renderFirmDocs/, '★ 탭을 열어도 원본 목록이 안 그려집니다');
});
