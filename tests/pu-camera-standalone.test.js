'use strict';
/* 푸른카메라 — «사진만 찍는» 별개 앱 (대표 지시 2026-09-12)
   실행: node --test tests/pu-camera-standalone.test.js

     「별개의 앱으로 만들어서 사진만 찍는 앱 만들어 달라」
     「사진 찍은 거 저장하는 거는 자동으로 사진첩으로 넘어가게」
   목업 docs/mockups/pu-camera-standalone.html · 대표 승인 「가」

   ■ ★★ 이 검사가 지키는 급소 — 「가는 곳」은 하나여야 한다
   2026-08-08 에 옛 푸른카메라를 없앤 까닭은 카메라가 둘이어서가 «아니라»
   **가는 곳이 달랐기** 때문이다 — 옛것은 기업정보함 직행, 사진첩 것은 자동 분류.
   같은 명함인데 어느 카메라로 찍었느냐에 따라 결과가 달랐다.
   그래서 이 앱은 저장을 **공용 층(PuPhotoStore) 하나**로만 한다.
   ⚠ 여기에 db.ref(…).set 이나 storage.ref(…).put 이 생기면 그 문제가 그대로 돌아온다.

   ■ 이 검사는 «글자»가 아니라 «하는 일»을 본다
   가짜 카메라·가짜 저장 층을 물려 실제로 찍어 보고, 저장 층에 무엇이 넘어가는지 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripComments } = require('./strip-comments.js');

const R = path.join(__dirname, '..');
const CAM = fs.readFileSync(path.join(R, 'pu-camera.html'), 'utf8');
const STORE = fs.readFileSync(path.join(R, 'js', 'pu-photo-store.js'), 'utf8');

/* ══════ ① 가벼워야 한다 — 그것이 이 앱의 존재 이유다 ═══════════════════ */

test('★★ 사진첩보다 «훨씬» 가볍다 — 안 그러면 별개 앱을 만든 뜻이 없다', () => {
  const photos = fs.statSync(path.join(R, 'pu-photos.html')).size;
  const cam = Buffer.byteLength(CAM);
  assert.ok(cam * 10 < photos,
    '★★ 푸른카메라 ' + Math.round(cam / 1024) + 'KB · 사진첩 ' + Math.round(photos / 1024) + 'KB.\n' +
    '  열 배 넘게 가볍지 않으면 「급할 때 바로 뜨는 카메라」라는 애초 목적이 사라집니다.\n' +
    '  (서비스워커가 일부러 안 담고 주소의 v= 가 10분마다 바뀌므로 매번 새로 받습니다)');
});

