# 재무 자동화 1단계 — CMS 자동이체 입금 (2026-10-09, 가지 feat/fin-auto-cms)

## 한 것
- `js/pu-cms-auto.js` — 더빌 출금결과 줄의 상태 읽기·판정(`judgeRows`)·통장 줄 거름. 순수 함수 모듈.
- `scripts/thebill-pull.js` — 더빌에서 출금결과를 «조회와 쪽 넘기기만» 해서 `data/cms_pull` 에 받는다(`--dry` 로 쓰기 없이 시험).
- `pu-erp.html` 이음 — 자동 확정·통장 줄 처리 표시·잇기·되돌리기·스위치(꺼짐이면 아무것도 쓰지 않음).
- 재무관리 › 🤖 자동 처리 화면 — 확인 상자(새 회원코드·중복 달·잇기 제안)와 되돌리기.
- 규칙 — `scripts/make-firebase-rules.js` 에 `cms_pull: finOnly`. `docs/firebase-rules-전체-적용본.json`·`docs/rules-paste.json` 재생성.

## 검사
`tests/cms-auto-core.test.js` · `cms-auto-erp.test.js` · `cms-auto-pull.test.js` 추가.
⚠ `tests/photos-staff-share.test.js` 「콘솔과 한 곳도 다르지 않다」는 `/data/cms_pull` 때문에 규칙 배포 전까지 걸린다(배포 직후 해소 — PENDING 에 넣지 않음).

## 판단 요약 (R1–R13)
- R1 click() 은 허용 두 함수(clickAllowed·clickPage) 안에서만.
- R2 스크립트는 `/data` 에 다중 경로(`cms_pull/rows/…`·`cms_pull/status`)로 쓴다.
- R3 스위치 꺼짐이면 cms_ledger 에도 쓰지 않고 메모리에서만 합친다.
- R4 skip 열쇠 바꿈·지난 done 의 incomeId 찾기는 Task 5 함수 안으로.
- R5 운영(Task 8)은 합쳐진 뒤 대표와 함께.
- R6 dup_month = 출금일과 같은 달에 찍힌 자문료 입금이 이미 있을 때.
- R7 회원코드가 두 업체에 있으면 new_member 확인 상자, _deleted 업체 제외, 출금일 없으면 skip.
- R8 하위 작업 커밋 꼬리표는 쓴 모델 그대로.
- R9 한 cms 날짜는 한 더빌 줄에만 쓴다.
- R10 받기는 30분마다(로그인돼 있을 때만), 로그인 유지 꼼수 없음.
- R13 `data/cms_pull` 은 finOnly, 규칙 배포는 합친 뒤.

## 남은 일
- [ ] 규칙 배포 (`node scripts/rules-deploy.js --deploy`)
- [ ] 대표 Aside 더빌 로그인 뒤 `node scripts/thebill-pull.js --dry` 실측
- [ ] 첫 잇기 제안 목록 확인
- [ ] 스위치 켜기
- [ ] 작업 스케줄러(30분마다, R10)
