# 2026-10-10 · 푸른 캘린더 — 여러 날 일정 고치기 · 대표 구글 연결 끊김 알림 (feat/gcal-multiday)

대표 지시 2026-10-10 「추천대로」(남은 제한 정리).

1. **여러 날 일정도 ✏️** — 고치는 창(store:"gcal")에 «끝나는 날» 칸. 종일은 end.date = 끝날+1, 시각 일정은 끝날 그 시각.
   끝 시각이 시작보다 일러도 다른 날이면 받는다. 끝나는 날이 앞이면 막는다(화면·서버 둘 다).
   몸 셈은 화면 몸만들기 ↔ 서버 bodyOf 같은 셈(검사 ⑬). pu-gcal-auth.js v12.
2. **대표 구글 연결 끊김 → 대표 폰 알림** — 서버 대신 넣기·고치기·지우기가 모두 이 연결에 기댄다.
   연결 없음·invalid_grant 이면 12시간에 한 번 푸시(gcal_proxy/alertAt), invalid_grant 는 gcal-link ⑤ 처럼 열쇠를 지워 «다시 연결»이 뜨게.
   잠깐 고장(5xx)에는 알리지도 지우지도 않는다(검사 ⑭).
3. 반복 일정은 «그 날 것만» 그대로 둔다(구글 «이 일정만»과 같다).

검사: tests/gcal-proxy.test.js 14개, 전체 실패 0.
⚠ 함수 배포: `firebase deploy --only functions:gcalProxy,functions:gcalEdit`.
