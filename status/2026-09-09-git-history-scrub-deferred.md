# 2026-09-09 · ㉯ 「깃 기록에서 지우기」 — 지금은 미룬다 (+ 죽은 브랜치 정리)

- 대표 결정: 「나」(㉯ 진행) → 지금 상태를 재어 보고 **「지금은 미루고 상태만 기록」** 으로 정정
- 이 파일의 자리: `status/2026-09-08-scrub-test-pii.md`·`status/2026-09-08-scrub-pii-2.md`
  가 파일에서는 이미 지웠지만(㉮), **깃 «기록»에는 여전히 남아 있다**고 적어 둔 그 ㉯다.

## 왜 지금 안 하나 — 처음 재어 본 숫자 (2026-09-09 오전)

| | |
|---|---|
| 원격에 병합 안 된 브랜치 | 45개 |
| 열려 있는 워크트리 | 31개 |
| 열려 있는 PR | 0개 |

## 그런데 「병합 안 됨」의 상당수가 «착시»였다

`git branch -r --no-merged`는 **일반 병합(merge commit)만** 안다. 이 저장소는 거의
모든 PR을 **스쿼시 병합**으로 합친다 — 스쿼시는 새 커밋을 만들기 때문에, 원래 브랜치의
조상 관계가 `main`과 안 이어진다. 그래서 **이미 GitHub에서 병합된 PR의 브랜치**도
`--no-merged` 목록에 계속 남는다. 브랜치 자체는 안 지워졌을 뿐 내용은 이미 main에 있다.

## 한 것 — 45개를 GitHub 병합 기록으로 다시 갈랐다

`gh pr list --search "head:<브랜치>" --state all` 로 **브랜치마다 실제 PR 이력**을 짚어
셋으로 갈랐다:

| 갈래 | 개수 | 처리 |
|---|---|---|
| **이미 병합된 PR이 있다** (내용은 100% main에 있음) | **33개** | **원격에서 삭제했다** — 잃는 것이 없다 |
| **지금 워크트리·열린 PR이 있어 살아 있다** | 3개 | 손대지 않았다 |
| **병합 기록이 없다**(닫힌 채 안 합쳐졌거나, PR 자체가 없다) | 9개 | 손대지 않았다 — 아래 참고 |

**결과: 미병합 브랜치 45개 → 13개**(그사이 다른 방이 새로 만든 `feat/gov-dash-order-drag`
1개가 더해져 13개다 — 이건 오늘 막 생긴 새 작업이라 정상이다).

### 삭제한 33개 (모두 GitHub 병합 기록으로 확인)

```
fix/end-from-start · fix/coinfo-send-holes · review/cards-todo · feat/gov-merge-run ·
photos/portalcam-bounce · feat/news-docs · perf/mail-body-fetch · feat/wk-billing ·
chore/portal-status · docs/sent-docs-design · feat/bizno-link · photos/access-log-retention ·
feat/doc-contact-link · fix/warm-logout-nfc · feat/ontology-stage1 · feat/closed-folder-one ·
ui/dash-unify · docs/dash-align-status · fix/co-scroll2 · feat/pager-center ·
feat/payroll-all-sites · fix/mail-preview-entity · change/kind-delete · feat/paydata-balance ·
feat/paydata-arrival-truth · test/read-fence · spec/paydata-chat · feat/paydata-onerow ·
feat/rrn-mask-auto · feat/paydata-month-one · feat/paydata-mailbox · feat/paydata-cowork ·
feat/paydata-bulk-actions
```

### 살아 있어 손 안 댄 3개

- `claude/zealous-lalande-175065` — **지금 열려 있는 PR + 워크트리** 둘 다 있다
- `feat/newsletter-ai-drafts` — 워크트리(`pureunall-newsletter`)에 체크아웃되어 있다
- `feat/portal-todo-move` — 워크트리(`pu-wt-todo`)에 체크아웃되어 있다

### 병합 기록이 없어 «죽었다고 단정 못 한» 9개

| 브랜치 | 마지막 커밋 | 왜 단정 못 하나 |
|---|---|---|
| `fix/docview-jsdom-skip` | 09-06 | PR #1012 **닫힘**(병합 아님) — 문제가 다른 길로 고쳐졌는지 확인 필요 |
| `fix/ci-red-kcareer-inbox` | 09-03 | PR **닫힘** — 「main 이 빨개 배포가 막힌다」는 심각한 내용이라, 다른 수로 고쳐졌는지 봐야 한다 |
| `fix/billing-less-text` | 08-21 | PR **닫힘** |
| `docs/chwieop-seogo-spec` | 09-06 | PR 없음 — 3일 전, 아직 PR 안 낸 진행 중일 수 있다 |
| `docs/erp-record-sync-plan` | 08-18 | PR 없음 |
| `feat/hana-chip-icon` | 08-30 | PR 없음 |
| `feat/homepage-manage` | 08-27 | PR 없음 |
| `ui/who-list` | 08-30 | PR 없음 |
| `codex/hana-message-install-v2` | 08-23 | PR 없음 — Codex 가 만든 브랜치(안드로이드 APK 서명) |

**이 9개는 지우지 않았다.** PR이 없다는 것이 곧 「버려졌다」는 뜻은 아니다 — 아직 리뷰
전인 진행 중 작업일 수 있고, 특히 `fix/ci-red-kcareer-inbox`·`fix/docview-jsdom-skip`
은 CI·배포 관련이라 섣불리 지우면 안 된다. 개별로 「이 기능이 지금 main에 이미 있는지」
를 봐야 확정할 수 있다 — 다음 걸음으로 남긴다.

## ㉯ 재개 조건 — 갱신

원래 조건(「미병합 브랜치가 뚜렷이 줄어든 때」)에 오늘 진전이 있었다: **45 → 13**.
다만 13개 중 3개는 지금 실제로 작업 중이라, **그 3개가 마무리되고 나머지 9개도
가려진 뒤**가 진짜 재개 시점이다. 그전엔 시작하지 않는다.

## 참고 — ㉯ 를 실제로 할 때 필요한 것 (지금은 준비만, 착수 안 함)

- 지울 값 목록은 이미 있다 — `status/2026-09-08-scrub-test-pii.md` ·
  `status/2026-09-08-scrub-pii-2.md` 의 이름표(가나테크·가나솔루션·cust01~62·
  010-1200-0001~0028 등, 원래 값은 그 문서에는 이미 안 남아 있으니 **깃 로그**에서
  다시 찾아야 한다 — `git log -S<원래값>` 로 커밋을 짚는다).
- `git filter-repo --replace-text` 로 문자열을 통째로 바꾸는 방식이 `filter-branch` 보다
  빠르고 안전하다(공식 권장).
- 강제 푸시 뒤 **모든 열린 브랜치를 새 `main` 위로 다시 만들어야** 한다 — 리베이스가
  아니라 **새로 따는 것**에 가깝다(조상이 아예 다른 나무가 된다).
- GitHub 쪽 캐시(포크·PR 코멘트에 인용된 diff 등)는 강제 푸시로도 안 지워질 수 있다 —
  완전한 삭제를 원하면 GitHub 지원팀에 별도 요청이 필요할 수 있다.
