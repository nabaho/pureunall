'use strict';
/* 🏢 환경설정 › 법인정보 탭 (대표 지시 2026-09-28 「환경설정에 법인정보도 필요하다 탭만들어서 넣을수 있게 해달라」)
   ─────────────────────────────────────────────────────────────
   ■ 지키는 것 — 2026-09-13 대표 결정 「노무법인 정보는 이알피의 내용을 가지고 와라」
     · 칸마다 «이알피 먼저». 이알피에 값이 있으면 그 칸은 여기서 못 고친다(고치는 곳은 한 곳).
     · 여기서 적는 것은 «이알피에 없는 칸»을 메운다 — 이알피 자료(data/)에는 절대 안 쓴다.
     · 이알피 사본(firm_info)은 클라우드로 안 올라가고, 여기서 적은 원본(firm_local)은 오간다.
   ⚠ 앱 함수를 vm 에 올려 «돌려» 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');

const CODE = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');

function 세상(이알피, 여기) {
  const 저장 = { 'cm3_firm_info': 이알피 ? JSON.stringify(이알피) : '', 'cm3_firm_local': 여기 ? JSON.stringify(여기) : '' };
  const 알림 = [], 쓴곳 = [];
  const 칸들 = [];
  const grid = { set innerHTML(h) { this._h = h; 칸들.length = 0;
      const re = /<input([^>]*)>/g; let m;
      while ((m = re.exec(h))) {
        const a = m[1], dk = /data-firm="([^"]+)"/.exec(a), v = /value="([^"]*)"/.exec(a);
        칸들.push({ ro: /readonly/.test(a), key: dk ? dk[1] : '', value: v ? v[1] : '',
          getAttribute: (n) => (n === 'data-firm' && dk ? dk[1] : null) });
      } }, get innerHTML() { return this._h; } };
  const state = { innerHTML: '' };
  const ctx = {
    console, JSON, String, Object, Array, Number, Date, Math,
    NS: 'cm3_',
    LS: { get: (k) => 저장[k] || '', set: (k, v) => { 저장[k] = v; } },
    toast: (m) => 알림.push(String(m)),
    escapeHtml: (x) => String(x == null ? '' : x), _jsAttr: (x) => String(x == null ? '' : x),
    document: {
      getElementById: (id) => (id === 'firmGrid' ? grid : id === 'firmState' ? state : null),
      querySelectorAll: (q) => (q === '#firmGrid input[data-firm]' ? 칸들.filter((c) => c.key).map((c) => {
        const o = { value: c.value, getAttribute: c.getAttribute }; c.el = o; return o; }) : [])
    },
    fbDb: { ref: (p) => ({ once: async () => ({ val: () => null }),
      set: () => 쓴곳.push(p), update: () => 쓴곳.push(p), remove: () => 쓴곳.push(p) }) },
    _puUnwrap: (v) => v,
    _저장: 저장, _알림: 알림, _칸들: 칸들, _쓴곳: 쓴곳, _grid: grid, _state: state
  };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(CODE.match(/var FIRM_CACHE='[^']+';/)[0], ctx);
  vm.runInContext(CODE.match(/var FIRM_LOCAL='[^']+';/)[0], ctx);
  vm.runInContext('var FIRM_FIELDS=' + CODE.match(/var FIRM_FIELDS=(\[[\s\S]*?\]\]);/)[1] + ';', ctx);
  ['function _firmObj(', 'function firmErp(', 'function firmLocal(', 'function firmInfo(', 'function firmShape(',
   'async function loadFirmInfo(', 'function renderFirmTab(', 'function firmTabSave(', 'async function firmTabPull(']
    .forEach((d) => vm.runInContext(cutFn(CODE, d), ctx));
  return ctx;
}

test('★★★ 칸마다 «이알피 먼저» — 없는 칸만 여기서 적은 것으로 메운다', () => {
  const ctx = 세상({ name: '푸른노무법인', tel: '041-000-0001', at: 1 }, { tel: '041-999-9999', fax: '041-000-0002', ceo: '대표' });
  const f = vm.runInContext('firmInfo()', ctx);
  assert.equal(f.name, '푸른노무법인');
  assert.equal(f.tel, '041-000-0001', '★★★ 여기서 적은 전화가 이알피를 가렸습니다 — 9월 13일 결정과 어긋납니다');
  assert.equal(f.fax, '041-000-0002', '★★ 이알피에 없는 팩스를 여기서 적은 것으로 안 메웁니다');
  assert.equal(f.ceo, '대표');
  assert.equal(f.email, '', '둘 다 없으면 빈 칸이어야 합니다');
});

test('★★ 이알피에서 받은 적이 없어도(로그인 전·사본 없음) 여기서 적은 것이 쓰인다', () => {
  const ctx = 세상(null, { name: '푸른노무법인', addr: '천안시 무슨길 1' });
  const f = vm.runInContext('firmInfo()', ctx);
  assert.equal(f.name, '푸른노무법인'); assert.equal(f.addr, '천안시 무슨길 1');
});

test('★★ 탭 — 이알피에 값이 있는 칸은 «읽기 전용», 없는 칸만 적을 수 있다 · 어디서 온 값인지 밝힌다', () => {
  const ctx = 세상({ name: '푸른노무법인', tel: '041-000-0001', at: Date.now() }, { tel: '041-999-9999' });
  vm.runInContext('renderFirmTab()', ctx);
  const 칸 = ctx._칸들;
  /* 설립일·자본금(2026-09-28)까지 열 칸 */
  assert.equal(칸.length, 10, '법인 칸 열이 다 있어야 합니다(설립일·자본금 포함)');
  assert.ok(칸[0].ro && !칸[0].key, '★★ 이알피가 채운 법인명을 여기서 고칠 수 있게 두었습니다');
  assert.equal(칸[0].value, '푸른노무법인');
  assert.ok(칸.filter((c) => !c.ro).length === 8, '이알피에 없는 여덟 칸은 적을 수 있어야 합니다');
  assert.match(ctx._grid.innerHTML, /firm-src erp">이알피/, '출처를 안 밝힙니다');
  assert.match(ctx._grid.innerHTML, /firm-src none">비어 있음/);
  assert.match(ctx._grid.innerHTML, /「041-999-9999」는 쓰이지 않습니다/, '★ 여기 적은 값이 안 쓰인다는 것을 말하지 않습니다');
  assert.match(ctx._state.innerHTML, /푸른이알피 › 회사정보/, '★ 이알피 값을 어디서 고치는지 안 알려 줍니다(막다른 길)');
});

