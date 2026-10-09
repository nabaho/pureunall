'use strict';
/* 경력관리 기기 사이 동기화 (대표 지시 2026-10-07 「동기화도 고쳐라」 — 전체 검토에서 나온 것)
   ① 휴지통에서 되살린 기록이 다른 기기를 거쳐 다시 지워졌다 — 지운 표가 «합집합»으로만 합쳐져서
   ② 자동 동기화를 꺼도 받아 와 꺼 둔 동안 고친 것을 덮었다
   ③ 「받아도 잃을 것 없다」가 번호만 보았다 — 이 기기에서 고친 기록도 덮었다
   ④ 받다가 일부만 써져도 «맞춰졌다»고 적었다
   ⑤ 올리기가 «확인 후 쓰기»로 갈라져 마지막에 쓴 쪽이 이겼다 — 이제 서버 규칙이 «내가 본 판 위에만» 받는다
   ⑥ 올리는 사이에 고친 것이 «안 올라간 고침» 표시에서 빠졌다
   ⑦ 같은 PC 탭 둘이 서로를 «남의 새 저장»으로 보았다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const R = path.join(__dirname, '..');
const CODE = fs.readFileSync(path.join(R, 'kcareer.html'), 'utf8');
const bare = CODE.replace(/\/\*[\s\S]*?\*\//g, ' ');
const N = require('../js/kcareer-notices.js');

function cut(decl) {
  const head = bare.indexOf(decl);
  assert.notEqual(head, -1, decl + ' 을 찾지 못했습니다');
  let i = bare.indexOf('{', head + decl.length - 1), d = 0;
  for (; i < bare.length; i++) { if (bare[i] === '{') d++; else if (bare[i] === '}') { d--; if (!d) break; } }
  return bare.slice(head, i + 1);
}
/* 기기 하나 — 저장소(localStorage)와 시계를 따로 든다 */
function 기기(이름) {
  const store = new Map();
  const ls = {
    getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); }, key: (i) => Array.from(store.keys())[i] || null,
    get length() { return store.size; },
  };
  const ctx = { console: { error() {}, warn() {}, log() {} }, JSON, Object, Array, String, Number, Math, Error, localStorage: ls,
    시계: 1000, 알림: [] };
  ctx.Date = class extends Date { static now() { return ctx.시계; } };
  ctx.toast = (m) => ctx.알림.push(String(m));
  vm.createContext(ctx);
  vm.runInContext('var _mem={}; var STORAGE_OK=true; var NS="cm3_"; var KV=null;', ctx);
  vm.runInContext(cut('const LS={').replace(/^const /, 'var '), ctx);
  vm.runInContext(bare.match(/var TOMB_KEY='_tomb'[^\n]*/)[0] + bare.match(/var TOMB_REV_KEY='_tombrev';/)[0], ctx);
  vm.runInContext(bare.match(/var FB_SKIP=\[[\s\S]*?\];/)[0] + bare.match(/var FB_UNION=\[[^\]]*\];/)[0], ctx);
  ['function _tombObj(', 'function tombLoad(', 'function tombRevLoad(', 'function tombSave(', 'function tombRevSave(',
   'function tombDead(', 'function tombHas(', 'function tombPrune(', 'function _tombDiff(', 'function kcApplyRestore(',
   'function kcRestoreFailed(', 'function _fbPendingNow(', 'function _fbPendingMark(', 'function _fbPendingClear(']
    .forEach((d) => vm.runInContext(cut(d), ctx));
  /* 이 기기의 기록 통 — set() 대신 «자리표 셈 + 담기»만 */
  vm.runInContext('function 담기(k, arr){ var old=JSON.parse(localStorage.getItem(NS+k)||"[]"); _tombDiff(k, old, arr); localStorage.setItem(NS+k, JSON.stringify(arr)); }'
    + 'function 꺼내기(k){ return JSON.parse(localStorage.getItem(NS+k)||"[]"); }'
    + 'function 모으기(){ var o={}; for(var i=0;i<localStorage.length;i++){ var k=localStorage.key(i); if(k.indexOf(NS)!==0) continue; var b=k.slice(NS.length); if(FB_SKIP.indexOf(b)>=0) continue; o[b]=localStorage.getItem(k); } return o; }', ctx);
  ctx.이름 = 이름;
  return ctx;
}
const ids = (ctx, k) => vm.runInContext('꺼내기("' + k + '")', ctx).map((r) => r.id).sort();

