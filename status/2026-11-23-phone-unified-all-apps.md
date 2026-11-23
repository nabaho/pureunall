# 2026-11-23 · 전체 47개 앱 폰 화면 모바일 CSS 통일 및 레이아웃 정리

- 브랜치: `feat/phone-unified-all-apps` (작업 워크트리 `pureunall-wt-phone`)
- 범위: 포털 36개 앱 + 단독 페이지 11종 = **총 47개 프로그램** 전수 검토 (`360×800`, `411×800`, `360 --font=1.35`, PC `1366 --design` 회귀 검사)

## 1. 변경 설계 및 공통 레이어
- **`css/pu-phone.css` 신규 도입 (`?v=1`)**
  - 모든 규칙을 `@media (max-width: 768px)` 및 `@media (max-width: 768px) and (prefers-color-scheme: dark)` 안에 격리하여 PC 화면(`>= 769px`)에 영향 없음.
  - 모바일 320~768px 공통 토큰·규칙 통일: 가로 넘침(`overflow-x: clip`), `box-sizing: border-box`, 이미지·SVG·입력칸 최대폭 제한, iOS 입력 확대 방지(`font-size >= 16px`), 이중·삼중 중첩 상자(`.pu-m-flat` 평탄화), 두꺼운 카드 슬림화, 세로 적재 KPI 2열/가로 스크롤(`.dkpis`), 가로 스크롤 칩 바 통일.
  - 44개 HTML에 `<link rel="stylesheet" href="css/pu-phone.css?v=1">` 연결 (`</style>` 및 `css/pu-design.css` 뒤 로드 보장).
- **감사 도구 확장 (`tools/phone-audit/measure.js`, `tools/phone-audit/run.mjs`)**
  - `standaloneApps()`(11개 단독 페이지 `--standalone`), CSP fallback(`addScriptTag({ url })`), `nestedBoxN`(이중·삼중 중첩 상자), `tallCardN`(160px 초과·90자 미만 두꺼운 카드/셀), `stackKpiN`(세로 적재 KPI 그룹), `textClipN`(ellipsis 없이 잘린 텍스트), `contentTopY`(첫 본문 시작 Y) 측정 지표 추가.
- **회귀 방지 테스트 (`tests/pu-phone-unified.test.js`)**
  - `@media (max-width <= 768px)` 격리, `tests/lib-palette.js` 허용 색상(27색 + `#fff`/`#000`) 준수, `input`/`textarea` 16px 미만 금지, `#pu-version-fab` 겹침 방지, 44개 HTML 로드 순서 검증.

## 2. 수정 파일 요약
- **신규**: `css/pu-phone.css`, `tests/pu-phone-unified.test.js`, `status/2026-11-23-phone-unified-all-apps.md`
- **공용/자산(캐시 버전 갱신 포함)**: `css/pu-erp.css` (`?v=48`), `js/pu-alio-union.js` (`?v=19`), `hangul/app.css` (`?v=8`)
- **HTML (44개)**:
  `chwieop.html`, `clinic-intake.html`, `docs-esign.html`, `enter.html`, `fund.html`, `gov.html`, `gov-consulting.html`, `gov-report.html`, `hangul.html`, `ieum-view.html`, `ilteo.html`, `install.html`, `jobtrans.html`, `kcareer.html`, `payroll-os.html`, `pu-alio-union.html`, `pu-cal.html`, `pu-camera.html`, `pu-cards.html`, `pu-datahub.html`, `pu-deungi.html`, `pu-edulib.html`, `pu-erp.html`, `pu-govaid.html`, `pu-harass.html`, `pu-home.html`, `pu-news.html`, `pu-orchestrator.html`, `pu-paydata.html`, `pu-pbox.html`, `pu-photos.html`, `pu-pubsearch.html`, `pu-settle.html`, `pu-signboard.html`, `pu-viewer.html`, `rehab-ad.html`, `remember-intake.html`, `rules.html`, `rules-v2.html`, `safety.html`, `sign.html`, `sign-contract.html`, `sign-harass.html`, `work.html`
- **도구·문서**: `tools/phone-audit/measure.js`, `tools/phone-audit/run.mjs`, `docs/폰화면-현황.md`

## 3. 전후 실측 결과

### ① 360·411px 전체 47개 앱 (786개 뷰×폭 행 기준)
| 지표 | 수정 전 (`out/base`) | 수정 후 (`out`) | 비고 |
|---|---:|---:|---|
| `overflowX` (가로 넘침 px 합 / 초과 행) | 279 (2행) | **0 (0행)** | 전 앱 완전 해소 |
| `offscreenN` (화면 밖 요소 합 / 행) | 9 (2행) | **0 (0행)** | 전 앱 완전 해소 |
| `verticalN` (세로 글자 깨짐 합 / 행) | 24 (2행) | **0 (0행)** | 전 앱 완전 해소 |
| `wrapBtnN` (두 줄 단추 합 / 행) | 12 (4행) | **0 (0행)** | 전 앱 완전 해소 |
| `squeezedN` (짓눌림 합 / 행) | 384 (24행) | **226 (9행)** | 잔여: `cal:week`, `consult:cal`, `career:settings` 2건 |
| `smallInputN` (작은 입력칸 합 / 행) | 130 (44행) | **102 (38행)** | `erp`·`fin` 인라인 셀 외 전역 0 |
| `nestedBoxN` (이중+ 중첩 상자 합) | 1529 | **1478** | 주요 카드형 목록·모달 평탄화 |
| `tallCardN` (두꺼운 카드 합 / 행) | 87 (59행) | **57 (40행)** | 세로 패딩·다단 행 슬림화 |
| `stackKpiN` (세로 KPI 그룹) | 54 | **50** | 2열 그리드·가로 스크롤 적용 |
| `textClipN` (글 잘림 합) | 1550 (20행) | 1550 (20행) | `cal` 캘린더 칩 말줄임 유지 |

