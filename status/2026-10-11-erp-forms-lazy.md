상태: 이어하기 대기
이어하기시도: 0
작업폴더: C:\Users\fair0\Documents\pu-wt-cost2

# 이알피가 계약서 양식을 «실시간»으로 받지 않게 (2026-10-11, fix/erp-forms-lazy)

대표 「비용이 너무 많이 증가 — 해결 방법」 → 「진행해라」 → 「계속」. #2450(문서관리 «바뀌었을 때만») 다음 단계.

## 왜
실측(10/11 12:24, 88초): 다른 방이 양식 29장을 새 원본으로 저장하자 `data/contract_forms` 내려받기 211MB.
양식 한 장 저장 = 목록 통째(1.8~3.4MB) × **열려 있는 이알피 창 7~8개**가 다시 받는다.
이알피는 양식을 «📄 계약서 출력» 창(ContractFormPrintModal) 한 곳에서만 쓴다.

## 할 일 (코드는 아직 안 고침)
1. `pu-erp.html` 2934 근처에 `var FB_COLD_ONCE_KEYS = ['contract_forms'];` — 부팅 키 거르기(11695·11736 줄)에서 FB_COLD_KEYS 처럼 뺀다.
2. `window.erpFreshForms()` — `data/contract_forms/u` 를 읽어 `localStorage[KEY+'_meta_contract_forms']` 와 같으면 0,
   다르면 `once('value')` 후 `_fbApplyRecord('contract_forms', v, {force:true})`. **구독(on) 금지**. 통째 모드(!_fbPerKeyMode)면 0.
3. `ContractFormPrintModal` 을 감싸는 껍데기로 — 처음엔 「양식 불러오는 중…」, erpFreshForms 끝나면 지금 본문을 그린다
   (hooks 순서 때문에 본문 함수를 안쪽 컴포넌트로 떼어 낸다). ⚠ `getContractForms()` 는 받기 «전에» 부르지 말 것 —
   빈 사본이면 기본 양식으로 서버를 덮는다(40870 줄 dbSet).
4. `serverBackupDaily`(4099 줄): FB_COLD_KEYS ensure 와 함께 `erpFreshForms()` 도 기다린다(구독 없이 백업에 최신 양식).
5. `erpAuditSyncKeys` 보고에 FB_COLD_ONCE_KEYS 칸 추가.
6. 검사 새로: 부팅 키에 contract_forms 없음 · erpFreshForms 가 u 같으면 통째 안 받음 · 다르면 받음 · on( 안 씀 ·
   출력 창이 받기 전에 getContractForms 를 안 부름. `tests/docs-office-forms.test.js` 의 getContractForms 실행 검사는 그대로 통과해야 함.
7. 전체 검사 `node --test "tests/*.test.js"` → 커밋(푸시·배포는 사람이 본다).

## 남은 확인
- 배포 뒤 3분 profile — 양식 저장 1번에 내려받기가 창 수만큼 곱해지지 않는지.