test('★★★ 저장은 «여기 자리(firm_local)»에만 — 이알피 사본도 이알피 자료도 안 건드린다', () => {
  const 이알피 = { name: '푸른노무법인', at: 1 };
  const ctx = 세상(이알피, {});
  vm.runInContext('renderFirmTab()', ctx);
  const 입력 = vm.runInContext("document.querySelectorAll('#firmGrid input[data-firm]')", ctx);
  입력.find((c) => c.getAttribute('data-firm') === 'fax').value = ' 041-000-0002 ';
  ctx.document.querySelectorAll = () => 입력;
  vm.runInContext('firmTabSave()', ctx);
  const 여기 = JSON.parse(ctx._저장['cm3_firm_local']);
  assert.equal(여기.fax, '041-000-0002', '★★ 적은 팩스가 안 담겼습니다(앞뒤 빈칸도 걷어야 합니다)');
  assert.ok(!('name' in 여기), '★★ 읽기 전용 칸(이알피 값)을 여기 자리에 베꼈습니다 — 두 곳이 됩니다');
  assert.deepEqual(JSON.parse(ctx._저장['cm3_firm_info']), 이알피, '★★★ 이알피 사본을 고쳤습니다');
  assert.deepEqual(ctx._쓴곳, [], '★★★ 이알피 자료(data/)에 썼습니다 — 읽기만 해야 합니다');
  /* 비우면 지운다 — 빈 글자가 남으면 «적은 값»으로 읽힌다 */
  입력.find((c) => c.getAttribute('data-firm') === 'fax').value = '';
  vm.runInContext('firmTabSave()', ctx);
  assert.ok(!('fax' in JSON.parse(ctx._저장['cm3_firm_local'])), '★ 비운 칸이 남았습니다');
});

