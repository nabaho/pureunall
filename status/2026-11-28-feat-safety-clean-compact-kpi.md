# 안전보건체계구축 실수행 29개소 정제 · 상단 KPI 컴팩트화 · 푸른 통합 연결 (2026-11-28)

## 요약
- 과거 미수행·단순 안내 공문·교육·노무상담·연도 중복으로 77개소까지 불어나 있던 안전보건체계구축(`/scal_safety/projects`) 데이터를 실수행 29개소(2023년 25 · 2024년 1 · 2025년 1 · 2026년 2)로 정제하고 원천 수집·백필 필터를 보강했다.
- 상단 헤더·탭·수행 트랙·KPI 카드 영역이 세로 25% 이상 차지하던 문제를 해소해 트랙과 1줄 미니 KPI 배지를 단일 스트립(`.sf-top-strip`)에 배치하고, Frame-A 전체 7개 앱(`safety.html` 및 `jobtrans`, `ilteo`, `gov-report`, `pu-harass`, `pu-settle`, `pu-edulib`)의 상단/KPI 스타일을 푸른 ERP 수준으로 슬림화했다.
- 푸른 ERP(`pu-erp.html` `OA_APPS`), 기업정보함(`pu-cards.html`), `/data/contracts`, `pu-health.js`, `pu-authsync.js`를 안전보건 워크스페이스와 양방향 연동했다.

## 변경 내용
- **실수행 사업장 선별·수집 필터 정제 (`js/pu-safety-intake.js`, `scripts/backfill-safety-history.js`)**:
  - `NON_CONSULTING_NOTICE_RE` + `CONSULTING_PROOF_RE` 도입으로 교육·세미나·선정 안내 공문·노무상담 연계 메일을 배제하고 계약·과업지시서·결과보고서·취합자료·실적증명서 기반 실수행 건만 선별.
  - `/data/contracts` 연동(`buildCompanyMailProfile`, `scanProjectMails`, `discoverSafetyCandidates`)으로 미연결 계약 사업장(`충남유통`, `세종시사회서비스원` 등) 자동 식별 및 연도별(`companyId:year`, `bizNo:year`) 기등록 중복 체크 보강.
  - `resolveMailYear`로 2024년 1~2월 취합자료 및 1~4월 실적증명서를 원 수행연도(2023년)로 보정하고 `CANONICAL_CORP_MAP` 및 `normalizeDisplayCompany`로 상호 변형을 통합.
  - Live RTDB `/scal_safety`에 `--reconcile-apply` 적용(29개소 유지, 55건 soft-delete(`_deleted: true`), 15건 자료카드 이관).
- **상단 헤더 · 트랙 · KPI 컴팩트화 (`css/pu-design.css`, `safety.html`, `jobtrans.html`, `ilteo.html`, `gov-report.html`, `pu-harass.html`, `pu-settle.html`, `pu-edulib.html`)**:
  - `css/pu-design.css` 및 7개 앱의 `.top`, `.tabs`, `.kpis`/`.kpi` 패딩·글꼴을 1줄 배지형(`label` ↔ `value`)으로 축소하고 모바일 2열·16px 입력·36px 터치 타깃 규칙을 유지.
  - `safety.html`의 `#scopeBar`를 `#p-projects` 안으로 옮겨 `#kpiBox`와 `.sf-top-strip` 단일 띠로 결합하고 `pu-health.js?v=8`, `pu-authsync.js?v=7`, `pu-erp.html?sso=1` 링크 추가.
- **뷰·포털 연동 보강 (`js/pu-safety-view.js`, `pu-erp.html`)**:
  - `D.contracts` 로드·스냅샷·검색·후보감지 배선, 메일 탭·행 건수에 `nameCandidates` 반영, 진행 중 사업장 기준 충족률 분리, 과거 아카이브 0% 행 `수행완료` 배지 표시, 빈 후보 카드 자동 숨김, 프로젝트 헤더에 `ERP`·`기업정보함` 바로가기 추가.
  - `pu-erp.html` `OA_APPS`에 `key:'safety'`(`scal_safety/projects` → `safety.html?sso=1#proj=...`) 등록.
- **회귀 테스트 (`tests/safety-auto.test.js`)**: 메일 필터·계약 후보 발견·연도별 재계약·취합연도 보정·상호 정규화·포털/ERP 연동 검증 추가.

## 검증
- `node scripts/check-cache-version.js` 통과
- `node --test tests/safety-auto.test.js tests/pu-design.test.js tests/phone-input-zoom.test.js tests/phone-screen-rules.test.js tests/health-auto-settle.test.js tests/color-palette-apps.test.js tests/ontology-contract.test.js tests/ontology-write-gate.test.js tests/one-line-cells.test.js tests/test-pin-guard.test.js tests/no-hardcoded-old-erp-url.test.js tests/portal-chatbot.test.js tests/perf-rules.test.js tests/appbar-every-link.test.js tests/govreport-phone.test.js` — 228/228 통과
- `node scripts/backfill-safety-history.js --audit` — `ok: true, projCnt: 29, cardCnt: 121, leakCount: 0`
- `node tools/phone-audit/run.mjs <app> --design` (`safety`, `jobtrans`, `ilteo`, `govreport`, `harass`, `settle`, `edulib`) 및 `safety --design` 재검증 통과
- 오카 다중 에이전트 기능·UI 검증(`antigravity:gemini-4-argon-high`) 및 보안 검토(`claude`) 통과 및 경미한 3건 반영 후 재검증 완료
