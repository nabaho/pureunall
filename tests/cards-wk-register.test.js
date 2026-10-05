'use strict';
/* 👷 근로자 「＋ 정보등록」 — 고른 이알피 사건에 사람을 더한다 (대표 결정 2026-10-05 «사건에 더하기»)
   ⚠⚠ 기업정보함이 이알피 사건 원장(data/cases)에 쓰는 유일한 자리다. 가짜 서버로 «실제로 돌려»
     이알피를 깨지 않는 다섯 가지를 지킨다 —
     ① 없는·지운 사건엔 안 쓴다  ② workers 가 배열일 때만  ③ 맨 끝에 고유 id 로
     ④ workers 한 칸만 거래로(그사이 남이 더한 사람을 안 덮는다)  ⑤ updatedAt·updatedBy·data/cases/u 를 올린다
   그리고 주민번호·주소·연락처·계좌는 «받지 않는다»(대표 결정 2026-09-01).
   ⚠ 예시는 가짜다(홍길동·가나상사). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { cutFn } = require('./cut-fn');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

/* 가짜 실시간DB — once·transaction·update 만. 거래는 «서버의 지금 값»으로 셈을 돌린다 */
function fakeDb(tree, opt) {
  const root = clone(tree);
  const log = { tx: [], update: [], tried: 0 };
  const get = (p) => p.split('/').reduce((o, k) => (o == null ? undefined : o[k]), root);
  const put = (p, v) => { const ks = p.split('/'); let o = root;
    ks.slice(0, -1).forEach((k) => { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; });
    o[ks[ks.length - 1]] = v; };
  return { root, log,
    ref(p) { return {
      once: async () => { const v = clone(get(p)); return { val: () => (v === undefined ? null : v) }; },
      transaction: async (fn) => {
        log.tried++;
        if (opt && opt.beforeTx) opt.beforeTx(root);          /* 그사이 다른 사람이 쓴 것 */
        const cur = clone(get(p));
        const next = fn(cur === undefined ? null : cur);
        if (next === undefined) return { committed: false, snapshot: { val: () => cur } };
        log.tx.push([p, clone(next)]); put(p, clone(next));
        return { committed: true, snapshot: { val: () => clone(next) } };
      },
      update: async (u) => { log.update.push(clone(u)); Object.keys(u).forEach((k) => put(k, u[k])); }
    }; } };
}
function world() {
  const ctx = { console, Date, Math, String, Array, Object, JSON };
  vm.createContext(ctx);
  vm.runInContext([
    (SRC.match(/const WK_BAD = [^;]+;/) || [''])[0].replace('const ', 'var '),
    cutFn(SRC, 'function wkNewWorker('), cutFn(SRC, 'function wkAppendWorker('), cutFn(SRC, 'async function wkAddToCase(')
  ].join('\n'), ctx);
  return ctx;
}
const 사건 = (x) => ({ data: { cases: { u: 1, v: { 'c-1': Object.assign({ id: 'c-1', companyName: '가나상사', updatedAt: 5,
  workers: [{ id: 'w-a', name: '김철수', rrn: '', pos: '' }] }, x || {}) } } } });

test('★★★ 고른 사건의 «맨 끝»에 고유 id 로 더하고, 다른 칸은 손대지 않는다', async () => {
  const w = world(); const db = fakeDb(사건());
  const p = w.wkNewWorker({ name: ' 홍길동 ', pos: '사원', hireDate: '2024.03.02' }, 1790000000000);
  const r = await w.wkAddToCase(db, 'c-1', p, '김보람');
  assert.equal(r.ok, true, r.msg);
  const ws = db.root.data.cases.v['c-1'].workers;
  assert.equal(ws.length, 2);
  assert.equal(ws[0].name, '김철수', '★ 있던 사람이 바뀌었습니다');
  assert.equal(ws[1].name, '홍길동', '★★ 새 사람이 맨 끝에 안 들어갔습니다(이알피 지급 확인이 순번으로 찾습니다)');
  assert.match(ws[1].id, /^w-/, '★ 고유 id 가 없습니다');
  assert.equal(ws[1].hireDate, '2024.03.02');
  assert.equal(db.root.data.cases.v['c-1'].companyName, '가나상사', '다른 칸을 건드렸습니다');
  assert.deepEqual(db.log.tx.map((t) => t[0]), ['data/cases/v/c-1/workers'], '★★ workers «한 칸»만 거래로 써야 합니다 — 사건을 통째로 덮으면 남이 고친 칸이 사라집니다');
});

