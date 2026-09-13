'use strict';
/* 푸른카메라 — 렌즈 바꾸기 · 사진 한 줄 메모 (대표 지시 2026-09-13 「푸른카메라 마저 채우기」)
   실행: node --test tests/pu-camera-lens-memo.test.js
   목업 docs/mockups/pu-camera-lens-memo.html · 대표 승인 「가」(㉮ 이 목업 그대로)

   ■ ★★ 이 검사가 지키는 급소 둘

   ① 「눌러도 안 되는 단추는 없느니만 못하다」
      폰마다 달린 렌즈가 다르다. 그래서 알은 **기기가 실제로 할 수 있는 것**으로만 만든다.
      할 줄 모르는 기기에서 0.5× 를 그려 두면, 눌러 보고 「고장났다」가 된다.
      손전등 ⚡ · 앞뒤 🔄 를 이미 그 규칙으로 감추고 있다 — 렌즈도 같다.

   ② 「새 칸을 만들지 않는다」
      한 줄 메모는 사진첩에 **이미 있는** 「사람이 적는 한 줄」(meta.note) 그 칸으로 간다.
      여기서 제 칸을 새로 만들면 사진첩에서 안 보이고, 「적었는데 없다」가 된다.
      이것이 2026-08-08 의 「가는 곳은 하나」와 같은 규칙이다.

   ■ 이 검사는 «글자»가 아니라 «하는 일»을 본다
   가짜 카메라(배율 되는 폰 / 뒷렌즈 여럿인 폰 / 아무것도 안 되는 폰)를 물려
   실제로 열어 보고, 알이 몇 개 그려지는지·무엇이 저장 층으로 넘어가는지 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripComments } = require('./strip-comments.js');

const R = path.join(__dirname, '..');
const CAM = fs.readFileSync(path.join(R, 'pu-camera.html'), 'utf8');

function 조각(name) {
  const m = CAM.match(new RegExp('<script data-part="' + name + '"[^>]*>([\\s\\S]*?)<\\/script>'));
  assert.ok(m, '<script data-part="' + name + '"> 조각이 없습니다');
  return m[1];
}
const 몸통 = stripComments(조각('app'));

/* ── 가짜 폰 ───────────────────────────────────────────────────────────
   o.zoom  : 기기가 받는 배율 {min,max} (없으면 배율을 못 받는 폰)
   o.cams  : enumerateDevices 가 내놓는 카메라 목록
   o.applyFails : 배율을 걸어도 기기가 튕기는 폰 */
