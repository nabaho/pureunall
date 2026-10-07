'use strict';
/* 큰 사본 창고(js/pu-big-store.js) — localStorage 에서 IndexedDB 로 옮길 때 «잃는 길이 없다»
   (2026-10-07 대표 크롬: localStorage 5,242,346자(한도)가 차서 경력관리가 목록을 못 적었다)

   지키는 것
   ① 차례: 옛 자리 읽기 → 새 자리 쓰기(끝났다는 답까지) → 다시 읽어 견주기 → 그때만 옛 자리 지우기
   ② 새 자리 쓰기 실패·다시 읽어 다름·그 사이 옛 자리가 바뀜 → 옛 자리를 «그대로» 둔다
   ③ 옛 자리에 값이 남아 있으면 그것이 이긴다(옛 판 화면이 적은 것일 수 있다)
   ④ 켜지는 중·IndexedDB 를 못 쓰는 브라우저 → 예전 그대로 localStorage(공간이 없으면 예전처럼 던진다)
   ⑤ 켜진 뒤 새 자리 쓰기가 실패하면 옛 자리에라도, 그것도 안 되면 낡은 옛 값을 지우고 알린다
   ⑥ IndexedDB 가 답하지 않으면 시간 안에 «못 씀»으로 정한다 — 앱이 영영 안 뜨는 일이 없다 */
const test = require('node:test');
const assert = require('node:assert');
const Big = require('../js/pu-big-store.js');

/* 크기 한도가 있는 가짜 localStorage — 넘치면 진짜처럼 QuotaExceededError */
function lsFake(cap) {
  const m = {}, log = [];
  const size = () => Object.keys(m).reduce((a, k) => a + k.length + m[k].length, 0);
  return {
    log, _m: m,
    getItem: (k) => { log.push('ls.get ' + k); return k in m ? m[k] : null; },
    setItem: (k, v) => {
      log.push('ls.set ' + k);
      const old = k in m ? m[k] : null; m[k] = String(v);
      if (cap && size() > cap) {
        if (old === null) delete m[k]; else m[k] = old;
        const e = new Error('full'); e.name = 'QuotaExceededError'; throw e;
      }
    },
    removeItem: (k) => { log.push('ls.remove ' + k); delete m[k]; },
  };
}
/* 가짜 창고(get/put/del) — 실패·뒤틀림을 끼워 넣을 수 있다 */
function storeFake(o) {
  o = o || {};
  const m = new Map(), log = [];
  return {
    log, _m: m,
    get: async (k) => { log.push('idb.get ' + k); return m.has(k) ? m.get(k) : null; },
    put: async (k, v) => {
      log.push('idb.put ' + k);
      if (o.failPut) throw Object.assign(new Error('idb full'), { name: 'QuotaExceededError' });
      m.set(k, o.corrupt ? v.slice(0, -1) : v);
    },
    del: async (k) => { log.push('idb.del ' + k); m.delete(k); },
  };
}
/* 아주 작은 가짜 IndexedDB — open()·거래 끝(oncomplete)까지 진짜 모양대로 돈다 */
function idbFake(o) {
  o = o || {};
  const dbs = {};
  return {
    dbs,
    open(name) {
      const req = {};
      if (o.hang) return req;                       // 답하지 않는 브라우저
      setTimeout(() => {
        let fresh = false;
        if (!dbs[name]) { dbs[name] = { stores: {} }; fresh = true; }
        const d = dbs[name];
        const db = {
          objectStoreNames: { contains: (n) => n in d.stores },
          createObjectStore: (n) => { d.stores[n] = new Map(); },
          close() {},
          transaction(n, mode) {
            const s = d.stores[n], ops = [], t = {};
            setTimeout(() => {
              if (o.failPut && ops.length) { t.error = new Error('abort'); t.onabort && t.onabort(); return; }
              ops.forEach((f) => f()); t.oncomplete && t.oncomplete();
            }, 0);
            t.objectStore = () => ({
              get(k) { const r = {}; queueMicrotask(() => { r.result = s.has(k) ? s.get(k) : undefined; r.onsuccess && r.onsuccess(); }); return r; },
              put(v, k) { if (mode !== 'readwrite') throw new Error('readonly'); ops.push(() => s.set(k, v)); return {}; },
              delete(k) { ops.push(() => s.delete(k)); return {}; },
            });
            return t;
          },
        };
        req.result = db;
        if (fresh && req.onupgradeneeded) req.onupgradeneeded();
        req.onsuccess && req.onsuccess();
      }, 0);
      return req;
    },
  };
}