test('★ 사진첩 화면을 통째로 싣지 않는다 — 그러면 도로 무거워진다', () => {
  assert.ok(!/pu-photos\.html['"]\s*>/.test(CAM), '사진첩 화면을 끼워 넣고 있습니다');
  assert.ok(!/<script src="js\/pu-doc-read/.test(CAM),
    '★ 판독 층을 싣고 있습니다 — 이 앱은 «사진만» 찍습니다(판독은 요금이 듭니다)');
});

/* ══════ ② ★★ 저장은 «공용 층 하나»로만 ═══════════════════════════════ */

/* 이 파일에는 인라인 <script> 가 둘이다 — 앞의 것은 명함·서류를 사진첩으로 «넘기는»
   조각이고 뒤의 것이 카메라 알맹이다. 순서로 집으면 조각이 하나 더 붙는 날
   검사가 통째로 헛돈다. 그래서 data-part 표시로 집는다(표시가 없으면 그 자리에서 멈춘다). */
function 조각(name) {
  const m = CAM.match(new RegExp('<script data-part="' + name + '"[^>]*>([\\s\\S]*?)<\\/script>'));
  assert.ok(m, '<script data-part="' + name + '"> 조각이 없습니다 — 표시를 지우면' +
    ' 이 검사가 어느 코드를 보고 있는지 알 수 없습니다');
  return m[1];
}
const 몸통 = stripComments(조각('app'));

test('★★★ 제 저장 길을 만들지 않는다 — 2026-08-08 에 없앤 문제가 돌아온다', () => {
  assert.ok(!/\bdb\.ref\s*\(/.test(몸통),
    '★★★ 실시간DB 를 직접 쓰고 있습니다 — 둘째 저장 길입니다.\n' +
    '  옛 푸른카메라가 기업정보함으로 «직행»해서 같은 명함이 카메라마다 다른 곳으로 갔습니다.\n' +
    '  저장은 반드시 PuPhotoStore 를 지나야 합니다.');
  assert.ok(!/storage\.ref\s*\(/.test(몸통), '★★★ 창고를 직접 쓰고 있습니다 — 둘째 저장 길입니다');
  assert.ok(!/\.set\s*\(|\.update\s*\(|\.put\s*\(/.test(몸통.replace(/setTimeout|setInterval/g, '')),
    '★★★ 저장 층을 건너뛰고 직접 쓰고 있습니다');
});

test('★★ 사진첩과 «같은 설정»을 본다 — 다르면 찍은 것이 사진첩에 안 보인다', () => {
  const 사진첩 = fs.readFileSync(path.join(R, 'pu-photos.html'), 'utf8');
  ['databaseURL', 'storageBucket', 'projectId'].forEach(function (k) {
    const a = (CAM.match(new RegExp(k + ": '([^']+)'")) || [])[1];
    const b = (사진첩.match(new RegExp(k + ": '([^']+)'")) || [])[1];
    assert.ok(a && b, k + ' 를 못 찾았습니다');
    assert.equal(a, b,
      '★★ ' + k + ' 이 사진첩과 다릅니다 — 찍은 사진이 딴 곳에 쌓입니다');
  });
});

test('★ 크기·화질 기준을 «저장 층»에서 받는다 — 여기 숫자를 박으면 사진첩과 달라진다', () => {
  assert.match(몸통, /PuPhotoStore\.uploadSpec\(/,
    '★ 화질 숫자를 이 파일에 적으면 같은 카메라로 찍은 사진이 앱마다 다른 화질로 쌓입니다');
});

/* ══════ ③ 실제로 찍어 본다 ═══════════════════════════════════════════ */

/* 화면 없이 「찍기」만 돌린다 — 가짜 캔버스·가짜 저장 층을 물린다 */
function 앱(o) {
  o = o || {};
  const 담긴것 = [];
  const el = {};
  const mk = function (id) {
    return (el[id] = el[id] || {
      id: id, style: {}, textContent: '', innerHTML: '', disabled: false,
      classList: { add: function () { }, remove: function () { } },
      videoWidth: o.w === undefined ? 1920 : o.w,
      videoHeight: o.h === undefined ? 1080 : o.h,
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
  const ctx = {
    console: { warn: function () { } },
    Date, Math, Number, String, Object, Array, JSON, Promise,
    setTimeout: function (f) { return 0; }, clearTimeout: function () { },
    setInterval: function () { return 0; },
    confirm: function () { return o.confirm !== false; },
    document: { getElementById: mk, createElement: canvas, addEventListener: function () { } },
    window: { addEventListener: function () { } },
    location: { href: '' },
    navigator: { mediaDevices: { getUserMedia: function () { return Promise.reject(new Error('없음')); },
      enumerateDevices: function () { return Promise.resolve([]); } } },
    PuPhotoStore: {
      /* ⚠ 앱이 시작하며 부르는 것들 — 빠지면 그 자리에서 멎어 검사가 통째로 운다 */
      init: function () { },
      signIn: function () { return Promise.resolve({ name: '권형하' }); },
      uploadSpec: function () { return { maxEdge: 1600, quality: 0.85, thumbEdge: 240 }; },
      newId: function () { return 'id' + (담긴것.length + 1); },
      myName: function () { return '권형하'; },
      photoYear: function (m) { return '2026'; },
      savePhoto: function (p) {
        담긴것.push(p);
        return o.saveFails ? Promise.reject(new Error('신호 없음')) : Promise.resolve();
      },
      deletePhoto: function () { 담긴것.지움 = true; return Promise.resolve(); }
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
  ctx.me = { uid: 'U1', email: 'p001@pureun.kr' };
  return { ctx: ctx, 담긴것: 담긴것, el: el };
}

test('★★★ 찍으면 저장 층으로 «곧바로» 간다 — 「올리기」를 안 누른다', async () => {
  const a = 앱();
  vm.runInContext('me = { uid: "U1", email: "p001@pureun.kr" }; shoot();', a.ctx);
  await new Promise(function (r) { setImmediate(r); });
  assert.equal(a.담긴것.length, 1,
    '★★★ 찍었는데 아무것도 안 담겼습니다 — 「자동으로 사진첩으로」가 이 앱의 전부입니다');
  const p = a.담긴것[0];
  assert.ok(p.id && p.full && p.thumb, '★ 본문·미리보기를 함께 넘겨야 합니다');
});

test('★★★ 「사진」으로 담는다 — 서류로 담으면 판독이 돌아 요금이 나간다', async () => {
  const a = 앱();
  vm.runInContext('me = { uid: "U1", email: "p001@pureun.kr" }; shoot();', a.ctx);
  await new Promise(function (r) { setImmediate(r); });
  assert.equal(a.담긴것[0].meta.kind, 'photo',
    '★★★ 서류(doc)로 담으면 판독 대기열에 들어가 AI 요금이 나갑니다 —\n' +
    '  「사진만 찍는 앱」이라는 대표 지시와 어긋납니다');
});

test('★ 누가·언제·어디서 찍었는지 남긴다 — 사진첩과 같은 칸이어야 섞이지 않는다', async () => {
  const a = 앱();
  vm.runInContext('me = { uid: "U1", email: "p001@pureun.kr" }; shoot();', a.ctx);
  await new Promise(function (r) { setImmediate(r); });
  const m = a.담긴것[0].meta;
  assert.equal(m.by, 'U1');
  assert.equal(m.byName, '권형하');
  assert.ok(m.takenAt && m.upAt, '때가 없으면 어느 해 자리에 담을지 모릅니다');
  assert.equal(m.via, 'pucam',
    '★ 어디서 들어왔는지 안 적으면, 화질 이야기가 나왔을 때 짚을 자료가 없습니다');
  assert.ok(m.srcW > 0 && m.w > 0, '원본·담은 화소를 함께 적어야 합니다');
});

test('★★ 화면이 아직 준비 안 됐으면 «안 찍는다» — 빈 사진을 담지 않는다', async () => {
  const a = 앱({ w: 0, h: 0 });
  vm.runInContext('me = { uid: "U1", email: "p001@pureun.kr" }; shoot();', a.ctx);
  await new Promise(function (r) { setImmediate(r); });
  assert.equal(a.담긴것.length, 0,
    '★★ 검은 화면을 그대로 담으면 「찍었는데 까맣다」가 됩니다');
});

test('★★★ 담기에 실패하면 «말을 한다» — 조용히 넘기면 그 사진은 영영 없다', async () => {
  const a = 앱({ saveFails: true });
  vm.runInContext('me = { uid: "U1", email: "p001@pureun.kr" }; shoot();', a.ctx);
  await new Promise(function (r) { setImmediate(r); });
  await new Promise(function (r) { setImmediate(r); });
  const 줄 = vm.runInContext('shots.map(function(s){return s.up;}).join(",")', a.ctx);
  assert.equal(줄, '실패',
    '★★★ 실패를 「됨」으로 두면 찍은 줄 알고 지나갑니다 — 그 사진은 어디에도 없습니다');
});

test('★ 방금 찍은 것이 줄에 쌓인다 — 그것이 「찍은 것만 확인」이다', async () => {
  const a = 앱();
  vm.runInContext('me = { uid: "U1", email: "p001@pureun.kr" }; shoot(); shoot(); shoot();', a.ctx);
  await new Promise(function (r) { setImmediate(r); });
  assert.equal(vm.runInContext('shots.length', a.ctx), 3);
  assert.equal(a.el.strip.style.display, 'block', '★ 찍었는데 줄이 안 뜹니다');
  assert.match(a.el.stripRow.innerHTML, /<img/, '★ 그림이 없으면 무엇을 찍었는지 모릅니다');
});

test('★ 줄은 끝없이 늘지 않는다 — 사진은 사진첩에 있다', async () => {
  const a = 앱();
  let s = 'me = { uid: "U1", email: "x" };';
  for (let i = 0; i < 20; i++) s += 'shoot();';
  vm.runInContext(s, a.ctx);
  await new Promise(function (r) { setImmediate(r); });
  const n = vm.runInContext('shots.length', a.ctx);
  assert.ok(n <= 12, '★ 줄에 ' + n + '장이 쌓였습니다 — 폰 메모리가 그만큼 미리보기를 듭니다');
  assert.equal(a.담긴것.length, 20, '줄에서 밀려나도 «담기는 것»은 다 담겨야 합니다');
});

test('★★ 지우기도 «공용 층»으로 — 직접 지우면 휴지통·되살리기를 건너뛴다', async () => {
  const a = 앱();
  vm.runInContext('me = { uid: "U1", email: "x" }; shoot();', a.ctx);
  await new Promise(function (r) { setImmediate(r); });
  vm.runInContext('dropShot(shots[0].id)', a.ctx);
  assert.equal(vm.runInContext('shots.length', a.ctx), 0);
  assert.ok(a.담긴것.지움, '★★ 저장 층의 지우기를 안 부르면 사진첩에 그대로 남습니다');
});

test('★ 지울지 «묻는다» — 되돌릴 수 없는 일은 한 번 묻는다', async () => {
  const a = 앱({ confirm: false });
  vm.runInContext('me = { uid: "U1", email: "x" }; shoot();', a.ctx);
  await new Promise(function (r) { setImmediate(r); });
  vm.runInContext('dropShot(shots[0].id)', a.ctx);
  assert.equal(vm.runInContext('shots.length', a.ctx), 1, '★ 안 묻고 지웁니다');
});

/* ══════ ④ 깔아 둔 아이콘이 깨지지 않는다 ═══════════════════════════════ */

test('★★ 주소·이름·아이콘을 바꾸지 않는다 — 폰에 깔아 둔 분들의 아이콘이 깨진다', () => {
  const mf = JSON.parse(fs.readFileSync(path.join(R, 'pu-camera-manifest.json'), 'utf8'));
  assert.equal(mf.start_url, './pu-camera.html');
  assert.equal(mf.name, '푸른카메라');
  assert.equal(mf.display, 'standalone', '★ 제 창으로 안 뜨면 그냥 웹페이지입니다');
  assert.ok(!/기업정보함/.test(mf.description),
    '★ 2026-08-08 에 없어진 동작입니다 — 그 말을 믿으면 엉뚱한 데서 사진을 찾습니다');
});

test('★ 로그인은 포털 하나로 — 여기서 새 로그인 길을 만들지 않는다', () => {
  assert.ok(!/signInWith|GoogleAuthProvider|createUserWith/.test(몸통),
    '★ 로그인 길이 둘이 되면 한쪽만 고쳐지고, 그쪽으로 들어온 사람은 권한이 다릅니다');
  assert.match(CAM, /enter\.html/, '★ 로그인 안 된 사람에게 갈 곳을 알려 줘야 합니다');
});
