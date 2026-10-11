상태: 완료
작업폴더: C:\Users\fair0\Documents\pu-wt-cost2

# 이알피가 계약서 양식을 «실시간»으로 받지 않게 (2026-10-11, fix/erp-forms-lazy)

대표 「비용이 너무 많이 증가 — 해결 방법」 → 「진행해라」 → 「계속」. #2450(문서관리 «바뀌었을 때만») 다음 단계.

## 왜
실측(10/11 12:24, 88초): 다른 방이 양식 29장을 새 원본으로 저장하자 `data/contract_forms` 내려받기 211MB.
양식 한 장 저장 = 목록 통째(1.8~3.4MB) × **열려 있는 이알피 창 7~8개**가 다시 받는다.
이알피는 양식을 「📄 계약서 출력」 창(ContractFormPrintModal) 한 곳에서만 쓴다.

## 고친 것 (`pu-erp.html`)
- `FB_COLD_ONCE_KEYS = ['contract_forms']` · `_fbIsColdKey` — 서버 명단·굳은 명단 두 부팅 길 모두 뺀다(u 감시도 없다).
- `window.erpFreshForms()` — `data/contract_forms/u` 를 이 PC 판(`_meta_`)과 견줘 같으면 안 받고, 다르면 once 로 받아
  `_fbApplyRecord(force)`. 구독(on)·erpEnsureKeys 안 씀. 통째 모드·이미 실시간이면 0.
- `ContractFormPrintModal` = 껍데기(「계약서 양식 불러오는 중…」 → 받은 뒤 `ContractFormPrintBody`). 받기 전 getContractForms 금지
  (빈 사본이면 기본 양식으로 서버를 덮는다).
- `serverBackupDaily` 가 erpFreshForms 도 기다린다 · `fbUploadAll` 은 양식을 빼고 올린다(낡은 사본으로 덮지 않게) ·
  다른 창 따라 받기(`_fbOnSiblingStorage`)에서 뺀다 · `erpAuditSyncKeys` 에 「부팅제외_열때만」 칸.

## 검사
- `tests/erp-forms-cold.test.js` 9개 — 일부러 망가뜨린 6가지 모두 운다.

## 남은 것
- 배포 뒤 3분 profile — 문서관리에서 양식을 고칠 때 내려받기가 이알피 창 수만큼 곱해지지 않는지.
- 양식 «한 건 고침 = 목록 통째 올리기»는 그대로(문서관리 쪽). 첨부를 목록 밖으로 빼는 것은 따로 설계할 일.
