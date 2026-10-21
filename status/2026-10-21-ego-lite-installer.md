# 에고라이트 한 번에 설치 도구 (2026-10-21)

- 지시: 「직접 설치하면 안 되냐? 설치해가지고 다 전부까지 해달라. 내 컴퓨터에.」
- 막힌 것: 클라우드 방은 대표 PC 에 손이 닿지 않는다(PC 의 Claude 세션이 안 잡힘). 설치 파일(exe)을 클라우드로 받아 서명을 미리 보는 일은 권한에서 막혔다 — 우회하지 않았다.
- 한 일: `tools/ego-lite/install-ego-lite.bat`(→ `install.ps1`) — 대표 PC 에서 두 번 누르면 만든 쪽 README 에서 설치 파일 주소를 읽어 받고,
  Authenticode 서명(Citro Labs·HashMismatch)을 실행 «전에» 보고, 설치 프로그램을 연 뒤 온보딩이 `ego-browser` 를 등록할 때까지 기다려
  `ego-browser ready`·Claude Code 스킬까지 확인한다. 조용히 깔지 않는다(크롬 자료 옮기기는 사람이 고른다).
- 검사: `tests/ego-lite-install.test.js` — 받는 곳·주소 안 박기·서명 먼저·조용히 안 깔기·BOM/ASCII. 일부러 어긴 네 가지를 각각 잡는 것을 확인했다.
- ⚠ 스크립트는 윈도에서 돌려 보지 못했다(이 상자에 PowerShell 없음). 첫 실행은 화면을 보며.
- 남은 일: 대표 PC 에서 `git pull` 뒤 실행 · 오류 보고/사용 분석 끄는 자리 확인 → `docs/에고라이트-검토.md` 4절.