test('① 차례: 읽기 → 쓰기 → 다시 읽기 → 그때만 옛 자리 지우기', async () => {
  const ls = lsFake(), st = storeFake();
  ls._m.big = 'A'.repeat(50);
  const r = await Big.moveFromLs(st, ls, 'big');
  assert.equal(r.moved, true);
  assert.equal(r.value, 'A'.repeat(50));
  assert.equal(ls._m.big, undefined, '옮긴 뒤 옛 자리를 비워야 자리가 생깁니다');
  assert.equal(st._m.get('big'), 'A'.repeat(50));
  const all = ls.log.concat(st.log);
  /* 지우기는 «쓰기와 다시 읽기 뒤»여야 한다 — 두 기록을 시각 없이 견주므로 창고 기록 안의 차례와 지우기 «있음»을 본다 */
  assert.deepEqual(st.log, ['idb.put big', 'idb.get big'], '쓰고 나서 다시 읽어 견줘야 합니다');
  assert.ok(all.includes('ls.remove big'));
});

test('① 지우기는 정말 «쓰기·견주기 뒤»에 일어난다 (한 줄 기록)', async () => {
  const log = [];
  const ls = { getItem: (k) => (log.push('ls.get'), 'V'), removeItem: () => log.push('ls.remove'), setItem() {} };
  const st = { put: async () => { log.push('idb.put'); }, get: async () => { log.push('idb.get'); return 'V'; } };
  await Big.moveFromLs(st, ls, 'k');
  assert.deepEqual(log, ['ls.get', 'idb.put', 'idb.get', 'ls.get', 'ls.remove'],
    '★★ 새 자리를 확인하기 전에 옛 자리를 지우면, 쓰기가 실패한 순간 자료가 «아무 데도» 없습니다');
});

test('② 새 자리 쓰기 실패 → 옛 자리 그대로', async () => {
  const ls = lsFake(), st = storeFake({ failPut: true });
  ls._m.big = 'payload';
  const r = await Big.moveFromLs(st, ls, 'big');
  assert.equal(r.moved, false); assert.equal(r.why, 'write');
  assert.equal(ls._m.big, 'payload', '★★ 못 옮겼는데 지우면 잃습니다');
  assert.equal(r.value, 'payload', '믿을 값은 옛 자리 값입니다');
});

test('② 다시 읽으니 다르다 → 옛 자리 그대로', async () => {
  const ls = lsFake(), st = storeFake({ corrupt: true });
  ls._m.big = 'payload';
  const r = await Big.moveFromLs(st, ls, 'big');
  assert.equal(r.moved, false); assert.equal(r.why, 'verify');
  assert.equal(ls._m.big, 'payload');
});

test('② 옮기는 사이 옛 자리가 바뀌었다 → 지우지 않고 새것을 믿는다', async () => {
  const ls = lsFake();
  ls._m.big = 'old';
  const st = storeFake();
  const put = st.put;
  st.put = async (k, v) => { await put(k, v); ls._m.big = 'newer'; };   // 그 사이 다른 탭이 적었다
  const r = await Big.moveFromLs(st, ls, 'big');
  assert.equal(r.moved, false); assert.equal(r.why, 'changed');
  assert.equal(ls._m.big, 'newer'); assert.equal(r.value, 'newer');
});