test('★★★ ① 되살린 기록은 다른 기기를 거쳐도 «산 채로» 남는다 — 다시 지우면 다시 지워진다', () => {
  const A = 기기('A'), B = 기기('B');
  const X = { id: 'W1', org: '가나상사' }, Y = { id: 'W2', org: '다라상사' };
  vm.runInContext('담기("wiccok", ' + JSON.stringify([X, Y]) + ')', A);
  vm.runInContext('담기("wiccok", ' + JSON.stringify([X, Y]) + ')', B);
  /* A 가 X 를 지우고 올린다 → B 가 받는다 */
  A.시계 = 2000; vm.runInContext('담기("wiccok", ' + JSON.stringify([Y]) + ')', A);
  let 구름 = vm.runInContext('모으기()', A);
  B.cloud = 구름; vm.runInContext('kcApplyRestore(cloud, "pull")', B);
  assert.deepEqual(ids(B, 'wiccok'), ['W2'], 'A 가 지운 것은 B 에서도 빠진다');
  /* A 가 휴지통에서 X 를 되살리고 올린다 → B 가 받는다 */
  A.시계 = 3000; vm.runInContext('담기("wiccok", ' + JSON.stringify([X, Y]) + ')', A);
  구름 = vm.runInContext('모으기()', A);
  B.시계 = 3500; B.cloud = 구름; vm.runInContext('kcApplyRestore(cloud, "pull")', B);
  assert.deepEqual(ids(B, 'wiccok'), ['W1', 'W2'], '★★ B 에 남은 옛 자리표가 되살린 기록을 버렸다 — 그 상태가 올라가면 A 까지 잃는다');
  /* B 가 X 를 «다시» 지운다 — 이번엔 지운 것이 이긴다 */
  B.시계 = 4000; vm.runInContext('담기("wiccok", ' + JSON.stringify([Y]) + ')', B);
  assert.equal(vm.runInContext('tombHas("W1")', B), true, '★ 되살린 뒤 다시 지운 것이 «지운 것»으로 안 잡힌다');
  B.cloud = 구름; vm.runInContext('kcApplyRestore(cloud, "pull")', B);   /* 낡은 클라우드(X 있음)를 받아도 */
  assert.deepEqual(ids(B, 'wiccok'), ['W2'], '다시 지운 것은 낡은 클라우드에서 돌아오지 않는다');
});

test('① 시계가 같은 한순간에 «지움 → 되살림 → 지움»이어도 마지막 일이 이긴다', () => {
  const A = 기기('A');                              /* 시계를 움직이지 않는다 */
  vm.runInContext('담기("wiccok", [{id:"W1"}]); 담기("wiccok", []); 담기("wiccok", [{id:"W1"}])', A);
  assert.equal(vm.runInContext('tombHas("W1")', A), false, '되살린 것');
  vm.runInContext('담기("wiccok", [])', A);
  assert.equal(vm.runInContext('tombHas("W1")', A), true, '★ 같은 시각이면 다시 지운 것이 «산 것»으로 남았다(미리보기에서 실제로 걸림)');
});

test('★★ ④ 받다가 못 쓴 보관함이 있으면 알려 주고 «맞춰졌다»고 적지 않는다', () => {
  const B = 기기('B');
  let 막힘 = true;
  const 원래 = B.localStorage.setItem;
  B.localStorage.setItem = (k, v) => { if (막힘 && k === 'cm3_cert') { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; } 원래(k, v); };
  B.cloud = { wiccok: '[{"id":"W1"}]', cert: '[{"id":"C1"}]' };
  const r = vm.runInContext('kcApplyRestore(cloud, "pull")', B);
  assert.deepEqual(Array.from(r.failed), ['cert']);
  assert.equal(vm.runInContext('kcRestoreFailed(kcApplyRestore(cloud, "pull"))', B), true);
  assert.ok(B.알림.some((m) => /받지 못했습니다/.test(m)));
  /* 받는 길 넷 모두 «기준 시각 적기 전에» 이것을 본다 */
  for (const d of ['function fbPull(', 'function fbFirstSync(', 'function fbNewerSync(', 'async function kcRecoverRun(']) {
    const f = cut(d);
    const a = f.indexOf('kcRestoreFailed('), b = f.indexOf('fbSetBase(');
    assert.ok(a > 0 && a < b, '★ ' + d + ' — 반쯤 받은 채 기준 시각을 적으면 줄어든 자료가 클라우드로 올라간다');
  }
});

