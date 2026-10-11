상태: 완료

# 계약서 양식 «옛 첨부 사본» 걷어내기 — 3단계 (2026-10-11 21:18, 대표 「걷어내라」)

#2505(1·2단계: 보관함에서 받기 · 새 저장엔 사본 안 넣기) 운영 확인 뒤, 운영 자료의 옛 사본을 걷어냈다.

## 한 일
1. 백업 — `data/contract_forms` 통째를 이 PC 에: `C:\Users\fair0\Documents\pu-cost-tools\contract_forms-backup-20261011-211757.json`
   (3.56MB · 양식 62 · u 1791708103860 · 사본 있는 첨부 62개 전부 보관함 번호 있음). ⚠ 저장소에 넣지 않는다(공개 저장소).
2. 한 번의 거래 — 문서관리 화면(대표 계정)에서 `PuContractForms.changeForms(db, removed, list => list.map(slimForm))`.
   거래 전에 서버 u 가 백업 때와 같은지 보고(같았음), 다르면 멈추게 했다. 1.3초.
3. 서버에서 따로 다시 셈 — 3.56MB → **0.29MB** · 사본 남은 첨부 0 · 첨부 번호 65개 모두 `pu_docs/originals` 에 실재 ·
   양식 id 62개 그대로 · 첨부 말고 바뀐 칸 0.

## 되돌리기 (필요할 때만)
`firebase database:set /data/contract_forms <백업파일> --project pureun-erp` — 단, 그 뒤에 고친 양식이 있으면 그것이 사라진다.
보관함 원본은 지울 수 없게 잠겨 있어(창고 규칙 update·delete false) 걷어낸 것으로 잃은 파일은 없다.

## 효과
양식 화면 열기·한 장 고치기·이알피 출력 창 받기 때마다 오가던 3.4MB 가 0.2~0.3MB 로 — 약 1/12.
요금 확인은 10/12 오후 3시 예약 작업(`firebase-cost-check-1012`)이 본다.
