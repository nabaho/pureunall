'use strict';
/* 나의 업무 — 기록은 업무관리 한 곳 · 두 화면 잇기(wsSyncRun) 되살림 (대표 「추천대로」 2026-09-27)

   ■ 무엇이 있었나
     ① 2026-08-16 엔진을 MyDeskV2 밖으로 옮기며 `sid` 가 따라오지 않았다. 첫 건에서 ReferenceError →
        `.catch(fin)` 이 삼켜 6주 동안 «아무것도 안 하고» 끝났다(마지막 기록 2026-08-10).
        업무관리에서 끝낸 건이 이알피에 안 넘어가 «진행중»으로 남았다.
     ② 그냥 sid 만 고쳐 켜면 해로웠다 — 상태말이 달라(in-progress ↔ 진행중) 이알피 빈 상태가
        업무관리 «진행중»을 빈칸으로 지웠다(모의 실행: 직원별 1~6건).
     ③ 같은 일을 두 곳(이알피 「+ 입력」 · 업무관리 기록)에 적게 돼 있어 둘 다 비어 갔다.
   ■ 규칙
     ⓐ 엔진이 «실제로 돈다» — 끝낸 건이 넘어간다.
     ⓑ 상태·다음 할 일·진행률을 이알피 쪽 기록(project_progress)과 주고받지 않는다.
     ⓒ 「나의 업무」에는 「+ 입력」 창이 없고, 「업무관리에서 기록 →」이 그 건을 연다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripJs } = require('./strip-comments');

const P = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
function fn(name) {
  const m = new RegExp('\\nfunction ' + name + '\\(').exec(P);
  if (!m) throw new Error('없음: ' + name);
  let i = P.indexOf('{', m.index), d = 0;
  for (; i < P.length; i++) { if (P[i] === '{') d++; else if (P[i] === '}') { d--; if (!d) break; } }
  return P.slice(m.index, i + 1);
}
const ENGINE = P.slice(P.indexOf('\nvar _wsBusy = false;'), P.indexOf('\nfunction MyDeskV2('));

/* 엔진을 «그대로» 싣고, 서버·저장은 가짜로 받는다 */
function run(opts) {
  const log = { up: null, patch: [], set: [] };
  const W = { 'work_erp/items': opts.items, 'work_erp/pesync': opts.pesync || {}, 'work_erp/steps': {} };
  const store = opts.store;
  const ctx = {
    console, Date, Math, JSON, Object, Array, String, Number, Promise, setTimeout,
    CURRENT_USER: { sid: opts.sid },
    dbGet: (k, d) => (k in store ? JSON.parse(JSON.stringify(store[k])) : d),
    dbPatch: (st, id, f) => { log.patch.push({ st, id, f }); return true; },
    dbSet: (k) => { log.set.push(k); return true; },
    showToast: () => {},
    fbDb: { ref: (p) => ({
      once: () => Promise.resolve({ val: () => (p in W ? W[p] : null), exists: () => p in W }),
      update: (up) => { log.up = up; return Promise.resolve(); } }) }
  };
  vm.createContext(ctx);
  vm.runInContext('var BRIEF_MAX = 40;', ctx);
  vm.runInContext(fn('isItemClosed'), ctx);
  vm.runInContext(fn('briefTrim'), ctx);
  vm.runInContext(ENGINE, ctx);
  return new Promise((res) => { ctx.wsSyncRun(null, null); setTimeout(() => res(log), 50); });
}
/* ⚠ 기준점 열쇠는 wsSafeKey 로 «-» 도 «_» 로 바뀐다(contract-ct_1) — 틀리면 «처음 보는 건» 갈래로 빠져 검사가 헛돈다 */
const SNAP = (o) => Object.assign({ type: 'contract', id: 'ct-1', work_id: 'PE-contract-ct-1', pe_closed: false, ws_done: false,
  st: '진행중', nt: '', nd: '', br: '', pg: '', ti: '', cl: '', cn: '', cr: '', cp: '', synced_at: '2026-08-10T00:00:00Z' }, o || {});

