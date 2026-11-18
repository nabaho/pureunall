# 2026-11-17 법제처(law.go.kr) 공식 MCP 서버 연결 및 중앙행정심판위원회·전 심판기관 재결례 API/MCP 통합

## 작업 배경 및 대표님 지시
1. **법제처를 MCP로 연결**: 별도 서드파티 중계 서버(`gomdori.app`)나 유료 API 없이 대한민국 법제처 국가법령정보센터(`https://www.law.go.kr`) 및 현행 전 법령(5,773편)을 Antigravity IDE·Claude Code·Codex 및 저장소(`.mcp.json`)에서 즉시 사용할 수 있는 공식 직결 MCP 서버(`moleg-law`)로 연결.
2. **중앙행정심판위원회 재결례 등 심판 사건 전체 API·MCP 연결**: 중앙행정심판위원회(국민권익위)뿐 아니라 시·도 및 교육청 행심위, 중앙·지방노동위원회, 산업재해보상보험재심사위원회, 고용보험심사위원회, 인사혁신처·지방 소청심사위원회, 조세심판원, 특허심판원, 해양안전심판원, 중앙토지수용위원회, 건강보험분쟁조정위원회, 공정거래위원회, 개인정보보호위원회, 국민권익위원회(고충의결), 국가인권위원회, 금융위·증선위, 방통위, 중앙환경분쟁조정위원회, 감사원 사전컨설팅까지 **23개 공식 심판·재결·결정 채널 전체**를 P박스 API(`pboxApi`)와 `moleg-law` MCP 양쪽에 통합 연결.

## 주요 변경 내역
- **`functions/pbox-sync.js`**:
  - 23개 심판·재결 채널 통합 레지스트리(`TRIBUNAL_TARGETS`, `TRIBUNAL_GROUP_MAP`, `TRIBUNAL_PRESETS`) 구축 (무인증 공개원문 SSR + `LAW_OC` DRF Open API 자동 전환 이중 지원).
  - 구 `nlrcSc.do`(404) 주소를 현행 법제처 통합 경로(`deccSc.do?deccType=S&decOrg=360109`)로 바로잡고, `specialDeccInfoP.do`·`decsnDocSc.do`(`ftcInfoP`, `ppcInfoP`, `acrInfoP`, `iaciacInfoP`, `eiacInfoP`, `ocltInfoP`, `eccInfoP`, `nhrckInfoP`, `fscInfoP`, `kccInfoP`)·`baiPvcsInfoP.do` 원문 파서 및 사건번호 비식별 보호 규칙 보강.
  - `pboxApi` 전용 `action: "pull_tribunals"`(`pullTribunalBundle`) 추가, 23개 채널 라운드로빈 상세 예산 공정 배분, DRF JSON 스트리밍 크기·타임아웃(`AbortController`) 상한, 시·도/교육청 행심위(`localOrg`) 엄격 검증 및 쿨다운 보호 적용.
- **`tools/moleg-mcp/` (`server.js`, `moleg-core.js`, `package.json`, `server.test.mjs`)**:
  - 외부 npm 의존성 0개인 순수 Node.js Stdio JSON-RPC 2.0 MCP 서버 구현 (`\n` 개행 프레이밍 및 `Content-Length` 프레이밍 자동 감지 겸용, 큐 상한·JSON-RPC `id`/스키마 정수·길이 검증 완비).
  - 9개 읽기 전용 도구 제공: `moleg_search_law`, `moleg_get_law_article`, `moleg_search_precedent`, `moleg_search_tribunal`, `moleg_list_tribunals`, `moleg_search_interpretation`, `moleg_search_ordinance_admrul`, `moleg_get_document`, `moleg_unified_search`.
  - `.mcp.json`, Antigravity(`mcp_config.json`), Claude Code(`.claude.json`), Codex(`config.toml`) 전역 등록 완료.
- **`js/pu-pbox-corpus.js`, `js/pu-pbox-engine.js`, `js/pu-pbox-store.js`, `js/pu-pbox-app.js`, `pu-pbox.html`**:
  - 법제처 공식 실존 심판·재결 원문 추가 수록(총 148건 전수 `https://www.law.go.kr/LSW/` 원문 검증 통과) 및 전국 법률사이트 허브 47개로 확장.
  - P박스 `판례·결정·유권해석` 화면에 심판기관별 원클릭 필터 칩 및 `하급심·심판 수집` 화면에 22개 심판기관 + 전국 22개 시·도/교육청 행심위 세부 선택 수집 카드 추가, 기계적 인용 검증기(`verifyCitations`) 전 심판 사건번호 패턴 지원.

## 검증 결과
- `node scripts/check-cache-version.js` 통과
- `node --test tools/moleg-mcp/server.test.mjs tests/mcp-config-no-secrets.test.js tests/pbox.test.js tests/color-palette-apps.test.js tests/one-line-cells.test.js tests/no-hardcoded-old-erp-url.test.js tests/test-pin-guard.test.js` 전 항목 통과
- `node tools/phone-audit/run.mjs pbox --widths=360,375,411,768,1280,1920` 전 해상도 0건 통과
