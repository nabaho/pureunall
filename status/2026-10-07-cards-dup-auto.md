# 2026-10-07 · 똑같은 명함 저절로 합치기 (기업정보함 점검 4절 — 대표 결정 「합치기」)

가지: `feat/cards-dup-auto`

- 「중복 아님」 짝을 **서버**(`pucards/config/dupIgnore/{idA~idB}`)에 둔다. 예전에는 그 PC 에만(2026-08-10 결정).
  옛 PC 표시는 지우지 않고 합쳐 보며, 처음 읽을 때 서버에 없는 것을 올린다. 「중복 아님」 목록 화면 안내 글도 바꿈.
- 하루 한 번 «한 PC»(`config/dupAutoMergeAt` 거래로 차지)가 명함이 다 들어오고 30초 뒤 `dupAutoRun` 을 돈다.
  잣대: 확실한 중복 + 보이는 칸이 하나도 안 다름(`dupAllSame`) + **폴더·둘째 연락처·이알피 연결까지 같음**.
  남의 잠긴 폴더 명함은 안 봄. 한 번에 200묶음까지. 남는 것 말고는 휴지통(30일).
- 「중복 아님」 서버 목록을 못 읽었거나 명함이 씨앗뿐이면 안 돈다.
- 한 일은 `config/dupAutoLast {at, groups, cards, by}` 에 남기고 알림을 띄운다.
- 규칙: `pucards/$k/$k2` 가 이미 직원 쓰기라 손댈 것 없음.
- 검사: `tests/cards-dup-auto.test.js`(7) · `cards-dup-fix` 의 「이 PC 에만」 검사를 새 규칙으로 바꿈.
