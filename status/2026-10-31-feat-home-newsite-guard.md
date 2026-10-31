상태: 완료
이어하기시도: 0
작업폴더: C:\Users\fair0\Documents\pu-wt-home1011
가지: feat/home-newsite-guard

# 2026-10-31 · 새 사이트 지킴이 — 퇴사자 저절로 빼기 + 열쇠·올리기 고장 감시

대표 「앞으로 이런 문제 없게 자동으로 프로그램 되게 해라」 → 「둘 다 (추천)」.
(이런 문제 = 퇴사자가 새 사이트에 남음 · GitHub 열쇠가 죽어도 아무도 모름 · 올리기 길이 처음부터 막혀 있었음 #2826)

## 끝낸 것
- ① 매달 1일 08:00 `monthlyHomepageAuto` 가 내리기를 마친 «뒤» 새 사이트 구성원 쪽도 다시 만들어 올린다.
  규칙 한 곳 `functions/homepage-newsite.js`(화면 «새홈페이지에갈사람»과 같은 잣대 — 안 올림·내린 표시·퇴사 빼고, 사유 있는 남기기는 올림).
  ⚠ 다른 점 하나: 직원과 안 이은 사람을 서버는 이름으로 맞추지 않고 그대로 둔다(«연결없음수»로 셈).
  한꺼번에 3명 넘게 빠지면 올리지 않고 멈춤. 바뀐 것 없으면 안 올림. 결과는 `homepage/auto/newsite`(이름 없음).
- 쪽 그리는 부품은 화면과 같은 코드 — `functions/site-people/` 는 `js/pu-site-people.js` 글자 그대로 사본
  (`node scripts/sync-site-people.js`, `tests/site-people-in-sync.test.js`).
- ② 매일 07:50 `dailyHomepageKeyCheck` — 열쇠로 두 저장소(pureun-site · pureunall 사본)를 읽어 보고 `homepage/auto/keyCheck` 에 남김. 읽기만.
- `publishSite` 가 구성원 쪽을 손으로 올려 성공하면 `homepage/auto/newsite` 를 «손으로 올림»으로 바꾼다 — 고친 뒤 실패 띠가 안 남게.
- ③ 화면(목업 보냄): 막혔을 때만 맨 위 띠 한 줄(열쇠 막힘·자동 올리기 실패 = 빨강, 멈춤·점검 3일 넘게 안 돎 = 노랑) +
  자동 연결 칸에 「새 사이트」 한 줄(올림 N명 · M명 뺌 / 바뀐 것 없음 / 실패 / 아직 안 돎).
- 스케줄 28→29, 포털 자동 일정 설명에 「새 사이트 열쇠 점검 하루 한 번」, 하루 537→538.
- 검사: functions/homepage-newsite.test.js(실제로 돌림 10) · tests/homepage-newsite-server.test.js(서버 입구 4) ·
  tests/home-newsite-guard.test.js(화면 9) · tests/site-people-in-sync.test.js(3). 사본 변형 8종 모두 잡힘.
  바뀐 파일을 읽는 검사 302개 파일 통과.

## 남은 일
- 배포(대표 「배포」 필요): monthlyHomepageAuto · dailyHomepageKeyCheck · publishSite.
- 첫 자동 실행은 배포 뒤 첫 1일 08:00. 첫 열쇠 점검은 배포 다음 날 07:50.
