# 2026-10-07 · 국세청 폐업·대표자 확인을 매달 서버가 (기업정보함 점검 4절 — 대표 결정 「월 1회 자동」)

가지: `feat/nts-monthly-server`

- `functions/nts-monthly.js` → `ntsMonthly`(매달 1일 06:00 서울, asia-northeast3).
  ① 상태 조회(번호만, 30일 안에 물은 곳 건너뜀) ② 등록증 대조(번호·대표자·개업일·상호, 셋 다 있는 곳만).
  적는 자리는 화면 단추와 같다: `pucards/coInfo/{번호}/ntsState·ntsAt·ntsEndDt·ntsMatch·ntsMatchAt·ntsMatchOf`.
  한 일은 `pucards/config/ntsMonthly` 에 남긴다. 결과는 표시만 — 업체·명함을 고치거나 지우지 않는다.
- 대상: 사업자등록증 명함(가장 최근 것)을 번호로 묶고 기업 상세를 얹는다. 잠긴 폴더·지운 명함은 안 본다.
- 열쇠: 서버 비밀 `NTS_KEY` 가 있으면 그것, 없으면 `data/app_config/ntsKey`(화면이 쓰는 자리). runWith secrets 에는 안 넣음.
- 셈은 화면 `coNts*` 와 같다 — `tests/nts-monthly.test.js` 가 둘을 같은 물음으로 돌려 견준다. 화면을 고치면 여기도.
- 실자료로 «안 보내고» 돌려 봄(10/7): 번호 있는 회사 456 · 이번에 물을 곳 141(2통) · 대조할 곳 144(4통) · 대조 못 하는 곳 15.
- 화면의 「🏛 국세청 훑기」·「🧾 전체 대조」 단추는 그대로(급할 때 손으로).

## 배포 — 끝 (2026-10-07)
#2159 합친 뒤 `firebase deploy --only functions:ntsMonthly` 로 올렸다(새로 만듦). 첫 회차는 2026-11-01 06:00 — 그 뒤 `pucards/config/ntsMonthly` 를 한 번 볼 것.
