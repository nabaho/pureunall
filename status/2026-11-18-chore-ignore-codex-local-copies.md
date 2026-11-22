상태: 완료
가지: chore/ignore-codex-local-copies
작업폴더: C:/Users/user/Desktop/github/pureunall/.claude/worktrees/package-mockup-e7bb31

# 2026-11-18 · Codex 용 로컬 사본(.agents/skills/hwpx · .codex)을 git 무시 목록에

- 계기(대표): worktree 의 `git status` 에 `?? .agents/skills/hwpx/…` 114개가 떠서 「커밋 필요하면 해라」.
- 판단: **커밋하지 않는다.** 2026-11-09 12:20 에 이 PC 의 도구가 메인 체크아웃과 worktree 50개 중 30개에 똑같이 만든 사본이다(만든 도구는 확인 못 함).
  - `.agents/skills/hwpx/` = `.claude/skills/hwpx/` 사본, `SKILL.md` 한 줄(«Claude Code 환경» → «Codex 환경»)만 다름. 올리면 같은 스킬이 두 벌이 되어 고칠 때마다 어긋난다.
  - `.codex/config.toml` = `.mcp.json` 을 옮긴 Codex MCP 설정. 비밀 값은 없고 환경변수 «이름»만 있다. 그러나 `deploy-pages.yml` 의 지우는 목록에 `.codex` 가 없어 올리면 공개 사이트에 실린다.
- 한 일: `.gitignore` 에 `.agents/skills/hwpx/` · `.codex/` 두 줄(+까닭 주석). `.agents/skills/` 전체는 막지 않았다 — Codex 저장소 스킬을 일부러 둘 자리이고 `.agents/rules/pureun-rules.md` 는 추적 중이다.
- 이 PC 의 사본은 지우지 않았다 — Codex 가 계속 읽는다(git 무시는 도구가 읽는 데 영향 없음).

## 검사
- `git check-ignore -v` 로 두 경로가 새 줄에 걸리는 것, `git ls-files .agents` 가 그대로(`.agents/rules/pureun-rules.md`)인 것 확인.
- `node --test tests/dev-tools-not-published.test.js tests/agents-md.test.js tests/status-log-noconflict.test.js` — 결과는 PR 설명.

## 남은 일
- 없음. (Codex 에 hwpx 스킬을 «저장소로» 주고 싶어지면 사본이 아니라 한 벌만 두는 길을 따로 정한다.)
