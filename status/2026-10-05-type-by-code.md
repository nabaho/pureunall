# 2026-10-05 · 업무유형 정리 2단계 — 이름 글자 대신 역할 칸·번호로 알아보기 (fix/type-by-code)

대표 지시: 「순서대로」(1단계 #2019 다음). 이름을 고쳐도 계산·표시가 깨지지 않게.

## 한 것
- 컨설팅 유형에 **역할 칸 role**('clinic' 현장클리닉 · 'tech' 기술보호 · 'none' 어느 셈에도 안 듦).
  - `consTypeRole` / `consRoleOf` 한 곳에서 판정 — role 이 있으면 이름과 상관없이 그 역할, 없으면 씨앗 번호 → 이름으로 짐작(지금까지와 같음).
  - `bizTypeApply` 가 컨설팅 사전을 **고치기 전** 역할로 굳힌다(`bizTypeStampRoles`) — 이름을 바꾸는 그 저장에서도 역할은 옛 이름으로 먼저 정해진다.
  - 환경설정 ✏ 에 「셈 묶음」 질문(단가가 있는 유형만) · 유형 줄에 「셈: 현장클리닉/기술보호」 칩.
- 역할로 바꾼 곳: `clinicIsType` · `techIsType` · `consTypeDayFee`(기본 단가) · `consTypeDayOpt`(일/회·부가세) ·
  `erpIsClinicItem`(입금 매칭의 현장클리닉 건) · 유형 카드 단위 칩.
- 1단계의 「이름 변경 경고」(bizTypeNameGuard)는 걷었다 — 이제 이름을 바꿔도 셈이 안 깨진다.
- 기업정보함(pu-cards) 사건 이름: 기록에 복사된 typeName 대신 사건 사전(biz_case_types)의 «지금 이름», 못 찾으면 복사본.
  읽는 자리가 하나 늘었다(사전 1KB 남짓).
- 검사: 새 `tests/type-role-by-code.test.js` 10개(일부러 망가뜨린 10가지 모두 운다) ·
  함수를 떼어 돌리던 검사 5개(clinic-day-cards·gisul-round-count·ledger-clinic-alias·cards-co-hist-funnel·cards-erp-case-cons)에 새 함수/자리를 실어 줌.

## 일부러 안 한 것 (이름이 바뀌어도 «틀린 저장»은 안 생기는 자리)
- 계약서 출력의 사건 양식 자동 체크(사건유형 이름 ↔ 양식 groupName) · js/pu-contract-forms.js CASE_TYPES —
  양식 묶음은 문서관리의 별도 분류라 번호로 잇는 표가 따로 필요하다. 지금도 못 맞추면 «전부 체크»로 물러선다.
- 계약 컨설팅 종류 칩(이름으로 묶어 보여 주기) — 지금 이름으로 묶이므로 이름을 고치면 같이 바뀐다.
- 경력관리 실적의 유형 이름 — «그때 이름» 사본이다(일부러).
