# 2026-11-07 · 한국어 대답 — Gemini·Antigravity·Codex 와 개인설정까지

상태: 완료(코드) · 남음: 대표 PC 에서 스크립트 한 번 + 앱 세 곳 손 설정

- 대표 지시: 「개인설정도 한국어로 하고 안티그래비티·제미나이·챗지피티·클로드 모두 한국어로」
- 앞 PR #2945(Claude `language`·CLAUDE.md·AGENTS.md)는 합쳐짐 → 가지를 main 에서 다시 땄다.
- 가지: `ccr-b0aca392-yhhdqp`

## 고친 것

| 파일 | 바뀐 것 |
|---|---|
| `GEMINI.md`(새) | Gemini CLI·Antigravity 용 — 한국어 줄 + 「규칙은 AGENTS.md」 |
| `scripts/korean-everywhere.js`(새) | 내 컴퓨터 개인설정: `~/.claude/settings.json` language · `~/.gemini/GEMINI.md` · `~/.codex/AGENTS.md`. 보기 기본, `--apply` 로 쓰기, 원본 .bak, 깨진 JSON 은 멈춤 |
| `tests/korean-everywhere.test.js`(새) | 세 지침 파일 규칙 + 스크립트 안전장치 8건 |
| `docs/규칙/한국어로-대답.md`(새) | 세 겹(저장소·개인설정·앱) 설명, 앱에 붙여 넣을 글 |
| `CLAUDE.md`·`AGENTS.md` | 한국어 줄에 GEMINI.md·스크립트·검사·문서 가리킴 |
| `deploy-pages.yml`·`dev-tools-not-published` 검사 | `GEMINI.md` 도 배포에서 빠졌는지 확인 |

## 사람이 할 것

- 대표 PC 저장소 폴더에서 `node scripts/korean-everywhere.js --apply` (이 클라우드 방에는 연결된 PC 폴더가 없어 대신 돌리지 못했다).
- ChatGPT·Claude·Gemini 앱 설정에 붙여 넣기 — 글과 자리는 `docs/규칙/한국어로-대답.md` 3절.
