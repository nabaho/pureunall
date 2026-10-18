# 2026-10-18 · PR #2621 「계약서 채우기: 이알피 계약 ID 연결」 — main 들이기 + 빨간 검사 고침

대표 지시: 이 PR 을 고쳐서 합치게 하라(가지 `claude/contract-link`, 합치기는 auto-merge.yml).

## 충돌 (main 을 merge 로 들였다 — rebase·force-push 안 함)
- `docs-esign.html` · `pu-erp.html` — 둘 다 «캐시 번호 줄»만 부딪혔다.
  main 은 그사이 `pu-contract-forms.js` 를 고쳐 `?v=62`, 이 PR 은 `?v=60`·`pu-form-cardfill.js?v=19`.
  → 합친 `pu-contract-forms.js` 는 main 판에 이 PR 손질이 얹힌 «새 판»이므로 `?v=63` (싣는 두 화면 같은 번호),
    `pu-form-cardfill.js` 는 main 이 안 건드려 이 PR 의 `?v=19` 그대로.
- 자동으로 합쳐진 `js/pu-contract-forms.js` 에서 이 PR 손질(ctxRef·noLocked·계약번호 잠금·세 기록 길의 `contract`)이
  main 의 폰 정리·보안 손질과 함께 모두 남은 것을 확인했다.

## 빨간 검사 (CI 2026-10-13)
- `tests/office-signed-return.test.js` ⓔ 「✉ 보내기도 대기에」 — 기대식이 `await: true })` 로 «await 가 맨 끝 칸»까지 박고 있었다.
  이 PR 이 기록 호출에 `contract: o.contract` 를 await 뒤에 붙여 못 맞췄다. 규칙(보내기 기록이 서명본 대기에 오른다)은 그대로 지켜진다.
- 고친 것: 「지금 값」이 아니라 「규칙」 꼴로 — `host.mail.record(o.row, V, { kind: kind, names: …` 줄을 모아
  ① 하나라도 «같은 { } 안에» `await: true` 가 있고 ② 보내기 기록마다 `await` 를 넘기는지(false 아님) 본다. 칸 차례·새 칸에는 안 매인다.
  await 를 빼거나 다른 { } 로 옮기면 여전히 빨개지는 것을 확인했다.

## 검사
- `node --test tests/*.test.js functions/*.test.js` (jsdom·pdfjs 를 CI 처럼 깔고): 27082 · 통과 27062 · 실패 0 · 건너뜀 8 ·
  취소 12(전부 `tests/rules-collect-stuck.test.js` — Node 22 에서만, main 도 같다. CI Node 24 는 초록).
