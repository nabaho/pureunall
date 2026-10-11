# 2026-10-11 · 푸른 캘린더 — 입력 창 「참석자 추가」·「Google Meet 화상 회의 추가」 줄 (feat/gcal-guests-meet)

대표 지시 2026-10-10 「/goal 완벽하게 구글 캘린더와 똑같이 … 데이터 입력형태」 이어서 — 구글 입력 화면의 마지막 줄들.

1. 「참석자 추가」(메일, 쉼표로 여러 명·스무 명까지) → 구글 attendees. 메일 꼴이 아니면 «어느 것이» 틀렸는지 말하고 막는다.
2. 「Google Meet 화상 회의 추가」 단추(켜면 ✓) → conferenceData.createRequest(hangoutsMeet) + conferenceDataVersion=1.
3. ⚠ 초대 «메일»은 보내지 않는다(sendUpdates=none) — 참석자는 구글 일정에만 붙는다. 줄 아래에 그렇게 적어 둔다.
4. ⚠ Meet 을 구글이 거절하면 일정이 통째로 사라지지 않게 «일정만» 다시 넣는다(화면 createEvent · 서버 proxyOne 모두). 서버는 기록에 「Google Meet 을 구글이 거절해 일정만 넣었습니다」를 남긴다.
5. 새 일정에만(고치기 창에는 없다). 나만 보기는 참석자·Meet 없이. 담당 직원 줄 아이콘은 «배지»로(group 은 참석자가 쓴다).
6. 화면 몸만들기(js/pu-gcal-auth.js) ↔ 서버 bodyOf 같은 셈(검사): 메일 꼴만·소문자·스무 명, Meet 은 meetId 가 있을 때만.

검사: tests/cal-google-form.test.js 3개 + tests/gcal-proxy.test.js 2개(Meet 거절 대비 포함). 전체 24,601 실패 0.
⚠ 서버 gcalProxy 재배포 필요: firebase deploy --only functions:gcalProxy
미확인: 실제 구글이 이 공용 달력에서 Meet 을 만들어 주는지(배포 뒤 시험 일정으로 확인 — 거절돼도 일정은 들어가도록 대비해 둠).
