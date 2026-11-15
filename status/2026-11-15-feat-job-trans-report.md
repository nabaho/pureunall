상태: 완료(배포 뒤 실제 화면 확인 대기)
# 2026-11-15 · ⚡ 산업일자리전환 자동화(jobtrans.html) — 능률협회(KMAC) · 충남경제진흥원(CEPA) 맞춤 중간·최종보고서 · HWPX · 푸른한글 연동

가지: `feat/job-trans-report`

## 한 것
- 전용 웹앱 `jobtrans.html` 및 모듈 5종 신규 구축 (`js/pu-jobtrans-catalog.js`, `js/pu-jobtrans-intake.js`, `js/pu-jobtrans-report.js`, `js/pu-jobtrans-hwpx.js`, `js/pu-jobtrans-view.js`):
  - **운영기관 2대 체계 완전 분리**:
    - 한국능률협회컨설팅(`kmac`: 본컨설팅 `kmac_std`, 진단·정책매니저 `kmac_pm`) — 구조혁신지원사업(산업·일자리전환) 표준 7장 중간보고서 · 8장 최종결과보고서 · 완료보고서 및 정책매니저 점검표.
    - 충남경제진흥원(`cepa`: 진단컨설팅 `cepa_diag`, 전문컨설팅 석탄화력 `cepa_coal`, 전문컨설팅 자동차부품·주력 `cepa_auto`) — 충남 산업일자리전환지원센터 표준 7장 중간보고서 · 트랙별 8장 결과보고서 · 컨설팅 완료계 및 충남 산업일자리전환 장려금 연계서.
  - **푸른이알피 계약확정 · 정부사업일정 · 로컬 컨설팅업체 폴더 선택적 연결 및 푸른메일함(`peek:true`) 정밀 필터링**:
    - `data/companies` · `data/consultings`(`typeCode`·`consultingType`·`no` 및 미등록 컨설팅 전용 사업장 `biz:10자리` 열쇠 지원) · `scal_cos`(`types` 배열·`co_id` 지원, 삭제/취소 및 일터혁신·기술보호 등 타 컨설팅 원천 제외)에서 오직 산업·일자리전환 사업장만 자동 발견.
    - 상단 `📂 컨설팅폴더 연결` 추가: 상위 `컨설팅업체` 폴더 선택 시 타 컨설팅(`0. 일터혁신`, `1. 공공기관`, `2. 상공회의소`, `3. 비즈니스지원단`, `5. 기술보호`, `6. 이음센터`, `7. 혁신바우처`, `8. 비정규직`, `9. 안전보건`, 일반 자문사 폴더) 및 컨설턴트 개인 정산서류(신분증·개인통장·원천세 구분확인서)는 진입·수집에서 100% 배제하고 오직 `4. 산업일자리전환컨설팅` 하위 사업장 자료만 그룹화·비식별 반영 (`IndexedDB` 핸들 보관, 표준 256비트 SHA-256 결정론적 카드·그룹 열쇠 및 도메인 구분 경계 지문 `folderBoundaryHash = bfp:<64hex>` 적용, 루트·컨테이너·그룹 상호 `safeFolderDisplayLabel` 개인정보 가림 및 쓰기 세션 `epoch`/`uid` 고정 바인딩 적용).
    - `mailbox/folders` · `mailbox/msgs` 에서 자문·급여·사무대행·세금계산서·타 컨설팅 메일함을 평탄화 단계부터 차단하고, `readMailMessage({ peek: 1 })` 로 메일함 읽음 상태를 건드리지 않고 중간보고 전(`pre_mid`)·후(`post_mid`) 산업일자리 관련 자료만 수신 체크.
  - **브라우저 로컬 비식별 통계 및 개인정보 2중 가림 강화**:
    - 3개년 재무제표(`biz_fin`, 세로·가로형 및 `netProfitM`/`netIncomeM` 양방향 지원), 인력명부(`org_roster`), 임금·근태(`wage_time`), 노동전환 설문 5대 영역·15문항(`trans_survey`) 엑셀을 브라우저 로컬에서만 비식별 집계하고, 부서·직무 열에 섞인 성명·사번까지 사전 제거하여 평문 유출을 원천 차단.
    - 구분자 없는 9~11자리 전화번호, 7자리 서울전화, 공백 포함 이메일, 연속/공백 계좌번호까지 클라이언트(`pu-jobtrans-intake.js`)와 서버(`functions/doc-read.js`) 양쪽에서 2중 가림·차단.
  - **3대 출력 + 별첨 패키지**:
    - ① 네이티브 한글(`.hwpx`) 즉시 다운로드 (`mid` · `final` · `completion` 3종, `PureunHwpx.buildHwpx` 기반)
    - ② 푸른한글(`hangul.html?from=jobtrans`) 새 탭 바로 열기·편집 브리지 (`pureun_hangul_ready` 양방향 핸드셰이크 · `bridgeId` 중복 열림 방지 · 수신 완료 시 `localStorage` 즉시 정리 · 5분 신선도 상한 · `pu-ls-guard` 100KB 한도 준수)
    - ③ 브라우저 내 A4 미리보기 및 `@media print` 기반 PDF 인쇄
    - ④ 별첨 6시트 `.xlsx` 및 5종 통합 `.zip` 일괄 내려받기
  - **전 목록 `☐ + 번호` 및 온톨로지·보안규칙**:
    - 14개 모든 목록(`projects`, `folderSync`, `discover`, `preChk`, `preMails`, `preCards`, `rounds`, `midSecs`, `postChk`, `postMails`, `diffRows`, `deliverables`, `finalSecs`, `followups`) 맨 왼쪽 `☐ + 번호` + 마우스 끌어고르기 + 일괄실행 바 적용.
    - `PuOntology.PROGRAMS.jobtrans` · `READ_ADAPTERS.jobtrans_core` 등록 및 `PuOntologyWrite` 강제 관문(`enforce`)·소프트삭제(`_deleted`) 적용.
    - 포털(`enter.html`, `js/pu-appbar.js`), 컨설팅보고서 총괄(`gov-report.html` 의 `industry` 및 `industry-cn` 바로가기) 연결, 전 `.html` 캐시 버전(`?v=`) 동기화.
