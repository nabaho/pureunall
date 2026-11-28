# 산재사건관리(`pu-sanjae.html`) · 부당해고·노동사건관리(`pu-case.html`) 신설 및 통합 보관·연동 구축 보고 (2026-11-28)

## 1. 구현 개요
- **목적**: 푸른노무법인의 산재 사건과 부당해고·징계·부당노동행위·임금체불·진정·대지급금 사건의 서류 수발신, 상대방 서류 vs 당사 대응 1:1 공방 대조, 심사/재심사·재심·행정소송 제척기간, 메일 자동 발굴, 표준 보관함(`File System Access API`) 인라인 미리보기 및 실시간 공동 관리를 전담 앱 2종으로 분리·통합 구축함.
- **신설 화면 및 코어·뷰 모듈**:
  - **산재사건관리**: `pu-sanjae.html` (`key: sanjae`, 아이콘 `🏥`), `js/pu-sanjae-core.js`, `js/pu-sanjae-view.js`
  - **부당해고·노동사건관리**: `pu-case.html` (`key: laborcase`, 아이콘 `🔨`), `js/pu-laborcase-core.js`, `js/pu-laborcase-view.js`
  - **공용 엔진·뷰키트**: `js/pu-case-archive-core.js`, `js/pu-case-archive-view-kit.js`
  - **전수 수집·정화 도구**: `scripts/case-archive-collector.js` (로컬 경로·예외 패턴은 저장소 외부 `_collector_config.json` 으로 분리)
- **전사 배선 및 실시간 DB 규칙**:
  - `enter.html`, `pu-erp.html`, `js/pu-appbar.js?v=56`, `js/pu-ontology.js?v=112`, `js/pu-chatbot-kb.js?v=20` 배선 완료 및 전체 HTML 캐시 버전 동기화.
  - `scripts/make-firebase-rules.js`: `sanjae_cases`, `sanjae_secret`, `labor_cases`, `labor_secret` 2단 보안 규칙 생성 및 라이브 RTDB 배포 완료(물리 삭제 금지, 부담당자 `managerMain`/`managerSubs` 변조 차단, 비밀금고는 관리자·배정 담당자만 열람).

## 2. 자료 전수 수집 · 표준 보관함 정리 · RTDB 적재 실적
- **자료 탐색 및 중복 제거 복사 (`case-archive-collector.js --copy`)**:
  - 탐색 전체 `43,794`개 파일(무관 제외 `31,316`개, 제외 폴더 `175`개) → 사건 적중 `6,996`개(SHA-256 중복 제거 후 고유 `5,463`개, `14,608,773,769` bytes).
  - 로컬/NAS 표준 보관함 동시 미러링: 각각 신규 `5,566`건 · 스킵 `5`건 (`errors: []`, `missingRoots: []`).
  - 정리 사건 묶음 **`1,911`건**(산재 `311` · 부당해고/노동위 `737` · 임금체불/진정/대지급금 `863`), 연결 서류 `6,588`건, 연계 메일 `1,017`통, 사건별 `_공방대조표.md` 및 최상위 4축/리포트 파일 생성.
- **RTDB 공유 원장 백필 및 메일 원문 주소 정화**:
  - 1차 백필(`--backfill-rtdb --apply`): 준비 `1,217`건 / 반영 `1,217`건 / 스킵 `0` / 단건메일유보 `694` / 절대경로위반 `0`.
  - 보안 정화(`--scrub-mail-addrs --apply`): 전체 `1,217`건 중 메일 주소 원문(`from`/`to` 등) 포함 `77`건 모두 정화 반영(스킵 `0`, 잔존 원문 `0`).

