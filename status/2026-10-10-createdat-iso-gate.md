# 2026-10-10 · 저장 관문이 createdAt 을 «숫자»로 찍던 것 → 저장소 모양(ISO 글자)에 맞춤

- 발견: `js/pu-ontology-write.js` prepareRecord 가 createdAt 이 없던 옛 레코드(업체 co-real-* 등)를 저장하면
  `Date.now()` 숫자를 찍었다. 이알피는 글자(ISO)로 비교(`(x.createdAt||'').localeCompare`)해서
  업체 6건이 숫자가 되자 업체관리가 죽었다(#2369 는 그 정렬 한 곳만 막음, 6건은 ISO 로 바꿔 둠).
- 고침(규칙): createdAt 이 «없을 때만» 모양을 고른다 — 있던 값은 절대 안 건드린다.
  ① `options.timeFormat`('iso'|'number') 우선 ② 업체(Organization)는 ISO ③ 레코드가 글자 updatedAt 이면 ISO, 아니면 숫자.
  - `js/pu-ontology-write.js` (`?v=5→6`, 24개 화면 모두)
  - `js/pu-cal-write.js`: 이알피 근태(attendance_records)는 `timeFormat:'iso'` (`?v=8→9`, pu-cal.html)
  - `functions/mail-fill.js`: 서버 쪽 업체 도장도 ISO (⚠ 함수 배포는 아직 — 다음 배포 때 같이 나간다)
- 검사: `tests/ontology-write-createdat-format.test.js` 신설. `tests/cal-write-gate.test.js` 의 `createdAt > 0`(숫자 전제)은
  «시각이 찍혔는가 + 근태는 글자»로 고침.
- 실데이터 읽기 전용 점검(data/*/v 155자리, 쓰기 없음):
  - companies: 숫자 0 · 글자 239 · 없음 141 (6건은 이미 ISO 로 고쳐져 있음)
  - **attendance_records: 숫자 10 · 글자 16 · 없음 363** ← 유일한 혼재. 10건은 달력(ScheduleEvent)이 9/27 이후 찍은 것
    (`att-mujjak2j-e7qxuizl` 외 9건, createdAt 1790496342820~…). 이알피 근태 스키마는 ISO 글자.
  - 그 밖 153자리: 숫자 createdAt 0건.
- 제안(대표 확인 후): 위 attendance_records 10건 createdAt 을 `new Date(n).toISOString()` 으로 변환. 아직 안 씀.
