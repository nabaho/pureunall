# 2026-11-18 한국공인노무사회(ilabor.co.kr 전용자료실 · kcplaa.or.kr 본회 포털) CLI 당겨오기 및 P박스 직접검색 연동

## 대표님 지시 사항
- 한국공인노무사회 전용자료사이트(`ilabor.co.kr`) 및 한국공인노무사회 본회 포털(`kcplaa.or.kr`)의 모든 정보를 CLI 연동으로 당겨와 직접 검색할 수 있게 하고, P박스에서도 통합 연결·검색 가능하도록 구축.

## 주요 구현 내역
1. **한국공인노무사회 전용 CLI 도구 (`tools/kcplaa-cli/kcplaa-cli.js`, 전역 명령 `kcplaa-pbox`)**:
   - `kcplaa-pbox channels`: 15개 연동 채널(오늘의 자료, 고용노동부 24개 분과, 근로복지공단, 노동위원회, 기관보도자료, 노동판례 5대 법원, 재결례, 행정해석, 지침, 노사정뉴스, 월간 노사 FOCUS, 법정서식·예규·훈령·고시, 통합검색, 본회 공지·알리다, 회원전용 게시판) 및 로컬 색인 상태 조회.
   - `kcplaa-pbox pull` / `kcplaa-pbox today`: 실존 자료를 당겨와 로컬 보안 색인(`~/.pureun-pbox/kcplaa-corpus.json`)에 중복제거 저장하고, 공개 자료는 `--export <파일.json>` 또는 `--push`로 P박스 공유 DB에 반영. (`--login` 대화형 인증 또는 `ILABOR_ID`/`ILABOR_PW` 일회성 환경변수로 회원 전용 상세원문 수집 지원, 명령줄 비밀번호 인자 및 회원 전용 원문의 공유 DB 업로드 원천 차단.)
   - `kcplaa-pbox search "<검색어>"`: 로컬 색인과 실시간 `ilabor.co.kr`·`kcplaa.or.kr` 채널을 동시 검색.
2. **서버 동기화 · 실시간 검색 · 일일 자동수집 직결 (`functions/pbox-sync.js`, `functions/index.js`)**:
   - `pullKcplaaIlaborBundle` 및 `pboxApi` `action: "pull_kcplaa"` 추가.
   - `pboxDailySync`(`03:20` KST) 및 실시간 통합수집(`live_search` / `auto_discover`)에 한국공인노무사회 채널 병행 연동.
   - 외부 HTML 내 제3자 `OC` 파라미터 즉시 폐기 및 공식 URL 화이트리스트(`sanitizeOfficialLawUrl`) 적용.
3. **MCP 도구 확장 (`tools/moleg-mcp/`)**: `moleg_search_kcplaa` 도구 추가(총 11종).
4. **P박스 웹 앱 (`js/pu-pbox-corpus.js`, `js/pu-pbox-engine.js`, `js/pu-pbox-store.js`, `js/pu-pbox-app.js`, `pu-pbox.html`)**:
   - 전국 법률사이트 허브 및 상단 빠른 직행 바에 `노무사회 ilabor`, `ilabor 행정자료`, `한국공인노무사회` 및 `공인노무사 핵심 4종 동시검색` 추가.
   - `하급심·심판·노무사회 수집` 화면 최상단에 원클릭 채널별 당겨오기·직접 검색 이동·CLI 명령어 복사 패널 탑재.
