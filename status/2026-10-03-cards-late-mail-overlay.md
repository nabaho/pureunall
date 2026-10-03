# 2026-10-03 · 기업정보함: 늦게 끝난 메일 조회가 명함 목록을 덮지 않게 (fix/cards-late-mail-overlay)

대표: 「다른 챗팅방에서 진행하던것 어떻게 해야하나? 계속할수 있게 검토해라」 → 「둘 다」.
Codex 가 오늘 아침 판(05:20) 위에서 만들다 커밋 없이 멈춘 고침(`.codex-worktrees/cards-startup-mail`, 73줄)을 이어받았다.

## 얹은 것 (겹치지 않는 둘만)
1. `renderMailPage` · `renderMailMobile` — 메일 화면이 아니면 그리지 않는다. 늦게 끝난 조회가 폰의 명함 목록(#list)을 메일함으로 덮던 것.
   같은 칸을 빌려 쓰는 「📥 연락처 정리」(cnt)는 그대로 그린다 — Codex 판에는 cnt 가 없어 그대로 얹었으면 그 화면이 멎었다.
2. `mbRuleBinOf` — 한 번 그리는 동안 주소마다 한 번만 센다(mbMemo 에 기억, 그리기마다 버림). 대표 화면 「mbWhoKey 155,962번」의 한 갈래.

## 안 얹은 것 (기업정보함 방에 맡김)
- Codex 의 `renderMailPanels`(옆줄·본문이 셈을 함께 쓰기, 부르는 자리 49곳 바꿈) — 오늘 기업정보함 방이 같은 자리에 `mbDrawSoon`·`pcSideBurst` 를 넣어 겹치고 부딪힌다. 더 줄일 게 남았는지는 그 방이 실측으로 본다.
- Codex 작업 자리(`.codex-worktrees/cards-startup-mail`)는 지우지 않았다 — 대표님이 정하실 일.

## 검사
- 새 `tests/cards-late-mail-overlay.test.js` — 사본에서 다섯 가지 되돌림에 모두 운다. 기업정보함을 읽는 검사 356개 파일 5,204개 통과.
