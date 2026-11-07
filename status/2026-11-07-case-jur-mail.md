# 2026-11-07 · 사건 관할기관 «메일에서 가져오기» (A안)

상태: 이어하기 대기
이어하기시도: 0
작업폴더: C:\Users\fair0\Documents\pu-wt-gongmun-case
가지: feat/case-jur-mail
계획: docs/superpowers/plans/2026-11-07-case-jur-mail.md

- 대표 지시(2026-11-07): 「A안으로」 — 사건 수정창 «🏛️ 관할기관» 상자에서 메일함의 공문 메일을 골라 기관·담당자·연락처·이메일 네 칸을 채운다. 💾 저장을 눌러야 사건에 반영.
- 서버 함수·보안규칙·새 DB 자리 없음(메일함 거울 읽기 + 기존 `readMailMessage`).

## 끝낸 것
- 계획서 작성

## 남은 일
- Task 1: `js/pu-case-jur-mail.js` + `tests/case-jur-mail.test.js`
- Task 2: `pu-erp.html` 패널·단추 + `tests/case-jur-mail-screen.test.js`
- Task 3: 화면 확인(PC·폰) · 검사 묶음 · PR (푸시·배포는 사람이 본다 — 감시는 코드·검사·커밋까지만)
