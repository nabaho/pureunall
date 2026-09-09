# 2026-09-09 · ㉯ 「깃 기록에서 지우기」 — 지금은 미룬다 (+ 죽은 브랜치 정리 완료)

- 대표 결정: 「나」(㉯ 진행) → 지금 상태를 재어 보고 **「지금은 미루고 상태만 기록」** 으로 정정
- 뒤이어 「44 목록」·「죽은것 같은것 우선 정리」·「하나씩 확인」 세 지시로 **미병합 브랜치를
  45개 → 5개까지** 줄였다.
- 이 파일의 자리: `status/2026-09-08-scrub-test-pii.md`·`status/2026-09-08-scrub-pii-2.md`
  가 파일에서는 이미 지웠지만(㉮), **깃 «기록»에는 여전히 남아 있다**고 적어 둔 그 ㉯다.

## 처음 재어 본 숫자 (2026-09-09 오전)

| | |
|---|---|
| 원격에 병합 안 된 브랜치 | 45개 |
| 열려 있는 워크트리 | 31개 |
| 열려 있는 PR | 0개 |

## 1단계 — 「미병합 45개」의 상당수가 «착시»였다

`git branch -r --no-merged`는 **일반 병합(merge commit)만** 안다. 이 저장소는 거의
모든 PR을 **스쿼시 병합**으로 합친다 — 스쿼시는 새 커밋을 만들기 때문에, 원래 브랜치의
조상 관계가 `main`과 안 이어진다. 그래서 **이미 GitHub에서 병합된 PR의 브랜치**도
`--no-merged` 목록에 계속 남았다.

`gh pr list --search "head:<브랜치>" --state all` 로 45개 전부의 **실제 PR 이력**을 짚어
셋으로 갈랐다:

| 갈래 | 개수 | 처리 |
|---|---|---|
| GitHub 병합 기록으로 확인됨 | **33개** | 삭제 |
| 지금 워크트리·열린 PR로 살아 있음 | 3개 | 보류 |
| 병합 기록 없음(닫힌 채 안 합쳐졌거나 PR 자체가 없음) | 9개 | 2단계로 |

## 2단계 — 병합 기록 없는 9개를 «코드로» 하나씩 확인

PR 기록이 없다고 죽은 것은 아니다 — 코드 내용을 main과 직접 대조해 「이미 다른 길로
들어갔는지」를 봤다.

| 브랜치 | 판정 | 근거 |
|---|---|---|
| `fix/docview-jsdom-skip` | **죽음** | main `check_docview.js` 에 같은 jsdom 옵셔널 처리가 이미 있다 |
| `fix/ci-red-kcareer-inbox` | **죽음** | main `tests/perf-rules.test.js` allowTop 에 `kcareer_inbox` 가 이미 있다 |
| `fix/billing-less-text` | **죽음** | main `enter.html` 에 `.btip`·`.bhelp`·`tr.dayclick` 이 이미 있다 |
| `docs/chwieop-seogo-spec` | **죽음** | 설계 대상(`rules_mgmt/casebook`)이 `rules/casebook-ocr`(병합됨)로 실현됨 |
| `docs/erp-record-sync-plan` | **죽음** | main `pu-erp.html` 이 이미 「건별」(`data/{k}/v/{id}`) 로 읽고 쓴다 |
| `feat/hana-chip-icon` | **★ 살아 있음** | main `tests/hana-phone-alive.test.js` 는 아직 `out.text` 를 쓴다 — 아이콘+말풍선(`out.title`) 개선이 안 들어갔다. 안드로이드 앱(MainActivity.java)도 함께 손댄다 |
| `feat/homepage-manage` | **죽음** | main `pu-home.html` 이 이미 5,566줄(브랜치보다 큼), 「경력관리」 개명도 이미 반영됨 |
| `ui/who-list` | **죽음** | main `pu-cards.html` 에 `mbWhoOrd`·`config/mailWhoOrder` 가 이미 있다 |
| `codex/hana-message-install-v2` | **죽음** | S25 한 대 설치 시험용 곁가지였다. main 은 그 문제(덮어쓰기 설치)를 **다른 설계**(release 대신 «debug 서명 고정», 대표 결정 2026-08-29)로 풀어 v2.3.0 까지 갔다 |

**8개 삭제, 1개(`feat/hana-chip-icon`) 보류.**

## 결과

```
미병합 브랜치   45개 → 13개(1단계) → 5개(2단계)
```

남은 5개는 **모두 실제로 살아 있다**:

| 브랜치 | 상태 |
|---|---|
| `claude/zealous-lalande-175065` | 지금 열려 있는 PR + 워크트리 |
| `feat/gov-dash-order-drag` | 오늘(09-09) 다른 방이 막 만든 새 작업 |
| `feat/hana-chip-icon` | 확인 완료 — 진짜 미병합 작업(위 표) |
| `feat/newsletter-ai-drafts` | 워크트리(`pureunall-newsletter`)에 체크아웃 중 |
| `feat/portal-todo-move` | 워크트리(`pu-wt-todo`)에 체크아웃 중 |

## ㉯ 재개 조건 — 갱신

원래 조건(「미병합 브랜치가 뚜렷이 줄어든 때」)이 오늘 **45 → 5**로 크게 진전됐다.
남은 5개 중 3개는 지금 실제 작업 중(워크트리·PR)이라, **그 3개가 마무리되고
`feat/hana-chip-icon` 도 병합되거나 정리된 뒤**가 진짜 재개 시점이다.
그전엔 시작하지 않는다.

## 참고 — ㉯ 를 실제로 할 때 필요한 것 (지금은 준비만, 착수 안 함)

- 지울 값 목록은 이미 있다 — `status/2026-09-08-scrub-test-pii.md` ·
  `status/2026-09-08-scrub-pii-2.md` 의 이름표(가나테크·가나솔루션·cust01~62·
  010-1200-0001~0028 등, 원래 값은 그 문서에는 이미 안 남아 있으니 **깃 로그**에서
  다시 찾아야 한다 — `git log -S<원래값>` 로 커밋을 짚는다).
- `git filter-repo --replace-text` 로 문자열을 통째로 바꾸는 방식이 `filter-branch` 보다
  빠르고 안전하다(공식 권장).
- 강제 푸시 뒤 **남은 브랜치를 새 `main` 위로 다시 만들어야** 한다 — 리베이스가
  아니라 **새로 따는 것**에 가깝다(조상이 아예 다른 나무가 된다). 이제 그 대상이
  5개뿐이라 부담이 훨씬 줄었다.
- GitHub 쪽 캐시(포크·PR 코멘트에 인용된 diff 등)는 강제 푸시로도 안 지워질 수 있다 —
  완전한 삭제를 원하면 GitHub 지원팀에 별도 요청이 필요할 수 있다.
