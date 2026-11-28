상태: 작업 완료 (PR·검토 진행)
가지: feat/deungi-history-dashboard

# 🖋 푸른등기 — «지난 기록» AB-1 대시보드·연도별 타임라인·인라인 서류 미리보기 (2026-11-28)

대표 지시 「년도별로 넘버링과 간략한 내용으로 왼쪽 대시보드 형태로 두고 각 진행된 등기들마다 클릭하면 오른쪽에 서류와 내용을 하나씩 확인할 수 있게 해달라」 및 AB-1 하이브리드 목업 승인에 따라 `pu-deungi.html` 의 `📚 지난 기록` 탭(`#pane-hist`)을 개편했습니다.

## 바꾼 파일
- `pu-deungi.html`:
  - **CSS (`.hd-*` 대시보드 레이아웃)**: 기존 `.arcgrid`/`.arcg`/`.hcols` 레이아웃을 2단 분할 대시보드(`.hd-wrap`)로 개편. `:root` 팔레트 CSS 변수와 `#ffffff`만 사용해 `color-palette-apps`·`pu-design` 규칙 준수.
    - 데스크톱(`body:not(.slim)`)에서는 왼쪽 타임라인(`340px`) + 오른쪽 상세(상단 요약 카드 `.hd-sum` + 하단 `.hd-split`: 서류 목록 `370px` + 인라인 미리보기 `#arcPvPanel`).
    - 서류 목록 테이블(`.hd-doccol .t.arct`)에 `table-layout: fixed` 적용(분할 모드에서 날짜 열 `.dt` 숨김, 긴 파일명은 한 줄 말줄임).
    - 모바일(`@media (max-width:768px)`)에서는 `[data-act="histListToggle"]` 숨김, `.hd-split.collapsed .hd-doccol` 강제 표시, `.hd-sum-hd` 세로 배치, 입력·선택 `16px` 유지(폰 확대 방지).
  - **왼쪽 패널 (`drawArchive`)**:
    - 상단 세그먼트 전환기(`등기 N / 끝난 M / 기록 K`, ARIA `role="tablist"` ↔ `id="hdLeftPanel" role="tabpanel"`) 및 `＋ 묶음` 버튼.
    - 실시간 검색 입력(`data-hist-q="1"`, `HIST_UI.q !== el.value` 가드로 모바일 `blur` 시 재진입 `innerHTML` `NotFoundError` 방지) 및 연도 필터 칩(`전체`, `2026`, `2019`…).
    - 연도별 고정 섹션 헤더와 세로 타임라인 카드(`№ 1 ~ № N`, 날짜, 제목, 2줄 요약, 변경 태그, 서류 개수).
    - `끝난`·`기록` 탭에는 호버·클램프 없는 정적 카드(`.hd-done-card.static`, `.hd-log-desc`) 적용.
  - **오른쪽 상세 + 인라인 서류 목록/미리보기**:
    - 상단 요약 카드(`.hd-sum`: `№ N`, 연도 칩, 날짜, 서류 개수, 태그, 제목, `고치기`·`＋ 파일`·`⬇ 전체 받기` 버튼, `arcKindSummary` 구성 요약).
    - 왼쪽 서류 목록(`.hd-doccol`): `◀ 목록 접기`(`histListToggle`), 종류별 필터 칩, 체크박스(`th.c` 래퍼 클릭 포함)·`№`·파일명·종류 칩·날짜·`⬇ 받기`, 하단 선택 막대(`선택 N개`, `⬇ 받기`, `빼기`, `풀기`).
    - 오른쪽 인라인 미리보기(`#arcPvPanel`·`#arcPvBody`): `▶ 서류 목록 (N)` 펼치기, `◀ 이전` `i / N` `다음 ▶`, 파일명, 날짜, `#arcPvKind` 서류 종류 변경 `<select>`, `↗ 비교 칸`(#side 팝아웃), `⬇ 받기`.
    - `arcInlineHidden()` 가 `offsetParent` 기준으로 `#arcPvPanel` 실제 표시 여부를 판별(769~1079px 태블릿에서도 인라인 뷰어 작동).
    - `drawHist()` 시 포커스 복원(`histFocusMark`/`histFocusRestore`) 및 `#arcPvBody` 기존 DOM 노드·`scrollTop` 보존(HWP/PDF/이미지 깜빡임·스크롤 초기화 방지).
    - 총괄관리자(`ME.isAdmin`) 가드는 `arcInlineLoad`/`arcView`/`arcDownload`에 유지하고, 비관리자도 행 클릭(`arcSelectFile`)·`◀ 이전 / 다음 ▶`(`arcPvNav`)로 메타데이터 탐색 가능.
    - `arcSetKind()`에서 `C.ARC_KINDS.some(...)`으로 허용된 서류 종류만 저장되도록 검증.
    - `wipe()`에서 `arcPvRevoke(); HIST_UI=histUiInit();` 호출로 로그아웃·전환 시 메모리·Blob URL 정리(`localStorage` 키 추가 없음).
- `tests/deungi-html.test.js`: AB-1 대시보드·인라인 미리보기·총괄관리자 가드·`arcSetKind` 검증·포커스/DOM 보존·`wipe()` 테스트 반영.
- `tools/phone-audit/seeds/deungi.js`: 2026년 묶음(`ARtest2026c`, 3문서) 및 `base.history` 샘플 추가, `histdash` E2E 시나리오(연도 넘버링, 연도·종류 필터, 인라인 이미지 미리보기, 보이는 표 헤더 뷰포트 검증, 체크박스 토글 시 `#arcPvBody` DOM·`scrollTop` 보존, `#arcPvKind` 실시간 변경·복원, 목록 접기/펴기, 검색 0건·초기화, `기록` 탭 전환) 추가 및 `hist`/`histdash`/`side` `HIST_UI.listOff` 상태 격리.

## Orca 검토 및 반영 내역
1. **1차 통합 검토 (`run_ca3415490c80`)**:
   - **보안 (`claude`, `codex` 한도 초과 전환)**: `CLEAN` (높음 0·중간 0·낮음 2).
     - 낮음 #1(`arcSetKind` 허용 목록 검증) → **반영** (`C.ARC_KINDS.some(...)`).
     - 낮음 #2(인라인 PDF `blob:` `iframe` `sandbox` 권고) → Chrome/Edge 내장 PDF 뷰어가 `sandbox` 제약에서 실패하므로 기존 `#side`와 동일하게 총괄관리자 전용 + `application/pdf` MIME 고정 구조로 **미적용** 유지.
   - **기능 (`antigravity:gemini-4-argon-high`)**: `FAILED` 8건 → 필터 동기화, `arcInlineHidden()` 가시성 판정, 포커스·`#arcPvBody` DOM/스크롤 보존, 정적 `끝난/기록` 카드, `tablist`/`tabpanel` ARIA, `th.c` 헤더 체크박스 클릭 등 **8건 모두 수정 반영**.
2. **2차 기능 재검증 (`run_d27b095d0e1d`, `--only verify --ui`)**:
   - UI 8개 항목 통과, `[높음]` `arcSetKind` 내 `C.ARC_KIND_KEYS` 미정의(핵심 모듈 미내보내기) 1건 발견 → `C.ARC_KINDS.some(...)`으로 수정 및 `seeds/deungi.js`에 `#arcPvKind` 실시간 변경·복원 검증 추가.
3. **최종 기능 재검증 (`run_6a8ea12f929e`, `antigravity:gemini-4-argon-high`, `--only verify --ui`)**:
   - **통과** (발견 문제 0건; 밝은 테마 고정 화면이므로 다크 테마 대비만 N/A 분류).

## 검증
- `node scripts/check-cache-version.js --all`: 통과 (종료 코드 0)
- `node --test tests/deungi-core.test.js tests/deungi-docs.test.js tests/deungi-html.test.js tests/ontology-contract.test.js tests/ontology-write-gate.test.js tests/color-palette-apps.test.js tests/phone-screen-rules.test.js tests/phone-input-zoom.test.js tests/test-pin-guard.test.js tests/one-line-cells.test.js tests/pu-design.test.js`: **217 통과 / 0 실패**
- `node tools/phone-audit/run.mjs deungi --widths=360,411,1366`: **42건 모두** `errors: []`, `navErr: null`, `overflowX: 0`, `squeezedN: 0`, `offscreenN: 0`, `verticalN: 0`, `wrapBtnN: 0`
- `node tools/phone-audit/run.mjs deungi --widths=375,768,900,1440 --view=histdash`: **8건 모두** `errors: []`, `navErr: null`, `overflowX: 0` (768px 폰 창 분리 및 900px 태블릿 인라인 미리보기 확인)
- 로컬 미리보기 서버(`http://127.0.0.1:4335/pu-deungi.html`, `1440×900`): `.hwp`/`.png` 인라인 미리보기, `#arcPvKind` 변경/복원, `◀ 목록 접기`/`▶ 서류 목록`, `기록`↔`등기` 전환 및 콘솔·페이지 오류 **0건** 확인
