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

firebase.messaging().onBackgroundMessage(function (payload) {
  var d = (payload && payload.data) || {};
  self.registration.showNotification(d.title || '푸른노무법인', {
    body: d.body || '',
    icon: '/pureunall/icon-192.png',
    badge: '/pureunall/icon-192.png',
    tag: d.tag || 'pu-suggestion',      // 같은 tag면 알림이 쌓이지 않고 최신 것으로 갈린다
    renotify: true,
    /* 🚗 출장 출발 알림은 누를 때까지 남긴다 — 운전 준비 중에 사라지면 못 찾는다(2026-10-09) */
    requireInteraction: /^pu-trip-/.test(d.tag || ''),
    data: { url: d.url || PORTAL_URL }
  });
});

/* 알림을 누르면 이미 열려 있는 포털 탭으로 — 없으면 새로 연다 */
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || PORTAL_URL;
  /* ⚠ «그 알림이 가리키는 화면»이 열려 있을 때만 그 탭으로 간다 (2026-10-04).
       예전에는 포털 탭이 있으면 무엇이든 거기로 갔다 — 메일 신규 문의 알림을 눌러도
       포털 건의함이 떴다. 주소의 경로(? 앞)로 견준다. */
  var path = String(url).split('?')[0];
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      /* 🚗 출장 알림(trip=)은 «그 일정»을 열어야 한다 — 이미 열린 달력 탭으로 가면 출장 카드가 안 뜬다.
           달력 탭은 이 워커가 다스리지 않아(scope /push/) 주소를 바꿔 줄 수도 없다 → 새로 연다 */
      if (String(url).indexOf('trip=') < 0) {
        for (var i = 0; i < list.length; i++) {
          if (list[i].url.indexOf(path) >= 0 && 'focus' in list[i]) return list[i].focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