function 앱(o) {
  o = o || {};
  const 담긴것 = [];
  const 적힌것 = [];
  const 건배율 = [];
  const 연것 = [];
  const el = {};
  const mk = function (id) {
    return (el[id] = el[id] || {
      id: id, style: {}, textContent: '', innerHTML: '', title: '', className: '', disabled: false,
      classList: { add: function () { }, remove: function () { } },
      videoWidth: 1920, videoHeight: 1080,
      addEventListener: function () { }
    });
  };
  const canvas = function () {
    return {
      width: 0, height: 0,
      getContext: function () { return { drawImage: function () { } }; },
      toDataURL: function () { return 'data:image/jpeg;base64,QUJD'; }
    };
  };
  const track = {
    getCapabilities: function () {
      const c = { torch: false };
      if (o.zoom) c.zoom = o.zoom;
      return c;
    },
    applyConstraints: function (c) {
      const adv = (c && c.advanced && c.advanced[0]) || {};
      if ('zoom' in adv) 건배율.push(adv.zoom);
      return o.applyFails ? Promise.reject(new Error('못 함')) : Promise.resolve();
    },
    stop: function () { }
  };
  const ctx = {
    console: { warn: function () { } },
    Date, Math, Number, String, Object, Array, JSON, Promise, RegExp,
    setTimeout: function (f) { return 0; }, clearTimeout: function () { },
    setInterval: function () { return 0; },
    confirm: function () { return true; },
    prompt: function () { return o.prompt === undefined ? '가나상사 3층 작업장' : o.prompt; },
    document: { getElementById: mk, createElement: canvas, addEventListener: function () { } },
    window: { addEventListener: function () { } },
    location: { href: '' },
    navigator: {
      mediaDevices: {
        getUserMedia: function (c) {
          연것.push(c && c.video);
          return Promise.resolve({ getVideoTracks: function () { return [track]; },
            getTracks: function () { return [track]; } });
        },
        enumerateDevices: function () { return Promise.resolve(o.cams || []); }
      }
    },
    PuPhotoStore: {
      init: function () { },
      signIn: function () { return Promise.resolve({ name: '권형하' }); },
      uploadSpec: function () { return { maxEdge: 1600, quality: 0.85, thumbEdge: 240 }; },
      newId: function () { return 'id' + (담긴것.length + 1); },
      myName: function () { return '권형하'; },
      photoYear: function () { return '2026'; },
      savePhoto: function (p) { 담긴것.push(p); return Promise.resolve(); },
      saveNote: function (year, id, patch) { 적힌것.push({ year: year, id: id, patch: patch }); return Promise.resolve(); },
      deletePhoto: function () { return Promise.resolve(); }
    },
    firebase: {
      initializeApp: function () { }, database: function () { return {}; },
      storage: function () { return {}; },
      auth: function () { return { onAuthStateChanged: function () { } }; }
    }
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(조각('app'), ctx);
  vm.runInContext('me = { uid: "U1", email: "p001@pureun.kr" };', ctx);
  return { ctx: ctx, el: el, 담긴것: 담긴것, 적힌것: 적힌것, 건배율: 건배율, 연것: 연것 };
}
const 잠깐 = () => new Promise(function (r) { setImmediate(r); });

const 뒷렌즈셋 = [
  { kind: 'videoinput', deviceId: 'b1', label: 'camera2 0, facing back' },
  { kind: 'videoinput', deviceId: 'b2', label: 'camera2 2, facing back' },
  { kind: 'videoinput', deviceId: 'b3', label: 'camera2 3, facing back' },
  { kind: 'videoinput', deviceId: 'f1', label: 'camera2 1, facing front' }
];

/* ══════ ① 렌즈 — 「할 수 있는 기기에서만」 ═══════════════════════════ */

test('★★ 배율을 받는 폰 — 되는 것만 알로 그린다', async () => {
  const a = 앱({ zoom: { min: 0.5, max: 8 } });
  await vm.runInContext('startCam()', a.ctx);
  await 잠깐(); await 잠깐();
  const 알 = vm.runInContext('lenses.map(function(L){return L.label;}).join(",")', a.ctx);
  assert.equal(알, '0.5×,1×,2×');
  assert.equal(a.el.lens.style.display, 'flex', '★ 알을 그려 놓고 안 보이면 없는 것과 같습니다');
});

test('★★ 0.5× 가 «안 되는» 폰에는 0.5× 를 안 그린다', async () => {
  const a = 앱({ zoom: { min: 1, max: 4 } });
  await vm.runInContext('startCam()', a.ctx);
  await 잠깐(); await 잠깐();
  const 알 = vm.runInContext('lenses.map(function(L){return L.label;}).join(",")', a.ctx);
  assert.equal(알, '1×,2×',
    '★★ 못 하는 배율을 그려 두면 눌러 보고 「고장났다」가 됩니다');
});

test('★★★ 아무것도 못 바꾸는 폰에는 «알을 안 그린다»', async () => {
  const a = 앱({ cams: [{ kind: 'videoinput', deviceId: 'b1', label: 'camera2 0, facing back' }] });
  await vm.runInContext('startCam()', a.ctx);
  await 잠깐(); await 잠깐();
  assert.equal(vm.runInContext('lenses.length', a.ctx), 0);
  assert.equal(a.el.lens.style.display, 'none',
    '★★★ 눌러도 안 되는 단추는 없느니만 못합니다 — 손전등·앞뒤와 같은 규칙입니다');
});

test('★ 알이 «하나»뿐이면 그것도 안 그린다 — 고를 것이 없다', async () => {
  const a = 앱({ zoom: { min: 1, max: 1.5 } });
  await vm.runInContext('startCam()', a.ctx);
  await 잠깐(); await 잠깐();
  assert.equal(vm.runInContext('lenses.length', a.ctx), 0);
});

test('★ 앞면으로 바꿔도 알이 «하나»면 안 그린다 — 뒷렌즈 물러서기가 없는 자리다', async () => {
  /* 뒤에서는 「배율이 하나면 뒷 카메라 목록으로 물러선다」가 알을 비워 주지만,
     앞면에서는 그 길이 없다. 그래서 마지막 울타리를 여기서 본다. */
  const a = 앱({ zoom: { min: 1, max: 1.5 }, cams: 뒷렌즈셋 });
  await vm.runInContext('startCam()', a.ctx);
  await 잠깐(); await 잠깐();
  vm.runInContext('flipCam()', a.ctx);
  await 잠깐(); await 잠깐();
  assert.equal(vm.runInContext('facing', a.ctx), 'user');
  assert.equal(vm.runInContext('lenses.length', a.ctx), 0,
    '★ 알 하나를 그려 두면 눌러도 아무 일이 없습니다 — 고를 것이 없기 때문입니다');
});

test('★★ 배율을 «못 거는» 기기면 말을 한다 — 조용하면 눌렀는지도 모른다', async () => {
  const a = 앱({ zoom: { min: 0.5, max: 8 }, applyFails: true });
  await vm.runInContext('startCam()', a.ctx);
  await 잠깐(); await 잠깐();
  vm.runInContext('pickLens(0)', a.ctx);
  await 잠깐(); await 잠깐();
  assert.match(a.el.toast.textContent, /0\.5×/,
    '★★ 화면이 그대로인데 아무 말도 없으면 「고장났다」가 됩니다');
});

test('★★ 배율을 못 받지만 뒷 카메라가 여럿인 폰 — 그 기기들을 알로', async () => {
  const a = 앱({ cams: 뒷렌즈셋 });
  await vm.runInContext('startCam()', a.ctx);
  await 잠깐(); await 잠깐();
  const 알 = vm.runInContext('lenses.map(function(L){return L.label;}).join(",")', a.ctx);
  assert.equal(알, '렌즈1,렌즈2,렌즈3', '★ 앞면 카메라는 뒷렌즈 목록에 끼면 안 됩니다');
});

test('★★ 렌즈를 고르면 «그 기기»로 다시 연다', async () => {
  const a = 앱({ cams: 뒷렌즈셋 });
  await vm.runInContext('startCam()', a.ctx);
  await 잠깐(); await 잠깐();
  const 전 = a.연것.length;
  vm.runInContext('pickLens(2)', a.ctx);
  await 잠깐();
  assert.ok(a.연것.length > 전, '★ 다시 열지 않으면 화면이 그대로입니다');
  assert.equal((a.연것[a.연것.length - 1].deviceId || {}).exact, 'b3',
    '★★ 고른 것과 다른 렌즈를 열면 0.5× 를 눌렀는데 1× 가 나옵니다');
});

test('★★ 배율 알은 «열어 둔 채로» 바꾼다 — 다시 열면 느리고 화면이 깜빡인다', async () => {
  const a = 앱({ zoom: { min: 0.5, max: 8 } });
  await vm.runInContext('startCam()', a.ctx);
  await 잠깐(); await 잠깐();
  const 전 = a.연것.length;
  vm.runInContext('pickLens(0)', a.ctx);
  await 잠깐();
  assert.equal(a.연것.length, 전, '★★ 배율은 기기를 다시 열 까닭이 없습니다');
  assert.equal(a.건배율[a.건배율.length - 1], 0.5, '★★ 눌렀는데 배율이 안 걸렸습니다');
});

test('★ 앞뒤를 바꾸면 «고른 렌즈»를 놓는다 — 뒷면 기기로 앞면을 열 수 없다', async () => {
  const a = 앱({ cams: 뒷렌즈셋 });
  await vm.runInContext('startCam()', a.ctx);
  await 잠깐(); await 잠깐();
  vm.runInContext('pickLens(1)', a.ctx);
  await 잠깐(); await 잠깐();
  assert.equal(vm.runInContext('lensDev', a.ctx), 'b2');
  vm.runInContext('flipCam()', a.ctx);
  await 잠깐();
  assert.equal(vm.runInContext('lensDev', a.ctx), '',
    '★ 안 놓으면 앞면으로 바꿔도 뒷 렌즈가 그대로 열립니다');
});

test('★ 이름표가 없으면(권한 전) 뒷렌즈로 치지 않는다', async () => {
  const a = 앱({ cams: [
    { kind: 'videoinput', deviceId: 'x1', label: '' },
    { kind: 'videoinput', deviceId: 'x2', label: '' }
  ] });
  await vm.runInContext('startCam()', a.ctx);
  await 잠깐(); await 잠깐();
  assert.equal(vm.runInContext('lenses.length', a.ctx), 0,
    '★ 어느 것이 어느 렌즈인지 모르는 채로 「렌즈1·2」를 그리면 아무 뜻이 없습니다');
});

/* ══════ ② 한 줄 메모 — 「새 칸을 만들지 않는다」 ═════════════════════ */

test('★★★ 걸어 둔 한 줄이 «담을 때 함께» 간다 — 사진첩의 그 칸으로', async () => {
  const a = 앱();
  vm.runInContext('askMemo(); shoot();', a.ctx);
  await 잠깐();
  assert.equal(a.담긴것.length, 1);
  assert.equal(a.담긴것[0].meta.note, '가나상사 3층 작업장',
    '★★★ meta.note 는 사진첩이 「사람이 적는 한 줄」로 이미 쓰는 칸입니다 —\n' +
    '  여기에 제 칸을 새로 만들면 사진첩에서 안 보이고 「적었는데 없다」가 됩니다');
});

test('★★★ 한 번 적으면 «그 뒤 찍는 것마다» 붙는다 — 열 번 치지 않는다', async () => {
  const a = 앱();
  vm.runInContext('askMemo(); shoot(); shoot(); shoot();', a.ctx);
  await 잠깐();
  const 줄 = a.담긴것.map(function (p) { return p.meta.note; });
  assert.deepEqual(Array.from(줄),
    ['가나상사 3층 작업장', '가나상사 3층 작업장', '가나상사 3층 작업장'],
    '★★★ 「걸어 두기」가 이 기능의 전부입니다 — 한 장에만 붙으면 안 적느니만 못합니다');
});

test('★★ 메모가 없으면 «안 적는다» — 빈 줄을 만들지 않는다', async () => {
  const a = 앱();
  vm.runInContext('shoot();', a.ctx);
  await 잠깐();
  assert.ok(!('note' in a.담긴것[0].meta),
    '★★ 빈 값을 적어 두면 「적었는데 비어 있음」과 구분이 안 됩니다');
});

test('★ ✕ 를 누르면 걸어 둔 것이 풀린다 — 다음 장부터 안 붙는다', async () => {
  const a = 앱();
  vm.runInContext('askMemo(); shoot(); clearMemo(); shoot();', a.ctx);
  await 잠깐();
  assert.equal(a.담긴것[0].meta.note, '가나상사 3층 작업장');
  assert.ok(!('note' in a.담긴것[1].meta), '★ 장소를 옮겼는데 옛 메모가 계속 붙습니다');
});

test('★★ 「취소」는 걸어 둔 것을 «지우지 않는다»', async () => {
  const a = 앱();
  vm.runInContext('askMemo();', a.ctx);
  a.ctx.prompt = function () { return null; };     /* 취소를 누른 것 */
  vm.runInContext('askMemo(); shoot();', a.ctx);
  await 잠깐();
  assert.equal(a.담긴것[0].meta.note, '가나상사 3층 작업장',
    '★★ 잘못 누르고 취소했는데 적어 둔 것이 사라지면 다시 칩니다');
});

test('★ 한 줄은 «한 줄»이다 — 길면 자른다', async () => {
  const a = 앱({ prompt: '가'.repeat(400) });
  vm.runInContext('askMemo(); shoot();', a.ctx);
  await 잠깐();
  assert.ok(a.담긴것[0].meta.note.length <= 60,
    '★ 사진첩 목록의 한 칸이 두 줄·세 줄이 되면 표 전체가 그만큼 길어집니다');
});

test('★★★ 찍은 «그 한 장»만 고치면 저장 층으로 간다', async () => {
  const a = 앱({ prompt: '' });
  vm.runInContext('shoot();', a.ctx);
  await 잠깐(); await 잠깐();
  a.ctx.prompt = function () { return '나중에 적은 한 줄'; };
  vm.runInContext('editShot(shots[0].id)', a.ctx);
  await 잠깐();
  assert.equal(a.적힌것.length, 1, '★★★ 화면에서만 바뀌면 사진첩에는 아무것도 안 남습니다');
  assert.equal(a.적힌것[0].patch.note, '나중에 적은 한 줄');
  assert.equal(a.적힌것[0].id, a.담긴것[0].id, '★ 엉뚱한 사진에 적혔습니다');
});

test('★★★ 아직 담기는 중이면 «기다린다» — 먼저 적으면 뒤이어 덮인다', async () => {
  /* 담기를 일부러 붙잡아 둔다 */
  let 풀기 = null;
  const a = 앱({ prompt: '' });
  a.ctx.PuPhotoStore.savePhoto = function (p) {
    a.담긴것.push(p);
    return new Promise(function (r) { 풀기 = r; });
  };
  vm.runInContext('shoot();', a.ctx);
  await 잠깐();
  a.ctx.prompt = function () { return '담기는 중에 적은 것'; };
  vm.runInContext('editShot(shots[0].id)', a.ctx);
  await 잠깐();
  assert.equal(a.적힌것.length, 0,
    '★★★ 담기기 전에 적으면 뒤이어 저장되는 정보가 그 한 줄을 덮습니다');
  풀기();
  await 잠깐(); await 잠깐();
  assert.equal(a.적힌것.length, 1, '★★★ 담긴 뒤에는 «반드시» 올려야 합니다 — 아니면 영영 안 적힙니다');
  assert.equal(a.적힌것[0].patch.note, '담기는 중에 적은 것');
});

test('★ 줄에 그 한 줄이 보인다 — 안 보이면 적었는지 알 수 없다', async () => {
  const a = 앱();
  vm.runInContext('askMemo(); shoot();', a.ctx);
  await 잠깐();
  assert.match(a.el.stripRow.innerHTML, /가나상사 3층 작업장/);
  assert.match(a.el.stripRow.innerHTML, /editShot\(/,
    '★ 사진을 눌러 고칠 길이 없으면 잘못 적은 것을 못 바로잡습니다');
});

/* ══════ ③ 어제의 약속을 깨지 않았는가 ═══════════════════════════════ */

test('★★★ 저장 길은 여전히 «공용 층 하나»다', () => {
  assert.ok(!/\bdb\.ref\s*\(|\bstorage\.ref\s*\(/.test(몸통),
    '★★★ 둘째 저장 길이 생겼습니다 — 2026-08-08 에 없앤 문제가 돌아옵니다');
  assert.match(몸통, /PuPhotoStore\.saveNote\(/,
    '★★★ 메모도 공용 층으로 가야 사진첩에서 보이고 거기서 고칠 수 있습니다');
});

test('★★ 여전히 «사진만» 찍는다 — 판독 요금이 나가지 않는다', () => {
  assert.match(몸통, /kind: 'photo'/);
  assert.match(CAM, /mode !== 'card' && mode !== 'document'/);
});

test('★★ 가벼움을 잃지 않았다 — 그것이 이 앱의 존재 이유다', () => {
  const photos = fs.statSync(path.join(R, 'pu-photos.html')).size;
  const cam = Buffer.byteLength(CAM);
  assert.ok(cam * 10 < photos,
    '★★ 푸른카메라 ' + Math.round(cam / 1024) + 'KB · 사진첩 ' + Math.round(photos / 1024) + 'KB');
});
