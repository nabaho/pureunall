상태: 완료
작업폴더: C:\Users\fair0\Documents\pu-wt-slim
(코드 1·2단계 끝·운영 확인 끝. 3단계는 운영 자료 쓰기라 대표 허락 대기 — 자동 이어하기 대상 아님)

# 계약서 양식 목록에서 «첨부 사본» 빼기 (2026-10-11, fix/forms-slim-att)

대표 「순서대로」 — 1·2단계(코드) 먼저, 3단계(운영 자료에서 옛 사본 걷어내기)는 운영 확인 뒤 **대표께 다시 묻고** 한다.

## 사실 (10/11 실측)
- `data/contract_forms` 3.43MB · 양식 62개. 첨부 62개(3.27MB)는 **100% 원본 보관함(`pu_docs/originals`, 창고)에 같은 파일이 있는 사본**
  (`originals[].attId === attachments[].id`). 목록에만 있는 원본 0개. 보관함은 지울 수 없음(update·delete false), 직원 읽기 가능.
- 첨부 본문(`a.data||a.dataUrl`)을 바로 읽는 곳: `js/pu-contract-forms.js` ~10곳 · `js/pu-office-docs.js` 449·513 · `pu-erp.html` 40996·41000·41649.
- `srcBytes(src)`(3098 근처)가 이미 `fileId` 로 보관함에서 받는다.

## 할 일
1. 읽는 길 하나로 — «사본 있으면 그것, 없으면 originals[attId].fileId 로 보관함에서» (비동기). 이알피도 같은 길(PuContractForms 노출).
2. 새로 저장할 때 `data` 를 안 넣는다 — 첨부엔 id·name·size·fileId 만.
3. (대표 허락 뒤) 옛 사본 걷어내기 — 백업 → 한 번의 거래 → 다시 세기.

## 끝낸 것 (1·2단계 코드)
- `js/pu-contract-forms.js`: `attSrc`·`attBytes`·`slimForm` 새로(내보냄). `changeForms` 는 고친·새 양식만 slimForm
  (`base.indexOf(f) >= 0` 이면 그대로 — 손대지 않은 양식의 옛 사본은 3단계 몫). 미리보기(`openHwpPreview` getBytes)·
  편집 창 미리보기(`opts.attBytes`)·받기 줄(사본 없으면 누를 때 보관함)·「한글 원본 크게 보기」가 보관함으로 물러선다.
- `pu-erp.html`: `_erpFormAttBytes(att, form)` — 사본 → 없으면 `pu_docs/originals/{fileId}.path` → `erpImgStorage()`(hrphotos) →
  fetch. 🔒 서명본은 거절(문서관리에서). 「계약서 출력」의 한글 열기·첨부 받기가 이 길을 쓴다.
- 검사 `tests/forms-slim-att.test.js` 11개 — 일부러 망가뜨린 7가지 모두 운다(★ 번호 없는 사본 빼기 포함).
- 캐시 번호 pu-contract-forms +1.

## 운영 확인 (#2505 배포 뒤, 대표 크롬 · 운영 자료는 안 고침)
- 실제 양식(「기본 상담확인서」)을 메모리에서만 slimForm → 사본 없음·fileId 있음 → `attBytes` 가 보관함에서 받은 것이
  목록 안 사본과 **바이트까지 같음**(15,788B, 1.2초).
- 이알피 길(`pu_docs/originals/{id}.path` → 창고 hrphotos `getDownloadURL` → fetch)도 HTTP 200 · 같은 크기(0.6초).

## 남은 것
- 3단계(대표 허락 필요): 옛 사본 걷어내기 — 백업(`data/contract_forms` 통째를 파일로) → slimForm 을 모든 양식에 한 번의 거래로 → 다시 세기.
