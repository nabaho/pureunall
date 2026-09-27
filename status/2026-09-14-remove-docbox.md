# 2026-09-14 · 서면함을 뺀다

- 가지: `chore/remove-docbox`
- 왜: 대표 지시 2026-09-14 「서면함 필요없다 삭제해라」
  (2026-09-12 「각 직원들이 한글로 서면 작성한 것들 모두 연결 관리하고 싶다」로 만들었던 것)

## 먼저 확인한 것 — 지워도 잃을 것이 없나

실시간DB 세 자리를 직접 읽어 보았다(2026-09-14):

| 자리 | 내용 |
|---|---|
| `erp_docs` | **비어 있음** |
| `erp_doc_idx` | **비어 있음** |
| `erp_doc_text` | **비어 있음** |

**담긴 서면이 하나도 없다.** 화면의 「0건」은 사람마다 다르게 보이는 값이라
그것만 믿지 않고 서버를 직접 봤다.

## 걷어낸 것

`pu-erp.html` (28,853자 줄었다)

- 층 파일 싣는 줄 · `biz/docs` 메뉴 · 역할 프리셋의 `biz/docs` · 도우미 설명 · 화면으로 가는 길
- **사건 상세**에 붙던 칸(`docRef` → `ItemDocsPanel`)
- **계약 상세**(📎 계약서 보관함)에 붙던 칸
- 본체 구역 통째로 — `erpDocBoxReady` · `erpDocExt` · `erpDocWhen` · `erpDocSrcItem` ·
  `erpDocWhoUids` · `erpDocPickList` · `erpDocOpen` · `ItemDocsPanel` · `DocAttachModal` · `DocBox`
- 그 구역에서만 쓰던 `_ensureFbStorage` 도 함께 (다른 데서 안 쓰는 것을 확인했다)

지운 파일 — `js/pu-erp-docbox.js` · `tests/erp-doc-box.test.js` · `docs/mockups/erp-doc-box.html`

등록부 — `js/pu-ontology.js` 의 `primaryRoots` 에서 세 뿌리를 뺐다.

기록 — `STATUS.md` 의 서면함 대목을 「뺐다」로 바꿨다.
**그대로 두면 없는 기능을 있다고 적어 둔 셈**이라, 다음 사람이 헛걸음한다.

## ⚠ 일부러 «안» 건드린 것

- **서버 자리**(비어 있는 세 뿌리)와 **규칙**(실시간DB·창고)은 그대로 두었다.
  규칙을 지우는 일은 **안전장치를 건드리는 별개의 일**이다 —
  `scripts/rules-deploy.js` 는 사라질 규칙이 하나라도 있으면 멈춘다(종료코드 2).
  빈 자리에 규칙이 남아 있다고 해로울 것이 없다.
  다시 만들 일이 없다고 정해지면 그때 `scripts/make-firebase-rules.js` 에서 함께 뺀다.
- `scripts/storage-rules-deploy.js` 의 덮임 점검에 `erp_docs/...` 한 줄이 남아 있다.
  규칙을 남겼으므로 그 줄도 남긴다 — 둘이 어긋나면 그때 멈춰야 한다.
  (지운 파일을 가리키던 주석만 고쳤다.)

## 확인

- 남은 흔적 **0곳** — `DocBox` · `ItemDocsPanel` · `DocAttachModal` · `PuErpDocBox` ·
  `erpDocBoxReady` · `biz/docs` · `pu-erp-docbox` · 「서면함」, 그리고 작은 도우미들까지
- 전체 검사 **17,186 중 17,182 통과 · 4 건너뜀 · 실패 0**
  (구문 검사가 함께 돌아 28,853자를 뺀 뒤에도 파일이 성한 것을 본다)

## 되살릴 때

지운 코드는 이 커밋 전으로 돌아가면 그대로 있다. 서버 자리와 규칙은 손대지 않았으므로
화면만 되살리면 곧바로 돌아간다.
