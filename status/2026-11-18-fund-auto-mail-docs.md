# 2026-11-18 — 설립·요청 필요서류 간소화 및 푸른메일함 기금서류 상시 자동 보관 시스템

## 1. 사내·공동기금 필요서류 간소화 및 불필요 설명 제거 (`fund.html`)
- **노동부 설립인가 필요서류(`REQ_DOCS.inka`, `SDC_DOC_DEFS.inka`) 정리**:
  - 사내기금 인가 단계에서 불필요한 재무제표(`inka_fin`), 고용보험 가입자명부(`inka_ei`), 노·사 준비위원 개인도장(`inka_pseal`), 기금법인 직인 제작(`inka_fseal`)을 제거하고 실무 필수 항목(설립준비위원 재직증명서, 사업자등록증 사본, 법인등기부등본, 기금출연확인서, 공동기금 참여신청서)만 유지.
- **기업 요청 메일 문안(`pmText`, `_pmMail`, `sdcMailText`) 전면 간소화**:
  - `3. 설립등기 뒤 세무·은행 안내`, `4. 도장·날인·납부 등 협조사항`, `함께 정해 주실 사항`, `기업 정보 확인`, 각 서류 아래의 부연 설명줄(`desc`/`req`)을 모두 제거하고 `[ ] 1. 서류명` 형태로 필요서류 제목만 간결하게 표시.

## 2. 푸른메일함 수신 서류 → 관리기금 상시 자동 유입·적재 (`functions/fund-mail-collect.js`, `functions/index.js`, `fund.html`)
- **서버 상시 자동 수집 (`exports.collectFundMailOnNew`)**:
  - `/mailbox/msgs/{slug}/{uid}` `.onCreate` 트리거로 수신 폴더(`INBOX`, 기금 전용 폴더, 자문사답변)에 첨부 메일이 도착하는 즉시 관리기금(`fund_erp/funds`·`sites`)과 매칭하고(기금명 약칭 변형어·담당자 이메일·유일 상호 지원), IMAP 읽기 전용으로 첨부(ZIP 내부 문서 포함)를 읽어 자동 분류·적재.
  - 개인 인감증명서·주민등록등초본·신분증 및 마스킹 전 주민등록번호 포함 문서는 바이너리(`closing_blobs`) 저장을 원천 차단하고 입수 사실 메타만 기록.
- **4갈래 필요 위치 자동 배분 + 클라이언트 자동 동기화(`autoIngestFundMail`)**:
  1. `fund_erp/closing/{fid}/{yr}/archive_docs` + `closing_blobs` + `archive_mails` (회계·결산 백업 보관함)
  2. `fund_erp/events/{fid}/{eid}/mail_docs` (진행중 변경 이벤트 카드 내 열람·받기 바)
  3. `fund_erp/site_doc_chk/{fid}/{sid}/{docId}` (사업장 제출서류 체크리스트 입수 자동 표시)
  4. `fund_erp/mail_auto_inbox/{fid}/{docId}` (기금 정보 탭 상단 `[📬 메일 자동보관함]` 통합 열람 창)

## 3. 검증
- `node fund-erp/tools/check_fund.js` 통과
- `tests/fund-*.test.js` 전체(1,449건 통과, 실패 0건), `tests/fund-mail-collect.test.js`, `tests/no-real-client-data.test.js`, `tests/rtdb-cost-guards.test.js`, `tests/functions-lazy-geoip.test.js` 통과
