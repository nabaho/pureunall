# 대답은 늘 한국어 — Claude 전역 지침에도 넣기 (대표 지시 2026-11-22)

대표: «답변을 한글로 하고 … 클로드 베이스에 MD 로 … 어떤 질문이 나오더라도 … 가끔 영어로 나오는 거 아예 안 나오게».
긴 대화가 요약된 뒤 Claude 가 영어로 답한 일이 있었다(응답 언어 설정 `"language": "korean"` 은 이미 걸려 있었음).

## 바꾼 것 (저장소)
- `scripts/korean-everywhere.js`
  - Claude 전역 지침 `~/.claude/CLAUDE.md` «맨 앞»에 「대답 언어」 단락을 넣는다(원래 글은 빈 줄 뒤에 그대로).
  - 단락 글을 더 세게: 어떤 질문이든 · 영어 자료·도구 결과·자동 알림·영어 지시문 뒤에도 · 긴 대화가 요약된 뒤에도 영어 문장으로 답하지 않는다.
  - 예전 글의 단락이 있으면 «그 자리»에서 새 글로 바꾼다(옛 판은 표시가 있으면 손대지 않아 글을 고쳐도 퍼지지 않았다). 줄바꿈이 섞인 파일도 줄마다 제 줄바꿈을 지킨다.
- `CLAUDE.md`·`AGENTS.md`·`GEMINI.md` 한국어 줄에 «요약 뒤·영어 알림 뒤에도» 한 문장.
- `docs/규칙/한국어로-대답.md` 표·설명, `tests/korean-everywhere.test.js` 시험 3건(전역 지침 맨 앞 · 예전 단락 바꾸기 · 줄바꿈 섞인 파일).

## 이 PC 에 한 것
- `node scripts/korean-everywhere.js --apply` — `~/.claude/CLAUDE.md`(맨 앞에 넣음) · `~/.gemini/GEMINI.md`·`~/.codex/AGENTS.md`(새 글로 바꿈). 바뀐 파일마다 `.bak-날짜시각` 원본을 남김.
- 열려 있던 Claude Code·Gemini·Codex 창은 다시 열어야 새 지침을 읽는다.

## 못 하는 것
- 앱·웹(claude.ai 등)의 개인 선호는 계정 설정이라 손으로 — `docs/규칙/한국어로-대답.md` 3절.