test('★★ 이알피에서 다시 받기 — 받은 값이 사본에 들고, 여기 적은 것은 그대로다', async () => {
  const ctx = 세상(null, { fax: '041-000-0002' });
  ctx.fbDb.ref = (p) => ({ once: async () => ({ val: () => (p === 'data/company_info' ? { name: '푸른노무법인', tel: '041-000-0001' } : null) }),
    set: () => ctx._쓴곳.push(p) });
  await vm.runInContext('firmTabPull()', ctx);
  assert.equal(vm.runInContext('firmErp()', ctx).name, '푸른노무법인', '★★ 이알피 값을 못 받았습니다');
  assert.equal(JSON.parse(ctx._저장['cm3_firm_local']).fax, '041-000-0002', '★★ 받으면서 여기 적은 것을 지웠습니다');
  assert.deepEqual(ctx._쓴곳, [], '★★★ 받으면서 이알피에 썼습니다');
  assert.match(ctx._알림.join(' '), /받았습니다/);
});

test('★★ 여기서 적은 원본은 클라우드로 «오간다» — 이알피 사본만 안 올라간다', () => {
  const skip = CODE.match(/var\s+FB_SKIP\s*=\s*\[([\s\S]*?)\]/)[1];
  assert.ok(skip.indexOf("'firm_info'") >= 0, '이알피 사본이 올라갑니다(이알피를 덮습니다)');
  assert.ok(skip.indexOf("'firm_local'") < 0, '★★ 여기서 적은 법인정보가 다른 기기로 안 갑니다');
});

