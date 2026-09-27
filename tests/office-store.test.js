'use strict';
/* 사무관리서류 원본 보관함·기업별 계약서 — 저장 층 (설계 docs/superpowers/specs/2026-09-27-사무관리서류-개편-design.md §4·§5)
   ■ 지키는 것
     ⓐ 같은 파일은 두 번 담지 않는다 — 해시로 찾아 같은 fileId 를 돌려준다.
     ⓑ 창고가 실패하면 색인·해시를 안 쓴다 — 없는 파일을 가리키는 색인이 생기면 안 된다.
     ⓒ 해시는 맨 마지막에 쓴다 — 중간에 끊겨도 다음 시도가 새로 담는다.
     ⓓ 기업 이름 표기가 달라도(㈜·주식회사·공백) 한 칸으로 모인다.
     ⓔ RTDB 에 undefined 를 안 넣는다. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');
const { webcrypto } = require('crypto');

const R = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(R, 'js/pu-office-store.js'), 'utf8');

function load() {
  const box = { console, Date, Math, JSON, Promise, Object, Array, String, Number, Error, Uint8Array, atob: (s) => Buffer.from(s, 'base64').toString('binary'), crypto: webcrypto };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(SRC, box);
  return box.PuOfficeStore;
}
const out = (v) => JSON.parse(JSON.stringify(v));

/* 가짜 실시간DB — 경로 문자열 한 겹 지도. undefined 가 들어오면 파이어베이스처럼 던진다 */
function fakeDb() {
  const store = {};
  let seq = 0;
  function noUndef(v, p) {
    if (v === undefined) throw new Error('undefined at ' + p);
    if (v && typeof v === 'object') Object.keys(v).forEach((k) => noUndef(v[k], p + '/' + k));
  }
  function kids(p) {
    const pre = p + '/', o = {};
    Object.keys(store).forEach((k) => { if (k.indexOf(pre) === 0) { const rest = k.slice(pre.length).split('/')[0]; o[rest] = true; } });
    return Object.keys(o);
  }
  function get(p) {
    let result = store[p];
    if (result !== undefined) {
      result = JSON.parse(JSON.stringify(result));
    }
    const ks = kids(p);
    if (!ks.length) {
      if (result !== undefined) return result;
      return null;
    }
    // We have child keys — merge with parent if it exists
    if (result === undefined) {
      const o = {};
      ks.forEach((k) => { o[k] = get(p + '/' + k); });
      return o;
    } else {
      // Merge: overlay child keys on parent object
      ks.forEach((k) => { result[k] = get(p + '/' + k); });
      return result;
    }
  }
  function put(p, v) {
    Object.keys(store).forEach((k) => { if (k === p || k.indexOf(p + '/') === 0) delete store[k]; });
    if (v !== null) store[p] = JSON.parse(JSON.stringify(v));
  }
  const db = {
    store, failSetAt: null,
    ref(p) {
      return {
        key: p.split('/').pop(),
        push() { seq++; const k = 'k' + String(seq).padStart(4, '0'); return db.ref(p + '/' + k); },
        once() { return Promise.resolve({ val: () => get(p), exists: () => get(p) != null }); },
        set(v) { noUndef(v, p); if (db.failSetAt && p.indexOf(db.failSetAt) === 0) return Promise.reject(new Error('PERMISSION_DENIED')); put(p, v); return Promise.resolve(); },
        update(v) { noUndef(v, p); Object.keys(v).forEach((k) => put(p + '/' + k, v[k])); return Promise.resolve(); },
        remove() { put(p, null); return Promise.resolve(); },
        transaction(fn) { const next = fn(get(p)); noUndef(next, p); put(p, next); return Promise.resolve({ committed: true, snapshot: { val: () => get(p) } }); },
        limitToFirst() { return { once: () => Promise.resolve({ val: () => get(p) }) }; }
      };
    }
  };
  return db;
}
function fakeStorage() {
  const files = {};
  const st = {
    files, puts: 0, fail: false,
    ref(p) {
      return {
        put(bytes, meta) { st.puts++; if (st.fail) return Promise.reject(Object.assign(new Error('storage/unauthorized'), { code: 'storage/unauthorized' })); files[p] = { bytes, meta }; return Promise.resolve(); },
        getDownloadURL() { return files[p] ? Promise.resolve('https://example.test/' + p) : Promise.reject(new Error('404')); }
      };
    }
  };
  return st;
}
function file(name, text) { const b = new Uint8Array(Buffer.from(text)); return { name, size: b.length, type: 'application/x-hwp', bytes: b }; }

