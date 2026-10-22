# 2026-10-22 · 옵시디언 자동 실행 등록 + 대표 위키 규칙(schema.md) 존중

- 대표 물음: 「채팅방에서 채팅하는 거 자동으로 옵시디언 정리 안 되나」 + 보관함 갈무리(raw · wiki · schema · purpose · 푸른노무법인 캔버스).
- 까닭 두 가지:
  1. 정리 도구는 만들었지만 «돌리는 일»이 사람 몫이었다 → `tools/obsidian-sync/auto.js`(윈도우 작업 스케줄러 30분마다 등록·해제·모의).
  2. 대표 보관함에는 이미 자기 위키 규칙(`schema.md`: entities·concepts·sources·queries·synthesis)이 있었다. 우리 틀(`CLAUDE.md`·`wiki/projects` …)을 끼워 넣으면 두 규칙이 부딪힌다.
- 고친 것: `sync.js` — schema.md/purpose.md 가 있으면 틀·log 끼어쓰기를 안 하고 원자료만 넣는다. «정리 끝»은 `wiki/` 어디든 원자료 이름이 적히면(출처)로 판정, 대기 목록은 우리가 넣은 `raw/sessions`·`raw/erp` 만.
- 알게 된 것(대표 목록 조회): 채팅방은 PC 에서 도는 «bridge» 방과 클라우드 방 두 종류. 자동으로 들어오는 것은 PC 에서 도는 방뿐이다(문서에 적음).
- 검사: `tests/obsidian-sync.test.js` 9건(자기 규칙 보관함 · 자동 등록 인자).
- ⚠ 못 한 것: 대표 PC 에서 `auto.js` 를 실제로 돌려 작업이 등록되는지 · 대표 `schema.md` 규칙에 맞춘 «정리해줘»(entities/sources 장 만들기)는 아직 안 했다.
