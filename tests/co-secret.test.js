'use strict';
/* 🔒 서명본 — 대표·관리자만 연다 (설계 2026-10-03-계약서류-표준-기록 §3.1, 대표 「추천대로」)
   ⓐ 저장: secret 이면 창고 pu_docs/secret/… 에 올리고 기록에 secret:true · 주소(fileUrl)를 만들지 않는다 · 내려받기는 서버 길로
   ⓑ 규칙: 창고는 읽기 false · 실시간DB 는 secret 자리 경로만 받는다 · 열람 기록은 총괄관리자만 읽는다
   ⓒ 서버 함수: 직원 확인 → 총괄관리자 확인 → 기록 secret 확인 → 바이트를 직접 · 토큰·서명 주소 금지 · 열람 기록
   ⓓ 화면: 문서관리가 secretFetch 를 넘기고, 카드·큰 보기가 🔒 를 따로 다룬다 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');
const { webcrypto } = require('crypto');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

function loadStore() {
  const box = { console, Date, Math, JSON, Promise, Object, Array, String, Number, Error, Uint8Array, crypto: webcrypto, setTimeout };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(read('js/pu-office-store.js'), box);
  return box.PuOfficeStore;
}
function fakeDb() {
  const store = {}; let seq = 0;
  const db = {
    store,
    ref(p) {
      return {
        key: p.split('/').pop(),
        push() { seq++; return db.ref(p + '/f' + String(seq).padStart(12, '0')); },
        once() { return Promise.resolve({ val: () => (store[p] === undefined ? null : JSON.parse(JSON.stringify(store[p]))) }); },
        set(v) { store[p] = JSON.parse(JSON.stringify(v)); return Promise.resolve(); }
      };
    }
  };
  return db;
}
function fakeStorage() { const puts = []; return { puts, ref(p) { return { put(b, m) { puts.push(p); return Promise.resolve(); }, getDownloadURL() { return Promise.resolve('https://x/' + p); } }; } }; }

test('ⓐ 저장 — 서명본은 secret 자리·기록 secret:true, 주소를 만들지 않고 내려받기는 서버 길', async () => {
  const S = loadStore(), db = fakeDb(), st = fakeStorage();
  let asked = null;
  S.init({ db, storage: st, uid: 'u1', name: '시험', secretFetch: (id) => { asked = id; return Promise.resolve({ fake: 'blob' }); } });
  const bytes = new Uint8Array(Buffer.from('시험 서명본'));
  const r = await S.putOriginal({ name: '자문계약서_서명.pdf', size: bytes.length, type: 'application/pdf', bytes }, { kind: 'folder', coName: '가나' }, { secret: true });
  assert.match(st.puts[0], /^pu_docs\/secret\/f\d+\/자문계약서_서명\.pdf$/);
  const rec = db.store['pu_docs/originals/' + r.fileId];
  assert.equal(rec.secret, true); assert.match(rec.path, /^pu_docs\/secret\//);
  await assert.rejects(S.fileUrl(rec), (e) => e.code === 'secret', '서명본은 주소를 만들면 안 된다');
  assert.equal(S.isSecret(rec), true);
  const b = await S.secretBlob(r.fileId); assert.equal(asked, r.fileId); assert.equal(b.fake, 'blob');
  /* 보통 파일은 그대로 */
  const n = await S.putOriginal({ name: 'a.pdf', size: 3, type: 'application/pdf', bytes: new Uint8Array([1, 2, 3]) }, { kind: 'co' });
  assert.match(st.puts[1], /^pu_docs\/originals\//);
  assert.ok(!('secret' in db.store['pu_docs/originals/' + n.fileId]), '보통 파일에는 secret 칸을 안 쓴다(규칙은 true 만 받는다)');
});

test('ⓑ 규칙 — 창고는 읽기 false·새로 쓰기만, 실시간DB 는 secret 일 때만 secret 경로, 열람 기록은 총괄관리자만', () => {
  const sto = read('docs/firebase-storage-전체(붙여넣기용).txt');
  const m = /match \/pu_docs\/secret\/\{fileId\}\/\{file\} \{([\s\S]*?)\n    \}/.exec(sto);
  assert.ok(m, '창고 규칙에 서명본 자리가 없습니다');
  assert.match(m[1], /allow read:\s+if false;/); assert.match(m[1], /allow update, delete: if false;/);
  const gen = read('scripts/make-firebase-rules.js');
  assert.match(gen, /newData\.parent\(\)\.child\('secret'\)\.val\(\) === true && newData\.val\(\)\.beginsWith\('pu_docs\/secret\/' \+ \$id \+ '\/'\)/);
  assert.match(gen, /secret_log: \{ '\.read': ADMIN \}/);
  const apply = JSON.parse(read('docs/firebase-rules-전체-적용본.json'));
  assert.ok(apply.rules.pu_docs.secret_log && apply.rules.pu_docs.originals.$id.secret, '적용본을 다시 내지 않았습니다');
});

test('ⓒ 서버 함수 — 총괄관리자만, 기록이 서명본일 때만, 바이트를 직접(주소 없음), 열람 기록', () => {
  const src = read('functions/index.js');
  const i = src.indexOf('exports.puDocSecret');
  assert.ok(i > 0, 'puDocSecret 이 없습니다');
  const fn = src.slice(i, src.indexOf('\n  });', i));
  assert.match(fn, /requireStaff\(req\)/);
  assert.match(fn, /uid_roles\/" \+ me\.uid/); assert.match(fn, /isAdmin !== true/);
  assert.match(fn, /rec\.secret !== true/); assert.match(fn, /pu_docs\/secret\/" \+ fileId \+ "\//);
  assert.match(fn, /\.download\(\)/); assert.match(fn, /pu_docs\/secret_log/);
  assert.ok(!/getSignedUrl|firebaseStorageDownloadTokens|tokenUrl/.test(fn), '서명본에 주소(토큰·서명)를 만들면 안 된다');
});

test('ⓓ 화면 — 문서관리가 서버 길을 넘기고, 카드·큰 보기가 🔒 를 따로 다룬다', () => {
  const html = read('docs-esign.html');
  assert.match(html, /secretFetch: fetchSecretDoc/); assert.match(html, /cloudfunctions\.net\/puDocSecret/);
  const docs = read('js/pu-office-docs.js');
  assert.match(docs, /if \(d\.secret\) return;/, '서명본 카드에서 주소를 만들려 하면 안 된다');
  assert.match(docs, /store\.secretBlob\(d\.fileId\)/);
});
test('ⓓ 사진첩에서 가져오기도 기본 🔒 서명본 — 사진첩의 보호가 풀리지 않게 (2026-10-03)', () => {
  const docs = read('js/pu-office-docs.js').replace(/\r\n/g, '\n');
  const a = docs.indexOf('function openPhotoImport('), b = docs.indexOf('function walkEntry(');
  assert.ok(a > 0 && b > a);
  const f = docs.slice(a, b);
  assert.match(f, /var secretCb = el\('input', \{ type: 'checkbox', checked: true \}\);/);
  assert.match(f, /\{ kind: 'photo',[^\n]*\}, \{ secret: secret \}\)/, '창고에 올릴 때 secret 을 넘겨야 한다');
  assert.match(f, /src: 'photo', secret: secret/, '기업별 서류 줄에도 🔒 표시');
  assert.doesNotMatch(f, /가져온 것은 전 직원이 봅니다/);
});
