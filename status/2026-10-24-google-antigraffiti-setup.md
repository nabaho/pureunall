# 2026-10-24 구글 안티그래비티 + REA 설치 도구

대표 지시: 「구글 안티그래피티 다운받고 최신 버전으로 … REA 리버스 엔지니어링 애니띵도 연결시켜줘」 (윈도)

- 새: `tools/antigravity/install-antigravity.bat` → `install.ps1` — 공식 페이지에서 최신 주소 읽기 · Google LLC 서명 확인 · 설치 창 · Node.js 판 확인 · `rea-agents setup --client antigravity` · 점검.
  `tools/ego-lite` 와 같은 틀. `tools/` 는 배포에서 지워진다(deploy-pages.yml).
- 새: `tests/antigravity-install.test.js`(6) · `docs/안티그래비티-REA-설치.md`.
- 남은 일: 대표 PC 에서 처음 돌려 보기 — 윈도에서 끝까지 돌린 적은 없다(pwsh 구문 검사·로직 일부만 클라우드에서 확인).
