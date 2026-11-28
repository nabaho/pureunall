상태: 작업 완료 (PR·검토 통과)
가지: feat/deungi-hist-clean-fullview (기존 PR #3299가 72b85a4fe에서 이미 main 머지되어 후속 3차 개편분 신규 PR 생성)

# 🖋 푸른등기 — «지난 기록» AB-1 대시보드·연도별 타임라인·인라인 서류 미리보기 (2026-11-28)

대표 지시 「년도별로 넘버링과 간략한 내용으로 왼쪽 대시보드 형태로 두고 각 진행된 등기들마다 클릭하면 오른쪽에 서류와 내용을 하나씩 확인할 수 있게 해달라」 및 AB-1 하이브리드 목업 승인에 따라 `pu-deungi.html` 의 `📚 지난 기록` 탭(`#pane-hist`)을 개편했습니다.

## 바꾼 파일
- `pu-deungi.html`:
  - **CSS (`.hd-*` 대시보드 레이아웃)**: 기존 `.arcgrid`/`.arcg`/`.hcols` 레이아웃을 2단 분할 대시보드(`.hd-wrap`)로 개편. `:root` 팔레트 CSS 변수와 `#ffffff`만 사용해 `color-palette-apps`·`pu-design` 규칙 준수.
    - `@container (min-width:820px)` 이상에서 왼쪽 연도 타임라인(`clamp(240px,27%,330px)`, `position:sticky`) + 오른쪽 상세 좌우 2단 배치(좁은 오른쪽 미리보기 창에서도 2단 유지).
    - `@container (min-width:1080px)` 이상에서 오른쪽 하단 `.hd-split` 좌우 2단(`clamp(290px,33%,360px)` sticky 서류 목록 + 인라인 미리보기 `#arcPvPanel`), 날짜 열 `.dt` 대신 파일명 아래 컴팩트 `.hd-fdt` 표시.
    - `#arcPvBody`의 `max-height` 스크롤 제한을 제거(`overflow-y:visible`, PDF `iframe` `height:max(680px,76vh)`)하여 클릭한 서류 전체 내용이 잘리지 않고 펼쳐지도록 개선.
    - 모바일(`@media (max-width:768px)`)에서는 `[data-act="histListToggle"]` 숨김, `.hd-split.collapsed .hd-doccol` 강제 표시, `.hd-sum-hd` 세로 배치, 입력·선택 `16px` 유지(폰 확대 방지).
  - **즉시 자동 미리보기 (`arcAutoLoad`) 및 탭·상세 패널 개선**:
    - `setTab('hist')` 시 `등기 건`용 `doc` `#side` 패널을 자동으로 닫아 대시보드 폭 확보, `?tab=hist` URL 쿼리 진입 지원.
    - `setTab('hist')`, `reload()`, `histTab`, `histYear`, `histReset`, `histPick`, `histKind` 실행 시 `arcAutoLoad()`로 선택된 묶음의 첫 서류를 오른쪽 인라인 뷰어에 즉시 자동 로드(검색 입력 `data-hist-q` 중에는 `puDocSecret` 감사 로그 과다 기록을 막기 위해 자동 호출 생략).
    - `drawHist()` 재렌더링 시 포커스(`histFocusMark`/`histFocusRestore`)뿐 아니라 `#arcPvBody` 기존 DOM 노드·내부 `scrollTop` 및 페이지 스크롤(`window.scrollX/scrollY`)까지 보존.
    - `끝난`(`histPickDone`)·`기록`(`histPickLog`) 탭도 왼쪽 카드 클릭 시 오른쪽 패널에 해당 등기 건·반영 기록의 전체 내용(변경 목적·변경 항목·등기할 사항·변경 사유·요약·등기 건 열기 버튼)을 표시하도록 개선.
  - **왼쪽 패널 (`drawArchive`)**:
    - 상단 세그먼트 전환기(`등기 N / 끝난 M / 기록 K`, ARIA `role="tablist"` ↔ `id="hdLeftPanel" role="tabpanel"`) 및 `＋ 묶음` 버튼.
    - 실시간 검색 입력(`data-hist-q="1"`, `HIST_UI.q !== el.value` 가드로 모바일 `blur` 시 재진입 `innerHTML` `NotFoundError` 방지) 및 연도 필터 칩(`전체`, `2026`, `2019`…).
    - 연도별 고정 섹션 헤더와 세로 타임라인 카드(`№ 1 ~ № N`, 날짜, 제목, 2줄 요약, 변경 태그, 서류 개수).
    - `끝난`·`기록` 탭에는 호버·클램프 없는 정적 카드(`.hd-done-card.static`, `.hd-log-desc`) 적용.
  - **오른쪽 상세 + 인라인 서류 목록/미리보기**:
    - 상단 요약 카드(`.hd-sum`: `№ N`, 연도 칩, 날짜, 서류 개수, 태그, 제목, `📝 이 등기로 새 개정`·`고치기`·`＋ 파일`·`⬇ 전체` 버튼, `arcKindSummary` 구성 요약).
    - 왼쪽 서류 목록(`.hd-doccol`): `◀ 목록 접기`(`histListToggle`), 종류별 필터 칩, 체크박스(`th.c` 래퍼 클릭 포함)·`№`·파일명·종류 칩·날짜·`⬇ 받기`, 하단 선택 막대(`선택 N개`, `⬇ 받기`, `빼기`, `풀기`).
    - 오른쪽 인라인 미리보기(`#arcPvPanel`·`#arcPvBody`): `▶ 서류 목록 (N)` 펼치기, `◀ 이전` `i / N` `다음 ▶`, 한글 쪽 넘기기(`#arcPvPageBar`: `▲ 이전 쪽`, `p / N쪽`, `▼ 다음 쪽`, `한 쪽씩`/`연속 보기`, 스크롤 페이지 추적, `PageUp`/`PageDown`/`ArrowLeft`/`ArrowRight` 키보드 이동), 파일명, 날짜, `#arcPvKind` 서류 종류 변경 `<select>`, `↗ 비교 칸`(#side 팝아웃), `⬇ 받기`.
    - `arcInlineHidden()` 가 `offsetParent` 기준으로 `#arcPvPanel` 실제 표시 여부를 판별(769~1079px 태블릿에서도 인라인 뷰어 작동).
    - `drawHist()` 시 포커스 복원(`histFocusMark`/`histFocusRestore`) 및 `#arcPvBody` 기존 DOM 노드·`scrollTop` 보존(HWP/PDF/이미지 깜빡임·스크롤 초기화 방지), 같은 묶음 내 파일 전환 시 `arcPvHeaderSync()`로 DOM 전체 재생성 생략.
    - 총괄관리자(`ME.isAdmin`) 가드는 `arcInlineLoad`/`arcView`/`arcDownload`/`pullCharterFromArc`에 유지하고, 비관리자도 행 클릭(`arcSelectFile`)·`◀ 이전 / 다음 ▶`(`arcPvNav`)로 메타데이터 탐색 가능.
    - `arcSetKind()`에서 `C.ARC_KINDS.some(...)`으로 허용된 서류 종류만 저장되도록 검증.
    - `wipe()` 및 권한 회수 시 `purgeAdminPreview()`(`arcCacheClear(); arcPvRevoke(); sideClose(); CHARTER_PULL=null; HIST_UI=histUiInit();`)로 메모리·Blob·추출 초안 정리(`localStorage` 키 추가 없음).
  - **2차 개편 — 풀폭 3단·1줄 연도 타임라인·50%+ 한글 뷰어·성능 가속·직전 개정 승계 (2026-11-28)**:
    - **풀폭 3단 및 1줄 타임라인**: `body.tab-hist main` `max-width:none;width:100%`로 화면 좌우 끝까지 활용. 왼쪽 `.hd-card`를 1줄 콤팩트 타임라인(`[№ N] [MM-DD] [제목 말줄임] [N개]`, ~32px)으로 줄여 6개년(2026~2012) 모두 한눈에 표시. `.hd-sum`을 가운데 `.hd-doccol` 상단으로 옮기고 `@container (min-width:1080px)`에서 `.hd-split`을 `minmax(260px,36%) minmax(50%,1fr)`로 배치해 `#arcPvPanel`이 화면 절반 이상 × 풀높이(`calc(100vh - 72px)`)로 펼쳐지도록 개선.
    - **한글 로딩 가속·메모리 가상화**: `reload()` 300ms 뒤 및 `setTab('hist')`에서 `PureunHwp.loadCore()` WASM 사전 예열, `GEN|WHO|fid` + 3분 TTL + `uid_roles` 실시간 권한 재확인 기반 RAM-only `ARC_CACHE` 추가, 공용 `renderHwpPaged()`(`arcRenderHwpFast` + `sideRenderHwpFast`)로 첫 2쪽만 즉시 렌더 후 나머지 쪽 `requestAnimationFrame` 지연 렌더(`dpr <= 1.5`, `convertToEditable`/`getPageTextLayout` 생략) 및 최대 16쪽/32M 픽셀 초과 캔버스 `.pg-blank`(`--pg-h`) 높이 보존 해제·탭 이탈/완료 시 `doc.free()` 단일 해제.
    - **직전 개정 승계·총괄관리자 검토 모달**: `newCase(refArcId, opts)`가 이전 등기 건 설정(`filing`, `agent`, `notary`, `meeting`, 현 사원 확인된 `chair`, 직전 개정 `memo`)을 승계하고 직전 한글 정관에서 `hwpExtractText()`로 추출한 뒤 `sanitizeCharterExtract()`(하이픈/공백/줄바꿈 주민번호·10/11자리/괄호/무구분/가상 유선전화·휴대전화·이메일 비식별화)를 거쳐 RAM `CHARTER_PULL`에만 적재. 쉬운 1단계·자세히 모드 상단(`prevBarHtml()`) 및 «등기 현황»에서 **`openCharterReviewModal` 검토 모달**로 총괄관리자가 직접 확인·수정한 뒤 승인할 때만 `expectedRev`(`CHARTER_PULL.baseRev`/`BASE_DRAFT_REV`)와 `uid_roles` 재확인을 거쳐 서버 최신 레코드의 `charter`만 트랜잭션 저장(무확인 덮어쓰기·동시 수정 유실·권한 경계 노출 차단).
  - **3차 개편 — 좌우 풀폭 확장·왼쪽 핵심 제목 1줄·가운데 중복 메타 제거·정관 상단 밀착 뷰어 (2026-11-28)**:
    - **좌우 풀폭 끝까지 활용**: `body.tab-hist main` 패딩을 `4px 6px 8px`로 줄이고 `.hd-wrap` 간격 `6px`, `@container (min-width:1050px)`에서 왼쪽 `clamp(200px,15.5%,245px)` + 오른쪽 `.hd-split` `minmax(250px,31%) minmax(56%,1fr)`로 배치해 `1080px` 이상 전 해상도에서 3단 분할 및 오른쪽 정관 뷰어 54%~59% 점유 확보.
    - **왼쪽 연도 목록 1줄 핵심 제목(`arcShortTitle`)**: `.hd-card`에서 `.hd-dt`·요약·태그를 완전히 제거해 `[№ N] [단축 핵심 제목] [N개]` 1줄(`~30.3px`)로 압축(`2026~2012` 6건 모두 한눈에 표시), 연도·날짜·요약 전문은 `title` 툴팁에 유지. `arcShortTitle`은 `YYYY-MM`, `YYYY년 M월 D일`, `YYYY. MM. DD.`, `YYYY MM` 등 선행 날짜 조각만 정밀 제거하고 `2026년 3명` 같은 인원수 문구는 보존.
    - **가운데 패널 중복 제거**: `.hd-sum`에서 중복 연도/개수 칩·`tagsR`·`.hd-sum-sub` 줄을 없애고 `h3.hd-sum-ttl` `title` 툴팁(`arcKindSummary`)으로 유지, 액션 단추 간소화(`📝 새 개정`, `고치기`, `＋`, `⬇`), 파일명에 날짜가 이미 들어간 경우 `.hd-fdt` 생략, `.hd-kbar`를 1줄 가로 스크롤 행으로 정리.
    - **오른쪽 상단 밀착 뷰어(`syncHeadH`)**: `draw()` 마지막(및 `resize`)에서 `#head` 높이를 측정해 `--headH`에 동기화하고 `.hd-pvh`를 초슬림 1줄(`34px`, `.hd-pvh button.sm`·`.hd-pvh .chip` 컴팩트 패딩, `#arcPvKind` PC `max-width:112px`), `.hd-pv-body` 상단 여백 `4px 8px 14px`로 줄여 `#arcPvBody`가 상단에 밀착(`top 119.3px`)되도록 개선. 미사용 `arcTags` 제거 및 `arcLockAttr(ttl)` 통합으로 중복 `title`·`aria-label` 보완.
- `tests/deungi-html.test.js`: AB-1 대시보드·풀폭 3단·1줄 타임라인·50% 한글 쪽넘기기·`renderHwpPaged`/`MAX_RAM_PIX`/`pg-blank`·`ARC_CACHE`/`purgeAdminPreview`·`BASE_DRAFT_REV`·`commitCharterToBase` revision 검사·확장 비식별화(`sanitizeCharterExtract`)·3차 개편(`@container (min-width:1050px)`, `arcShortTitle`, `syncHeadH`, `arcPopSide aria-label`) 회귀 테스트 보강.
- `tools/phone-audit/seeds/deungi.js`: 2026년 묶음(`ARtest2026c`, 3문서)·2쪽 HWP 스텁·비식별 추출 스텁 및 `histdash` 시나리오(1줄 카드 `height <= 42px`·`.hd-dt` 0개·`.hd-sum-sub` 0개·`arcShortTitle` 확인·1366px+ `#arcPvPanel >= 52%`·`#arcPvBody top <= 125px`·쪽 이동·스크롤 보존·`newCaseFromArc` → `reviewPulledCharter` 모달 → `applyPulledCharter` 반영 및 원복 격리) 검증 강화.

## Orca 검토 및 반영 내역
1. **1~4차 통합 검토 (`run_ca3415490c80`, `run_d27b095d0e1d`, `run_6a8ea12f929e`, `run_b6eddf486591`)**: AB-1 기본 구현 검증 통과.
2. **2차 개편 1~3차 검토 (`run_6453c733cee9`, `run_e016cdcc9e86`, `run_88fde2913b26`)**: Gemini 기능·UI 통과, Codex 보안 높음 0 · 중간 2건 수정·재검증 완료.
3. **3차 개편 UI·보안 검토 (`run_0892b9c71219`, `ow.bat review --ui`)**:
   - **Codex 보안**: 높음 0 · 중간 0 · 지정 변경 취약점 없음 (낮음 1건은 기존 `tools/phone-audit/run.mjs:108-114` 백슬래시 필터 권고).
   - **Gemini 기능·UI**: 통과 (높음 0 · 중간 0 · 낮음 5건 → `@container 1050px`, `arcShortTitle` 날짜 정규식, `arcPopSide` `aria-label` 및 `arcLockAttr(ttl)` 중복 `title` 제거, `arcPvEmptyHtml` 문구 통일, `arcTags` 제거·`syncHeadH()` 순서 보정 모두 반영).
4. **3차 개편 2단계 데스크보드 파이프라인 (`ow-fix-20261128-202825-Mgmz1w`)**:
   - **1단계 Gemini (`antigravity:gemini-4-argon-high`, `run_a0183fdbb949`)**: `pu-deungi.html`(`+17 -6`, `fix.diff`) 직접 보완 — 1080px 3단 시 `.hd-pvh`/`#arcPvName` 짓눌림(`20px` → `164px`) 해결, 같은 묶음 파일 전환 시 빈 카드/캔버스 초기화 순서 수정 및 죽은 `#arcPvDate` 조회 제거, 탭 복귀 시 `pg-blank` `arcPvRestore` 복원 추가.
   - **2단계 Claude (`claude`, `run_465d50cc0101`)**: **`[최종 판정] 통과`** (높음·중간 0건, 보안 발견 사항 없음).

## 검증 (최종 수정본 기준)
- `vm.Script` 인라인 JS 3블록(`pu-deungi.html`) 구문 검사: **통과**
- `node scripts/check-cache-version.js --all`: **통과** (종료 코드 0)
- 단위 테스트 15개 스위트(`deungi-html`, `deungi-core`, `deungi-docs`, `color-palette-apps`, `ontology-write-gate`, `back-button`, `app-headers-onerow`, `appbar-coverage`, `appbar-every-link`, `authsync`, `anon-not-login`, `phone-screen-rules`, `phone-input-zoom`, `one-line-cells`, `test-pin-guard`): **322 통과 / 0 실패**
- `node tools/phone-audit/run.mjs deungi`: `375·768·900·1080·1440·1920`(`deungi` + `histdash`) 및 `360·411·1366` 전체 14뷰 **전부 `옆넘침 0 · 화면밖 0 · 세로깨짐 0 · 짓눌림 0 · 두줄단추 0 · 오류 0`**
- 로컬 미리보기 서버(`http://127.0.0.1:4335/pu-deungi.html?tab=hist`, 6개년 샘플 아카이브):
  - **`1080×900`**: 3단 분할 작동(`main 1065px`, `#arcPvPanel 583.06px`=`53.99%`, `#arcPvName 164.39px` 잘림 없음)
  - **`1920×1080`**: 풀폭(`main 1905px`), 왼쪽 1줄 6건(`30.30px`, `.hd-dt 0개`), 가운데 중복 제거(`.hd-sum-sub 0개`, `.hd-kbar` 1줄 가로 배치), 오른쪽 `#arcPvPanel 1131.61px`(`58.94%`)·`.hd-pvh 34px`·`#arcPvBody top 119.30px`, 2쪽 한글 쪽 이동(`1/2`↔`2/2`), 탭 왕복 재렌더, 콘솔·페이지 오류 **0건**
