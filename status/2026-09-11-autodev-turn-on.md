# 2026-09-11 · 자동개발을 켰다 (건의를 AI가 직접 고쳐 변경안을 낸다)

- PR: (열면서 채움)
- 무엇: 2026-08-13 에 잠가 두었던 `developmentAutomation` 을 되살리고, 화면의
  「지금은 꺼져 있습니다」를 걷었다. **자동배포는 기본 꺼둠**으로 바꿨다.
- 왜: 대표 지시 2026-09-11 「자동개발도 켜달라」

## ★ 켜기 «전에» 막아 둔 것 (PR #1188) — 되돌리지 말 것

1. 공개 GitHub 이슈에 **건의 내용이 한 글자도 안 실린다** — ID·위험도·자동배포 여부뿐.
   `buildIssue` 안의 `assertNoLeak` 가 스스로 지킨다.
2. 위험 낱말에 **돈 세는 말**이 들어 있다(입금·거래내역·자문료·마감·성과·이관 …).
3. **공개 전 검문**(`scripts/autodev-privacy-gate.js`) — AI 가 만든 바뀜에 개인정보가
   섞이면 push 전에 멈춘다.

## ⚠⚠ 자동배포 기본값을 «꺼둠»으로 바꿨다

`automation.autoDeploy!==false` → `===true`.

**왜** — 이 칸을 켜면 AI 가 쓴 코드가 전체검사만 통과하면 **사람 눈 없이 운영에
병합·배포된다**(`.github/workflows/autodev-auto-merge.yml` 이 `auto-deploy-approved`
표를 보고 병합한다). 처음 얼마간은 사람이 한 번 보는 것이 낫다. 꺼 두어도
「검사 확인 후 운영 배포 승인」 단추 하나면 올라간다.
되돌리려면 `===true` 를 `!==false` 로.

## ⚠ 켜려면 비밀값 넷이 «다» 있어야 한다

`developmentAutomation` 이 `AUTOMATION_BRIDGE_KEY` 를 요구하므로, 그 값이 없으면
**함수 배포가 통째로 멈춘다** — 메일·건의 알림까지 못 올린다(2026-08-13 에 잠근 까닭).

| 비밀값 | 어디 | 2026-09-11 상태 |
|---|---|---|
| `AUTOMATION_BRIDGE_KEY` | Firebase **와** GitHub 양쪽에 «같은» 임의 문자열 | 둘 다 없음 |
| `AUTOMATION_ENDPOINT` | GitHub — 배포된 함수 URL | 없음 |
| `OPENAI_API_KEY` | GitHub (유료) | 없음 |
| `GITHUB_AUTOMATION_TOKEN` | Firebase | 있음 |

**순서**: ① 대표가 Firebase `AUTOMATION_BRIDGE_KEY` 를 넣는다 → ② 함수를 올린다
(`firebase deploy --only functions:developmentAutomation`) → ③ 나온 URL 과 나머지 둘을
GitHub 비밀값에 넣는다.

## 흐름 (켜진 뒤)

건의 → 대표가 「개발 지시」를 적고 [자동개발 실행] → 공개 이슈(내용 없음) 생성 →
`ai-ready` 표 → Codex 가 별도 가지에서 고침 → **공개 전 검문** → 전체검사 →
변경안(PR) → (자동배포 켜둔 «낮음» 건이면 자동 병합 / 아니면 대표가 승인) →
배포 → 문제가 있으면 「직전 버전으로 복귀」(비밀번호 + 1회용 키)

## 검사

- 새 검사 6개(`tests/autodev-turned-on.test.js`) · **되돌림 검사 10/10 잡음**
- 전체 15,493건 중 15,491 통과(남은 하나 `rc-open` 은 기존 건)

## ⚠ 곁들여 알게 된 것 — `stripComments(enter.html)` 는 구역을 먹는다

`stripComments` 를 enter.html «전체»에 걸면 자동개발 구역(`sgDevBox`)이 통째로
사라진다(origin/main 에서도 그렇다). 그 상태로 「…이 없다」를 물으면 **늘 통과한다** —
아무것도 안 지키는 검사가 된다. 이 검사는 «그 구역만» 잘라 내고 거기서 주석을 걷는다.
**enter.html 을 글자로 보는 새 검사는 같은 함정을 조심할 것.**
