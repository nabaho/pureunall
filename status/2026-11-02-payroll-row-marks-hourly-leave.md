# 급여아웃소싱 전 사업장·전 직원 순번·체크(☐/☑)·별표(☆/★) 저장 및 연차 시간차(시간단위 연차) 지원 (2026-11-02)

## 1. 배경 및 요청 사항
- **모든 사업장·모든 사람 번호 + `ㅁ` 체크 + `★` 별표 및 저장·기록**:
  - 사업장 목록·카드와 모든 탭(한눈에 주민번호·급여·근태·연차·퇴직·명세서·신고)의 모든 근로자 줄에 항상 **일련번호(`1, 2, 3…`)**, **체크박스(`☐`/`☑`)**, **별표(`☆`/`★`)**를 표시하고 클릭 즉시 로컬 및 Firebase 서버(`payroll_os/row_marks`)에 누가·언제 표시했는지(`{ chk, star, by, at }`) 저장·기록.
  - 사업장 목록 상단에 **`전체` / `☑ 체크` / `★ 별표`** 필터 버튼과 상단 헤더 회사 줄(`coBarHtml`)에도 즉시 체크·별표 버튼 제공.
- **연차휴가 시간차(시간 단위 연차) 사용 및 자동 환산**:
  - 연차·휴가 대장(`screenLeave`)과 근태 달력(`screenDayCalendar`), 카톡 OCR 파서(`parseKakaoOcrLines`), 급여명세서(`leaveSummaryForSlip`)에서 **시간차(`1h`, `2h 반반차`, `4h 반차` 등 시간 단위 연차)**를 입력·사용할 수 있도록 지원.
  - 사업장 설정(`policyBar`)의 `1일 소정근로시간`(기본 `8h`)을 기준으로 시간차를 일수로 자동 환산(`사용시간 ÷ 1일 소정근로시간`)하고, 잔여 연차를 **일수와 시간(`예: 12.75일 (102h)`)**으로 동시 표시하며 미사용수당도 잔여 시간 기준으로 정확히 산정.

## 2. 변경 파일
- `js/pu-labor-core.js`:
  - `LEAVE_TYPES`에 `quarter`(반반차 0.25일·2시간) 및 `hourleave`(시간차) 추가.
  - `summarizeAttendance`: 일별 `quarter`·`hourleave` 기록의 시간(`leaveHours`)을 집계하여 `합계.연차사용시간` 및 `합계.연차사용`에 합산.
  - `annualLedger`: `사용시간` 및 `policy.dailyContractHours`를 받아 `시간차환산일수`, `총사용일수`, `총사용시간`, `잔여일수`, `잔여시간` 계산.
  - `annualUnusedPay`: `미사용시간`이 주어지면 시간 단위까지 반영하여 미사용수당(`시급 × 미사용시간`) 산정.
- `payroll-os.html` / `pu-erp.html`:
  - `js/pu-labor-core.js?v=7` 버전 갱신.
  - `rowMarkOf`, `toggleRowMark`, `setMarkFilter`, `rowMarkBox`, `addLeaveHours` 추가 및 전 사업장·전 직원 행에 적용.
  - `screenLeave`, `policyBar`, `screenDayCalendar`, `leaveSummaryForSlip`, `parseKakaoOcrLines`에 시간차(`시간차(h)`, `+1h`/`+2h`/`+4h`, `반반차(2h)`/`시간차(시간연차)`) 적용.
- `tests/labor-core.test.js`, `tests/labor-screens.test.js`, `tests/payroll-shell.test.js`:
  - 시간차 환산·수당 계산 및 전 사업장·직원 번호·체크·별표 표시·저장 회귀 테스트 추가.