- **단독 11종 (`--standalone`, 22행)**: 전 22행 모두 `overflowX: 0, offscreenN: 0, verticalN: 0, squeezedN: 0, wrapBtnN: 0, smallInputN: 0, tallCardN: 0, stackKpiN: 0, textClipN: 0` (`rules.html` 420px 컨테이너 쿼리 반영 후 `sa_rules_old 411` `squeezedN: 3` 해소).

### ② 360px 큰 글자 `1.35×` (`--font=1.35`)
- **`base-f135` 매칭 29개 앱 (184행) 비교**:
  - `overflowX`: `1882 → 0`
  - `offscreenN`: `81 → 11` (`19행 → 10행`)
  - `verticalN`: `8 → 8` (`2행 → 2행`, `pu-orchestrator.html`·`kcareer.html` 추가 보완으로 신규 증가 `0`)
  - `wrapBtnN`: `10 → 2` (`payroll-os.html` `이 달 확정` 보완 포함 신규 증가 `0`)
  - `tallCardN`: `64 → 52`, `nestedBoxN`: `289 → 282`
- **전체 47개 앱 (`after-f135`, 393행) 총계**:
  - `overflowX: 0 (0행)`, `offscreenN: 42 (11행)`, `verticalN: 13 (7행)`, `wrapBtnN: 10 (4행)`, `smallInputN: 16 (11행)`.

### ③ PC `1366 --design` 회귀 검사
- 대상 11개 대표 앱(`portal`, `erp`, `ilteo`, `orch`, `settle`, `aliounion`, `edulib`, `datahub`, `payroll`, `pbox`, `career`), **총 127개 뷰**: `designBad: 0` (`lostN: 0`, `newOffN: 0`).

### ④ 360px PNG 육안 확인 (최종 산출물)
- 직접 확인한 주요 화면: `payroll-pay-360.png`, `aliounion-region_multicmp-360.png`, `orch-360.png`, `after-f135/orch-360.png`, `govaid-360.png`, `paydata-360.png`, `paydata-pending-360.png`, `work-360.png`, `cards-sel-360.png`, `datahub-360.png`, `pubsearch-360.png`, `mail-mat-360.png`, `edulib-360.png`, `edulib-detail-360.png`, `aliounion-organ-360.png`, `pbox-360.png`, `hangul-360.png`, `news-now-full-360.png`, `home-360.png`, `rules-daily-360.png`, `govbid-360.png`, `sa_rules_old-360.png`, `sa_chwieop-360.png`, `fin-hana-pair-link-360.png`, `hr-hr-pay-360.png`, `career-settings-360.png`, `photos-viewer-360.png`.

## 4. 테스트 및 검수
- `node scripts/check-cache-version.js --all`: **통과 (종료 코드 0)**.
- `node --test tests/photos-viewer-split.test.js tests/pu-design.test.js tests/pu-phone-unified.test.js`: **32 / 32 통과 (0 fail)**.
- `node --test "tests/payroll*.test.js" "tests/rules*.test.js" "tests/phone*.test.js" tests/pu-phone-unified.test.js` (Orca 중간 이슈 수정 뒤 영향 범위): **1,538건 중 1,529 통과 / 0 실패 / 9 기존 스킵**.
- `node --test "tests/*.test.js" "functions/*.test.js"` (2,512개 테스트 파일, 최종 수정 이후 재실행): **31,610건 중 31,539 통과 / 0 실패 / 71 기존 스킵** (약 92.5s).

## 5. Orca 다중 에이전트 리뷰 및 후속 조치
- 실행: `C:\Users\user\.orca-workflow\ow.bat review --coder antigravity --repo pureunall --ui` (`Run run_c7a7047b32cb`)
- 역할: 코딩 기준 `antigravity:claude-opus-5-5-high`, 기능·UI 검증 `antigravity:gemini-4-argon-high` (36%), 보안 검토 `codex` (71%)
- 판정: **통과** (기능·UI 높음 0 · 중간 2 · 낮음 2 / 보안 새 취약점 없음 · 중간 1 · 낮음 3)
- **중간(medium) 3건 즉시 반영 및 768px 재확인 완료**:
  1. `payroll-os.html`: `@media (min-width:761px) and (max-width:768px)` 태블릿 1단 전환 보강 (`payroll` 360·411·768 전 11뷰 `overflowX:0, verticalN:0, squeezedN:0, wrapBtnN:0, smallInputN:0`)
  2. `rules.html`: `@media (min-width:761px) and (max-width:768px)` `.pane h3 .summary` 래핑 및 16px 입력칸 적용 (`sa_rules_old` 360·411·768 전 항목 0)
  3. `tools/phone-audit/measure.js`: `textClip`·`tallSamples` 표본에서 화면 원문(`text`) 제거 (선택자·치수만 기록)
- **낮음(low) 5건(후속 검토 제안)**: `css/pu-phone.css`의 `:where(...)` 입력 규칙 특이도·`select` 16px 명시 및 `--pup-dg` 대비(4.41:1), 다크모드 `--pup-acc` 보강(UI 2건); `tools/phone-audit/run.mjs` 루프백 정적 서빙 범위/sandbox 재시도 정리 및 `tools/phone-mirror.js` 표본 원문 축소(보안 3건).
