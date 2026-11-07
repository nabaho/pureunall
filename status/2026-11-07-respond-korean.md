# 2026-11-07 · 대답은 늘 한국어로

상태: 완료

- 대표 지시: 「한국어로 항상 나오게」(스레드 갈무리 — 지침에 `Respond in Korean` 을 넣으라는 조언)
- 가지: `ccr-b0aca392-yhhdqp`

## 고친 것

| 파일 | 바뀐 것 |
|---|---|
| `.claude/settings.json` | `"language": "korean"` — Claude Code 공식 설정(응답 언어). 저장소를 여는 모든 방에 걸린다 |
| `CLAUDE.md` | 머리에 한 줄: 대답·보고·PR 설명은 늘 한국어 |
| `AGENTS.md` | 같은 줄(Codex·Copilot 용) |

## 남는 것

- 이 설정은 «새로 여는 방»부터 먹는다. 이미 열린 방은 다시 열어야 한다.
- 저장소 밖(다른 폴더·claude.ai 채팅)까지 한국어로 하려면 개인 설정 `~/.claude/settings.json` 에도 `"language": "korean"` 을 넣거나 `/config` 에서 언어를 고른다.
