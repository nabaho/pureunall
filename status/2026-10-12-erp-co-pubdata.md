상태: 완료
# 2026-10-12 · 이알피 업체 상세 — 공단·국세청 두 줄 (대표 「진행」, 목업 승인)

가지: `erp-co-pubdata`
- CompanyDetailModal 「4대보험」 아래: 사업 상태(국세청, 폐업 빨강·휴업 노랑) · 공단 신고(상시 N명·사업장·국민연금(고른 곳만)·받은 날).
- 공공데이터 공용 자리(pubdata/co/{사업자번호}) 구독, 읽기만. 업체 기록과 다르면 노란 「N명 다름」 표만 — companies 에 저장 안 함.
- 아직 안 받은 회사: 「공단에서 받아 오기」 → pubdata_req → 서버 pubdataAsk.
- 검사: tests/erp-co-pubdata.test.js. ⚠ 로그인 화면 눈 확인은 아직.
