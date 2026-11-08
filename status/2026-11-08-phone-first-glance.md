# 2026-11-08 · 폰 화면 점검 질문 하나 (claude/login-start-screen-386qu2)

- 대표 지시 「추천대로」 — Stageshow(benjitaylor/skills) 검토 결과, 스킬은 붙이지 않고 점검 질문 하나만 `docs/규칙/폰화면.md` 에 넣음:
  «처음 보는 눈이 어디에 먼저 가는가, 그것이 이 화면의 결과인가».
- 문서만 바뀜(코드·검사 없음).

## 함께 고친 것 — main 빨강(홈페이지 sitemap)
- 자동 주간 브리핑이 홈페이지 저장소(pureun-site)의 sitemap(140 빠짐)에 141 만 더해 이 저장소에 덮어써서 140 이 사라졌다 → `tests/homepage-static.test.js` 빨강.
- `functions/notice-lib.js` `사이트맵채우기` — 빠진 공지까지 채운다(실린 가장 작은 번호 이상만). `weeklyNewsBrief` 가 이것을 쓴다. `site/sitemap.xml` 에 140 되살림.
- ⚠ pureun-site 쪽 sitemap 은 다음 자동 브리핑(배포 뒤)이 채운다. 함수 배포: weeklyNewsBrief.