test('ⓐ ★★ 엔진이 «실제로 돈다» — 업무관리에서 끝낸 건이 이알피로 넘어간다', async () => {
  const log = await run({
    sid: 'P-001',
    store: { contracts: [{ id: 'ct-1', companyName: '가나상사', status: 'progress' }], project_progress: [] },
    items: { 'PE-contract-ct-1': { ref: { type: 'contract', id: 'ct-1' }, state: 'done', end_way: 'done', status: '종료',
      mgr_main: { sid: 'P-003' }, state_at: '2026-09-20T00:00:00Z' } },
    pesync: { 'contract-ct_1': SNAP() }
  });
  assert.ok(log.up, '★★ 엔진이 아무것도 안 썼습니다 — sid 가 또 빠졌거나 오류를 삼킵니다');
  const close = log.patch.find((p) => p.st === 'contracts' && p.id === 'ct-1');
  assert.ok(close && close.f.status === 'closed', '★★ 업무관리에서 끝낸 건이 이알피에 안 넘어갑니다');
});

test('ⓑ ★★ 이알피의 빈 상태가 업무관리 «진행중»을 지우지 않는다', async () => {
  const log = await run({
    sid: 'P-001',
    store: { contracts: [{ id: 'ct-1', companyName: '가나상사', status: 'progress' }],
      /* 이알피 쪽 옛 기록 — 상태가 비어 있다(실제로 흔하다) */
      project_progress: [{ id: 'pp-1', sid: 'P-001', projectType: 'contract', projectId: 'ct-1', status: '', nextAction: '', nextDate: '',
        progress: 0, updatedAt: '2026-09-25T00:00:00Z' }] },
    items: { 'PE-contract-ct-1': { ref: { type: 'contract', id: 'ct-1' }, status: '진행중', mgr_main: { sid: 'P-001' },
      next: { text: '홍길동 면담', date: '2026-10-01' } } },
    pesync: { 'contract-ct_1': SNAP({ nt: '홍길동 면담', nd: '2026-10-01' }) }
  });
  const up = log.up || {};
  const sn = up['work_erp/pesync/contract-ct_1'];
  assert.ok(sn && sn.note !== '기준선', '검사가 헛돕니다 — «처음 보는 건» 갈래로 빠졌습니다');
  assert.ok(!('work_erp/items/PE-contract-ct-1/status' in up), '★★ 업무관리 상태를 이알피 값으로 덮었습니다');
  assert.ok(!('work_erp/items/PE-contract-ct-1/next' in up), '★★ 업무관리 «다음 할 일»을 이알피 값으로 덮었습니다');
  assert.equal(log.set.indexOf('project_progress'), -1, '★★ 이알피 진행 기록(project_progress)을 다시 고치기 시작했습니다');
});

test('ⓒ ★★ 「나의 업무」에 「+ 입력」 창이 없고, 「업무관리에서 기록 →」이 그 건을 연다', () => {
  const my = stripJs(fn('MyDeskV2'));
  assert.ok(my.indexOf("'📝 메모' : '+ 입력'") < 0, '★★ 「+ 입력」·「📝 메모」 단추가 되살아났습니다 — 기록이 다시 두 곳이 됩니다');
  const at = my.indexOf("'업무관리에서 기록 →'");
  assert.ok(at > 0, '★★ 업무관리로 가는 단추가 없습니다');
  assert.match(my.slice(at - 400, at), /wsOpen\(_w\.wid\)/, '★★ 눌러도 업무관리의 그 건이 안 열립니다');
  /* 상태 칸은 업무관리에 적힌 것이 먼저다 */
  assert.match(my, /if\(_wsx && _wsx\.status\) return _wsx\.status;/, '★ 상태 칸이 업무관리 상태를 안 봅니다');
  assert.match(my, /status:String\(w\.status\|\|''\)/, '★ 업무관리 상태를 안 받아 옵니다');
});
