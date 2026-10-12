상태: 완료
이어하기시도: 0
작업폴더: C:\Users\fair0\Documents\pu-wt-govaid-note
가지: feat/govaid-auto-refresh(#2612) · fix/govaid-notice-threshold(#2614) · feat/govaid-notices-tab

# 🎯 정부지원금 — 매년·매일 자동 업데이트 (A 서버 매일 + B 이 PC 정기 조사)

대표 지시 2026-10-12 「매년 사업관련 자동 업데이트 되게 해서 지원사업 업데이트」 → 방식 「둘다」.

## 설계
- A 서버 `govaidNoticeWatch`(서울, 매일 08:10): 기업마당 공고(인증키는 정부사업신청이 쓰는 대표 자리 gov/{uid}/key_biz — 읽기만)
  → `govaid/notices/{공고번호}`(Document, docKind govNotice) 에 쌓고 사전 사업과 «이름이 비슷한» 후보(suggest)를 단다.
  - ⚠ 이름으로 «잇지» 않는다 — 사람이 «이 사업에 잇기»를 눌러 program.bizinfo 에 공고번호가 들어간 것만,
    서버가 그 사업의 접수 상태(closure: 접수기간 지남 → 접수 마감, 기간 안 → 접수 중)를 자동으로 고친다.
  - ⚠ 사람이 표시한 접수 상태(by 가 자동 표식이 아님)는 덮지 않는다.
  - 화면이 govaid 전체를 읽지 않게 programs·prospects·extras·reviews 를 따로 읽고, notices 는 «새 공고» 탭에서만.
- B 이 PC 예약 작업: 매년 1월(새해 사업·조건·서류 → 초안) · 매월 1일(접수 상태 다시 확인 → closure, 확신 높음·중간만).
  스크립트는 저장소 scripts/govaid-refresh/ (마른 돌리기 → 서버 다시 읽어 확인 → 쓰기 → 다시 읽어 확인).

## 진행
- [x] A 순수 로직 functions/govaid-notice-watch.js + 검사 9건
- [x] A 예약 함수 govaidNoticeWatch(index.js) · 규칙 govaid.notices/noticeLast(콘솔에 올림, 다시 읽어 같음) · 온톨로지 쓰기 계약 · 사용액 화면 자동 일정 문구(하루 512번) · 앱이 govaid 를 칸마다 따로 읽기
- [x] A 함수 배포 — govaidNoticeWatch(asia-northeast3) 올림(FUNCTIONS_DISCOVERY_TIMEOUT=60). 같은 run() 을 이 PC 에서 한 번 돌려 운영 공고 함 1,462건 채움(오류 0) · 제안 56건(기준 0.65 — #2614)
- [x] B 스크립트 scripts/govaid-refresh/(common·export·load-close·load-yearly·BRIEF 둘·README) — 오늘 자료로 마른 돌리기 확인
- [x] B 예약 작업 govaid-monthly-closure(매월 1일 09:30) · govaid-yearly-refresh(1월 20일 10:00) — 이 PC 데스크톱 앱이 켜져 있어야 돈다
- [x] 화면 «📰 새 공고» 탭(대표 승인 「네」): 비슷한 공고·전체·인력경영·이은 것·관계없음 / 접수 중만 / 찾기 · ↔ 잇기(사업 bizinfo, 공고에 처리 기록) · ＋초안(공고번호에서 id, 새 자리만, 편집 창 열림) · 관계없음(여럿 고르기) · 편집 창에 기업마당 공고번호 칸. 공고 함은 그 탭을 열 때만 읽음. 운영 공고 1,462건으로 그려 확인
