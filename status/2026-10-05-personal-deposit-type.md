# 2026-10-05 · personal-deposit-type — 👤 개인입금 사업 (컨설팅 유형 스위치)

- 대표 「법인이 아닌 개인에게 입금되는 사업 — 자동으로 개인입금, 바뀌면 일괄 변경」 → 검토 → 목업 → 「목업대로 해라」.
- 컨설팅 유형 personalDeposit 스위치(환경설정 › 유형 카드 「👤」). 처음 켤 유형 7개: 일터상생혁신·통합기술보호지원단·산업일자리전환 충남·능률·일터혁신상생·인사노무 충남북부상의·출산육아휴직우수기업.
- 계약·컨설팅은 값을 베끼지 않고 personalDepositMode('' 따름 / 'on' / 'off' 예외)만 — 유형만 바꾸면 미입금 건은 저절로 따라감. 옛 personalDeposit:true 는 'on' 으로 읽음.
- 규칙 한 곳: erpPersonalDepositInfo / erpIsPersonalDeposit → erpInitDeductions(입금확정·거래내역 자동확정 둘 다).
- 스위치를 바꾸면 PersonalDepositBulkModal — 이미 확정된 입금 중 분류가 다른 것만, 예외 건·마감 달(입금 마감·급여 마감)은 안 바꿈, erpIncomeLog 로 기록. 셈은 확정창과 같음(personalReclassPatch).
- 실데이터: 7개 유형의 확정 입금은 이미 모두 개인수익이거나 0건 → 지금 켜도 바뀌는 확정 입금 0건.
