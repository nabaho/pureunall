'use strict';
/* 메일 첨부 → 사진첩 (대표 지시 2026-10-05)
   「메일함에 들어오는 사업자등록증·명함·계약서를 자동으로 사진첩으로 가져와
     판독하고 기업정보함으로 보낼 수 없나」 — 1걸음(건네기)을 지킨다.

   ★ 이 검사가 지키는 것
     ① 건네는 통로(js/pu-handoff.js)가 «실제로» 돈다 — 담고, 꺼내고, 한 번만 쓰이고,
        너무 큰 것은 거절하고, 묵은 것은 없는 것으로 친다.
     ② 메일함의 「→ 사진첩」이 통로와 공용 이동층을 쓴다(창 하나 규칙 — _blank 금지).
     ③ 사진첩이 받는 길은 «새로 만들지 않는다» — addFiles 한 통로로 들어간다.
        그래야 축소·대기열·자동 판독·중복 살피기가 그대로 걸린다.
     ④ 두 앱이 통로 파일을 싣는다(안 실으면 단추가 조용히 아무 일도 안 한다).

   ⚠ 값(단추 글자·열쇠 이름)을 박지 않는다 — 「그 길이 살아 있는가」만 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const 읽기 = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ── 아주 작은 가짜 IndexedDB ──
   진짜와 같은 모양(open → onupgradeneeded/onsuccess, transaction → objectStore)만 흉내 낸다.
   저장은 Map 하나다. 커서는 쓸기(오래된 것 치우기)에 필요한 만큼만. */
function 가짜IDB() {
  const 창고 = new Map();
  function 요청(값, 바로) {
    const r = { result: 값, error: null, onsuccess: null, onerror: null };
    setTimeout(() => { if (r.onsuccess) r.onsuccess(); }, 바ro(바로));
    return r;
  }
  function 바ro(x) { return x === undefined ? 0 : x; }
  function store() {
    return {
      put(v) { 창고.set(v.k, v); return 요청(undefined); },
      get(k) { return 요청(창고.get(k)); },
      delete(k) { 창고.delete(k); return 요청(undefined); },
      openCursor() {
        const r = { result: null, onsuccess: null };
        const 줄 = [...창고.values()];
        let i = 0;
        const 다음 = () => {
          if (i >= 줄.length) { r.result = null; if (r.onsuccess) r.onsuccess(); return; }
          const v = 줄[i++];
          r.result = { value: v, delete() { 창고.delete(v.k); }, continue: () => setTimeout(다음, 0) };
          if (r.onsuccess) r.onsuccess();
        };
        setTimeout(다음, 0);
        return r;
      },
    };
  }
  return {
    창고,
    open() {
      const req = { result: null, error: null, onupgradeneeded: null, onsuccess: null, onerror: null };
      setTimeout(() => {
        req.result = {
          objectStoreNames: { contains: () => true },
          createObjectStore: () => store(),
          transaction() {
            const t = { oncomplete: null, onerror: null, error: null, objectStore: () => store() };
            setTimeout(() => { if (t.oncomplete) t.oncomplete(); }, 1);
            return t;
          },
        };
        if (req.onupgradeneeded) req.onupgradeneeded();
        if (req.onsuccess) req.onsuccess();
      }, 0);
      return req;
    },
  };
}

function 통로싣기() {
  const idb = 가짜IDB();
  const 상자 = {
    indexedDB: idb,
    setTimeout, clearTimeout, Date, Math, Promise, Error, String, Number, Object, JSON,
    File: function (조각, 이름, 옵션) {
      const b = 조각[0];
      this.name = 이름; this.type = (옵션 || {}).type || '';
      this.size = b && (b.byteLength !== undefined ? b.byteLength : b.length) || 0;
      this._b = b;
    },
    Blob: function (조각, 옵션) { this.type = (옵션 || {}).type || ''; this._b = 조각[0]; },
  };
  상자.window = 상자;
  vm.createContext(상자);
  vm.runInContext(읽기('js/pu-handoff.js'), 상자);
  return { 상자, idb, H: 상자.PuHandoff };
}

test('★ 담고 → 꺼내면 그대로 나온다 (이름·종류·내용·어디서 왔는지)', async () => {
  const { H } = 통로싣기();
  const 바이트 = new Uint8Array([1, 2, 3, 4, 5]);
  const 열쇠 = await H.put({ name: '사업자등록증.pdf', type: 'application/pdf', bytes: 바이트, from: '메일 · 가나상사' });
  assert.ok(열쇠 && typeof 열쇠 === 'string', '열쇠를 안 준다');
  const 받은것 = await H.take(열쇠);
  assert.equal(받은것.name, '사업자등록증.pdf');
  assert.equal(받은것.type, 'application/pdf');
  assert.equal(받은것.from, '메일 · 가나상사');
  assert.equal(받은것.file.size, 5, '내용이 바뀌었다');
});

