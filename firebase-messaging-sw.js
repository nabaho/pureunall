/* 푸른 통합포털 웹푸시 서비스워커 — 브라우저를 닫아둬도 새 건의 알림을 받는다.
 *
 * ⚠ 이 워커는 반드시 좁은 scope(앱 뿌리/push/ — 옛 주소 /pureunall/push/, 새 주소 /push/)로 등록한다.
 *   서비스워커는 한 scope에 하나만 살아남는다. 기본 scope(앱 뿌리)로 등록하면
 *   기업정보함 공유 수신용 pu-cards-sw.js 를 밀어내 [공유→푸른기업정보함]이 죽는다.
 *   등록은 enter.html 의 pushEnable() 이 scope를 지정해 처리한다.
 *
 * 서버(functions/index.js notifySuggestion)는 data 전용 메시지를 보낸다.
 * notification 필드를 함께 보내면 브라우저가 자체 알림을 띄워 알림이 두 번 뜬다.
 */
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDkZz5QlKSoqMOYByp5YGeMNLNDrIghliA',
  projectId: 'pureun-erp',
  messagingSenderId: '936817166182',
  appId: '1:936817166182:web:9bd31f70d0afdf5fca2aa7'
});

/* ★ 앱 뿌리(APP_BASE) — 이 워커 파일이 놓인 폴더다 (2026-11-15 ERP 주소 이사 준비).
     옛 주소 nabaho.github.io 에서는 /pureunall/, 새 주소 erp.pureunlabor.co.kr 에서는 / 이다.
     서버는 알림 주소를 옛 꼴(/pureunall/x)로 보낸다 — 새 주소에서 그대로 열면 404 라서 앞머리를 떼어 맞춘다.
     위치를 못 읽는 곳(검사 등)에서는 옛 꼴로 둔다. */
function appBaseOf(loc) {
  try {
    var p = String((loc && loc.pathname) || '');
    if (p.charAt(0) !== '/') return '/pureunall/';
    return p.slice(0, p.lastIndexOf('/') + 1) || '/';
  } catch (err) {
    return '/pureunall/';
  }
}
var APP_BASE = appBaseOf(typeof self !== 'undefined' && self ? self.location : null);
var PORTAL_URL = APP_BASE + 'enter.html?sg=1';

/* 옛 꼴(/pureunall/x) 주소를 «지금 앱 뿌리»에 맞춘다 — 새 주소(뿌리 /)에서만 앞머리를 뗀다.
   옛 주소에서는 손대지 않는다(다른 저장소 길 /other/… 을 /pureunall/ 안으로 끌어들이지 않게). */
function toAppPath(p) {
  p = String(p || '');
  if (APP_BASE === '/') return p.replace(/^\/pureunall(?=\/)/, '');
  return p;
}

/* ★ 알림 클릭 이동 주소는 «같은 출처(origin) + 앱 뿌리(APP_BASE) 안쪽» 만 허용한다 (2026-11-11 폰 보안 점검).
   외부 도메인·javascript:·다른 경로가 들어오면 기본 포털 주소로 되돌려 오픈 리다이렉트를 막는다. */
function safePortalUrl(raw) {
  try {
    var hasLoc = typeof URL === 'function' && typeof self !== 'undefined' && self && self.location && self.location.origin;
    if (!hasLoc) {
      var s = toAppPath(String(raw || PORTAL_URL));
      if (s.indexOf(APP_BASE) === 0 && s.charAt(APP_BASE.length) !== '/' && !/[\r\n\\]/.test(s)) return s;
      return PORTAL_URL;
    }
    var base = self.location.origin;
    var u = new URL(String(raw || PORTAL_URL), base);
    if (u.origin !== base) return new URL(PORTAL_URL, base).href;
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return new URL(PORTAL_URL, base).href;
    var p = toAppPath(u.pathname);
    /* 뿌리 바로 뒤에 빗금이 또 오면(예: /pureunall//evil.com → 새 주소에서 //evil.com) 다른 집 주소처럼 읽힐 수 있다 — 막는다 */
    if (p.indexOf(APP_BASE) !== 0 || p.charAt(APP_BASE.length) === '/') return new URL(PORTAL_URL, base).href;
    return base + p + u.search + u.hash;
  } catch (err) {
    return PORTAL_URL;
  }
}

firebase.messaging().onBackgroundMessage(function (payload) {
  var d = (payload && payload.data) || {};
  self.registration.showNotification(d.title || '푸른노무법인', {
    body: d.body || '',
    icon: APP_BASE + 'icon-192.png',
    /* ⚠ badge 는 폰 맨 위 상태줄의 작은 아이콘이다. 안드로이드는 «모양(투명도)만» 쓰고 흰색으로 칠한다.
       바탕이 꽉 찬 icon-192.png 를 주면 «흰 네모» 가 된다(2026-10-12 대표 「누구건지 모르겠다」).
       투명 바탕 + 「푸」 획만 있는 그림을 준다 — 만들개: scripts/make-badge-icon.js */
    badge: APP_BASE + 'icon-badge-96.png',
    tag: d.tag || 'pu-suggestion',      // 같은 tag면 알림이 쌓이지 않고 최신 것으로 갈린다
    renotify: true,
    /* 🚗 출장 출발 알림은 누를 때까지 남긴다 — 운전 준비 중에 사라지면 못 찾는다(2026-10-09) */
    requireInteraction: /^pu-trip-/.test(d.tag || ''),
    data: { url: safePortalUrl(d.url || PORTAL_URL) }
  });
});

/* 알림을 누르면 이미 열려 있는 포털 탭으로 — 없으면 새로 연다 */
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = safePortalUrl((e.notification.data && e.notification.data.url) || PORTAL_URL);
  var hasLoc = typeof URL === 'function' && typeof self !== 'undefined' && self && self.location && self.location.origin;
  var targetUrl = null;
  if (hasLoc) {
    try { targetUrl = new URL(url, self.location.origin); } catch (_) {}
  }
  var getPath = function (v) {
    var m = String(v || '').match(/^(?:https?:\/\/[^/?#]+)?(\/[^?#]*)/);
    return m ? m[1] : '';
  };
  var targetPath = targetUrl ? targetUrl.pathname : getPath(url);
  /* ⚠ «그 알림이 가리키는 화면»이 열려 있을 때만 그 탭으로 간다 (2026-10-04).
       예전에는 포털 탭이 있으면 무엇이든 거기로 갔다 — 메일 신규 문의 알림을 눌러도
       포털 건의함이 떴다. 같은 출처 + 경로(pathname)로 정확히 견준다. */
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      /* 🚗 출장 알림(trip=)은 «그 일정»을 열어야 한다 — 이미 열린 달력 탭으로 가면 출장 카드가 안 뜬다.
           달력 탭은 이 워커가 다스리지 않아(scope /push/) 주소를 바꿔 줄 수도 없다 → 새로 연다 */
      if (String(url).indexOf('trip=') < 0 && targetPath) {
        for (var i = 0; i < list.length; i++) {
          try {
            if (hasLoc && targetUrl) {
              var cu = new URL(list[i].url);
              if (cu.origin === targetUrl.origin && cu.pathname === targetUrl.pathname && 'focus' in list[i]) {
                return list[i].focus();
              }
            } else if (getPath(list[i].url) === targetPath && 'focus' in list[i]) {
              return list[i].focus();
            }
          } catch (_) {}
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
