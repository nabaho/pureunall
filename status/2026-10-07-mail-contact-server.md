# 2026-10-07 · 메일로 업체 담당자 채우기를 서버로 (점검 ③-A)

가지: `feat/mail-contact-server` · 기업정보함 점검 ③.

- 예전: 대표님 PC 에서 메일 화면이 열려 있을 때만 1분마다 채웠다(`mnewAutoFill`).
- 이제: 메일 동기화(`functions/mail-sync.js` → `functions/mail-fill.js`)가 받은메일함에 **새로 받은** 줄을 적은 직후,
  회사 도메인이 업체관리의 일하는 업체 **딱 한 곳**과 같으면 그 업체 담당자 줄을 더한다(한 회차 20곳까지).
- 셈은 `js/pu-mail-fill-core.js` «한 벌»(도메인 표·한 곳 짚기·채우기 셈·이름 다듬개).
  서버 사본은 `functions/mail-fill-core/`(`scripts/sync-mail-fill-core.js`). 화면의 `mnewDomTable`·`mnewDomCo`·`erpFillContactPlan` 도 이것을 부른다.
- 업체 기록은 거래 안에서 서버 판 위에 셈하고, `PuCompanyWrite.patch` 와 같은 도장을 찍는다
  (관문 파일은 안 옮김 — `pu-ontology.js` 를 여러 방이 자주 고쳐 남의 PR 이 같음 검사에 걸린다. 같은 결과인지는 검사가 견준다).
- 서버만 더 조심하는 것: 「자문사 아님」으로 치운 주소·도메인은 안 채운다.
- 화면: 서버가 남긴 「정리한 것」 기록을 덮지 않고(added:false 로), 그 기록을 10분마다 다시 읽는다 — 서버가 채운 것도 화면에서 되돌린다.
- 화면 쪽 채우기는 그대로 둔다 — 서버가 못 본 지난 1년 치 메일과, 업체 주소가 나중에 생겨 새로 짚히는 것을 맡는다.
- 검사: `tests/mail-fill-core-in-sync.test.js`(사본·다듬개 같음, 관문과 같은 도장, 채우는 것·안 채우는 것 12가지, 부르는 자리).
  옛 메일 검사 12개 파일이 상자에 공용 셈을 불러오게 손봄.

## 배포

합친 뒤 `firebase deploy --only functions:syncMailbox,functions:pullMailbox` — 안 올리면 서버 채우기가 안 돈다(화면 쪽은 그대로 돈다).
⚠ `js/pu-mail-fill-core.js` 를 고치면 sync 를 돌리고 이 둘을 다시 올린다.
