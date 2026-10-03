'use strict';
/* 🔐 업체 주담당 «변경 승인» (대표 승인 목업 2026-10-03)
   「자꾸바꾸면 나중에 혼란이 … 바꾸기 전에 이알피에서 먼저 수정승인 받게」 → 승인제 + 잦은 변경 경고 · 관리자 전원

   지키는 것
   ① 직원이 «이미 담당이 있는» 업체를 바꾸면 요청만 — 관리자는 바로 · 첫 지정은 바로
   ② 바뀔 때마다 업체에 이력(누가·언제, 승인이면 요청자·승인자)
   ③ 최근 90일에 바뀐 적이 있으면 경고
   ④ 승인 — 업체를 바꾸고, 요청을 닫고, 요청한 사람에게 알린다 · 그새 바뀌었으면 묻는다 · 관리자만
   ⑤ 거두기는 요청한 사람(또는 관리자)만
   ⑥ 넷의 길(수정 창·표 칸·여럿 배정·급여담당자 엑셀)이 모두 같은 잣대(coMgrNeedsOk)를 탄다
   ⑦ 요청 자리가 동기화·규칙에 이름이 있다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const root = path.join(__dirname, '..');
const erp = fs.readFileSync(path.join(root, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const strip = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, ' ');
const D = Date.now();
const plain = (x) => JSON.parse(JSON.stringify(x));

function box(o) {
  o = o || {};
  const store = { co_mgr_requests: o.reqs || [], companies: o.cos || [], cases: o.cases || [], consultings: o.cons || [],
    user_dir: [{ sid: 'P-001', name: '권형하' }, { sid: 'P-002', name: '박한별' }, { sid: 'P-003', name: '김보람' }, { sid: 'P-004', name: '김혜민' }] };
  const ctx = {
    Object, String, Number, Array, Date, JSON, Math, isNaN, RegExp, Promise,
    CURRENT_USER: o.user || { sid: 'P-003', name: '김보람', isAdmin: false },
    dbGet: (k, d) => (store[k] !== undefined ? store[k] : d),
    dbUpsert: (k, rec) => { const a = store[k] || (store[k] = []); const i = a.findIndex((x) => x.id === rec.id); if (i >= 0) a[i] = rec; else a.push(rec); return true; },
    dbPatch: (k, id, p) => { ctx.patches.push({ k, id, p }); const c = (store[k] || []).find((x) => x.id === id); if (c) Object.assign(c, p); return true; },
    uid: (p) => p + '-' + (++ctx._n),
    showToast: (t) => { ctx._toast = t; },
    confirm: () => (o.confirm !== undefined ? o.confirm : true),
    fbDb: {},
    handoffSend: (cand, text) => { ctx.notes.push({ to: cand.toSid, text }); return Promise.resolve(true); },
    h: (tag, props, ...kids) => ({ tag, props, kids }),
    patches: [], notes: [], _n: 0, store,
  };
  vm.createContext(ctx);
  vm.runInContext("var CO_MGR_REQ_KEY = 'co_mgr_requests'; var CO_MGR_HOT_DAYS = 90;", ctx);
  ['coMgrCanDirect', 'coMgrNeedsOk', 'coMgrName', 'coMgrHistAdd', 'coMgrRecent', 'coMgrDay', 'coMgrHotText', 'coMgrReqs',
    'coMgrPending', 'coMgrPendingAll', 'coMgrRequest', 'coMgrOpenWorks', 'coMgrWarnBox', 'coMgrDecide', 'coMgrCancel']
    .forEach((n) => vm.runInContext(sliceFn(erp, 'function ' + n + '('), ctx));
  return ctx;
}
const ADMIN = { sid: 'P-001', name: '권형하', isAdmin: true };
const SUB = { sid: 'P-004', name: '김혜민', isSubAdmin: true };
const text = (n) => (n == null || n === false) ? '' : Array.isArray(n) ? n.map(text).join('') : (typeof n !== 'object' ? String(n) : (n.kids || []).map(text).join(''));

test('★★★ 직원이 담당 있는 업체를 바꾸면 «승인» — 관리자·부관리자는 바로 · 첫 지정은 바로', () => {
  const c = box();
  assert.equal(c.coMgrNeedsOk('P-002', 'P-001'), true, '★★★ 직원이 바로 바꿉니다');
  assert.equal(c.coMgrNeedsOk('P-002', ''), true, '★★ 직원이 담당을 바로 비웁니다');
  assert.equal(c.coMgrNeedsOk('', 'P-001'), false, '★★ 첫 지정까지 승인을 받게 합니다');
  assert.equal(c.coMgrNeedsOk('P-002', 'P-002'), false);
  assert.equal(c.coMgrNeedsOk('P-002', 'P-001', ADMIN), false, '★★ 관리자도 요청을 거칩니다');
  assert.equal(c.coMgrNeedsOk('P-002', 'P-001', SUB), false, '★★ «관리자 전원»인데 부관리자는 바로 못 바꿉니다');
});

test('★★★ 요청은 업체마다 «한 줄» — 다시 요청하면 그 줄을 고쳐 쓴다', () => {
  const c = box();
  const co = { id: 'co1', name: '가나상사', managerMain: 'P-002' };
  const r1 = c.coMgrRequest(co, 'P-001', '컨설팅 맡게 됨', '');
  const r2 = c.coMgrRequest(co, 'P-004', '', '');
  assert.equal(r1.id, r2.id, '★★★ 같은 업체 요청이 두 줄로 쌓입니다');
  const all = plain(c.store.co_mgr_requests);
  assert.equal(all.length, 1);
  assert.equal(all[0].to, 'P-004');
  assert.equal(all[0].from, 'P-002');
  assert.equal(all[0].by, 'P-003');
  assert.equal(all[0].status, 'wait');
});

test('★★★ 승인 — 업체를 바꾸고 이력(요청자·승인자)을 남기고 요청을 닫고 요청한 사람에게 알린다', () => {
  const co = { id: 'co1', name: '가나상사', managerMain: 'P-002' };
  const c = box({ user: ADMIN, cos: [co], reqs: [{ id: 'r1', coId: 'co1', coName: '가나상사', from: 'P-002', to: 'P-001', by: 'P-003', byName: '김보람', at: D, status: 'wait' }] });
  assert.equal(c.coMgrDecide(c.store.co_mgr_requests[0], true, ''), true);
  const p = c.patches[0].p;
  assert.equal(p.managerMain, 'P-001');
  const h = plain(p.mgrHistory).slice(-1)[0];
  assert.equal(h.from, 'P-002'); assert.equal(h.to, 'P-001');
  assert.equal(h.reqBy, 'P-003'); assert.equal(h.okBy, 'P-001', '★★ 누가 승인했는지 안 남깁니다');
  assert.equal(c.store.co_mgr_requests[0].status, 'ok');
  assert.equal(c.notes.length, 1, '★★ 요청한 사람에게 안 알립니다');
  assert.equal(c.notes[0].to, 'P-003');
});

test('★★ 반려 — 업체는 그대로, 까닭을 알린다 · 관리자가 아니면 못 한다', () => {
  const co = { id: 'co1', name: '가나상사', managerMain: 'P-002' };
  const req = { id: 'r1', coId: 'co1', coName: '가나상사', from: 'P-002', to: 'P-001', by: 'P-003', byName: '김보람', at: D, status: 'wait' };
  const c = box({ user: ADMIN, cos: [co], reqs: [req] });
  c.coMgrDecide(c.store.co_mgr_requests[0], false, '자문은 그대로');
  assert.equal(c.patches.length, 0, '★★ 반려했는데 업체를 바꿉니다');
  assert.equal(c.store.co_mgr_requests[0].status, 'no');
  assert.match(c.notes[0].text, /반려[\s\S]*자문은 그대로/);
  const s = box({ cos: [co], reqs: [Object.assign({}, req)] });
  assert.equal(s.coMgrDecide(s.store.co_mgr_requests[0], true, ''), false, '★★★ 직원이 승인합니다');
  assert.equal(s.patches.length, 0);
});

test('★★ 그새 담당이 바뀌었으면 승인 전에 묻는다', () => {
  const co = { id: 'co1', name: '가나상사', managerMain: 'P-004' };
  const c = box({ user: ADMIN, cos: [co], confirm: false,
    reqs: [{ id: 'r1', coId: 'co1', coName: '가나상사', from: 'P-002', to: 'P-001', by: 'P-003', at: D, status: 'wait' }] });
  assert.equal(c.coMgrDecide(c.store.co_mgr_requests[0], true, ''), false, '★★ 묻지 않고 덮습니다');
  assert.equal(c.patches.length, 0);
});

test('★★ 거두기는 요청한 사람(또는 관리자)만', () => {
  const req = { id: 'r1', coId: 'co1', coName: '가나상사', from: 'P-002', to: 'P-001', by: 'P-002', at: D, status: 'wait' };
  const c = box({ reqs: [Object.assign({}, req)] });
  assert.equal(c.coMgrCancel(c.store.co_mgr_requests[0]), false, '★★ 남의 요청을 거둡니다');
  const me = box({ user: { sid: 'P-002', name: '박한별' }, reqs: [Object.assign({}, req)] });
  assert.equal(me.coMgrCancel(me.store.co_mgr_requests[0]), true);
  assert.equal(me.store.co_mgr_requests[0].status, 'cancel');
});

test('★★★ 최근 90일에 바뀐 적이 있으면 경고 — 수정 창에 «승인 뒤 반영»·까닭 칸·그대로인 건 담당', () => {
  const co = { id: 'co1', name: '가나상사', managerMain: 'P-002', bizNo: '123-45-67890',
    mgrHistory: [{ at: D - 10 * 86400000, from: 'P-004', to: 'P-002' }, { at: D - 400 * 86400000, from: 'P-001', to: 'P-004' }] };
  const c = box({ cons: [{ id: 'k1', companyId: 'co1', status: 'progress', managerMain: 'P-004', title: '성과급 설계' }] });
  assert.equal(c.coMgrRecent(co).length, 1, '★★ 90일 밖의 바꿈까지 셉니다');
  const w = c.coMgrWarnBox(co, { managerMain: 'P-001' }, () => {});
  const t = text(w);
  assert.match(t, /관리자 승인 뒤 반영/);
  assert.match(t, /최근 90일에 담당이 1번 바뀌었습니다/, '★★★ 잦은 변경 경고가 없습니다');
  assert.match(t, /컨설팅\(성과급 설계\)의 담당은 그대로 김혜민/, '★★ 그대로인 건 담당을 안 알립니다');
  assert.ok(JSON.stringify(w).indexOf('까닭') >= 0, '★ 까닭 칸이 없습니다');
  assert.equal(c.coMgrWarnBox(co, { managerMain: 'P-002' }, () => {}), null, '(대조) 안 바꾸면 아무것도 안 뜬다');
  const a = box({ user: ADMIN });
  assert.match(text(a.coMgrWarnBox(co, { managerMain: 'P-001' }, () => {})), /주담당이 바뀝니다/);
});

test('★★★ 넷의 길이 모두 같은 잣대를 탄다 — 수정 창 · 표 칸 · 여럿 배정 · 급여담당자 엑셀', () => {
  const body = (name) => { const i = erp.indexOf(name); assert.ok(i >= 0, name); return strip(erp.slice(i, i + 4000)); };
  assert.match(body('function applyBulkMgr('), /coMgrNeedsOk\(co\.managerMain, sid\)[\s\S]{0,80}coMgrRequest\(/, '★★★ 여럿 배정이 승인을 안 거칩니다');
  assert.match(body('function commitEdit('), /editing\.field === 'managerMain'[\s\S]{0,600}coMgrNeedsOk\(_coF\.managerMain, nextVal\)/, '★★★ 표 칸 고르기가 승인을 안 거칩니다');
  assert.match(body('function renderMgrCell('), /coMgrNeedsOk\(co\.managerMain, ''\)/, '★★ 표 칸 ✕ 가 승인을 안 거칩니다');
  assert.match(body('function applyPayContacts('), /coMgrNeedsOk\(base\.managerMain, p\.managerMain\)/, '★★ 급여담당자 엑셀이 승인을 안 거칩니다');
  const save = strip(erp.slice(erp.indexOf("editModal && h(CompanyEditModal"), erp.indexOf("editModal && h(CompanyEditModal") + 2500));
  assert.match(save, /coMgrNeedsOk\(editModal\.managerMain, form\.managerMain\)[\s\S]{0,200}coMgrRequest\(editModal/, '★★★ 수정 창이 승인을 안 거칩니다');
  assert.match(save, /form\.managerMain = editModal\.managerMain/, '★★★ 요청만 하고 담당을 그대로 바꿔 버립니다');
});

test('★★ 요청 자리가 동기화 목록·규칙에 이름이 있다 · 띠·이력이 화면에 걸려 있다', () => {
  const m = erp.match(/var FB_ALL_SYNC_KEYS = \[([\s\S]*?)\];/);
  assert.ok(m && /'co_mgr_requests'/.test(m[1]), '★★ 동기화 목록에 없어 관리자 화면에 띠가 안 뜹니다');
  const rules = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'rules-paste.json'), 'utf8'));
  assert.ok(rules.rules.data.co_mgr_requests, '★★ 규칙에 이름이 없습니다');
  assert.match(erp, /coMgrBanner\(function\(\)\{ setMgrReqOpen\(true\); \}\)/);
  assert.match(erp, /coMgrHistBox\(co, props\.onClose\)/);
  assert.match(erp, /coMgrPendTag\(co\)/);
  assert.match(erp, /coMgrWarnBox\(props\.cur, f, set\('_mgrReason'\)\)/);
});
