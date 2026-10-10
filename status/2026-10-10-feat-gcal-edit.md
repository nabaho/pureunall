# 2026-10-10 · 푸른 캘린더 — 구글 일정 고치기·지우기 연동 (feat/gcal-edit)

대표 지시 2026-10-10 「23 연동」 — ② 고친 내용이 구글에 안 감 ③ 상세 창에서 구글 일정을 지워도 이알피 줄이 남음.

1. **상세 창 ✏️·🗑** (구글 일정, 하루짜리) → 고치는 창(store:"gcal") / 지우기 확인.
   서버 `gcalEdit`(functions/gcal-proxy.js, HTTPS, 푸른 로그인 증표)가 대표 늘 연결로 구글을 고치고·지운다.
   - **본인 일정만**(주인 = shared.puSid → 설명 「푸른 담당 (sid)」 → 만든이 메일). 관리자·부관리자는 모두. 담당 바꾸기는 관리자만.
   - 고칠 때 구글 일정을 받아 «나머지(참석자·알림·반복·다른 속성)»는 그대로 두고 PUT.
   - 설명은 「담당자: …」·메모·「푸른 담당: 이름 (sid)」 꼴(descOf ↔ 화면 splitDesc).
   - 이어진 my_schedules 줄(gcalEventId 같음)도 같이 — 고치면 같은 칸(+gcalEditAt=updatedAt), 지우면 삭제표시.
2. **이알피에서 옮긴 줄을 고치면** `gcalProxy` 트리거가 구글도 고친다(syncEdit). 화면 고치기가 맞춘 것은 다시 안 보낸다.
3. 반복 일정은 «그 날 것만» 바뀐다(창에 적어 둠). 여러 날 일정은 ✏️ 를 안 띄운다(구글에서).

검사: tests/gcal-proxy.test.js 12개. pu-gcal-auth.js v11(callServer 내보냄).
⚠ 함수 배포: `firebase deploy --only functions:gcalProxy,functions:gcalEdit`.