test('★★ ⑥ «안 올라간 고침» 표시는 일련번호 — 올리는 사이 고친 것은 남는다', () => {
  const A = 기기('A');
  vm.runInContext('_fbPendingMark()', A);
  const 첫 = vm.runInContext('_fbPendingNow()', A);
  assert.ok(첫);
  A.시계 = 5000; vm.runInContext('_fbPendingMark()', A);           /* 올리는 사이에 또 고침 */
  vm.runInContext('_fbPendingClear(' + JSON.stringify(첫) + ')', A);  /* 올리기는 «모을 때 본 번호»로 지운다 */
  assert.ok(vm.runInContext('_fbPendingNow()', A), '★ 올리는 사이 고친 것까지 «올라갔다»고 지웠다 — 곧 받아 오며 덮는다');
  const 둘 = vm.runInContext('_fbPendingNow()', A);
  vm.runInContext('_fbPendingClear(' + JSON.stringify(둘) + ')', A);
  assert.equal(vm.runInContext('_fbPendingNow()', A), '');
});

/* ── 올리기 흉내 — 서버 규칙(prevAt = 지금 at)을 흉내 낸다 ── */
function 올리기세상(서버) {
  const A = 기기('A');
  A.서버 = 서버; A.보낸것 = [];
  const 거절 = () => Object.assign(new Error('PERMISSION_DENIED: Permission denied'), { code: 'PERMISSION_DENIED' });
  A.fbDb = { ref: () => ({
    update: (p) => { A.보낸것.push(p); if (p.prevAt != null && 서버.at != null && p.prevAt !== 서버.at) return Promise.reject(거절());
      Object.assign(서버, p); return Promise.resolve(); },
    child: () => ({ once: () => Promise.resolve({ val: () => 서버.at }) }),
  }) };
  A.fbUid = 'u1';
  Object.assign(A, { fbGatherLS: () => ({ wiccok: '[]' }), fbDeviceLabel: () => 'A', fbShowInfo() {}, fbHideNotice() {},
    _fbSchedulePush() { A.다시 = (A.다시 || 0) + 1; }, fbShowNotice(k) { A.띠 = k; }, Promise });
  vm.runInContext('var _fbBase=null;' + cut('function fbGetBase(') + cut('function fbSetBase(') + cut('function _fbDoPush('), A);
  return A;
}

test('★★★ ⑤ 올리기는 «내가 본 판» 위에만 — 다른 기기가 먼저 올렸으면 덮지 않고 띠로 묻는다', async () => {
  const 서버 = { at: 100 };
  const A = 올리기세상(서버);
  vm.runInContext('fbSetBase(100); _fbPendingMark();', A);
  A.시계 = 50;                                     /* 시계가 늦은 기기 */
  await vm.runInContext('_fbDoPush(3, true)', A);
  const p = A.보낸것[0];
  assert.equal(p.prevAt, 100, '★ 내 기준 시각을 함께 보내야 서버가 «그 판 위인지» 가린다');
  assert.ok(p.at > 100, '★ 시계가 늦어도 새 시각은 기준보다 커야 «새것»으로 보인다');
  assert.equal(vm.runInContext('fbGetBase()', A), p.at, '올라간 «뒤»에 기준을 적는다');
  assert.equal(vm.runInContext('_fbPendingNow()', A), '');
  /* 그 사이 다른 기기가 올렸다 */
  서버.at = 999; A.시계 = 2000; vm.runInContext('_fbPendingMark()', A);
  const 기준전 = vm.runInContext('fbGetBase()', A);
  await assert.rejects(vm.runInContext('_fbDoPush(3, true)', A));
  assert.equal(서버.at, 999, '서버는 남의 판 그대로');
  assert.equal(vm.runInContext('fbGetBase()', A), 기준전, '★ 실패했는데 기준을 옮기면 다음에 남의 고침을 덮는다');
  assert.ok(vm.runInContext('_fbPendingNow()', A), '★ 못 올린 고침의 표시를 지우면 받아 오며 덮인다');
  assert.equal(A.띠, 'newer', '사람이 고르게 띠를 띄운다');
  assert.ok(A.알림.some((m) => /먼저 저장/.test(m)), '★ 조용히 버리지 않는다');
  /* ☁ 저장 단추(force)는 «지금 서버 시각»을 막 읽어 그 위에 쓴다 */
  await vm.runInContext('_fbDoPush(3, false, {force:true})', A);
  assert.equal(A.보낸것[A.보낸것.length - 1].prevAt, 999);
  assert.ok(서버.at > 999);
});

