/* 푸른 통합 서비스워커 — 기업정보함·사진첩 「공유 받기」 + PWA 설치 셸을 하나로 합침
   ═══════════════════════════════════════════════════════════════════════════
   ★ 왜 하나로 합쳤나
   서비스워커는 **한 scope에 하나만** 살아남는다. 예전에는 네 앱이 저마다
   자기 워커를 기본 scope(/pureunall/)에 등록했다 —
     pu-cards-sw.js · pu-photos-sw.js · work-sw.js · pu-camera-sw.js
   나중에 연 앱의 워커가 앞의 것을 밀어내므로, 예를 들어
     · 푸른사진첩을 열면  → 기업정보함 [공유→푸른기업정보함] 이 죽고
     · 업무관리나 푸른카메라를 열면 → 두 앱의 공유가 **모두** 죽었다
       (이 둘의 워커는 하는 일이 없는 설치용 껍데기라 공유 POST를 안 받는다)
   공유 대상 주소가 둘 다 /pureunall/ 아래라서 scope를 좁혀 나눌 수도 없다.
     · 기업정보함  : POST /pureunall/pu-cards-share
     · 사진첩  : POST /pureunall/pu-photos.html
   그래서 **같은 파일 하나를 네 앱이 함께 등록**한다. 같은 주소·같은 scope면
   다시 등록해도 밀어내기가 일어나지 않는다.

   ★ 2026-11-15 이알피도 이 파일로 들어왔다. 이알피만 자기 일꾼(pu-erp-sw.js)을
     같은 scope 에 등록해 위 약속을 어기고 있었다 — 이알피를 연 뒤에는 기업정보함·
     사진첩·급여데이터함·문서뷰어의 공유가 죽고, 다른 앱을 연 뒤에는 이알피 공유가 죽었다.
     이알피 몫은 아래 takeErp(받은 사진을 사진첩 받은 함에 넣는다)이다.
     ⚠ scope 를 좁히지 않은 등록은 «어느 화면이든» 이 파일이어야 한다 —
       tests/sw-one-root-worker.test.js 가 저장소의 모든 html·js 를 훑어 지킨다.

   ※ 포털 웹푸시(firebase-messaging-sw.js)는 여기 끼우지 않는다. 그쪽은
     /pureunall/push/ 로 scope를 좁혀 등록하므로 애초에 서로 부딪히지 않는다.
     푸른캘린더 공유(pu-cal-share-sw.js)도 /pureunall/cal-share/ 로 좁혀 따로 산다.

   ⚠ 이 워커는 **아무것도 캐시하지 않는다.**
   캐시를 두면 pu-version.js 의 「새 버전 자동 적용」과 싸워 옛 화면이 남는다.
   그래서 공유 POST 말고는 손도 대지 않고 흘려보낸다 —
   respondWith 를 부르지 않으면 브라우저가 평소대로 처리한다.

   ⚠ 애플(아이폰)은 웹앱을 공유 목록에 올리는 것을 막아 두었다. 공유는 안드로이드 전용이다. */

self.addEventListener('install', function () {
  /* 기다리지 않고 바로 새 일꾼으로 바꾼다 — 옛 일꾼이 남아 공유를 놓치면
     쓰는 사람 눈에는 "가끔 안 된다"로 보인다. */
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(self.clients.claim());
});

var CARDS_SHARE = '/pu-cards-share';    // 기업정보함 manifest 의 share_target.action
var PHOTOS_SHARE = '/pu-photos.html';   // 사진첩 manifest 의 share_target.action
var PAYDATA_SHARE = '/pu-paydata.html'; // 급여데이터함 manifest 의 share_target.action
var VIEWER_SHARE = '/pu-viewer.html';   // 문서뷰어 manifest 의 share_target.action
var ERP_SHARE = '/pu-erp.html';         // 이알피 manifest 의 share_target.action (받은 것은 사진첩 함으로 간다)

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'POST') return;          // GET 등은 건드리지 않는다(캐시 없음)
  var url;
  try { url = new URL(e.request.url); } catch (_) { return; }
  var p = url.pathname;
  if (p.slice(-CARDS_SHARE.length) === CARDS_SHARE) { e.respondWith(takeCards(e.request)); return; }
  if (p.slice(-PHOTOS_SHARE.length) === PHOTOS_SHARE) { e.respondWith(takePhotos(e.request, url)); return; }
  if (p.slice(-PAYDATA_SHARE.length) === PAYDATA_SHARE) { e.respondWith(takePaydata(e.request, url)); return; }
  if (p.slice(-VIEWER_SHARE.length) === VIEWER_SHARE) { e.respondWith(takeViewer(e.request, url)); return; }
  if (p.slice(-ERP_SHARE.length) === ERP_SHARE) { e.respondWith(takeErp(e.request, url)); return; }
});

/* 303 — 받은 POST 를 GET 으로 바꿔 돌려보낸다(새로고침해도 다시 안 보낸다) */
function redirect(to) {
  return Response.redirect(new URL(to, self.location).href, 303);
}