test('★ 화면 — 환경설정에 탭·패널이 있고 열 때 그린다', () => {
  assert.match(CODE, /<button class="tab" data-tab="firm">🏢 법인정보<\/button>/, '★ 탭 단추가 없습니다');
  assert.match(CODE, /<div class="tabpanel" id="tab-firm">/, '★ 탭 패널이 없습니다(단추를 눌러도 아무것도 안 뜹니다)');
  assert.match(CODE, /'firm': \(\)=>\{ _safe\(renderFirmTab\);/, '★ 탭을 열 때 그리지 않습니다');
  assert.match(CODE, /onclick="firmTabSave\(\)"/);
  assert.match(CODE, /onclick="firmTabPull\(\)"/);
});

/* ══════ 설립일·자본금 (대표 지시 2026-09-28 「법인의 경우 설립일 자본금을 넣을 수 있게 해라」) ══════ */
test('★★ 설립일·자본금 — 탭에서 적고, 이알피에 있으면 받아 온다(이알피 먼저)', async () => {
  const ctx = 세상(null, { estDate: '2016.01.04', capital: '50,000,000원' });
  const f = vm.runInContext('firmInfo()', ctx);
  assert.equal(f.estDate, '2016.01.04', '★★ 여기서 적은 설립일이 안 쓰입니다');
  assert.equal(f.capital, '50,000,000원', '★★ 여기서 적은 자본금이 안 쓰입니다');
  vm.runInContext('renderFirmTab()', ctx);
  assert.match(ctx._grid.innerHTML, /<label>설립일 /, '설립일 칸이 없습니다');
  assert.match(ctx._grid.innerHTML, /<label>자본금 /, '자본금 칸이 없습니다');
  /* 이알피 회사정보에 있으면 그쪽 — 흔한 이름(openDate)도 받는다 */
  ctx.fbDb.ref = () => ({ once: async () => ({ val: () => ({ name: '푸른노무법인', openDate: '2015.12.01', capital: '1억원' }) }) });
  await vm.runInContext('loadFirmInfo()', ctx);
  const g = vm.runInContext('firmInfo()', ctx);
  assert.equal(g.estDate, '2015.12.01', '★★ 이알피의 설립일(openDate)을 안 받습니다');
  assert.equal(g.capital, '1억원', '★★ 이알피의 자본금이 먼저여야 합니다');
});

test('★★ 서식의 「설립일」·「자본금」 칸을 알아보고 채운다 — 「개업일」은 사람 것일 수 있어 안 본다', () => {
  const X = require('../js/kcareer-hwpxfill.js');
  ['설립일', '설 립 일', '설립연월일', '법인설립일'].forEach((t) => assert.equal(X.fieldKeyOf(t), 'firmEst', t));
  ['자본금', '자 본 금', '납입자본금'].forEach((t) => assert.equal(X.fieldKeyOf(t), 'firmCapital', t));
  assert.equal(X.fieldKeyOf('개업일'), '', '★ 공인노무사 «개업일»을 법인 설립일로 봅니다');
  assert.ok(X.FIELD_FILL_KEYS.indexOf('firmEst') >= 0 && X.FIELD_FILL_KEYS.indexOf('firmCapital') >= 0, '채울 열쇠에 없습니다');
  /* AI 가 칸을 짚을 때 «법인» 것임을 안다 */
  const A = require('../js/kcareer-slotai.js');
  ['firmName', 'firmCeo', 'firmCorpNo', 'firmBizNo', 'firmEst', 'firmCapital'].forEach((k) =>
    assert.ok(A.MEANING[k], '★ AI 에게 ' + k + ' 의 뜻을 안 알려 줍니다'));
  const ctx = 세상({ name: '푸른노무법인' }, { estDate: '2016.01.04', capital: '5천만원' });
  Object.assign(ctx, { get: () => [], getProfileInfo: () => ({}), formatDate: (x) => x || '', isAwardType: () => false, workPeriod: () => '' });
  vm.runInContext(cutFn(CODE, 'function _isLangCert('), ctx);
  vm.runInContext(cutFn(CODE, 'function _cvFillData('), ctx);
  const fl = vm.runInContext('_cvFillData()', ctx).fields;
  assert.equal(fl.firmEst, '2016.01.04', '★★ 설립일이 서식 채우기로 안 갑니다');
  assert.equal(fl.firmCapital, '5천만원', '★★ 자본금이 서식 채우기로 안 갑니다');
});

test('★★ 서식 채우기가 «합친 값»을 쓴다 — 여기 적은 팩스가 서식의 팩스 칸에 간다', () => {
  const ctx = 세상({ name: '푸른노무법인', tel: '041-000-0001', at: 1 }, { fax: '041-000-0002', corpNo: '000000-0000000' });
  Object.assign(ctx, { get: () => [], getProfileInfo: () => ({ fax: '개인팩스' }), formatDate: (x) => x || '',
    isAwardType: () => false, workPeriod: () => '' });
  vm.runInContext(cutFn(CODE, 'function _isLangCert('), ctx);
  vm.runInContext(cutFn(CODE, 'function _cvFillData('), ctx);
  const f = vm.runInContext('_cvFillData()', ctx).fields;
  assert.equal(f.firmName, '푸른노무법인');
  assert.equal(f.phoneWork, '041-000-0001', '★★ 사무실 전화가 이알피 것이 아닙니다');
  assert.equal(f.fax, '041-000-0002', '★★ 여기서 적은 법인 팩스가 서식에 안 갑니다');
  assert.equal(f.firmCorpNo, '000000-0000000', '★★ 여기서 적은 법인등록번호가 서식에 안 갑니다');
});
