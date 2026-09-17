'use strict';
/* 기업정보함 검색색인(pucards/idx, 1.36MB)을 «쓸 때» 받는다 — 부팅 때가 아니다
   ─────────────────────────────────────────────────────────────────────────
   대표 지시 2026-09-18 「기업정보함도 줄여라」

   ■ 재 본 것 (firebase database:profile 165초)
     `/pucards/idx` 1.36MB 가 **부팅마다** 내려왔다. 폭풍이 있던 날에는 10.89MB ×8.
     받는 쪽이 둘이었다 —
       ⑴ 푸른이알피: 로그인이 끝나자마자 무조건 구독(계약창을 한 번도 안 열어도)
       ⑵ 기업정보함: 「이미 채워져 있나」를 세려고 통째로 받고 거의 언제나 그냥 돌아섬
     ⑵ 는 **세기 위해서만** 1.36MB 를 받는 순수한 낭비다.

   ■ 못 박는 것
     ① 이알피는 부팅 때 색인을 «안 받는다»
     ② 처음 «읽는 순간» 받기 시작한다 (여덟 자리를 하나하나 안 고쳐도 되게)
     ③ 넣어 주는 것(검사·다른 코드)도 그대로 된다
     ④ 찾기 창은 색인이 도착하면 다시 그린다
     ⑤ 기업정보함은 «세려고» 통째로 받지 않는다 — 적어 둔 한 칸만 읽는다
     ⑥ 그래도 스스로 낫는다 — 오래됐거나 명함이 훌쩍 늘면 다시 센다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const ERP_RAW = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
const ERP = stripJs(ERP_RAW);
const CARDS_RAW = fs.readFileSync(path.join(ROOT, 'pu-cards.html'), 'utf8');
const CARDS = stripJs(CARDS_RAW);

/* ══ 이알피 — 색인을 언제 받나 ══════════════════════════════════════════ */
function loadErpIdx() {
  const a = ERP.indexOf('var _pcIdx = {};');
  assert.ok(a > 0, '_pcIdx 를 찾지 못했습니다');
  const b = ERP.indexOf('function ensurePucardsIdx()');
  assert.ok(b > a, 'ensurePucardsIdx 를 찾지 못했습니다');
  const src = ERP.slice(a, ERP.indexOf('\n', ERP.indexOf('}', b)) + 1);

  const calls = { on: [], ref: [] };
  const ref = { on: function (ev) { calls.on.push(ev); } };
  const ctx = {
    fbDb: { ref: function (p) { calls.ref.push(p); return ref; } },
    setTimeout: function () { return 1; }, clearTimeout: function () {},
    Object, JSON, Date, console,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return { ctx, calls };
}

test('①★ 이알피는 «부팅 때» 색인을 받지 않는다 — 1.36MB 가 켤 때마다 내려오던 자리', () => {
  const auth = ERP.slice(ERP.indexOf('firebase.auth().onAuthStateChanged(function(user){'),
                         ERP.indexOf('firebase.auth().onAuthStateChanged(function(user){') + 3000);
  assert.ok(auth.indexOf('watchPucardsIndexByChild()') < 0,
    '★★ 로그인이 끝나자마자 색인을 받으면, 계약창을 한 번도 안 열어도 부팅마다 1.36MB 입니다');
});

test('②★ 처음 «읽는 순간» 받기 시작한다 — 쓰는 자리 여덟 곳을 하나하나 안 고쳐도 되게', () => {
  const { ctx, calls } = loadErpIdx();
  assert.equal(calls.ref.length, 0, '★ 아직 아무도 안 읽었는데 벌써 받습니다');
  const v = ctx.window.pucardsIdx;            // ← 읽는다
  /* ⚠ deepEqual 로 {} 와 견주지 않는다 — vm 안에서 만든 객체는 겉모습이 같아도
     밑틀(prototype)이 달라 엄격 비교에서 늘 깨진다. «비었는가»만 본다. */
  assert.ok(v && Object.keys(v).length === 0, '처음에는 비어 있어야 합니다');
  assert.deepEqual(calls.ref, ['pucards/idx'], '★★ 읽었는데도 안 받으면 검색이 영영 빈손입니다');
  assert.deepEqual(calls.on.sort(), ['child_added', 'child_changed', 'child_removed'],
    '★ 한 건씩 받는 구독이어야 합니다 — value 로 받으면 한 장 고칠 때마다 통째로 다시 옵니다');
  ctx.window.pucardsIdx;                       // 두 번째 읽기
  assert.equal(calls.ref.length, 1, '★ 읽을 때마다 새로 구독하면 같은 것을 여러 벌 받습니다');
});

test('③ 넣어 주는 것도 그대로 된다 — 검사·다른 코드가 가짜 색인을 끼운다', () => {
  const { ctx } = loadErpIdx();
  ctx.window.pucardsIdx = { a1: { n: '홍길동', c: '가나상사' } };
  assert.equal(ctx.window.pucardsIdx.a1.n, '홍길동', '★ 넣은 것이 안 들어가면 여러 검사가 헛돕니다');
});

test('④ 찾기 창은 색인이 도착하면 다시 그린다 — 안 그리면 「0건에서 검색」이 남는다', () => {
  assert.match(ERP, /function usePucardsIdxReady\(\)\{/, '★ 다시 그리는 길이 없습니다');
  assert.match(ERP, /window\.addEventListener\('pucards-idx', on\)/, '★ 도착 신호를 안 듣습니다');
  assert.match(cutFn(ERP, 'function watchPucardsIndexByChild('), /'pucards-idx'/,
    '★ 도착했는데 아무에게도 안 알립니다');
  ['function PucardsContactPickerModal(props){', 'function PucardsCompanyPickerModal(props){']
    .forEach(function (d) {
      assert.match(cutFn(ERP, d).slice(0, 400), /usePucardsIdxReady\(\)/,
        '★ ' + d + ' 가 도착 신호를 안 씁니다');
    });
});

/* ══ 기업정보함 — 「세려고」 통째로 받던 것 ═════════════════════════════ */
function loadBackfill(meta, itemCount) {
  const reads = [], writes = [];
  function refFor(p) {
    return {
      once: function () {
        reads.push(p);
        const val = (p.indexOf('idx_meta') >= 0) ? meta : {};
        return Promise.resolve({ val: function () { return val; } });
      },
      set: function (v) { writes.push({ p: p, n: v && Object.keys(v).length }); return Promise.resolve(); }
    };
  }
  const items = {};
  for (let i = 0; i < itemCount; i++) items['c' + i] = { id: 'c' + i, name: '홍길동' + i, company: '가나상사' };
  const ctx = {
    console, Object, Date, Promise, Number, Array, JSON,
    DB_ROOT: 'pucards',
    Store: { mode: 'firebase', db: { ref: refFor } },
    state: { items: items },
    idxRecord: function (it) { return { n: it.name, c: it.company }; },
    inLockedGroup: function () { return false; },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(CARDS.slice(CARDS.indexOf("const IDX_META = '/idx_meta';"),
                              CARDS.indexOf('\nconst state = {')), ctx);
  return { ctx, reads, writes };
}
const wait = () => new Promise(r => setImmediate(() => setImmediate(() => setImmediate(r))));

test('⑤★★ 적어 둔 것이 싱싱하면 색인을 «통째로 안 받는다» — 세기 위해서만 1.36MB 를 받던 자리', async () => {
  const { ctx, reads } = loadBackfill({ n: 6600, items: 6600, at: Date.now() - 3600000 }, 6600);
  ctx.backfillIdx();
  await wait();
  assert.deepEqual(reads, ['pucards/idx_meta'],
    '★★ 적어 둔 한 칸이면 되는데 1.36MB 를 통째로 받았습니다 — 기업정보함을 켤 때마다입니다');
});

test('⑥ 적어 둔 것이 없으면 예전처럼 통째로 세고, 그 수를 적어 둔다', async () => {
  const { ctx, reads, writes } = loadBackfill(null, 10);
  ctx.backfillIdx();
  await wait();
  assert.ok(reads.indexOf('pucards/idx') >= 0, '★ 적어 둔 것이 없는데 안 세면 색인이 비어도 모릅니다');
  assert.ok(writes.some(w => w.p.indexOf('idx_meta') >= 0),
    '★★ 세고도 안 적어 두면 다음 부팅에 또 1.36MB 를 받습니다');
});

test('⑥ 오래됐으면(30일) 다시 센다 — 스스로 낫는 길을 막지 않는다', async () => {
  const old = Date.now() - 31 * 24 * 3600 * 1000;
  const { ctx, reads } = loadBackfill({ n: 6600, items: 6600, at: old }, 6600);
  ctx.backfillIdx();
  await wait();
  assert.ok(reads.indexOf('pucards/idx') >= 0, '★ 영영 안 세면 색인이 망가져도 아무도 모릅니다');
});

test('⑥ 명함이 훌쩍 늘면 다시 센다 — 새 명함이 검색에서 빠지면 안 된다', async () => {
  const { ctx, reads } = loadBackfill({ n: 100, items: 100, at: Date.now() }, 200);
  ctx.backfillIdx();
  await wait();
  assert.ok(reads.indexOf('pucards/idx') >= 0, '★ 100곳이 200곳이 됐는데 그냥 지나갑니다');
});