/* ══════════ 기업정보함: 공유받은 이미지를 Cache 에 잠깐 둔다 ══════════
   pu-cards.html 이 ?shared=1 로 돌아와 'pucards-share' 캐시에서 꺼내 쓴다.
   키 이름(shared-files · shared-N)은 읽는 쪽과 짝이라 바꾸면 안 된다. */
function takeCards(req) {
  return (async function () {
    try {
      var form = await req.formData();
      var files = form.getAll('images').filter(function (f) { return f && f.size; });
      /* 앞선 공유에서 남은 shared-1..N 그림이 새 공유 뒤에 섞여 남지 않도록 먼저 비운다 */
      await caches.delete('pucards-share');
      var cache = await caches.open('pucards-share');
      await cache.put('shared-files', new Response(JSON.stringify({ n: files.length })));
      for (var i = 0; i < files.length; i++) {
        await cache.put('shared-' + i, new Response(files[i], {
          headers: { 'Content-Type': files[i].type || 'image/jpeg' }
        }));
      }
    } catch (err) {
      if (self.console) console.warn('[기업정보함 공유 받기]', err);
    }
    return redirect('./pu-cards.html?shared=1');
  })();
}

/* ══════════ 사진첩: 공유받은 사진을 IndexedDB 에 잠깐 둔다 ══════════
   Blob 그대로 담는다 — base64 로 바꾸면 용량이 1.33배가 되고 느리다.
   pu-photos.html 이 ?share=1 로 돌아와 꺼내 확인 화면을 띄운다. */
var IDB_NAME = 'pu-photos-share', IDB_STORE = 'inbox', IDB_VER = 1;

