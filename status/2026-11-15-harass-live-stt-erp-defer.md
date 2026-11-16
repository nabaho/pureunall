# 2026-11-15 — 괴롭힘·성희롱 조사 현장 실시간 상담녹취 자동구조화 · 좌우 전체폭 채움 · 과거 자료 이알피 번호 공란 편입

## 배경
- 조사 현장에서 근로자·참고인 초기 상담 및 면담을 진행할 때 별도 변환 과정 없이 바로 음성 발언을 문답(Q&A)·요지·법정 3요건 검토표·조사결과보고서 초안으로 자동 정리할 수 있는 기능이 필요했다.
- 데스크톱 화면에서 `main` 최대폭(`1360px`) 제한 때문에 좌·우 여백이 남고, 신규·과거 사건 열람 시 좌측(면담·진술 기록)과 우측(3요건 검토표·보고서 본문 초안)을 한눈에 채워 보여주는 자동 합성 기능이 요구되었다.
- 푸른이알피에 기존 등록되지 않았던 과거 메일 발굴 사건들은 당장 2026년 신규 이알피 사건번호가 채번되지 않도록 이알피 번호를 공란(`erpDefer: true`)으로 편입해 두고, 추후 한 번에 정리·연결할 수 있어야 했다.

## 주요 변경
1. **`js/pu-harass-core.js` (`?v=8`)**:
   - `buildErpSyncPayload`: `erpDefer === true` 이고 `erpCaseId`가 비어 있는 사건은 `null`을 반환해 푸른이알피 동기화·채번을 유예하도록 보강.
   - `synthesizeWorkspaceFromCase` & `extractCandidateIssuesFromQa`: 사건의 수집 공문·진술 메일 및 상담·면담 문답으로부터 좌측 `interviews`와 우측 `issues`(3요건 검토표)·`overview`·`recommendations`·`conclusion`·`reportBody`(표준 조사결과보고서 초안)를 비파괴적으로 자동 합성하고, 수동 작성된 본문(`reportBodyAuto: false`)은 덮어쓰지 않도록 보호.
2. **`pu-harass.html` · `js/pu-harass-view.js` (`?v=11`) · `pu-erp.html` · `sign-harass.html`**:
   - 데스크톱 전체폭 레이아웃(`main` `width:100%;max-width:none`) 및 좌·우 분할 창 확장 적용.
   - `openInterviewModal` 내 **🎤 현장 실시간 녹취**(`SpeechRecognition` / `webkitSpeechRecognition`, `ko-KR` 연속 인식, `[문: 조사자]`·`[답: 진술인]` 화자 전환 및 `Alt+S` 단축키, 실시간 주민등록번호 사전 가림 `scrubRrn`, 선택적 기기 내 `.webm` 보관 및 로컬 오디오 플레이어 연결 — 원본 음성 외부 서버 미전송) 및 저장 시 좌·우 창 동시 자동 반영 구현.
   - 미등록 메일 묶음을 **이알피 번호 공란(`⏸ 번호 공란(추후정리)`)** 상태로 개별·일괄 편입하는 흐름(`registerBundleNow`, `importBundlesBatch`, `#importAllDeferBtn`)과 추후 일괄 채번·연결 모달(`openErpBatchLinkModal`, `#erpBatchBtn`, `#caseErp` 필터) 구현.
   - `pu-erp.html` `erpApplyHarassSyncOne`에도 `erpDefer` 방어선 추가 및 모달 닫기·로그아웃 시 마이크·음성인식 스트림 즉시 해제(`stopActiveLiveCapture`).
3. **검증**:
   - `tests/harass-invest.test.js` 13개 합성 시나리오 및 저장소 품질·보안 규칙 테스트 전체 통과, `tools/phone-audit` 375/768/1366px 점검 통과.
