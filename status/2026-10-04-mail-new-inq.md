# 2026-10-04 · 메일 신규 문의 → 관리자 폰 알림 + 메일함 띠 (mail-new-inq)

- 대표 결정: 받는 곳 「폰 알림 + 메일함 띠」 · 때 「들어오면 바로」 → 목업 「승인」.
- 서버 `functions/mail-new-inquiry.js` — syncMailbox 가 받은메일함 새 줄을 적은 뒤(자동분류 바로 다음) 부른다.
  고르는 것: 제목 문의·상담·견적·의뢰(광고 낱말 빼고) + 공공·자동발송 아님 + 처음 보는 곳
  (이알피 업체·연락처, 명함, 직원, mailCo·mailWho·mailNotCo, 그 회사 도메인 — 개인 메일은 주소째만).
  기록: `mailbox/inq/{d}_{slug}_{u}` (메일함과 같은 칸 — 직원 읽기·서버만 쓰기, 규칙 변경 없음).
  후보가 없는 회차는 아무것도 안 읽는다. 실패해도 동기화는 계속.
- 폰 알림: `functions/push-admins.js` 로 모음 — 새 건의(notifySuggestion)도 이제 이것을 쓴다.
  관리자(퇴사 아님) 기기만, data 전용, 죽은 토큰 정리.
- `firebase-messaging-sw.js`: 알림을 누르면 «그 화면» 경로가 열린 탭으로만 간다
  (예전엔 포털 탭이 있으면 무엇이든 포털로 갔다).
- 화면 `pu-cards.html`: 메일 목록 위 「📥 새 문의 n건」 띠 — 최근 3일, 읽은 것은 빠짐, 이름 누르면 그 메일.
- ⚠ 남은 일(대표): 폰에서 포털 → 건의함 → [🔔 폰 알림] 한 번 켜기. 2026-10-04 등록 기기 0대.
- 검사: tests/mail-new-inquiry.test.js (12, 되돌려 우는지 11가지 확인). 함수 배포: syncMailbox · notifySuggestion.
