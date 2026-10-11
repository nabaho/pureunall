'use strict';
/* 계약서 양식 묶음은 «바뀌었을 때만» 받는다 (2026-10-11 대표 「비용이 너무 많이 증가하는데 해결 방법 없나」)

   ■ 무엇이 있었나
     양식 62개가 3.4MB(96% 가 첨부 원본 base64). 문서관리 화면을 열 때마다·서류를 채울 때마다 통째로 받았다 —
     실측 3분에 8번 · 29.6MB, 그 3분 내려받기의 93%. 실시간DB 는 내려받은 양만큼 돈이 든다.
   ■ 규칙
     ⓐ 처음엔 통째 받고, 같은 판(u)이면 이 창에서는 다시 안 받는다.
     ⓑ 새 창(새로 연 화면)도 이 기기에 적어 둔 판(IndexedDB)이 같으면 안 받는다.
     ⓒ 누가 고쳐 u 가 바뀌면 다시 받는다 — 낡은 양식을 쓰면 안 된다.
     ⓓ u 가 없거나 u 를 못 읽으면 예전처럼 통째 받는다(안전한 쪽).
     ⓔ 돌려준 것을 고쳐도 보관본은 그대로다.
     ⓕ 내가 저장(changeForms)한 뒤에는 그 판을 바로 기억한다 — 저장 직후 다시 열어도 안 받는다.
   가짜 자료만 쓴다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-contract-forms.js'), 'utf8');

const PATH = 'data/contract_forms', PATH_RM = 'data/contract_forms_removed';
const tick = () => new Promise((r) => setTimeout(r, 5));

/* 가짜 IndexedDB — 열기·읽기·쓰기만, 모두 비동기 */
function fakeIDB(store) {
  let made = false;
  return {
    open() {
      const rq = {};
      setTimeout(() => {
        const db = {
          createObjectStore() { made = true; },
          transaction() {
            const tx = {
              objectStore() {
                return {
                  get(k) { const r = {}; setTimeout(() => { r.result = store[k] === undefined ? undefined : JSON.parse(JSON.stringify(store[k])); r.onsuccess && r.onsuccess(); }); return r; },
                  put(v, k) { store[k] = JSON.parse(JSON.stringify(v)); setTimeout(() => tx.oncomplete && tx.oncomplete()); }
                };
              }
            };
            return tx;
          },
          close() {}
        };
        rq.result = db;
        if (!made && rq.onupgradeneeded) rq.onupgradeneeded();
        rq.onsuccess && rq.onsuccess();
      });
      return rq;
    }
  };
}
/* 가짜 실시간DB — 자리마다 몇 번 받았는지 센다 */
function fakeDb(data, opt) {
  const count = {};
  return {
    count,
    data,
    ref(p) {
      return {
        once() {
          count[p] = (count[p] || 0) + 1;
          if (opt && opt.failU && p === PATH + '/u') return Promise.reject(new Error('읽기 막힘'));
          let v;
          if (p === PATH + '/u') v = data[PATH] ? data[PATH].u : null;
          else v = data[p] === undefined ? null : data[p];
          v = v == null ? null : JSON.parse(JSON.stringify(v));
          return Promise.resolve({ val: () => v });
        },
        transaction(fn, cb) {
          const cur = data[p] == null ? null : JSON.parse(JSON.stringify(data[p]));
          const nv = fn(cur);
          data[p] = nv;
          setTimeout(() => cb(null, true, { val: () => JSON.parse(JSON.stringify(nv)) }));
        }
      };
    }
  };
}
/* 화면 하나 = 모듈 한 벌(보관 메모리가 따로). idbStore 를 함께 쓰면 «같은 기기»다 */
function page(idbStore) {
  const win = {};
  if (idbStore) win.indexedDB = fakeIDB(idbStore);
  const ctx = vm.createContext({ window: win, console, setTimeout, clearTimeout, Promise, JSON, Math, Date });
  vm.runInContext(SRC, ctx);
  return win.PuContractForms;
}
const form = (id, name) => ({ id, name, kind: 'case', attachments: [{ id: 'a' + id, name: name + '.hwp', data: 'data:;base64,AAAA' }] });
const serverData = (u) => ({ [PATH]: { u, v: [form('t1', '가나상사 위임계약서'), form('t2', '홍길동 근로계약서')] }, [PATH_RM]: { u: 1, v: [] } });