## 3. 보안 및 UI/접근성 강화 내역
- **미리보기/XSS 격리**: PDF(`%PDF-` 매직 바이트 + HTML/SVG 태그 거부 + `application/pdf` 강제) 및 이미지(PNG/JPG/GIF/WEBP/BMP 매직 바이트 확인, SVG 차단) 검증, 다운로드 링크 `application/octet-stream` 분리, 비동기 미리보기 경합(`_pvSeq`) 방지.
- **수집기 파일시스템 방어**: 복사·대조표·색인 쓰기 전 `assertNoSymlinkAndInsideRoot` 로 심볼릭 링크·정션 거부 및 보관함 루트 이탈 차단, `nasOk` 블록 스코프 오류 수정.
- **공유 원장 비식별**: `Archive.sanitizeMailLink` 에서 `from`/`to` 이메일 주소 제거 및 제목·첨부명 이메일 패턴 마스킹(`***@***`), `openMailViewerModal` 은 권한 조회 결과(`data.from`/`data.to`)만 표시하고 본문/첨부 분기를 `isPastMail` 로 통일.
- **UI·접근성**: 4축 뷰(연도·기업·당사자·판정 추적), 100건 단위 끊어 그리기(`STATE.pageLimit = 100`), KPI·목록 행·축 카드 키보드(`tabindex="0" role="button"` + `Enter`/`Space`), 모바일 2줄 카드(`<=768px`), 다크 모드 `#toast.err` 대비 보정(`#991b1b`/`#ffffff`), `pu-harass.html` 연관 조사 탐지.

## 4. 검증 결과 (최종 수정 후 기준)
- `node --test tests/*.test.js`: **31,280건 중 31,209건 통과, 0건 실패** (71건 스킵).
- `node --test tests/sanjae-labor-case.test.js`: **7/7 통과**.
- `node scripts/erp-integrity-audit.js`: `"ok": true, "blockerCount": 0, "missing": [], "unlinked": []`.
- `node scripts/check-cache-version.js --all`: 통과 (종료 코드 0).
- `node tools/phone-audit/run.mjs sanjae laborcase --widths=360,411`: 전 20개 모바일 화면 `옆넘침 0 · 화면밖 0 · 세로깨짐 0 · 짓눌림 0 · 두줄단추 0 · 작은단추 0 · 작은입력 0`.
- **Orca 2단계 검증 및 최종 재검토**:
  - 1차 파이프라인(`ow-fix-20261128-172649-Xl7ytd`, Gemini 점검·수정 + Claude 재검토) 및 1차 재검토(`run_69ae57ea777a`) 지적사항(기능 중간 1 · 보안 중간 3 · 낮음 4) 전부 반영.
  - 최종 재검토(`run_70b44e2d7c39`): 기능·UI 검증(`antigravity:gemini-4-argon-high`) **높음 0 · 중간 0 · 낮음 3** (단, 작업자가 보고 출력 후 `worker_done` 호출을 누락해 수동 확인·정리), 보안 검증(`claude`, `codex` 사용률 92% 초과로 자동 전환) **높음 0 · 중간 0 · 낮음 4**.

## 5. 독립 PWA 완결 · 업무관리(`work.html`) 3중 통합 · 교차검토 고도화 (2026-11-28 2차)
- **`origin/main` 최신 병합 (`963c86e30`)**: 최신 포털(`govlinks` · 컨설팅 12종 · `msgintake` · `coach` · `kakaoroom` · 로그인 안정화 `#3320`)을 무손실 병합하고 규칙 생성기(`make-firebase-rules.js`) 중복 제거.
- **독립 설치형 PWA 2종 완결**:
  - `scripts/make-sanjae-case-icons.js` 로 고유 PNG(`icon-sanjae-192/512.png`, `icon-laborcase-192/512.png`) 및 `pu-sanjae-manifest.json` / `pu-case-manifest.json` 생성, `pu-sanjae.html` (`🏥`, 초록 좌측 강조선) · `pu-case.html` (`🔨`, 파랑 좌측 강조선) 헤더 `#btnGoWork`(`📋 업무관리로`) 및 `<head>` 매니페스트·홈화면 아이콘 배선, `tests/app-icons.test.js` 51/51 통과.