- Firebase 실시간 데이터베이스 보안규칙 `/scal_jobtrans` 추가 및 콘솔 배포 완료 (`scripts/make-firebase-rules.js` → `node scripts/rules-deploy.js --deploy` → 살아 있는 콘솔 대조 일치 확인).

## 확인
- `node scripts/check-cache-version.js --all` 통과 (누락 0건).
- `node tests/perf-rules.test.js` 25/25 통과.
- `tests/color-palette-apps.test.js` (`jobtrans.html` 예외 색 0건 · 명도 대비 통과).
- `tests/jobtrans-auto.test.js` 11개 통합·회귀 스위트 통과 (목차·트랙 분리, 로컬 비식별 집계·성명 혼입 제거, 메일 스캔 분기, 수기 잠금·후속 Diff, KMAC·CEPA × 3종 `.hwpx` 생성 및 `<hp:run>` 내부 `<hp:t>` 무결성 검증, 온톨로지·`doc-read` 2중 가림 보안, 전 목록 `☐+번호`, 컨설팅업체 폴더 산업일자리전환 선별 진입·타 컨설팅/개인서류 차단, 사업자번호 충돌 격리·SHA-256 결정론적 경계 지문·DOM/RTDB 개인정보 무노출·계정 전환 교차 세션 오염 차단).
- 폰·PC 실측 점검 (`tools/phone-audit/run.mjs jobtrans` — 360px · 375px · 411px · 768px · 1280px × 6개 보기 = 총 30개 화면): 옆넘침 0 · 화면밖 0 · 세로깨짐 0 · 짓눌림 0 · 두줄단추 0 · 작은단추 0 · 작은입력 0 · 콘솔 오류 0.
- Orca 다중 에이전트 최종 검토 (`run_98a9bd58c1e9`, `run_c1581ab82268`): 기능·UI 검증(`antigravity:gemini-4-argon-high`) 결함 0건 통과 · 보안 검토(`codex`) 발견 사항 없음(높음 0 / 중간 0 / 낮음 0) 무결점 통과.
- 저장소 전체 품질 관문 (`node --test 'tests/*.test.js' 'functions/*.test.js'`): **30,302 통과 / 0 실패**.

## ⚠ 못 한 것 · 확인 필요
- 실제 고객사 데이터를 다루는 프로그램이므로 운영 배포 후 실제 계약 사업장 1곳으로 메일 첨부 비식별 집계 및 한글(`.hwpx`) 서식 여백을 사람이 최종 점검하는 것을 권장함.