test('ⓐ 같은 창에서 두 번째부터는 13바이트(u)만 읽는다', async () => {
  const db = fakeDb(serverData(1000));
  const C = page(null);
  const a = await C.formsValue(db);
  const b = await C.formsValue(db);
  assert.equal(db.count[PATH], 1, '양식 묶음 통째 받기는 한 번뿐이어야 한다');
  assert.equal(db.count[PATH + '/u'], 2);
  assert.equal(a.v.length, 2); assert.equal(b.v[0].name, '가나상사 위임계약서');
});

test('ⓐ 화면이 쓰는 loadForms 도 같은 길 — 두 번 불러도 통째는 한 번', async () => {
  const db = fakeDb(serverData(1000));
  const C = page(null);
  const l1 = await C.loadForms(db), l2 = await C.loadForms(db);
  assert.equal(db.count[PATH], 1);
  assert.ok(l1.some((f) => f.id === 't1') && l2.some((f) => f.id === 't2'));
});

test('ⓑ 새로 연 화면도 이 기기에 적어 둔 판이 같으면 안 받는다', async () => {
  const store = {};
  const db = fakeDb(serverData(2000));
  await page(store).formsValue(db);
  await tick(); await tick();                       // 기기에 적기(비동기)가 끝나게
  assert.equal(db.count[PATH], 1);
  const v = await page(store).formsValue(db);       // 새 화면
  assert.equal(db.count[PATH], 1, '새 화면이 기기 보관본을 두고 또 받으면 안 된다');
  assert.equal(v.v[1].name, '홍길동 근로계약서');
});

test('ⓒ 누가 고쳐 u 가 바뀌면 다시 받는다 — 메모리·기기 보관본 둘 다 버린다', async () => {
  const store = {};
  const db = fakeDb(serverData(3000));
  const C = page(store);
  await C.formsValue(db); await tick(); await tick();
  db.data[PATH] = { u: 3001, v: [form('t9', '새 양식')] };
  const v = await C.formsValue(db);
  assert.equal(db.count[PATH], 2);
  assert.equal(v.v[0].name, '새 양식');
  await tick(); await tick();
  const v2 = await page(store).formsValue(db);      // 새 화면도 새 판을 본다
  assert.equal(v2.v[0].name, '새 양식');
  assert.equal(db.count[PATH], 2, '새 판을 적어 뒀으니 새 화면은 또 받지 않는다');
});

test('ⓓ u 가 없으면 매번 통째 받는다(예전과 같다)', async () => {
  const d = serverData(1); delete d[PATH].u;
  const db = fakeDb(d);
  const C = page(null);
  await C.formsValue(db); await C.formsValue(db);
  assert.equal(db.count[PATH], 2);
});

test('ⓓ u 를 못 읽으면 통째 받는다 — 화면은 그대로 뜬다', async () => {
  const db = fakeDb(serverData(5000), { failU: true });
  const C = page(null);
  const v = await C.formsValue(db);
  assert.equal(v.v.length, 2);
  assert.equal(db.count[PATH], 1);
});

test('ⓓ 기기 보관본이 다른 판이면 버리고 받는다', async () => {
  const store = { contract_forms: { u: 1, val: { u: 1, v: [form('old', '낡은 양식')] } } };
  const db = fakeDb(serverData(6000));
  const v = await page(store).formsValue(db);
  assert.equal(db.count[PATH], 1);
  assert.equal(v.v[0].name, '가나상사 위임계약서');
});

test('ⓔ 돌려준 것을 고쳐도 보관본은 그대로', async () => {
  const db = fakeDb(serverData(7000));
  const C = page(null);
  const a = await C.formsValue(db);
  a.v[0].name = '망가뜨림'; a.v.length = 0;
  const b = await C.formsValue(db);
  assert.equal(b.v.length, 2);
  assert.equal(b.v[0].name, '가나상사 위임계약서');
});

test('ⓕ 내가 저장한 판은 바로 기억한다 — 저장 직후 다시 열어도 통째 안 받는다', async () => {
  const db = fakeDb(serverData(8000));
  const C = page(null);
  await C.formsValue(db);
  await C.changeForms(db, [], (list) => list.concat([form('t3', '새로 넣은 양식')]));
  const v = await C.formsValue(db);
  assert.equal(db.count[PATH], 1, '저장 뒤에 또 통째 받으면 안 된다');
  assert.ok(v.v.some((f) => f.id === 't3'), '저장한 것이 보여야 한다');
  assert.equal(v.u, db.data[PATH].u);
});

test('통째 받기 자리는 formsValue 한 곳뿐 — 다른 곳에서 once 로 다시 받지 않는다', () => {
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const hits = code.match(/ref\(PATH\)\.once\(/g) || [];
  assert.equal(hits.length, 1, 'ref(PATH).once( 는 formsValue 의 «통째 받기» 한 곳이어야 한다');
});
