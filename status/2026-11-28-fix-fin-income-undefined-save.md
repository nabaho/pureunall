# 2026-11-28 · 재무 — 입금확정 두 번째부터 입금 기록이 서버에 안 올라가던 결함

- PR: (만든 뒤 PR 설명에 적음)
- 무엇: 서버로 바로 가는 저장 길(`_recServerWrite`)이 보내는 값에서 **안쪽 칸의 undefined** 를 걷어낸다(`_fbNoUndef`).
  보통 객체는 undefined 칸을 뺀 사본, 배열의 undefined 는 null(자리 유지), 그 밖은 그대로 — 이 PC 사본(JSON)과 같은 모양.
- 왜: 운영 화면(입금관리 «미입금 대기» → 입금확정)에서 첫 건은 올라가고 두 번째부터는 `finance_income` 이 안 올라갔다.
  콘솔 `update failed: values argument contains undefined in property 'data.finance_income.v.<id>.perfSettleType'`.
  원장 «받음»·통장 «처리됨»은 올라가서 «받음인데 입금 기록·성과급은 없는» 반쪽이 남았다.
- 원인 사슬: `perfSettleType: settleType || undefined`(doConfirm 등) → `dbUpsert` → 서버 형식이 정해진 뒤(`_recCanDirect`)
  `_recFieldPaths` 가 새 레코드를 통째로 → `_recServerWrite` 는 맨 위 값만 null 로 바꿈 → Firebase 가 update 전체 거절.
  첫 건은 `dbSet` 길(맨 앞 JSON 왕복이 undefined 를 걷음)이라 통과했다.
- 바꾼 자리(pu-erp.html): `_recServerWrite` 의 값 한 줄 · 그 바로 뒤 `_fbNoUndef` 새 함수 · `dbSet` 머리글의 «모두 여기로 온다» 한 줄 바로잡음.
  `dbSet` 건별 길은 이미 JSON 왕복으로 걷혀 있어 손대지 않았다(새 검사가 그 왕복을 «돌려서» 지킨다).
  `perfSettleType: settleType || undefined` 세 곳도 그대로 — 길목에서 걸러진다.
- 검사: `tests/server-write-no-undefined.test.js` — 실제 dbUpsert·dbPatch·dbUpsertMany·dbSet 을 떠서
  «실시간DB 처럼 깐깐한» 가짜 서버로 돌린다. 고치기 전 코드로는 4개가 실패하는 것을 확인했다.
- ⚠ 남은 일: `_recServerWrite` 의 catch 는 `fbSyncFail` 만 부르고 «못 보낸 변경»(`_fbPendRecord`)을 적지 않는다 —
  다른 까닭으로 실패해도 그 변경은 이 PC 에만 있다가 조용히 사라질 수 있다. 이번 PR 범위 밖.
- ⚠ 이미 생긴 반쪽 기록(원장 «받음»인데 입금 기록 없음)은 이 PR 이 되살리지 않는다 — 어떻게 바로잡을지는 따로 점검이 필요하다([확인 필요]).