test('ⓓ 기업 이름 표기가 달라도 한 칸', () => {
  const S = load();
  assert.equal(S.coKey('(주)가나상사'), S.coKey('가나상사'));
  assert.equal(S.coKey('㈜ 가나 상사'), S.coKey('가나상사'));
  assert.equal(S.coKey('주식회사 가나상사'), S.coKey('가나상사'));
  assert.equal(S.coKey('유한회사 다라'), S.coKey('다라'));
  assert.equal(S.coKey('A.B/C#D$E[F]'), 'a_b_c_d_e_f_');
  assert.equal(S.coKey('   '), '');
});

test('종류·크기 검사', () => {
  const S = load();
  assert.equal(S.okDocFile('a.hwp', 10).ok, true);
  assert.equal(S.okDocFile('a.HWPX', 10).ok, true);
  assert.equal(S.okDocFile('scan.JPG', 10).ok, true);
  assert.equal(S.okDocFile('a.exe', 10).ok, false);
  assert.equal(S.okDocFile('a.html', 10).ok, false);
  assert.equal(S.okDocFile('noext', 10).ok, false);
  assert.equal(S.okDocFile('a.pdf', 0).ok, false);
  assert.equal(S.okDocFile('a.pdf', 25 * 1024 * 1024).ok, false);
  assert.equal(S.okDocFile('a.pdf', 25 * 1024 * 1024 - 1).ok, true);
  assert.equal(S.safeFileName('a/b\\c#d?.hwp'), 'a_b_c_d_.hwp');
});

test('sha256Hex 는 64자 16진수이고 같은 바이트면 같다', async () => {
  const S = load();
  const a = await S.sha256Hex(new Uint8Array([1, 2, 3]));
  const b = await S.sha256Hex(new Uint8Array([1, 2, 3]));
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(a, b);
  assert.equal(a, '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81');
});

test('dataUrlToBytes', () => {
  const S = load();
  assert.deepEqual(Array.from(S.dataUrlToBytes('data:x;base64,AQID')), [1, 2, 3]);
});

test('ⓐ 같은 파일 두 번 → 창고 1번·색인 1개·같은 fileId', async () => {
  const S = load(); const db = fakeDb(); const st = fakeStorage();
  S.init({ db, storage: st, uid: 'u1', name: '홍길동' });
  const from = { kind: 'form', formId: 'fm-1', formName: '자문계약서', formKind: 'company' };
  const r1 = await S.putOriginal(file('자문.hwp', 'same'), from);
  const r2 = await S.putOriginal(file('자문(복사).hwp', 'same'), from);
  assert.equal(st.puts, 1, '★★ 같은 파일을 창고에 두 번 올렸습니다');
  assert.equal(r1.fileId, r2.fileId);
  assert.equal(r1.reused, false); assert.equal(r2.reused, true);
  const list = await S.listOriginals();
  assert.equal(list.length, 1);
  const rec = out(list[0]);
  assert.equal(rec.id, r1.fileId);
  assert.equal(rec.name, '자문.hwp');
  assert.equal(rec.by, 'u1'); assert.equal(rec.byName, '홍길동');
  assert.equal(rec.path, 'pu_docs/originals/' + r1.fileId + '/자문.hwp');
  assert.deepEqual(rec.from, from);
  assert.ok(st.files[rec.path], '창고에 그 자리로 안 들어갔습니다');
});

test('ⓑ 창고가 실패하면 색인·해시를 안 쓴다', async () => {
  const S = load(); const db = fakeDb(); const st = fakeStorage(); st.fail = true;
  S.init({ db, storage: st, uid: 'u1', name: '홍길동' });
  await assert.rejects(S.putOriginal(file('a.pdf', 'x'), { kind: 'co', coKey: 'k', coName: '가나상사' }));
  assert.equal(Object.keys(db.store).filter((k) => k.indexOf('pu_docs/') === 0).length, 0, '★★ 없는 파일을 가리키는 색인이 생겼습니다');
});

test('ⓒ 색인에서 끊기면 해시가 없어 다음 시도가 새로 담는다', async () => {
  const S = load(); const db = fakeDb(); const st = fakeStorage();
  S.init({ db, storage: st, uid: 'u1', name: '홍길동' });
  db.failSetAt = 'pu_docs/originals/';
  await assert.rejects(S.putOriginal(file('a.pdf', 'y'), { kind: 'co', coKey: 'k', coName: '가나상사' }));
  assert.equal(Object.keys(db.store).filter((k) => k.indexOf('pu_docs/hash/') === 0).length, 0, '★ 해시를 먼저 써서 다음 시도가 없는 색인을 가리킵니다');
  db.failSetAt = null;
  const r = await S.putOriginal(file('a.pdf', 'y'), { kind: 'co', coKey: 'k', coName: '가나상사' });
  assert.equal(r.reused, false);
  assert.ok(await S.getOriginal(r.fileId));
});

