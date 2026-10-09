# 재무 자동화 1단계 — CMS 자동이체 입금 (2026-10-09, 가지 feat/fin-auto-cms)

## 한 것
- `js/pu-cms-auto.js` — 더빌 출금결과 줄의 상태 읽기·판정(`judgeRows`)·통장 줄 거름. 순수 함수 모듈.
- `scripts/thebill-pull.js` — 더빌에서 출금결과를 «조회와 쪽 넘기기만» 해서 `data/cms_pull` 에 받는다(`--dry` 로 쓰기 없이 시험).
- `pu-erp.html` 이음 — 자동 확정·통장 줄 처리 표시·잇기·되돌리기·스위치(꺼짐이면 아무것도 쓰지 않음).
- 재무관리 › 🤖 자동 처리 화면 — 확인 상자(새 회원코드·중복 달·잇기 제안)와 되돌리기.
- 규칙 — `scripts/make-firebase-rules.js` 에 `cms_pull: finOnly`. `docs/firebase-rules-전체-적용본.json`·`docs/rules-paste.json` 재생성.

## 누가 볼 수 있나
- `data/cms_pull`(더빌 출금 줄: 회사명·금액) — 규칙이 없어 `data/$other` 로 «재직 직원 누구나» 읽고 쓰던 자리였다. 이제 재무 권한자(fin)만.

## 검사
`tests/cms-auto-core.test.js` · `cms-auto-erp.test.js` · `cms-auto-pull.test.js` 추가.
규칙을 콘솔에 올린 뒤 `tests/photos-staff-share.test.js` 도 통과한다(확인함).

- 자동 처리 화면 탭 이름을 `faTab`/`setFaTab` 으로 했다(다른 컴포넌트의 `setTab` 과 이름이 겹쳐 `state-declared-in-own-component` 검사가 걸렸다). 탭 기억(`finauto_tab`)은 유지.

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

## 최종 검토 고침 (2026-10-09)
- ★ **자동 시작일** `app_settings.cmsAutoSince` — 스위치를 켤 때(한국 날짜) 한 번 적힌다. 그 앞 출금 줄은 `old`(미리보기만),
  켜져 있는데 시작일이 없으면 «전부» `old`. 옛 줄이 한꺼번에 자동 확정되지 않게 하는 울타리다.
- `recorded` — 같은 업체(번호, 또는 번호가 «빈» 옛 입금은 이름)·같은 금액·출금일/정산일 ±5일, 또는 같은 받을 달의 자문료가
  이미 있으면 자동 확정하지 않는다. 이름 일치는 «막는 데만» 쓴다(R15). `dup_month` 도 같은 업체 판정.
- 마감은 받을 달뿐 아니라 **입금일의 달**도 본다.
- 더빌 합계 통장 줄은 그날 성공 줄이 **전부** 입금관리에 있을 때만 처리됨. 이름 통장 줄은 ±1일, 이미 가져간 입금(`incomeId`)·CMS 입금은 짝짓지 않는다.
- 통장 처리됨은 `erpMarkBankRowsProcessed` 로 한 번에 저장, 훑는 범위는 시작일 7일 앞(없으면 45일).
- 첫 실행은 `fb_initial_done` 뒤. 입금 id 는 `fi-cms-<safeKey(줄 지문)>`(두 기기가 같이 돌아도 한 건). cms_ledger 는 새 줄이 있을 때만 저장.
- 더빌 탭이 없으면 «Aside 를 켜고 더빌에 로그인». 수수료는 자동으로 안 넣는다는 안내 한 줄.

## 남은 일
- [x] 규칙 배포 — 2026-10-09 콘솔에 올림, 새 기준 `docs/firebase-rules-콘솔원문-2026-10-09.json`
- [ ] 대표 Aside 더빌 로그인 뒤 `node scripts/thebill-pull.js --dry` 실측
- [ ] 첫 잇기 제안 목록 확인
- [ ] 스위치 켜기
- [ ] 작업 스케줄러(30분마다, R10)
- [ ] 더빌 로그인 유지 시간 재기(첫 주)