test('옛 자리가 비어 있으면 아무것도 안 한다', async () => {
  const ls = lsFake(), st = storeFake();
  const r = await Big.moveFromLs(st, ls, 'none');
  assert.equal(r.why, 'none'); assert.equal(st.log.length, 0);
});

test('켜기: 옛 자리 것을 옮기고, 없으면 새 자리 것을 읽는다 · 아무 데도 없으면 «없음»으로 알린다', async () => {
  const ls = lsFake(), st = storeFake();
  ls._m.a = 'from-ls';
  st._m.set('b', 'from-idb');
  const mm = Big.mirror({ keys: ['a', 'b', 'c'], ls, open: async () => st });
  assert.equal(mm.state, 'wait');
  const rep = await mm.boot();
  assert.equal(mm.state, 'on');
  assert.equal(mm.get('a'), 'from-ls'); assert.equal(mm.get('b'), 'from-idb'); assert.equal(mm.get('c'), null);
  assert.equal(ls._m.a, undefined, '옮긴 것은 옛 자리에서 빠져야 합니다');
  assert.deepEqual(rep.missing, ['c'], '«없음»을 알려야 부르는 쪽이 받은 시각을 지워 서버에서 다시 받습니다');
});

test('③ 옛 자리에 값이 있으면 새 자리의 옛 값보다 이긴다', async () => {
  const ls = lsFake(), st = storeFake();
  st._m.set('a', 'stale-idb');
  ls._m.a = 'fresh-ls';
  const mm = Big.mirror({ keys: ['a'], ls, open: async () => st });
  await mm.boot();
  assert.equal(mm.get('a'), 'fresh-ls');
  assert.equal(st._m.get('a'), 'fresh-ls');
});

test('③ 켜지는 사이 옛 자리에 새로 적힌 것도 이긴다', async () => {
  const ls = lsFake(), st = storeFake();
  st._m.set('a', 'idb');
  const get = st.get;
  st.get = async (k) => { const v = await get(k); ls._m.a = 'written-during-boot'; return v; };
  const mm = Big.mirror({ keys: ['a'], ls, open: async () => st });
  await mm.boot();
  assert.equal(mm.get('a'), 'written-during-boot');
  await mm.flush();
  assert.equal(st._m.get('a'), 'written-during-boot', '다시 옮겨 둬야 다음에 켤 때도 이 값입니다');
  assert.equal(ls._m.a, undefined);
});

test('켜진 뒤 쓰기: 메모리에 바로, 새 자리에는 뒤에서 — localStorage 는 안 쓴다', async () => {
  const ls = lsFake(10), st = storeFake();
  const mm = Big.mirror({ keys: ['a'], ls, open: async () => st });
  await mm.boot();
  mm.set('a', 'X'.repeat(1000));   // localStorage 한도(10자)를 크게 넘는다
  assert.equal(mm.get('a'), 'X'.repeat(1000), '쓴 즉시 읽혀야 합니다');
  await mm.flush();
  assert.equal(st._m.get('a'), 'X'.repeat(1000));
  assert.equal(ls._m.a, undefined);
  mm.remove('a');
  await mm.flush();
  assert.equal(mm.get('a'), null); assert.equal(st._m.has('a'), false);
});

test('④ 켜지는 중에는 예전 그대로 — 공간이 없으면 예전처럼 던진다', async () => {
  const ls = lsFake(10), st = storeFake();
  const mm = Big.mirror({ keys: ['a'], ls, open: async () => st });
  assert.throws(() => mm.set('a', 'X'.repeat(100)), /full/, '부르는 쪽의 공간 부족 처리가 예전처럼 돌아야 합니다');
  mm.set('a', 'ok');
  assert.equal(ls._m.a, 'ok');
  await mm.boot();
  assert.equal(mm.get('a'), 'ok'); assert.equal(ls._m.a, undefined, '켜지면서 옮겨집니다');
});

