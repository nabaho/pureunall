# 2026-10-04 · 정부컨설팅 — 이알피 «상태만 종료»인 건도 걸러낸다

가지: `fix/gov-erp-closed-status-filter` — 대표 「배경 그만두고 걸러내는 것」.

## 무슨 일이었나
- 전체 훑기에서 가져오기 목록에 배경건설(주)(현클-2026-004)이 «새 사업장»으로 떴다.
  이알피에는 `status:'closed'` 인데 `closedDate`·`closedAt` 이 «둘 다 빈 채» — 목록의 상태 칸을 「종료」로 바꾸면
  status 만 바뀐다(「종료」 단추를 눌렀을 때만 closedAt 이 적힌다).
- 가져오기(`erpBuildPlan`)는 날짜 칸만 보고 거르던 터라 샜다. 반면 자동 종료(`erpClosedOn`)는 status 도 봐서
  «가져오라는 건이 곧 자동 종료 대상»이 되는 어긋남이 있었다(코드 주석은 「같게 맞췄다」고 적혀 있었으나 아니었다).

## 한 것 (gov-consulting.html)
- `erpIsClosed(c)` — status 종료 · closedDate · closedAt 중 하나라도 있으면 끝난 것. **잣대 하나.**
- 거르는 세 곳(가져오기 계획 `erpBuildPlan` · 사업장 짝짓기 `erpConsByCo` · 연결표 건수 `erpMappableTypes`)과
  자동 종료 `erpClosedOn` 이 같은 함수를 쓴다.

## 실제 서버 자료로 견준 것 (읽기만, 2026-10-04)
- 이알피 진행 61건 → 56건. 빠진 5건은 전부 «이미 일정관리에 있던(exists) 상태만 종료 건»(호성기업·미르지엔아이·신솔이엔에스·배경건설·해성엔지니어링).
- 늘어난 건 0. 가져올 것(new/addtype) 0.
- ★ 배경건설(주)은 9/28 에 이미 일정관리에 들어와 있고 같은 날 종료로 적혀 있다(`endedTypes.t3`=2026-09-28) —
  지울 것도 넣을 것도 없다.

## 검사
`tests/gov-erp-closed-status-filter.test.js` 5개(실제 함수를 돌림), 되막기 8자리 전부 걸림.
`gov-erp-close-down.test.js` 는 함수 목록에 `erpIsClosed` 만 더했다. 정부컨설팅 검사 829개 통과.

## 남은 일
- 없음.
