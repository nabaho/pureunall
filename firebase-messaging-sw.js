/* 푸른 통합포털 웹푸시 서비스워커 — 브라우저를 닫아둬도 새 건의 알림을 받는다.
 *
 * ⚠ 이 워커는 반드시 좁은 scope(/pureunall/push/)로 등록한다.
 *   서비스워커는 한 scope에 하나만 살아남는다. 기본 scope(/pureunall/)로 등록하면
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

var PORTAL_URL = '/pureunall/enter.html?sg=1';

/* ★ 알림 클릭 이동 주소는 «같은 출처(origin) + /pureunall/ 안쪽» 만 허용한다 (2026-11-11 폰 보안 점검).
   외부 도메인·javascript:·다른 경로가 들어오면 기본 포털 주소로 되돌려 오픈 리다이렉트를 막는다. */
function safePortalUrl(raw) {
  try {
    var base = (self.location && self.location.origin) || 'https://nabaho.github.io';
    var u = new URL(String(raw || PORTAL_URL), base);
    if (u.origin !== base) return new URL(PORTAL_URL, base).href;
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return new URL(PORTAL_URL, base).href;
    if (!/^\/pureunall\//.test(u.pathname)) return new URL(PORTAL_URL, base).href;
    return u.href;
  } catch (err) {
    return PORTAL_URL;
  }
}

firebase.messaging().onBackgroundMessage(function (payload) {
  var d = (payload && payload.data) || {};
  self.registration.showNotification(d.title || '푸른노무법인', {
    body: d.body || '',
    icon: '/pureunall/icon-192.png',
    /* ⚠ badge 는 폰 맨 위 상태줄의 작은 아이콘이다. 안드로이드는 «모양(투명도)만» 쓰고 흰색으로 칠한다.
       바탕이 꽉 찬 icon-192.png 를 주면 «흰 네모» 가 된다(2026-10-12 대표 「누구건지 모르겠다」).
       투명 바탕 + 「푸」 획만 있는 그림을 준다 — 만들개: scripts/make-badge-icon.js */
    badge: '/pureunall/icon-badge-96.png',
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
  var targetUrl = null;
  try { targetUrl = new URL(url, self.location.origin); } catch (_) {}
  /* ⚠ «그 알림이 가리키는 화면»이 열려 있을 때만 그 탭으로 간다 (2026-10-04).
       예전에는 포털 탭이 있으면 무엇이든 거기로 갔다 — 메일 신규 문의 알림을 눌러도
       포털 건의함이 떴다. 같은 출처 + 경로(pathname)로 정확히 견준다. */
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      /* 🚗 출장 알림(trip=)은 «그 일정»을 열어야 한다 — 이미 열린 달력 탭으로 가면 출장 카드가 안 뜬다.
           달력 탭은 이 워커가 다스리지 않아(scope /push/) 주소를 바꿔 줄 수도 없다 → 새로 연다 */
      if (String(url).indexOf('trip=') < 0 && targetUrl) {
        for (var i = 0; i < list.length; i++) {
          try {
            var cu = new URL(list[i].url);
            if (cu.origin === targetUrl.origin && cu.pathname === targetUrl.pathname && 'focus' in list[i]) {
              return list[i].focus();
            }
          } catch (_) {}
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