- **양방향 할 일(`SJ-` / `LC-`) 및 `work.html` 3중 통합**:
  - `PuSanjaeCore` / `PuLaborCaseCore` `buildWorkItemPayload`: `SJ-`/`LC-` 키(금지문자 치환 시 해시 접미사로 충돌 차단 · 다른 사건 `sc.cid` 덮어쓰기 거부), `cat` (`산재` · `부해` · `체불`), `src` (`sanjae` · `laborcase`), `prevItem` 기존 필드 보존, `ref` 미포함(`wsSyncRun` 간섭 차단), 상세 화면 `📋 업무관리로 보내기`(`canEditCase` 권한 확인) 및 `?co=` 초기 필터 구현.
  - `work.html`: ① 왼쪽 메뉴 `🏥 산재사건`(`#nav-sanjae`) · `🔨 부당해고·노동사건`(`#nav-labor`), `renderCaseHub`(1줄 콤팩트 KPI · 번호 컬럼 · IME 보존 부분갱신 · `#sanjae`/`#labor` 해시 진입), ② 사업장 서랍 `dSanjaeLaborHTML(it)` (`co_id`/`sc.cid` 우선, 없을 때만 `scNormCo` 추측 표시, 비밀금고 미접근, `scSendToWork` `+할일 등록`), ③ `hasResult` · `peFlag` 배지 · `dmore` 앱 열기 · `HELP.sc` 통합.
  - `js/pu-ontology.js` (`v=115`) `work.sharedRoots` 및 `sanjae`/`laborcase` `work_erp/items` 쓰기 계약 반영, `js/pu-chatbot-kb.js` (`v=24`) 갱신 및 60개 HTML 캐시버전 동기화.
- **검증 및 교차검토 경위 (마지막 수정 후 기준)**:
  - **Orca 파이프라인 경위**: `ow.bat pipeline --ui` 실행(`ow-fix-20261128-201149-aIKfPj`, `203653-qZtnE9`, `204750-0u7riM`) 중 호스트의 `Orca.exe` 부재 및 Antigravity CLI 백엔드 일시 오류(`empty conversation id`)로 1·2단계가 모두 `0/1건 [시간 초과]`로 완료되지 못함.
  - **Claude & Codex 읽기 전용 교차 검토**: `claude` (2.1.317) · `codex` (0.166.0) 직접 교차 검토 지적사항(KST 오늘 날짜 `todayKst`, 엄격한 달력일 검증 `addDaysIso`/`scAddDays`, `btnSendWork` `canEditCase` 권한 제한, `safeWorkId` 해시 충돌 방지 및 `prev.sc.cid` 가드, `work.html` `correctionDueDate`·한글 IME 보존·`escJ` 줄바꿈 이스케이프·1줄 KPI) 전부 반영 및 `work.html` `SC` 블록을 `openFromHash` 직전으로 이동해 `work-paydata-arrivals`/`work-visits` 충돌 해소.
  - `node --test tests/*.test.js`: **31,457건 중 31,385건 통과 · 1건 실패 · 71건 스킵** (`fail 1`은 `tests/photos-staff-share.test.js:117` — `origin/main`의 `/kakao_room` 규칙이 최신 `docs/firebase-rules-콘솔원문-2026-11-28.json`과 미동기화된 기존 상태이며 `sanjae_*`/`labor_*` 및 본 작업 관련 테스트는 0건 실패).
  - `node tools/phone-audit/run.mjs work sanjae laborcase --widths=360,411`: `sanjae`·`laborcase`·`work:sanjae`·`work:labor` 포함 전 52개 모바일 뷰 **옆넘침 0 · 화면밖 0 · 세로깨짐 0 · 짓눌림 0 · 두줄단추 0 · 작은입력 0** (exit 0).
  - `node scripts/check-cache-version.js --all` (exit 0), `node scripts/erp-integrity-audit.js` (`ok: true`, `blockerCount: 0`), 민감정보 diff 스캔 (`rrnCount: 0`, `emailHits: []`, `unexpectedOsPaths: 0`).
