# 2026-11-07 · 견적·계약 자동화 — 계획 1 (작업 기록 + 지난 견적 모음)

상태: 진행 중 — 계획 1 과제 1~4 끝, 5~7 남음 · PR 은 `[보류]` 초안(자동 병합 안 됨)

- 가지: `claude/quote-auto-design`
- 설계: `docs/superpowers/specs/2026-11-07-quote-contract-auto-design.md`
- 계획: `docs/superpowers/plans/2026-11-07-quote-auto-plan1-worklog-quotes.md`
- ⚠ 2026-11-07 대표 PC 의 C 드라이브를 포맷하면서 이 가지는 `D:\pu-wt-quote` 사본에만 남아 있었다(GitHub 에 안 올라간 상태).
  새로 받은 저장소(`E:\pureunall`)로 커밋 8개를 «내용 고침 없이» 옮겨 올렸다.

## 한 것 (원래 커밋 8개)

| 커밋 | 내용 |
|---|---|
| `f7458ab4` | 견적·계약 자동화 설계 문서(대표 결정·검토 반영) |
| `4c5e1ce5` | 견적·계약 자동화 계획 1 — 작업 기록·지난 견적 모음 |
| `720a59b7` | 작업 기록 저장 층·규칙(총괄관리자만 읽기, 덧붙이기만) |
| `7b19a7f9` | 작업 기록 규칙: rules-paste.json 재생성·perf-rules 허용 목록에 pu_worklog 추가 |
| `29d3cda6` | 계약서등관리 — 올리기·내려받기·메일·서명 요청·서식 저장을 작업 기록에 |
| `35d69789` | 작업 기록 화면 — 총괄관리자만, 달·사람·종류로 거르기 |
| `bdba100f` | pu-erp.html 계약서 양식 모듈 캐시 번호 69로 맞춤 |
| `8f4167a6` | 견적 기록 저장 층·금액 잠금 규칙(대표·총괄·재무·확정 담당만) |

## 복구하며 덧붙인 것 (커밋 1개)

전체 검사에서 이 가지 때문에 빨개진 두 곳을 저장소 관례대로 맞췄다. 기능 코드는 건드리지 않았다.

| 파일 | 바뀐 것 |
|---|---|
| `tests/worklog-hooks.test.js` · `tests/worklog-view.test.js` | 캐시 번호(`?v=69`·`?v=1`)를 글자 그대로 박던 것을 `\?v=\d+` 로 — `test-pin-guard` 규칙 |
| `tests/photos-staff-share.test.js` | 콘솔에 아직 안 올린 새 자리 셋(`/pu_quote_amt`·`/pu_quotes`·`/pu_worklog`)을 「게시 전」 목록 `PENDING` 에 |
| `status/2026-11-07-quote-auto-design.md` | 이 기록 |

## 남는 것

- 계획 1 과제 5(🔒 견적서 파일 열기 권한 — 서버 `puDocSecret`) · 6(「지난 견적·계약」 화면) · 7(보낸메일에서 가져오기) — 계획 문서 그대로 이어서 한다.
- 실시간DB 규칙 세 자리는 만들개(`scripts/make-firebase-rules.js`)에만 있고 콘솔 게시 여부는 이 가지 기록으로 확인되지 않는다 [확인 필요].
  게시는 `node scripts/rules-deploy.js --deploy` 뒤 콘솔 원문을 새 판으로 갈아 끼우고 `PENDING` 세 줄을 뺀다.
- 과제 2·3 의 화면 고리가 이미 들어 있으므로, 합치는 때는 남은 과제와 규칙 게시를 마친 뒤로 한다(그래서 `[보류]`).
- 검사: 이 PC(윈도)에서 `node --test tests/*.test.js functions/*.test.js` — 맞춘 뒤 결과는 PR 설명에 적는다.
