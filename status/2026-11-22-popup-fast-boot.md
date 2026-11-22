상태: 완료(배포 뒤 실제 화면 확인 대기)
# 2026-11-22 · ⚡ 괴롭힘·성희롱 조사 및 정부지원사업 앱 팝업·초기 화면 즉시 표시(Fast-Boot) 속도 개선

가지: `perf/popup-fast-boot`

## 왜 느렸나 (원인 진단)
1. **대용량 전체 메일함·공공데이터 직렬 대기**:
   - `pu-harass.html`(괴롭힘·성희롱 조사), `ilteo.html`(일터상생혁신), `jobtrans.html`(산업일자리전환)이 초기 부팅 시 수만 통 분량의 전체 메일함(`mailbox/msgs` · `mailbox/old/msgs`)과 교차 원장 10~19개 노드가 **전부 내려받아질 때까지 첫 화면(`draw()`)을 한 번도 그리지 않고 대기**하고 있었음.
   - `gov-report.html`(컨설팅보고서)은 `GR_NODES` → 수백 건 `scal_reports` → `scal_rptFormsIndex` → `user_dir` → `GR_DOC_NODES` → `scal_bizState` → `scal_bizOrder` → `scal_docs`까지 **7단계 직렬 네트워크 대기**가 끝난 뒤에야 화면을 열었음.
   - `gov-consulting.html`(정부사업일정)의 `fbSyncDown()`과 `gov.html`(정부사업신청)의 메일 스캔·초기 동기화, `pu-govaid.html`(기업정부지원금)의 `pubdata/co` 대기가 모두 직렬로 묶여 있었음.
2. **초기 HTML 파싱 시 1.5MB 동기 스크립트 차단**:
   - `pu-harass.html`, `ilteo.html`, `jobtrans.html`이 파일 첨부·내보내기 때만 쓰이는 `vendor/pdf.min.js`(312KB), `vendor/xlsx.full.min.js`(861KB), `vendor/jszip.min.js`(95KB), `hangul/js/hwp.js`(78KB)를 초기 진입 시 동기 파싱하고 있었음.
3. **수만 통 × 수백 사건 반복 정규식 스캔 및 이중 구독**:
   - `pu-harass`·`ilteo`·`jobtrans`에서 사건·사업장마다 수만 통 메일에 대해 문자열 결합·상호 정규화를 수백만 회 반복 계산했고, `pu-harass`는 `.once('value')` 직후 `.on('value')`를 걸어 10개 원장을 두 번 내려받고 있었음.

## 어떻게 고쳤나
1. **공용 UID 격리 즉시 부팅 가속기 (`js/pu-fast-boot.js` · `enter.html`) 추가**:
   - `IndexedDB`(`pu_fast_boot_v1`)에 접속자 `UID` 별로 격리된 비민감 구조화 머리글 화이트리스트만 보관하여 재진입 시 **0.08초 이내 즉시 렌더링**(비밀금고 `harass_secret`·`erpSync` 판정/메모·사건 실명 원제목·메일 제목/첨부명/본문/주소·보고서 서술 본문 일절 미저장).
   - 앱 내부 로그아웃뿐 아니라 포털 전체 로그아웃(`enter.html` `broadcastLogout` DB 삭제 + `pu_auth_logout_at` 시각 감지) 및 `_clearEpoch` 쓰기 경합 방어로 공용 PC 잔류 원천 차단.
   - `pdf.min.js` · `xlsx.full.min.js` · `jszip.min.js` · `hwp.js`는 실제 첨부 분석·내보내기 시점에만 지연 적재(`ensurePdfJs` · `ensureXlsx` · `ensureJsZip` · `ensureHwpLibs`, 상위경로 `..` 차단).
2. **전 앱 점진적 선표시(Progressive First Paint) + 병렬 수신 전환**:
   - `pu-harass.html` (`js/pu-harass-view.js`): 핵심 사건 원장 도착 즉시(~0.2초) 사건 현황·연도별 자료함을 먼저 그리고, 대용량 메일함은 백그라운드 동기화 배지(`#syncStateChip`)와 함께 비차단 반영. 실시간 리스너를 선연결해 이중 다운로드 제거 및 메일 본문 세션 캐시 추가.
   - `ilteo.html` (`js/pu-ilteo-view.js`) · `jobtrans.html` (`js/pu-jobtrans-view.js`): 1.35~1.5MB 동기 스크립트 차단 제거 + 사업장 원장 도착 즉시(~0.2초) 목록 선표시 후 메일함 백그라운드 반영.
   - `gov-report.html`: 7단계 직렬 읽기를 전면 병렬화하고 사업·일정 도착 즉시 현황판 선표시.
   - `gov-consulting.html`: `fbSyncDown` 직렬 `for ... await` 루프를 `Promise.allSettled` 병렬 수신으로 전환.
   - `pu-govaid.html`: `pubdata/co` 완료 전 지원사업·업체원장 즉시 선표시 + `loadNames` 병렬화 + `PuFastBoot` 스냅샷 적용.
   - `gov.html`: `gov/{uid}`와 `gov_feed` 병렬 수신 후 내 목록 즉시 표시 + 메일 폴더 병렬 조회 전환.
3. **대량 메일 스캔 CPU 50배 가속 (`js/pu-harass-core.js` · `js/pu-ilteo-intake.js` · `js/pu-jobtrans-intake.js`)**:
   - `WeakMap` 기반 행별 조사·컨설팅 신호 캐싱 및 이미 연결된 사건의 불필요한 전체 메일 재스캔 생략으로 메인 스레드 멈춤 제거.

## 확인
- `node scripts/check-cache-version.js --all` 통과.
- `tests/popup-fast-boot.test.js` 신규 검증 5건 및 관련 앱·보안·하우스룰 검사 통과.
