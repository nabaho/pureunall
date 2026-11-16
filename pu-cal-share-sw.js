/* 푸른캘린더 — 「공유 → 푸른캘린더」로 온 캡처·글을 받는 일꾼 (서비스워커, 2026-11-15)
   ═══════════════════════════════════════════════════════════════════
   대표 지시 2026-11-15 「사업장 방문 등이 문자·카톡·메일로 오면 구글캘린더에 넣고 싶다」 → 「공유 버튼 만들기」.

   폰에서 문자·카톡 «캡처»를 「공유 → 푸른캘린더」로 보내면 안드로이드가 **POST** 로 보낸다.
   이 사이트(깃허브 페이지)는 POST 를 받을 서버가 없어서 이 일꾼이 가로채 IndexedDB 에 잠깐 두고
   화면(pu-cal.html)을 ?share=1 로 연다. 화면이 꺼내면서 «바로 지운다» — 사진을 남기지 않는다.
   (2026-10-31 에는 글만 받았다 — GET 은 일꾼 없이 되지만 사진(파일)은 POST 라서 일꾼이 있어야 한다.)

   ★★ scope 를 «./cal-share/» 로 좁혀 등록한다(pu-cal.html). 까닭 —
     서비스워커는 한 scope 에 하나만 산다. /pureunall/ 전체는 통합 워커(pu-sw.js)의 자리다 — 거기에 다른 일꾼을
     끼우면 나중에 연 앱이 앞의 것을 밀어내 서로의 공유가 죽는다(2026-11-15 까지 이알피 워커가 실제로 그랬다).
     좁은 scope 는 «더 긴 주소가 이긴다» 규칙으로 늘 이 일꾼에게 온다 — 웹푸시(/push/)와 같은 방법이다.
   ⚠ 이 일꾼은 **아무것도 캐시하지 않는다.** 캐시를 두면 pu-version.js 의 「새 버전 자동 적용」과 싸운다.
     cal-share/ 아래로 오는 요청만 보고, 그 밖의 주소는 애초에 이 일꾼에게 오지 않는다.
   ⚠ 사진만 받는다(image/*). 한 번에 3장까지(화면 캡처 읽기 한도와 같다) · 한 장 15MB 넘는 것은 버린다.
   ⚠ 새 공유가 오면 앞의 대기분을 «먼저 비운다» — 옛 캡처가 새 공유에 섞이지 않게.
   ⚠ 다른 웹사이트가 보낸 전송은 담지 않는다(아래 fromOtherSite, 2026-11-16 — pu-sw.js 와 같은 잣대).
   ⚠ 이름(IDB_NAME·IDB_STORE·IDB_VER·파일 칸 'images')은 pu-cal.html 공유함 · pu-cal-manifest.json 과 짝이다.
     tests/cal-share-target.test.js 가 셋을 맞대 본다.
   ⚠ 애플(아이폰)은 웹앱을 공유 목록에 올리는 것을 막아 두었다. 안드로이드 전용이다. */

var SHARE_DIR = '/cal-share/';            // manifest share_target.action(./cal-share/) · 등록 scope 와 같다
var BACK = './pu-cal.html';               // 받은 뒤 열 화면
var IDB_NAME = 'pu-cal-share', IDB_STORE = 'inbox', IDB_VER = 1;
var MAX_FILES = 3;
var MAX_BYTES = 15 * 1024 * 1024;
var TEXT_MAX = 2000;