test('★ 열쇠는 «한 번만» 쓰인다 — 뒤로가기로 돌아와도 두 번 담기지 않는다', async () => {
  const { H } = 통로싣기();
  const 열쇠 = await H.put({ name: 'a.jpg', type: 'image/jpeg', bytes: new Uint8Array([9]) });
  assert.ok(await H.take(열쇠));
  assert.equal(await H.take(열쇠), null, '두 번째도 나오면 같은 첨부가 두 장이 된다');
});

test('없는 열쇠로 꺼내도 터지지 않고 «없다»고 한다', async () => {
  const { H } = 통로싣기();
  assert.equal(await H.take('h없는것'), null);
  assert.equal(await H.take(''), null);
});

test('★ 너무 큰 것은 담지 않는다 — 까닭을 말한다', async () => {
  const { H } = 통로싣기();
  await assert.rejects(
    () => H.put({ name: '큰것.zip', type: 'application/zip', bytes: new Uint8Array(H.최대 + 1) }),
    (e) => /너무 큽니다/.test(e.message), '한도를 넘겨도 조용히 담으면 나중에 알 수 없게 실패한다');
});

test('묵은 것은 «없는 것»으로 친다 — 반나절 지난 열쇠', async () => {
  const { H, idb } = 통로싣기();
  const 열쇠 = await H.put({ name: 'b.pdf', type: 'application/pdf', bytes: new Uint8Array([1]) });
  const 줄 = idb.창고.get(열쇠);
  줄.at = Date.now() - (H.목숨 + 1000);          /* 담긴 때를 뒤로 민다 */
  assert.equal(await H.take(열쇠), null);
});

/* ── 길이 «이어져 있는가» ─────────────────────────────────────────────── */

test('★ 메일함의 「→ 사진첩」이 통로와 공용 이동층을 쓴다 (창은 하나)', () => {
  const 카드 = 읽기('pu-cards.html');
  assert.match(카드, /onclick="mbAttToPhoto\(/, '첨부 줄에 사진첩 단추가 없다');
  const 시작 = 카드.indexOf('function mbAttToPhoto');
  assert.ok(시작 > 0, 'mbAttToPhoto 가 없다');
  /* 함수 몸만 떼어 본다 — 뒤에 붙은 다른 함수까지 보면 「있는 것처럼」 보인다 */
  const 몸 = require('./cut-fn').cutFn(카드, 'function mbAttToPhoto(');
  assert.match(몸, /PuHandoff\.put/, '통로를 안 쓰면 파일을 못 건넨다');
  assert.match(몸, /goPhotos\(/,
    '사진첩을 여는 «한 곳»(goPhotos)을 거쳐야 한다 — 따로 열면 창이 둘이 된다');
  assert.ok(!/_blank/.test(몸), '창을 새로 열면 안 된다(집안 규칙)');
  assert.match(몸, /take=/, '열쇠를 주소로 넘겨야 받는 쪽이 찾는다');
  /* 그 한 곳은 공용 이동층으로만 연다 */
  assert.match(require('./cut-fn').cutFn(카드, 'function goPhotos('), /PuAppBar\.goApp/,
    '집안 규칙 — 앱 사이 이동은 공용 층으로만');
});

test('★ 사진첩이 받는 길은 새로 만들지 않는다 — addFiles 한 통로로 들어간다', () => {
  const 사진첩 = 읽기('pu-photos.html');
  const 시작 = 사진첩.indexOf('function takeHandoff');
  assert.ok(시작 > 0, 'takeHandoff 가 없다');
  const 몸 = 사진첩.slice(시작, 시작 + 1800);
  assert.match(몸, /PuHandoff\.take/, '통로에서 꺼내지 않는다');
  assert.match(몸, /addFiles\(/, '담기는 반드시 addFiles 를 타야 자동 판독·중복 살피기가 걸린다');
  assert.match(사진첩, /takeHandoff\(\)/, '화면이 다 뜬 뒤 한 번 불러야 한다');
});

test('★ 두 앱이 통로 파일을 싣는다 — 안 실으면 단추가 조용히 아무 일도 안 한다', () => {
  ['pu-cards.html', 'pu-photos.html'].forEach((f) => {
    assert.match(읽기(f), /src="js\/pu-handoff\.js\?v=\d+"/, f + ' 가 통로 파일을 안 싣는다');
  });
});
