# 2026-10-10 · 푸른 캘린더 — 직원 일정을 구글 공용 달력에 «서버가 대신 넣기» (feat/gcal-proxy)

대표 지시 2026-10-10 「직원구글연결되게 해라」 → 「서버가 대신 넣기」.

실측(10-10): 구글 늘 연결은 대표 1명뿐 — 직원이 넣는 새 일정은 my_schedules 에만 남을 판이었다
(지금까지 그렇게 남은 직원 일정은 0건, my_schedules 25건은 모두 외부 협력자).

1. **서버 `gcalProxy`**(functions/gcal-proxy.js, data/my_schedules/v/{id} onWrite)
   - 새로 생긴 직원 일정(외부 협력자·이미 이어진 것 제외) → 대표 늘 연결 표로 구글 공용 달력에 넣고
     `movedToGcal:true · gcalEventId` 표. **지우지 않는다** — 이알피(이번주 일정 등)는 구글을 안 읽는다.
   - 실패하면 기록 그대로 + `gcalProxyErr`.
   - 옮긴 줄을 지우면(삭제표시·통째로) 구글 쪽도 지운다(404·410 은 끝난 것으로).
2. **담당 번호** — 구글에 만든이가 대표 계정으로 찍히므로 `extendedProperties.shared.puSid` +
   설명 「푸른 담당: 이름 (P-005)」. 화면 `gcalToEvent`(일정담당)와 출장 알림이 만든이 메일보다 먼저 본다.
   대표가 직원 일정을 직접 넣을 때(구글에넣기)도 같이 단다. `js/pu-gcal-auth.js` bodyOf ↔ 서버 bodyOf 같은 셈(검사).
3. 화면: 옮긴 줄은 안 그린다(구글을 못 받았으면 그린다). 저장 뒤 6초·20초에 구글을 다시 받는다.

검사: `tests/gcal-proxy.test.js` 7개 · trip-remind ⑦ · 기존 gcalToEvent 검사 둘에 일정담당을 싣도록 맞춤.
⚠ 함수 배포: `firebase deploy --only functions:gcalProxy,functions:tripRemind`.
남은 일: 푸른 캘린더 상세 창에서 구글 일정을 지울 때 이어진 my_schedules 줄(이알피)은 그대로 남는다.
