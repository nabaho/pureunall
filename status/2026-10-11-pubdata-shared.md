상태: 이어하기 대기
이어하기시도: 0
작업폴더: C:\Users\fair0\Documents\pu-wt-pubdata
가지: pubdata-shared

# 2026-10-11 · 🗂 공공데이터 공용 자리 pubdata (대표 「추천대로」→ 목업 → 「진행」)

한 번 받아(서버) 한 곳(pubdata)에 두고 모든 프로그램이 읽는다. 열쇠 = 사업자번호 10자리.

## 단계
1. [x] 규칙: pubdata 직원 읽기·쓰기 막음(서버만) · pubdata_req 받아 달라 요청 · 읽기 도구 js/pu-pubdata.js · 온톨로지 INFRA_ROOTS
2. [x] 서버(nps-monthly.js): pubdata/co/{번호}/nps·ei 씀 + 한 달은 옛 자리(pucards/coInfo)도 · 요청 처리 · 공휴일 pubdata/common/holidays/{연도}
3. [ ] 기업정보함이 pubdata 읽기 + 있는 자료 한 번 옮김
4. [ ] 공휴일: 캘린더·이알피·급여관리 · 손입력 약정휴일 그대로
5. [ ] 옛 자리 쓰기 멈춤(11월 중순 이후) · 업체관리 한 줄

## 끝낸 것 / 남은 일
- 1·2단계: PR(pubdata-shared). 규칙은 10/11 콘솔에 올림(새 자리 pubdata·pubdata_req 둘, 사라진 것 0). 읽기 = pucards 와 같은 MAIL — 보는 사람 안 늘어남.
- 서버: functions/pubdata.js, nps-monthly 가 pubdata+옛 자리 둘 다 씀, 공휴일 올해·내년, pubdataAsk(요청 처리, 그 회사 한 곳만 읽음), nts-monthly 상태도 pubdata/co/{번호}/nts.
- ⚠ 합친 뒤 함수 배포: npsMonthly · ntsMonthly · pubdataAsk(새).
- 남은 일: 3단계(기업정보함 읽기 전환·자료 옮기기) → 4단계(공휴일 화면들).