test('④ IndexedDB 를 못 쓰면 off — 예전 그대로 localStorage, 비어 있는 칸은 «없음»', async () => {
  const ls = lsFake();
  ls._m.a = 'here';
  const mm = Big.mirror({ keys: ['a', 'b'], ls, open: async () => null });
  const rep = await mm.boot();
  assert.equal(mm.state, 'off');
  assert.equal(mm.get('a'), 'here');
  mm.set('b', 'v'); assert.equal(ls._m.b, 'v');
  assert.deepEqual(rep.missing, ['b']);
});

test('⑤ 켜진 뒤 새 자리 쓰기 실패 → 옛 자리에라도 적는다', async () => {
  const ls = lsFake(), st = storeFake();
  const mm = Big.mirror({ keys: ['a'], ls, open: async () => st });
  await mm.boot();
  st.put = async () => { throw new Error('idb broken'); };
  mm.set('a', 'v1');
  await mm.flush();
  assert.equal(ls._m.a, 'v1', '아무 데도 안 남으면 다음에 켤 때 잃습니다');
});

test('⑤ 둘 다 못 적으면 낡은 옛 값을 지우고 알린다', async () => {
  const ls = lsFake(20), st = storeFake();
  const told = [];
  const mm = Big.mirror({ keys: ['a'], ls, open: async () => st, onWriteFail: (k) => told.push(k) });
  await mm.boot();
  ls._m.a = 'stale';                 // 옛 판 화면이 남긴 낡은 값
  st.put = async () => { throw new Error('idb broken'); };
  mm.set('a', 'Y'.repeat(100));      // localStorage 에도 안 들어간다
  await mm.flush();
  assert.equal(ls._m.a, undefined, '★ 낡은 값을 남기면 다음에 켤 때 «옛 자리가 이긴다»로 되살아납니다');
  assert.deepEqual(told, ['a'], '알려야 부르는 쪽이 받은 시각을 지우고 사람에게 말합니다');
  assert.equal(mm.get('a'), 'Y'.repeat(100), '이번 화면은 방금 것을 읽습니다');
});

test('진짜 모양의 IndexedDB 로 한 바퀴 — 옮기고, 새로 열어도 남아 있다', async () => {
  const idb = idbFake();
  const ls = lsFake();
  ls._m['pureun_v6_contract_forms'] = '[{"id":"f1"}]';
  const m1 = Big.mirror({ keys: ['pureun_v6_contract_forms'], ls, idb, name: 't1' });
  await m1.boot();
  assert.equal(m1.state, 'on');
  assert.equal(ls._m['pureun_v6_contract_forms'], undefined);
  m1.set('pureun_v6_contract_forms', '[{"id":"f2"}]');
  await m1.flush();
  const m2 = Big.mirror({ keys: ['pureun_v6_contract_forms'], ls, idb, name: 't1' });
  await m2.boot();
  assert.equal(m2.get('pureun_v6_contract_forms'), '[{"id":"f2"}]', '다음에 켜도 새 자리에서 읽혀야 합니다');
});

test('진짜 모양: 거래가 중단되면(쓰기 실패) 옛 자리를 지우지 않는다', async () => {
  const idb = idbFake({ failPut: true });
  const ls = lsFake();
  ls._m.k = 'keep-me';
  const st = await Big.open({ idb, name: 't2' });
  const r = await Big.moveFromLs(st, ls, 'k');
  assert.equal(r.moved, false);
  assert.equal(ls._m.k, 'keep-me');
});

test('⑥ IndexedDB 가 답하지 않으면 시간 안에 «못 씀»', async () => {
  const st = await Big.open({ idb: idbFake({ hang: true }), timeoutMs: 30 });
  assert.equal(st, null, '앱이 이것을 기다리며 영영 안 뜨면 안 됩니다');
  const mm = Big.mirror({ keys: ['a'], ls: lsFake(), idb: idbFake({ hang: true }), timeoutMs: 30 });
  await mm.boot();
  assert.equal(mm.state, 'off');
});