test('★★★ 주민번호·주소·연락처·계좌는 «받지 않는다» — 이알피 편집기 꼴로 빈 칸만', () => {
  const w = world();
  const p = w.wkNewWorker({ name: '홍길동', rrn: '900101-1234567', phone: '010-1111-2222', addr: '서울', account: '123' });
  ['rrn', 'phone', 'addr', 'bank', 'account', 'holder'].forEach((k) => assert.equal(p[k], '', '★★★ ' + k + ' 를 받았습니다'));
  /* 창에도 그런 칸이 없어야 한다 */
  const ui = strip(cutFn(SRC, 'function openWkRegister('));
  assert.doesNotMatch(ui, /id="wr_(rrn|phone|addr|bank|account|tel|mobile)"/, '★★★ 근로자 창에 주민번호·연락처·계좌 칸이 생겼습니다');
});

test('★★ 그사이 남이 더한 사람을 «덮지 않는다» — 거래가 서버의 지금 목록 위에 얹는다', async () => {
  const w = world();
  const db = fakeDb(사건(), { beforeTx: (root) => root.data.cases.v['c-1'].workers.push({ id: 'w-b', name: '이영희' }) });
  const r = await w.wkAddToCase(db, 'c-1', w.wkNewWorker({ name: '홍길동' }), '김보람');
  assert.equal(r.ok, true);
  assert.deepEqual(Array.from(db.root.data.cases.v['c-1'].workers, (x) => x.name), ['김철수', '이영희', '홍길동'],
    '★★ 그사이 들어온 「이영희」가 사라졌습니다');
});

test('★★ 이알피가 «다시 받게» — updatedAt·updatedBy·id 와 표의 시각(u)을 올린다', async () => {
  const w = world(); const db = fakeDb(사건());
  await w.wkAddToCase(db, 'c-1', w.wkNewWorker({ name: '홍길동' }), '김보람');
  const u = db.log.update[0] || {};
  assert.ok(u['data/cases/u'] > 1, '★★ 표의 시각(u)을 안 올리면 이알피 다른 기기가 영영 옛 목록을 봅니다');
  assert.ok(u['data/cases/v/c-1/updatedAt'] > 5, '★ updatedAt 을 안 올리면 열어 둔 이알피 편집 창이 경고 없이 덮습니다');
  assert.equal(u['data/cases/v/c-1/updatedBy'], '김보람');
  assert.equal(u['data/cases/v/c-1/id'], 'c-1', '번호를 늘 함께 보낸다 — 껍데기를 막는 그물');
});

test('★★★ 없는 사건·지운 사건·지도꼴 목록에는 «아무것도» 안 쓴다', async () => {
  const w = world();
  for (const [why, tree] of [
    ['없는 사건', { data: { cases: { v: {} } } }],
    ['지운 사건', 사건({ _deleted: true })],
    ['지도꼴 workers', 사건({ workers: { a: { name: '김철수' } } })],
    ['번호가 다른 껍데기', 사건({ id: 'c-x' })]
  ]) {
    const db = fakeDb(tree);
    const r = await w.wkAddToCase(db, 'c-1', w.wkNewWorker({ name: '홍길동' }), '김보람');
    assert.equal(r.ok, false, why + ' 인데 썼습니다');
    assert.equal(db.log.tx.length + db.log.update.length, 0, '★★★ ' + why + ' 에 무언가를 썼습니다 — 껍데기·깨진 표가 생깁니다');
    assert.equal(db.log.tried, 0, '★ ' + why + ' 인데 쓰러 가 보기까지 했습니다 — 먼저 보고 멈춰야 합니다');
  }
  /* 거래 안에서도 배열이 아니면 그만둔다 */
  assert.equal(w.wkAppendWorker({ a: 1 }, { id: 'w-1' }), undefined);
  assert.equal(w.wkAppendWorker(null, { id: 'w-1' }).length, 1, '아직 아무도 없는 사건이면 첫 사람으로');
  assert.equal(w.wkAddToCase.length, 4);
});

test('★★ 이 앱에서 data/cases 에 쓰는 곳은 «여기 하나» — 나머지는 읽기만', () => {
  const s = strip(SRC);
  const fn = strip(cutFn(SRC, 'async function wkAddToCase('));
  const rest = s.replace(fn, '');
  /* 사건 원장 경로를 쓰는 줄 — set·update·transaction·remove·push 와 한 줄에 있으면 쓰기다 */
  const bad = rest.split('\n').filter((ln) => /data\/cases/.test(ln) && /\.(set|update|transaction|remove|push)\(/.test(ln));
  assert.deepEqual(bad, [], '★★ wkAddToCase 밖에서 이알피 사건 원장에 씁니다:\n' + bad.join('\n'));
});

test('★ 근로자 화면의 「＋ 정보등록」은 이 창을 연다', () => {
  assert.match(strip(cutFn(SRC, 'function openRegister(')), /if\(state\.view==='wk'\)\{[\s\S]*?openWkRegister\(\)/);
  assert.match(strip(cutFn(SRC, 'function wkRegCases(')), /!r\._deleted/, '지운 사건을 고를 목록에 올리지 않습니다');
});
