/* 푸른이알피 — 「공유 받기」 전용 일꾼 (서비스워커)
   ═══════════════════════════════════════════════════════════════════
   대표 지시 2026-09-17 「이알피에도 공유받기 붙여라」

   폰에서 사진(명함 등)을 「공유 → 푸른이알피」로 보내면 안드로이드가 **POST** 로 보낸다.
   보통 웹페이지는 POST 를 받을 수 없어서(서버가 없다) 이 일꾼이 가로챈다.

   ★★ 받은 사진은 «사진첩의 받은 함»에 그대로 넣고 사진첩 확인 화면으로 넘긴다.
     까닭 — 이알피에는 사진이 들어갈 «자리»가 없다. 사진은 사건·업체·계약에 붙는 것이라
     어느 건인지 모르는 채로는 넣을 데가 없다. 사진첩은 받아서 «명함 판독»까지 하고
     기업정보함으로 넘기는 길이 이미 있다 — 그 길로 태우는 것이 가장 짧다.
     (대표께는 「이알피로 공유해도 된다」가 되고, 뒷일은 사진첩이 한다.)
   ⚠ 같은 origin(github.io/pureunall/) 이라 IndexedDB 를 사진첩과 «함께 쓴다» —
     그래서 이름·판 번호를 pu-photos-sw.js 와 «똑같이» 맞춰야 한다. 어긋나면
     사진첩이 빈 함을 열고 「보낸 게 없다」고 한다.

   ⚠ 이 일꾼은 **아무것도 캐시하지 않는다.** 캐시를 두면 pu-version.js 의
     「새 버전 자동 적용」과 싸워 옛 화면이 남는다(사진첩·업무관리와 같은 까닭).
   ⚠ 애플(아이폰)은 웹앱을 공유 목록에 올리는 것을 막아 두었다. 안드로이드 전용이다. */

var SHARE_PATH = '/pu-erp.html';        // 이 길로 오는 POST 만 공유로 본다
var HAND_TO = 'pu-photos.html?share=1'; // 받은 뒤 넘길 곳(사진첩 확인 화면)
/* ⚠★ 아래 셋은 pu-photos-sw.js 와 «한 글자도» 달라선 안 된다 */
var IDB_NAME = 'pu-photos-share';
var IDB_STORE = 'inbox';
var IDB_VER = 1;

self.addEventListener('install', function () {
  self.skipWaiting();
});
self.addEventListener('activate', function (e) {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function (e) {
  /* 공유 POST 가 아니면 **건드리지 않는다**(캐시도, 가로채기도 없다) */
  if (e.request.method !== 'POST') return;
  var url;
  try { url = new URL(e.request.url); } catch (_) { return; }
  if (url.pathname.slice(-SHARE_PATH.length) !== SHARE_PATH) return;
  e.respondWith(takeShare(e.request, url));
});

function openIdb() {
  return new Promise(function (ok, no) {
    var rq = indexedDB.open(IDB_NAME, IDB_VER);
    rq.onupgradeneeded = function () {
      var db = rq.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE, { autoIncrement: true });
    };
    rq.onsuccess = function () { ok(rq.result); };
    rq.onerror = function () { no(rq.error); };
  });
}

function keep(files) {
  return openIdb().then(function (db) {
    return new Promise(function (ok, no) {
      var tx = db.transaction(IDB_STORE, 'readwrite');
      var st = tx.objectStore(IDB_STORE);
      files.forEach(function (f) {
        st.add({ name: f.name || '공유사진', type: f.type || 'image/jpeg', at: Date.now(), blob: f, via: 'erp' });
      });
      tx.oncomplete = function () { ok(files.length); };
      tx.onerror = function () { no(tx.error); };
    });
  });
}

function takeShare(req, url) {
  /* 넘길 곳은 «이 앱과 같은 폴더»다 — 주소를 손으로 붙이지 않고 기준에서 만든다 */
  var base = url.origin + url.pathname.slice(0, url.pathname.length - SHARE_PATH.length + 1);
  return req.formData().then(function (fd) {
    /* manifest 의 params.files[0].name 과 같은 이름이어야 한다 */
    var files = fd.getAll('photos').filter(function (f) {
      return f && typeof f === 'object' && f.size > 0;
    });
    if (!files.length) return 0;
    return keep(files);
  }).then(function (n) {
    /* 한 장도 못 받았으면 그 사실을 알린다 — 조용히 넘기면
       "공유했는데 아무 일도 없다"가 되고, 사람은 올라간 줄 안다. */
    return redirect(base + (n ? HAND_TO : 'pu-photos.html?share=none'));
  }).catch(function (err) {
    if (self.console) console.warn('[이알피 공유 받기]', err);
    return redirect(base + 'pu-photos.html?share=err');
  });
}

function redirect(to) {
  /* 303 — 받은 POST 를 GET 으로 바꿔 돌려보낸다(새로고침해도 다시 안 보낸다) */
  return Response.redirect(to, 303);
}