test('★★ ⑤ 서버 규칙 — kcareer/$uid/prevAt 는 «지금 at 과 같을 때만»', () => {
  const rules = JSON.parse(fs.readFileSync(path.join(R, 'docs', 'rules-paste.json'), 'utf8'));
  const r = rules.rules.kcareer.$uid;
  assert.ok(r.prevAt, '★ 규칙이 없으면 «확인 후 쓰기»가 서버에서 한 번에 일어나지 않는다');
  assert.match(r.prevAt['.validate'], /newData\.val\(\) === data\.parent\(\)\.child\('at'\)\.val\(\)/);
  assert.match(r.prevAt['.validate'], /!data\.parent\(\)\.child\('at'\)\.exists\(\)/, '첫 저장은 받는다');
  /* 통째 되돌리기는 백업 속 prevAt 을 빼고 쓴다 — 안 빼면 규칙에 막힌다 */
  assert.match(cut('async function kcRecoverRun('), /delete c\.prevAt/);
});

test('★★ ② 자동 동기화를 끄면 받지도 않는다 · 꺼 둔 동안 고친 것도 표시한다', () => {
  assert.match(cut('function fbNewerSync('), /^function fbNewerSync\(\)\{\s*if\(!fbAutoOn\(\)\) return;/);
  assert.match(cut('function fbFirstSync('), /^function fbFirstSync\(\)\{\s*if\(!fbAutoOn\(\)\) return;/);
  const s = cut('function fbSetAuto(');
  assert.match(s, /fbUnwatch\(\)/, '★ 끌 때 감시를 떼지 않으면 다른 기기 저장에 새로고침한다');
  assert.match(cut('function fbUnwatch('), /\.off\('value', _fbWatchFn\)/);
  const sch = cut('function fbScheduleAuto(');
  assert.ok(sch.indexOf('_fbPendingMark()') < sch.indexOf('fbAutoOn()'), '★ 꺼 두었다고 표시를 안 남기면 켜는 순간 덮인다');
});

test('★ ⑦ 탭끼리 기준을 함께 본다 · 이 PC 가 올리는 것은 «남의 새 저장»이 아니다', () => {
  const w = cut('function fbWatch(');
  assert.match(w, /if\(at===_fbPushingAt\(\)\) return;/);
  assert.match(w, /var base=_fbBaseNow\(\);/, '탭마다 든 _fbBase 로 견주면 다른 탭 저장마다 새로고침한다');
  assert.match(cut('function fbAutoPush('), /var base=fbGetBase\(\);/);
  assert.match(cut('function fbNewerSync('), /v\.at===fbGetBase\(\)/);
  assert.match(bare.match(/var FB_SKIP=\[[\s\S]*?\];/)[0], /'_fbpushing'/, '올리는 중 표시는 기기마다');
});

test('★★ ③ 「받아도 잃을 것 없다」는 번호만이 아니라 «이 기기에서 더 나중에 고친 것»도 본다', () => {
  const 구름 = { wiccok: JSON.stringify([{ id: 'W1', org: '가나', savedAt: '2026-10-01T00:00:00Z' }, { id: 'W2', org: '다라' }]) };
  /* 이 기기에서 W1 을 나중에 고쳤다 */
  let r = N.firstPullLoss({ wiccok: JSON.stringify([{ id: 'W1', org: '가나(고침)', savedAt: '2026-10-05T00:00:00Z' }]) }, 구름, [], '_tomb');
  assert.equal(r.safe, false, '★ 같은 번호라고 덮으면 이 기기에서 고친 것이 사라진다');
  assert.equal(r.lost[0].changed, true);
  /* 처음 깔린 자료(시각 없음)는 잃는 것이 아니다 — 처음 여는 기기가 저절로 받아야 한다 */
  r = N.firstPullLoss({ wiccok: JSON.stringify([{ id: 'W2', org: '다라(옛)' }]) }, 구름, [], '_tomb');
  assert.equal(r.safe, true);
  /* 클라우드가 지웠다가 «되살린» 것은 지운 것이 아니다 */
  const 구름2 = { wiccok: '[]', _tomb: JSON.stringify({ W9: 100 }), _tombrev: JSON.stringify({ W9: 200 }) };
  r = N.firstPullLoss({ wiccok: JSON.stringify([{ id: 'W9' }]) }, 구름2, [], '_tomb');
  assert.equal(r.safe, false, '되살린 기록을 «클라우드가 지웠다»로 보면 이 기기 것을 잃는다');
});
