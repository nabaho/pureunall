상태: 완료

# 2026-10-11 퇴직연금 자동 정리 — 연말 정산 «낸 돈 0» 고침 (fix/dc-auto-yearend)

- 실제 화면에서 찾음: 연말 정산이 자동 정리로 넣은 통장 줄만 세어, 재무에 올린 통장(ledger_batches)·출금관리 몫이 빠져 모두 «낸 돈 0»
- dcYearEnd(…, companyTotal): 월별 표와 같은 통장 합(dcBankOutflows + 출금관리만 있는 달)을 임금 비율로 나눈다
- 표 아래 «통장 내역은 YYYY-MM-DD 까지» 안내
