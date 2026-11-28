# 안전보건체계구축 실수행 29개소 정제 · 직장 내 괴롭힘(`pu-harass`) 표준 레이아웃 통일 · 푸른 통합 연결 (2026-11-28)

## 요약
- 과거 미수행·단순 안내 공문·교육·노무상담·연도 중복으로 77개소까지 불어나 있던 안전보건체계구축(`/scal_safety/projects`) 데이터를 실수행 29개소(2023년 25 · 2024년 1 · 2025년 1 · 2026년 2)로 정제하고 원천 수집·백필 필터를 보강했다.
- `origin/main`(PR #3300 `pu-harass.html` 상단·표 구조)과 병합하고 전체 HTML 129개 내 `css/pu-design.css?v=3` 캐시 버전을 통일했다(`tests/shared-js-cache-version.test.js` 통과).
- `safety.html`과 `js/pu-safety-view.js`를 **직장 내 괴롭힘(`pu-harass`) 표준 형태**(`① 2줄 통합 트립 + 클릭형 1줄 KPI 배지 → ② 독립 필터 + ↺ 초기화 → ③ 연도·사업장명·진행상태 독립 열 수직 정렬 표` + 작업실 1줄 리본·접기 패널 + 상단 커밋 `#SHA` 표시 `#releaseShaChip`)로 맞췄으며, 앞으로 서류·목록 정리 시 동일 형태를 유지하도록 규칙 문서를 신설·반영했다.

## 변경 내용
- **표준 형태 규칙 명문화 (`docs/규칙/서류-목록-표준형태.md`, `CLAUDE.md`, `AGENTS.md`)**:
  - 상단 3단 슬림 구조, 기업명/사건명 옆 배지 혼재 금지 및 독립 열(`연도`, `사업장명`, `진행상태`, `.pbar` 진행현황, `📧/🗂️` 배지, `wide` 요약, `열기`) 수직 정렬 원칙, 작업실 1줄 `.ws-steps` + `<details class="sub-fold">` 접기 패널 규격 명문화.
- **`pu-harass` 표준 레이아웃 및 커밋 표시 적용 (`safety.html`, `js/pu-safety-view.js`)**:
  - `.sf-top-strip`을 `pu-harass` `.hi-top-strip`과 동일한 2단 카드(수행 트랙 행 + 클릭형 인라인 KPI 배지 행)로 통일하고 KPI 클릭·키보드(Enter/Space) 필터 토글 및 `#projResetBtn`(`↺ 초기화`) 추가.
  - 목록 표 열을 `☐ | 번호 | 연도(td.yr) | 사업장명(td.ti) | 진행상태(td.st .c-direct/.c-direct-ing) | 업종·트랙 | 진행현황(.pbar 점) | 메일·자료(📧/🗂️) | 주요 수행 이력(wide) | 열기`로 분리 정렬하고 완료 행에 `.perf-direct` 초록 포인트 띠 적용(모바일 `<=768px` 2줄 카드 포함).
  - 작업실 헤더를 1줄 `.bar` + 1줄 `.ws-steps` 리본 + `<details class="sub-fold">`로 축소하고 수치형 필드 정규화(`num(..., 0)`) 적용.
  - 상단 `#head .top`에 `#releaseShaChip`(`meta[name="pu-release"]` 기반 `#<shortSha>` 또는 로컬 표시) 추가.
- **공용 디자인·캐시 통일 (`css/pu-design.css` 및 `css/pu-design.css?v=3` HTML 22개 + A틀 6개 앱)** 및 **푸른 ERP 통합 (`pu-erp.html` `OA_APPS` 등록, `/data/contracts` 연동)**.
- **회귀 테스트 (`tests/safety-auto.test.js`)**: `NON_CONSULTING_NOTICE_RE`, 계약 후보 발견·연도별 재계약 판별, 취합연도 보정, 상호 정규화, 포털/ERP 연동 및 `pu-harass` 표준 형태·커밋 표시·수치 정규화·규칙 문서 검증 추가.

## 검증
- `node scripts/check-cache-version.js` 및 `node --test tests/shared-js-cache-version.test.js` 통과
- 전체 CI 테스트(`node --test tests/*.test.js`) 통과
- `node scripts/backfill-safety-history.js --audit` — `ok: true, projCnt: 29, cardCnt: 121, leakCount: 0`
- `node tools/phone-audit/run.mjs <app> --design` (`safety`, `harass`, `jobtrans`, `ilteo`, `govreport`, `settle`, `edulib`) 통과
- 오카(Orca) 다중 에이전트 검증(`antigravity:gemini-4-argon-high`) 및 보안 검토(`codex`) 통과