test('거절되는 파일은 창고를 안 두드린다', async () => {
  const S = load(); const db = fakeDb(); const st = fakeStorage();
  S.init({ db, storage: st, uid: 'u1', name: '' });
  await assert.rejects(S.putOriginal(file('a.exe', 'z'), { kind: 'co', coKey: 'k', coName: 'x' }), /종류/);
  assert.equal(st.puts, 0);
});

test('창고가 없으면 이름을 대고 거절한다', async () => {
  const S = load(); const db = fakeDb();
  S.init({ db, storage: null, uid: 'u1', name: '' });
  await assert.rejects(S.putOriginal(file('a.pdf', 'z'), { kind: 'co', coKey: 'k', coName: 'x' }), /창고/);
});

test('기업별 — 붙이고, 건수가 오르고, 빼면 파일은 남는다', async () => {
  const S = load(); const db = fakeDb(); const st = fakeStorage();
  S.init({ db, storage: st, uid: 'u1', name: '홍길동' });
  const f = await S.putOriginal(file('c.pdf', 'c'), { kind: 'co', coKey: S.coKey('가나상사'), coName: '가나상사' });
  const a = await S.addCoDoc({ coName: '(주)가나상사', fileId: f.fileId, title: '자문계약서', date: '2026-03-02', src: 'upload' });
  const b = await S.addCoDoc({ coName: '가나상사', fileId: f.fileId, title: '갱신', date: '2027-03-02', src: 'photo' });
  assert.equal(a.coKey, b.coKey, '★ 표기가 다르다고 회사가 둘로 갈렸습니다');
  let cos = out(await S.listCo());
  assert.equal(cos.length, 1); assert.equal(cos[0].n, 2); assert.equal(cos[0].name, '(주)가나상사');
  const docs = out(await S.listCoDocs(a.coKey));
  assert.deepEqual(docs.map((d) => d.title), ['갱신', '자문계약서'], '계약일 최신순이 아닙니다');
  await S.updateCoDoc(a.coKey, a.docId, { title: '자문계약서(원본)', date: '2026-03-03' });
  assert.equal(out(await S.listCoDocs(a.coKey)).filter((d) => d.id === a.docId)[0].title, '자문계약서(원본)');
  await S.unlinkCoDoc(a.coKey, a.docId);
  cos = out(await S.listCo());
  assert.equal(cos[0].n, 1);
  assert.ok(await S.getOriginal(f.fileId), '★★ 회사에서 뺐더니 보관함 원본까지 사라졌습니다');
});

test('빈 회사 이름은 거절', async () => {
  const S = load(); const db = fakeDb();
  S.init({ db, storage: fakeStorage(), uid: 'u1', name: '' });
  await assert.rejects(S.addCoDoc({ coName: '  ', fileId: 'x', title: 't', date: '', src: 'upload' }), /회사/);
});

test('updateCoDoc 는 title 만 바꾸고 fileId·src·date 는 그대로', async () => {
  const S = load(); const db = fakeDb(); const st = fakeStorage();
  S.init({ db, storage: st, uid: 'u1', name: '홍길동' });
  const f = await S.putOriginal(file('c.pdf', 'c'), { kind: 'co', coKey: S.coKey('가나상사'), coName: '가나상사' });
  const a = await S.addCoDoc({ coName: '가나상사', fileId: f.fileId, title: '원본 계약서', date: '2026-03-02', src: 'upload' });
  // 제목만 바꿈
  await S.updateCoDoc(a.coKey, a.docId, { title: '수정된 계약서' });
  const doc = out(await S.listCoDocs(a.coKey)).filter((d) => d.id === a.docId)[0];
  assert.equal(doc.title, '수정된 계약서', '제목이 바뀌어야 함');
  assert.equal(doc.fileId, f.fileId, '★ fileId가 사라졌습니다');
  assert.equal(doc.src, 'upload', '★ src가 사라졌습니다');
  assert.equal(doc.date, '2026-03-02', '★ date가 사라졌습니다');
});

test('isDenied — 권한 거절을 알아본다', () => {
  const S = load();
  assert.equal(S.isDenied({ code: 'PERMISSION_DENIED' }), true);
  assert.equal(S.isDenied(new Error('permission_denied at /pu_docs')), true);
  assert.equal(S.isDenied({ code: 'storage/unauthorized' }), true);
  assert.equal(S.isDenied(new Error('network')), false);
});
