# 2026-10-09 · 푸른 캘린더 — 🚗 출장 출발 알림 (feat/trip-remind)

대표 지시 2026-10-09 「캘린더에 출장장소가 잡히면 한두 시간 이전에 … 폰에 자동으로 이동장소 주소가 연결되게」
→ 「1시간 30분 전 · 대표님만」.

1. **서버 `tripRemind`**(functions/trip-remind.js, 15분마다) — 앞으로 90분 안에 시작하는, 시각·주소 있는 «대표 일정»을
   대표 폰으로 푸시(push-admins.pushOne). 대표 일정 = 만든이·참석자 메일이 대표 사번에 이어짐(gcal_mail_sid) ·
   제목 괄호 표식(기본 「권」, 예 「(권별)」) · 우리 일정 sid P-001 · 대표 나만 보기. 한 일정 한 번(trip_remind/sent).
   설정 trip_remind/config {enabled, leadMin, ownerSid, titleMarks}. 서버 전용 자리(보안규칙 없음).
2. **출장 카드**(pu-cal.html ?trip=…&d=…) — 알림을 누르면 뜬다. [📋 주소 복사하고 제네시스 앱 열기]
   → 안드로이드면 MY GENESIS(com.genesis.apps, 공식 설치 안내의 플레이 주소에서 확인)를 연다. 지도 창에도 🚗 제네시스 앱 단추.
3. **워커**(firebase-messaging-sw.js) — 출장 알림은 누를 때까지 남기고, 누르면 새 창으로 그 일정을 연다
   (달력 탭은 이 워커 scope 밖이라 주소를 바꿔 줄 수 없다).

검사: `tests/trip-remind.test.js` 7개.
⚠ 함수는 사이트 배포로 안 나간다 — `firebase deploy --only functions:tripRemind`.
⚠ 대표 폰이 🔔 폰 알림 등록(fcm_tokens)이 돼 있어야 받는다. 없으면 «보냈다»고 적지 않고 다음 회차에 다시 본다.
남은 일: 폰 실기기에서 복사 + 제네시스 앱 열림 확인.
