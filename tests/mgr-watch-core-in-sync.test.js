'use strict';
/* 🔎 담당 점검 — 서버가 10분마다 (2026-10-07 기업정보함 점검 ③)
   ① 서버의 셈 사본(functions/mgr-watch-core/)이 화면 원본(js/pu-mgr-watch-core.js)과 «한 글자까지» 같다
      — 다르면 화면과 서버가 바뀐 담당을 다르게 센다. 고칠 곳은 js/ 쪽: node scripts/sync-mgr-watch-core.js
   ② 서버 함수가 실제로 돈다 — 가짜 서버로: 바뀐 것을 «전 → 새»로 적고, 업체를 거의 못 읽으면 건너뛴다
   ③ 배포 목록(index.js)에 올라 있다 — 안 올리면 «함수가 아예 안 올라간다»
   ⚠ 예시는 가짜다(가나상사). */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { 옮길것 } = require('../scripts/sync-mgr-watch-core.js');

const 뿌리 = path.join(__dirname, '..');
const 읽기 = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

test('★★★ 서버 사본이 화면 원본과 같다 — 다르면 화면과 서버가 바뀐 담당을 다르게 센다', () => {
  assert.ok(옮길것.indexOf('pu-mgr-watch-core.js') >= 0);
  옮길것.forEach((이름) => {
    const 사본 = path.join(뿌리, 'functions', 'mgr-watch-core', 이름);
    assert.ok(fs.existsSync(사본), '사본이 없다 — node scripts/sync-mgr-watch-core.js 를 돌려 주세요');
    assert.ok(읽기(path.join(뿌리, 'js', 이름)) === 읽기(사본),
      '★★★ functions/mgr-watch-core/' + 이름 + ' 이 js/ 원본과 다릅니다 — 고칠 곳은 js/ 쪽, 고친 뒤 sync 를 돌리고 mgrWatch 를 다시 올려 주세요');
  });
});

function fakeDb(tree) {
  const writes = [];
  const get = (p) => p.split('/').reduce((o, k) => (o == null ? undefined : o[k]), tree);
  return { writes, ref: (p) => (p === undefined
    ? { update: async (u) => { writes.push(u); } }
    : { once: async () => ({ val: () => { const v = get(p); return v === undefined ? null : JSON.parse(JSON.stringify(v)); } }) }) };
}
/* 파이어베이스 함수 꾸밈새 흉내 — 정기 실행을 거는 사슬만 */
const chain = { runWith: () => chain, pubsub: { schedule: () => ({ timeZone: () => ({ onRun: (f) => f }) }) } };
const FN = { region: () => chain };
const 업체들 = (n) => Array.from({ length: n }, (_, i) => ({ id: 'co' + i, name: '업체' + i, managerMain: 'P-001' }));

test('★★★ 서버가 바뀐 담당을 «전 → 새»로 적는다 — 이알피 업체 기록은 안 쓴다', async () => {
  const cos = 업체들(60); cos[0].name = '가나상사'; cos[0].managerMain = 'P-002';
  const v = {}; cos.forEach((c) => { v[c.id] = c; });
  const seen = {}; cos.forEach((c) => { seen[c.id] = 'P-001'; });
  const db = fakeDb({ data: { companies: { v } }, pucards: { config: { mgrSeen: seen, mgrChange: {} } } });
  const M = require('../functions/mgr-watch.js')({ getDatabase: () => db, functions: FN });
  const r = await M.watchOnce(123);
  assert.equal(r.n, 1);
  const up = db.writes[0];
  assert.deepEqual(up['pucards/config/mgrChange/co0'], { co: 'co0', coName: '가나상사', from: 'P-001', to: 'P-002', at: 123 });
  assert.equal(up['pucards/config/mgrSeen/co0'], 'P-002');
  assert.ok(Object.keys(up).every((k) => k.indexOf('pucards/config/mgr') === 0), '★★★ 이알피 업체 기록이나 다른 자리를 씁니다');
});

test('★★ 업체를 거의 못 읽으면 «그 회차를 건너뛴다» — 기준을 비우면 다음에 모든 업체가 «처음»이 된다', async () => {
  const db = fakeDb({ data: { companies: { v: { co1: { id: 'co1', managerMain: 'P-1' } } } }, pucards: { config: {} } });
  const M = require('../functions/mgr-watch.js')({ getDatabase: () => db, functions: FN });
  const r = await M.watchOnce(1);
  assert.equal(r.skipped, true);
  assert.equal(db.writes.length, 0);
});

test('★ 배포 목록에 올라 있다 — 업무 시간 10분마다', () => {
  const idx = 읽기(path.join(뿌리, 'functions', 'index.js'));
  assert.match(idx, /exports\.mgrWatch = MGRW\.mgrWatch;/, '★ index.js 에 안 적으면 함수가 아예 안 올라간다');
  const src = 읽기(path.join(뿌리, 'functions', 'mgr-watch.js'));
  assert.match(src, /require\("\.\/mgr-watch-core\/pu-mgr-watch-core\.js"\)/, '서버는 사본(한 벌)을 써야 한다 — 셈을 베껴 넣지 않는다');
  assert.match(src, /pubsub\.schedule\("\*\/10 7-21 \* \* \*"\)/);
});
