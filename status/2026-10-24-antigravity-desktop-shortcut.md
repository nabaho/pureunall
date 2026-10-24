# 2026-10-24 안티그래비티 바탕화면 바로가기

대표: 「안티그래피티 바탕화면에 안보인다」

- 설치 프로그램이 바탕화면 바로가기를 안 만드는데, 설치 스크립트에도 그 단계가 없었다.
- `tools/antigravity/install.ps1` — 설치 뒤(이미 깔려 있어도) 바탕화면 바로가기를 만든다. 실행 파일은 프로그램 목록의 아이콘 자리 → 설치 폴더 → `%LOCALAPPDATA%\Programs` 순으로 찾고, 제거 프로그램은 거른다.
  바탕화면 자리는 `GetFolderPath('Desktop')` — OneDrive 바탕화면에서도 보이게.
- 새: `tools/antigravity/make-desktop-shortcut.bat`(`-ShortcutOnly`) — 바로가기만 만들고 열지 묻는다.
- 검사 ⑦ 추가(돌연변이: `%USERPROFILE%\Desktop` 박기 → 걸림).
- 남은 일: 대표 PC 에서 실제로 바로가기가 생기는지 — 클라우드에는 윈도가 없어 실행 파일 찾기만 가짜 폴더로 돌려 봤다.
