상태: 완료(배포 뒤 실제 화면 확인 대기)
# 2026-11-16 · ⚡ 산업일자리전환 자동화(jobtrans.html) — 좌우 전체폭 확장 · 소속기관별(능률협회 KMAC vs 충남경제진흥원 CEPA) 완전 분리 보기 · 기관별 보고서 양식 분리 검토 · 일터상생 중복 차단

가지: `feat/jobtrans-agency-split-wide`

## 한 것
- **좌우 전체 가로폭 활용 레이아웃 개편 (`jobtrans.html`)**:
  - `html, body`, `#head`, `main`의 가로폭 제약을 전면 해제(`width: 100%; max-width: none; padding: 10px 26px 56px 12px`)하고, 데스크톱 표 가변 열(`td.wide { width: 100%; max-width: 0 }`)과 우측 액션 열(`td[data-k="act"] { width: 1% }`)을 밀착 정렬하여 1920px 2단 대조 및 전체폭 상하 분리 모두 가로 잘림·여백 낭비 없이 화면 좌우 전체 폭을 100% 사용하도록 개편.
  - 보고서·인터뷰 작성 중 유휴 자동 새로고침으로 인한 미저장 원고 유실을 막기 위해 `pu-version.js` 미탑재 규칙을 고정(`ilteo.html`·`pu-viewer.html`과 동일).
  - 5열 와이드 KPI(`전체 산업일자리`, `🔵 한국능률협회컨설팅(산일능률)`, `🟢 충남경제진흥원(산일충남)`, `📩 미확인 메일`, `📌 중간·최종 확정`) 및 반응형 브레이크포인트(폰 화면 `<=768px`은 기존 2줄 카드·옆넘침 0건 유지) 적용.
- **소속기관별(능률협회 KMAC vs 충남경제진흥원 CEPA) 완전 분리 보기 (`js/pu-jobtrans-view.js`)**:
  - 상단 고정 소속기관 스코프 바(`#agencyScopeBar`: `⚖️ 기관별 좌우 분리` / `▤ 전체폭 상하 분리` / `🔵 능률협회(KMAC · 산일능률)` / `🟢 충남경제진흥원(CEPA · 산일충남)`) 추가.
  - 사업장 목록을 단일 혼합 표에서 **`🔵 한국능률협회컨설팅(KMAC)` 전용 표(`projectsKmac`)**와 **`🟢 충남경제진흥원(CEPA)` 전용 표(`projectsCepa`)** 좌우 2단 분할 구조로 분리하고, 사업장 선택 `<select>`도 기관별 `<optgroup>`으로 분리.
  - 각 행에 확정 ERP 계약코드(`산일능률-YYYY-NNN` / `산일충남-YYYY-NNN`) 및 동일 거래처 타 컨설팅(`일터상생` 별도 수행 자동분리) 안내 배지 표시.
- **일터혁신 상생컨설팅(`일터상생`) · 석유화학 노동전환지원센터(`노동전환-`) 중복 원천 차단 (`js/pu-jobtrans-catalog.js`, `js/pu-jobtrans-intake.js`)**:
  - ERP 계약 발견(`discoverJobtransCandidates`), 로컬 컨설팅폴더 선별(`filterJobtransFolderEntries`, `groupJobtransFolderEntries`), 메일함 스캔(`flattenMailboxRows`, `scanProjectMails`) 전 구간에서 `일터상생`·`상생컨설팅`·`일터혁신`·`노사발전재단`·`에프엠어소시에이션`·`통합진단보고서양식_일반형`·`디자인팀 회의`·`이행결과표` 및 별도 사업인 `충남노동전환지원센터(석유화학 노동전환)`을 100% 배제.
  - 공용 정부사업 메일함(`3.컨설팅(정부사업)`) 내 타 컨설팅 메일 오탐 차단 및 KMAC ↔ CEPA 상대 기관 전용 메일 교차 혼입 방지 가드 적용.
  - 로컬 폴더 스캔 시 하위 파일 증거(예: `완료계`·`전문컨설팅` vs `정책매니저`·`구조혁신진단`)로 기관 오분류 자동 교정.
- **소속기관별 보고서 양식 분리 검토 워크벤치 및 전용 탭 신설 (`js/pu-jobtrans-catalog.js`, `js/pu-jobtrans-report.js`, `js/pu-jobtrans-view.js`)**:
  - `AGENCY_FORM_SPECS` 및 `Report.evaluateReportFormReview` 신설: KMAC 6대 검수기준(중진공 구조혁신 7장/8장 목차, KPI 4개+, 지원사업 2개+·전환지원금 필수, 대면 75%+, 3개년 현황·설문, 타 양식 무혼입)과 CEPA 6대 검수기준(충남지원센터 진단/전문 7장/8장 목차, 석탄화력/미래차 공급망 진단, 전환직무·지역훈련, 대면 80%+, 대표자 날인 완료계·충남 장려금, 타 양식 무혼입)을 완전 분리 판정.
  - `② 기관맞춤 중간보고` 및 `③ 최종보고·완료계·HWPX`를 좌우 2단 워크벤치(`.report-workbench`: 좌측 장별 원고 편집기 + 우측 실시간 기관 전용 양식 적합성 검수표 및 공식 양식 A4 대조 미리보기)로 개편.
  - 상단 5번째 탭 `⚖️ 기관별 양식검토`(`#p-forms`)를 신설해 KMAC vs CEPA 제출서식·목차·사업장별 검수 현황과 `일터혁신 상생컨설팅` 구분 대조표를 한눈에 분리 검토하도록 구성.
- **실시간 `/scal_jobtrans` 데이터 정밀 정리 완료**:
  - 비대상 `노동전환-2026` 2건 및 기관 오분류·약칭 중복 레코드 소프트삭제(`_deleted: true`) 및 정통 소속기관 단일 레코드로 무손실 통합 완료 (총 32개사: KMAC 14개사 · CEPA 18개사, 중복·혼입 0건).

## 확인
- `node scripts/check-cache-version.js --all` 통과.
- `node --test tests/jobtrans-auto.test.js` **12/12 스위트 통과** 및 `tests/color-palette-apps.test.js`, `tests/one-line-cells.test.js`, `tests/phone-screen-rules.test.js`, `tests/phone-input-zoom.test.js`, `tests/test-pin-guard.test.js`, `tests/ontology-contract.test.js`, `tests/ontology-write-gate.test.js` 전량 통과.
- 폰·PC 와이드 화면 실측 점검 (`node tools/phone-audit/run.mjs jobtrans --widths=360,768,1280,1920`, 7개 보기 × 4개 폭 = 28개 화면): 옆넘침 0 · 화면밖 0 · 세로깨짐 0 · 짓눌림 0 · 두줄단추 0 · 작은단추 0 · 작은입력 0.
- Orca 다중 에이전트 최종 검토 (`run_7d53c1fb0198`): 기능·UI 8개 항목 검증(`antigravity:gemini-4-argon-high`, 375·768·1280·1600px 라이트·다크·빈값·다건·초장문 실측 포함) **통과(결함 0건)** · 보안 검토(`codex`) **통과(발견 사항 없음 — 높음 0 / 중간 0 / 낮음 0)**.
