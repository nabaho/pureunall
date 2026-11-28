# 2026-11-23 안전보건체계구축(`safety.html`) 신설 · 업종별 체크리스트 · 과거 수행이력 비식별 백필

- 작업 브랜치: `feat/safety-system`
- 주요 추가 파일:
  - [safety.html](file:///safety.html): 과거 수행이력 아카이브, 신규 착수 사전 체크(12항목), 공식 7대 핵심요소(25문항), 8대 업종별 특화 체크리스트(복합 겸영 지원), 24종 고위험 기인물, 표준 16대 서류, 위험성평가 매트릭스, 2026 공단 수행기준 감사, 종합보고서·핵심 개선사항 1P 요약보고서(.hwpx/.xlsx/.zip) 통합 워크스페이스
  - `js/pu-safety-catalog.js`, `js/pu-safety-intake.js`, `js/pu-safety-report.js`, `js/pu-safety-hwpx.js`, `js/pu-safety-view.js`
  - `scripts/backfill-safety-history.js`: 과거 안전보건컨설팅 수행이력 비식별 통합 백필 스크립트 (`2023년안전보건컨설팅.xlsx` 일반 자문사 명단 및 개별 산재보상 사건 제외)
  - `tools/phone-audit/seeds/safety.js`, `tests/safety-auto.test.js`
- 주요 연동 파일:
  - `enter.html`, `js/pu-appbar.js`, `js/pu-ontology.js` (`PROGRAMS.safety`, `READ_ADAPTERS.safety_core`), `js/pu-chatbot-kb.js` (`SYS-safety-01`), `hangul/js/app.js` (`from=safety`), `functions/doc-read.js` (`safety` AI 윤문 가림), `gov-report.html`, `scripts/make-firebase-rules.js` (`rules.scal_safety`), `tests/perf-rules.test.js`, `tests/color-palette-apps.test.js`, `tests/portal-chatbot.test.js`
- 보안 및 데이터 원칙:
  - 모든 쓰기는 `PuOntologyWrite` 강제 관문(`enforce`) 및 Soft Delete(`_deleted: true`)를 거칩니다.
  - 개인정보·주민등록번호·연락처·계좌·로컬 경로는 클라이언트·서버 2중 가림 및 저장 차단 검증을 적용했습니다.
