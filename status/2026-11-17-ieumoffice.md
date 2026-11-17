# 2026-11-17 · 이음오피스 설치 파일 (claude/login-start-screen-386qu2)

- 대표 지시 「이음오피스 내 PC 에 다운받고 실행 가능하게」. 클라우드 방은 PC 에 못 닿아 «누르면 받고 설치 창을 띄우는» 파일을 만들었다.
- `tools/ieumoffice/install-ieumoffice.bat` → `install.ps1`: 공식 저장소(pblsketch/ieumoffice) 최신 릴리스에서만 받기 · 크기·SHA256 확인 · 설치 창은 사람이.
- 안내 `docs/이음오피스.md` · 검사 `tests/ieumoffice-install.test.js`. tools/·docs/ 는 배포에서 지워진다.
- ⚠ PC 에서 실제로 돌려 보지는 못했다(이 상자에 윈도·PowerShell 없음).
