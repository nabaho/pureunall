# 2026-11-11 · 푸른이알피 종료·삭제·되돌림 불변 규칙 및 부활·중복 원천 차단

- 무엇:
  1. `pu-erp.html` 전반에서 확정 되돌림(`undoneDate`)·휴지통(`_deleted`)·종결(`closed`/`transferred`/`cancelled`) 레코드가 다시 보이거나 되살아나거나 번호가 밀리는 7개 경로를 일괄 차단:
     - `PerfTab`(성과관리)·`IncomeListTab`·`IncomeKindTab`·`IncomeUnmatchedTab`·`erpPerfCounts`·퇴사자 미정산 알림/모달·카드수수료 파생·세금계산서 대조·사건 입금 대조·전역 검색에 `erpIncomeLive` / `undoneDate`·`_deleted` 거르개 통일.
     - `erpIncomeSourceStore` 공용 매핑 도입으로 `erpUndoIncome`·`markPartial` 에서 기타사업(`other → other_projects`) 완납 롤백 누락 해결.
     - `reorderConsultingNos`·`renumberContracts2026` 에서 `_deleted` 제외 및 종결·이관·취소 레코드 관리번호 동결(`lockedNums`).
     - `_fbUnknownBaseUpserts`·`dbSet` 트랜잭션 병합에서 서버 `_deleted`·`undoneDate`·종결 상태가 옛 캐시 사본에 덮여 되살아나는 경로 차단(`TrashBin.restore` 명시적 `_restoredAt` 복원만 허용).
     - 콘솔 `erpSyncNow()` 의 날 배열 통째 덮어쓰기 제거(보류 연산 건별 재전송만 수행).
     - `erpQuoteLanePlan`·`processPhotoContractRequest` 가 `closed`·`cancelled` 계약 이력을 중복 방지 대상으로 인식하도록 보강.
  2. 에이전트 지침(`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.agents/rules/pureun-rules.md`, `STATUS.md` §4 #13)과 상세 규칙 문서(`docs/규칙/종료-삭제-되돌림-불변.md`) 신설.
  3. 읽기 전용 정적·스냅샷 무결성 점검기(`scripts/erp-integrity-audit.js`) 및 자동 회귀 검사(`tests/anti-resurrection-guards.test.js`) 추가.
- 왜: 대표 지시 「여러번 기존 종료된 것이나 끝난 부분에 대하여 되살아나거나 중복되는 경우가 자주 발생한다. 코딩을 하거나 데이터 검토를 하더라도 함부로 바꾸면 안 되게 md 나 시스템을 명확하게 해달라.」
- ⚠ 남긴 주의: 데이터 검토·정리 시 표 루트(`data/<표>`) 통째 덮어쓰기나 무덤 표식 없는 물리 삭제를 절대 쓰지 말고, 전후 스냅샷을 `node scripts/erp-integrity-audit.js --before ... --after ...` 로 검증할 것.