self.addEventListener('install', function () {
  /* 기다리지 않고 바로 새 일꾼으로 — 옛 일꾼이 남아 공유를 놓치면 «가끔 안 된다»로 보인다 */
  self.skipWaiting();
});
self.addEventListener('activate', function (e) {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function (e) {
  var url;
  try { url = new URL(e.request.url); } catch (_) { return; }
  if (url.pathname.slice(-SHARE_DIR.length) !== SHARE_DIR) return;   // 공유 주소가 아니면 손대지 않는다
  if (e.request.method === 'POST') {
    e.respondWith(fromOtherSite(e.request) ? refuseOtherSite(BACK) : take(e.request));
    return;
  }
  /* 공유 주소를 그냥 열면(GET) 깃허브가 404 를 낸다 — 캘린더로 돌려보낸다 */
  if (e.request.mode === 'navigate') e.respondWith(redirect(BACK));
});

/* ══════ 다른 웹사이트가 보낸 «공유»는 담지 않는다 (대표 지시 2026-11-16) ══════
   pu-sw.js 의 같은 이름 두 함수와 «똑같다» — 이 일꾼은 scope 를 좁혀 따로 살아서 불러 쓰지 않고 옮겨 두었다.
   고치면 함께 고친다 — tests/share-target-other-site.test.js 가 공유를 받는 모든 일꾼을 같은 잣대로 돌려 본다.
   폰의 공유는 «보낸 곳»이 비어서 오거나 android-app:// 로 온다. 웹페이지가 보낸 전송에는 그 페이지 주소가
   붙는다 — 그것이 이 일꾼과 같은 폴더(우리 앱) 밖이면 담지 않는다.
   ⚠ 보낸 곳이 비었거나 http(s) 주소가 아니면 받는다 — 폰의 공유가 그렇게 온다(막으면 공유가 죽는다). */
function fromOtherSite(req) {
  var home = new URL('./', self.location);          // 이 일꾼 파일이 사는 폴더(깃허브 /pureunall/)
  var from = '';
  try { from = String(req.referrer || ''); } catch (_) { from = ''; }
  if (/^https?:/i.test(from)) {
    var u;
    try { u = new URL(from); } catch (_) { return true; }
    /* 같은 깃허브 주소라도 폴더가 다르면 다른 저장소의 페이지다 */
    if (u.origin !== home.origin || u.pathname.indexOf(home.pathname) !== 0) return true;
  }
  var origin = '';
  try { origin = String((req.headers && req.headers.get && req.headers.get('origin')) || ''); } catch (_) { origin = ''; }
  if (/^https?:/i.test(origin) && origin !== home.origin) return true;
  return false;
}

/* 거절 화면 — 보낸 곳의 주소나 받은 내용은 화면에 싣지 않는다(남의 글을 우리 화면에 띄우지 않는다) */
function refuseOtherSite(home) {
  var to = String(new URL(home, self.location).href).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
  var html = '<!doctype html><html lang="ko"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>공유를 받지 않았습니다</title></head>' +
    '<body style="margin:0;padding:24px 16px;font-family:system-ui,sans-serif;line-height:1.7;color:#1f2937;background:#fff">' +
    '<h1 style="font-size:20px;margin:0 0 12px">공유를 받지 않았습니다</h1>' +
    '<p style="font-size:16px;margin:0 0 16px">다른 웹사이트에서 보낸 것이라 담지 않았습니다.<br>' +
    '사진·문서는 폰의 갤러리·카톡 등에서 «공유»로 보내 주세요.</p>' +
    '<p style="font-size:16px;margin:0"><a href="' + to + '">앱으로 가기</a></p></body></html>';
  return new Response(html, {
    status: 403,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

/* 303 — 받은 POST 를 GET 으로 바꿔 돌려보낸다(새로고침해도 다시 안 보낸다) */
function redirect(to) {
  return Response.redirect(new URL(to, self.location).href, 303);
}

function 글칸(fd, k) {
  var v = fd.get(k);
  return typeof v === 'string' ? v.trim().slice(0, TEXT_MAX) : '';
}

function 사진인가(f) {
  return !!(f && typeof f === 'object' && f.size > 0 && f.size <= MAX_BYTES && /^image\//.test(String(f.type || '')));
}

function openIdb() {
  return new Promise(function (res, rej) {
    var r = indexedDB.open(IDB_NAME, IDB_VER);
    r.onupgradeneeded = function () {
      var d = r.result;
      if (!d.objectStoreNames.contains(IDB_STORE)) d.createObjectStore(IDB_STORE, { keyPath: 'id', autoIncrement: true });
    };
    r.onsuccess = function () { res(r.result); };
    r.onerror = function () { rej(r.error); };
  });
}

/* 앞의 대기분을 비우고 이번 것 하나만 둔다 */
function keep(rec) {
  return openIdb().then(function (db) {
    return new Promise(function (res, rej) {
      var tx = db.transaction(IDB_STORE, 'readwrite');
      var st = tx.objectStore(IDB_STORE);
      st.clear();
      st.add(rec);
      tx.oncomplete = function () { db.close(); res(true); };
      /* 용량이 모자라 저장이 «중단(abort)»돼도 끝을 알린다 — 안 그러면 공유 화면이 멈춘 채 남는다 */
      tx.onerror = tx.onabort = function () { try { db.close(); } catch (_) {} rej(tx.error || new Error('공유함 저장 중단')); };
    });
  });
}

function take(req) {
  return req.formData().then(function (fd) {
    var files = fd.getAll('images').filter(사진인가).slice(0, MAX_FILES);
    var rec = {
      at: Date.now(),
      title: 글칸(fd, 'title'), text: 글칸(fd, 'text'), url: 글칸(fd, 'url'),
      files: files.map(function (f, i) { return { blob: f, name: String(f.name || ('공유캡처_' + (i + 1))), type: String(f.type || '') }; })
    };
    /* 사진도 글도 없으면 담지 않고 «없음»으로 알린다 — 조용히 넘기면 «공유했는데 아무 일도 없다»가 된다 */
    if (!rec.files.length && !rec.title && !rec.text && !rec.url) return false;
    return keep(rec);
  }).then(function (ok) {
    return redirect(BACK + (ok ? '?share=1' : '?share=none'));
  }).catch(function (err) {
    if (self.console) console.warn('[푸른캘린더 공유 받기]', err);
    return redirect(BACK + '?share=err');
  });
}
