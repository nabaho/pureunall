# 2026-11-18 P박스 무설정 무료 공유 DB 직결 · 무인증 일일 자동동기화 · 홈페이지 개편 대비 4중 자가복구 탐색기 구현

## 작업 배경 및 대표님 지시
1. **무료 공유 설정 직접 연결 및 판례·재결 자동동기화 완비**: 사용자가 `Supabase URL`·`JWT`·`OC 아이디`를 수동 입력하지 않아도, 푸른 포털 로그인 즉시 **푸른 보안 클라우드 무료 공유 저장소(`pureun-erp-hrphotos/pbox_shared/corpus_v1.json`, 비용 ₩0)**가 자동 연결되고 `LAW_OC` 미설정 환경에서도 매일 새벽(`03:20`) 및 일일 최초 접속 시 12개 핵심 채널(대법원·하급심·헌재·중앙행심위·중노위·산재재심사위·소청심사위·고용노동부·법제처·조례·행정규칙) 공식 원문이 자동 수집·공유되도록 직결.
2. **무료 법률사이트 홈페이지 개편 대비 자동 탐색기 구현**: 무료 공공·법률 사이트의 메뉴 코드·경로·HTML/DOM 구조가 개편되어 일반 수집이나 검색이 막힐 때도 실존 원문을 자동으로 찾아오는 4중 자가복구 탐색 엔진 구축.

## 주요 변경 내역
- **`functions/index.js` & `functions/pbox-sync.js`**:
  - `pboxDailySync` 및 `pboxApi`에 서버 전용 Cloud Storage 공유 저장소(`upsertToBucketStore` / `pullFromBucketStore` / `deleteFromBucketStore`, GCS `ifGenerationMatch` 원자적 낙관적 잠금·소유권 보호·삭제 툼스톤 불변 보장) 직결.
  - `runSync()`에 무인증 공식 원문 일일 자동수집기(`pullKeylessOfficialRecent`) 추가 (`LAW_OC` 미입력 상태에서도 매일·최초 접속 시 자동 수집).
  - **4중 자가복구 탐색 엔진(`autoDiscoverOfficialMaterials`, `action: "auto_discover"`)**:
    1. **1단계(경로 우회)**: 기본 `menuId`/`decOrg`/`cmt` 주소 404·빈 화면 시 무파라미터 표준 `.do` 및 통합 심판/결정 경로(`buildFallbackSsrListUrls`) 자동 우회.
    2. **2단계(자율 DOM/JSON 파서)**: `onclick` 변경 시 `<a href="*InfoP.do">`, `<script id="__NEXT_DATA__">`·`application/ld+json`, `data-seq` 속성에서 원문 주소를 자율 복원(`extractAdaptiveListEntries`)하고, 상세 페이지 `#conTop` 부재 시 `<main>`/`<article>` 및 라벨형 사건번호·법원명 표를 자동 파싱.
    3. **3단계(약칭 확장·핵심어 분해)**: 복합 문장·약칭 질의를 핵심 법리 키워드·사건번호로 분해 재탐색(`buildDiscoveryQueries`).
    4. **4단계(공공도메인 정밀 우회 경로)**: 외부 기관 내부 게시판 개편과 무관하게 도달하는 `.go.kr` 도메인 정밀 탐색 링크(`buildAlternateOfficialPortalRoutes`) 제공.
- **`tools/moleg-mcp/` (`server.js`, `moleg-core.js`)**: `moleg_auto_discover` 도구 추가(총 10종).
- **`js/pu-pbox-store.js`, `js/pu-pbox-app.js`, `pu-pbox.html`**:
  - 한국 표준시(KST) 기준 일일 최초 접속 자동 부트스트랩 동기화(`autoBootstrapIfStale`, `isoToKstYmd`) 및 상위 장애 시 30분 재시도 보호(`lastSyncAttemptAt`), 다중 페이지 공유 문서 수신 지원.
  - `⚙ P박스 자동동기화 · 무료 공유 DB 설정` 모달을 실시간 공유 연결 검증 상태 중심 화면으로 개편(수동 입력란은 고급 선택 아코디언으로 접음, 포커스·입력값 보존 갱신)하고 즉시 동기화·자동탐색기 실행 버튼 배치.