function openIdb() {
  return new Promise(function (res, rej) {
    var r = indexedDB.open(IDB_NAME, IDB_VER);
    r.onupgradeneeded = function () {
      var d = r.result;
      if (!d.objectStoreNames.contains(IDB_STORE)) {
        d.createObjectStore(IDB_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    r.onsuccess = function () { res(r.result); };
    r.onerror = function () { rej(r.error); };
  });
}

function keepPhotos(files) {
  return openIdb().then(function (db) {
    return new Promise(function (res, rej) {
      var tx = db.transaction(IDB_STORE, 'readwrite');
      var st = tx.objectStore(IDB_STORE);
      var at = Date.now();
      files.forEach(function (f, i) {
        st.add({ blob: f, name: f.name || ('공유사진_' + (i + 1)), type: f.type || '', at: at });
      });
      tx.oncomplete = function () { db.close(); res(files.length); };
      tx.onerror = function () { db.close(); rej(tx.error); };
    });
  });
}

function takePhotos(req, url) {
  var back = url.origin + url.pathname;
  return req.formData().then(function (fd) {
    /* manifest 의 params.files[0].name 과 같은 이름이어야 한다 */
    var files = fd.getAll('photos').filter(function (f) {
      return f && typeof f === 'object' && f.size > 0;
    });
    if (!files.length) return 0;
    return keepPhotos(files);
  }).then(function (n) {
    /* 한 장도 못 받았으면 그 사실을 화면에 알린다 — 조용히 넘기면
       "공유했는데 아무 일도 없다"가 되고, 사람은 올라간 줄 안다. */
    return redirect(back + (n ? '?share=1' : '?share=none'));
  }).catch(function (err) {
    if (self.console) console.warn('[사진첩 공유 받기]', err);
    return redirect(back + '?share=err');
  });
}

/* ══════ 이알피: 받은 사진은 «사진첩의 받은 함»에 넣고 사진첩 화면으로 넘긴다 ══════
   대표 지시 2026-09-17 「이알피에도 공유받기 붙여라」 — 2026-11-15 옛 pu-erp-sw.js 에서 옮겨 왔다.
   까닭 — 이알피에는 사진이 들어갈 «자리»가 없다. 사진은 사건·업체·계약에 붙는 것이라
   어느 건인지 모르는 채로는 넣을 데가 없다. 사진첩은 받아서 «명함 판독»까지 하고
   기업정보함으로 넘기는 길이 이미 있다 — 그 길로 태우는 것이 가장 짧다.
   그래서 담는 곳은 사진첩 몫과 «같은» keepPhotos 다(이름·판 번호를 따로 들지 않는다 —
   따로 들면 언젠가 어긋나 사진첩이 빈 함을 열고 「보낸 게 없다」고 한다).
   ⚠ 파일 칸 이름은 pu-erp-manifest.json 의 params.files[0].name 과 짝이다. */
function takeErp(req, url) {
  /* 넘길 곳은 «이 앱과 같은 폴더»의 사진첩이다 — 주소를 손으로 붙이지 않고 받은 주소에서 만든다 */
  var photos = url.origin + url.pathname.slice(0, url.pathname.length - ERP_SHARE.length) + PHOTOS_SHARE;
  return req.formData().then(function (fd) {
    var files = fd.getAll('photos').filter(function (f) {
      return f && typeof f === 'object' && f.size > 0;
    });
    if (!files.length) return 0;
    return keepPhotos(files);
  }).then(function (n) {
    /* 한 장도 못 받았으면 그 사실을 사진첩 화면이 알린다 — 조용히 넘기면
       "공유했는데 아무 일도 없다"가 되고, 사람은 올라간 줄 안다. */
    return redirect(photos + (n ? '?share=1' : '?share=none'));
  }).catch(function (err) {
    if (self.console) console.warn('[이알피 공유 받기]', err);
    return redirect(photos + '?share=err');
  });
}

/* ══════ 급여데이터함: 공유받은 자료를 IndexedDB 에 잠깐 둔다 ══════
   사진첩과 같은 방식이지만 자리(store)는 따로 둔다 — 한 IndexedDB를 같이
   쓰면 두 앱이 서로의 대기분을 집어가 버릴 수 있다. */
var PAYDATA_IDB_NAME = 'pu-paydata-share', PAYDATA_IDB_STORE = 'inbox', PAYDATA_IDB_VER = 1;

function openPaydataIdb() {
  return new Promise(function (res, rej) {
    var r = indexedDB.open(PAYDATA_IDB_NAME, PAYDATA_IDB_VER);
    r.onupgradeneeded = function () {
      var d = r.result;
      if (!d.objectStoreNames.contains(PAYDATA_IDB_STORE)) {
        d.createObjectStore(PAYDATA_IDB_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    r.onsuccess = function () { res(r.result); };
    r.onerror = function () { rej(r.error); };
  });
}

function keepPaydata(files) {
  return openPaydataIdb().then(function (db) {
    return new Promise(function (res, rej) {
      var tx = db.transaction(PAYDATA_IDB_STORE, 'readwrite');
      var st = tx.objectStore(PAYDATA_IDB_STORE);
      var at = Date.now();
      files.forEach(function (f, i) {
        st.add({ blob: f, name: f.name || ('공유자료_' + (i + 1)), type: f.type || '', at: at });
      });
      tx.oncomplete = function () { db.close(); res(files.length); };
      tx.onerror = function () { db.close(); rej(tx.error); };
    });
  });
}

function takePaydata(req, url) {
  var back = url.origin + url.pathname;
  return req.formData().then(function (fd) {
    var files = fd.getAll('photos').filter(function (f) {
      return f && typeof f === 'object' && f.size > 0;
    });
    if (!files.length) return 0;
    return keepPaydata(files);
  }).then(function (n) {
    return redirect(back + (n ? '?share=1' : '?share=none'));
  }).catch(function (err) {
    if (self.console) console.warn('[급여데이터함 공유 받기]', err);
    return redirect(back + '?share=err');
  });
}

/* ══════ 문서뷰어: 공유받은 파일을 IndexedDB 에 «잠깐만» 둔다 ══════
   화면(js/pu-viewer-app.js takeShared)이 ?share=1 로 돌아와 꺼내면서 «바로 지운다» — 파일 내용을 남기지 않는다.
   자리(store)는 따로 둔다 — 사진첩·급여데이터함의 대기분과 섞이면 서로 집어가 버린다.
   ⚠ 파일 이름 칸(manifest params.files[0].name)은 'docs' — manifest 와 짝이라 바꾸면 안 된다. */
var VIEWER_IDB_NAME = 'pu-viewer-share', VIEWER_IDB_STORE = 'inbox', VIEWER_IDB_VER = 1;

function openViewerIdb() {
  return new Promise(function (res, rej) {
    var r = indexedDB.open(VIEWER_IDB_NAME, VIEWER_IDB_VER);
    r.onupgradeneeded = function () {
      var d = r.result;
      if (!d.objectStoreNames.contains(VIEWER_IDB_STORE)) {
        d.createObjectStore(VIEWER_IDB_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    r.onsuccess = function () { res(r.result); };
    r.onerror = function () { rej(r.error); };
  });
}

function keepViewer(files) {
  return openViewerIdb().then(function (db) {
    return new Promise(function (res, rej) {
      var tx = db.transaction(VIEWER_IDB_STORE, 'readwrite');
      var st = tx.objectStore(VIEWER_IDB_STORE);
      var at = Date.now();
      files.forEach(function (f, i) {
        st.add({ blob: f, name: f.name || ('공유문서_' + (i + 1)), type: f.type || '', at: at });
      });
      tx.oncomplete = function () { db.close(); res(files.length); };
      tx.onerror = function () { db.close(); rej(tx.error); };
    });
  });
}

function takeViewer(req, url) {
  var back = url.origin + url.pathname;
  return req.formData().then(function (fd) {
    var files = fd.getAll('docs').filter(function (f) {
      return f && typeof f === 'object' && f.size > 0;
    });
    if (!files.length) return 0;
    return keepViewer(files);
  }).then(function (n) {
    return redirect(back + (n ? '?share=1' : '?share=none'));
  }).catch(function (err) {
    if (self.console) console.warn('[문서뷰어 공유 받기]', err);
    return redirect(back + '?share=err');
  });
}
