# 폰 연결 켜기 — PC 에 Remote Control 문을 두 번 누르기로 (2026-10-22)

- 지시: 「claude remote-control 이거 니가 못 여나」 → 못 연다(PC 쪽에서 먼저 열어야 하는 문) → 「만들어줘」
- 한 일: 저장소 맨 위 `폰연결-켜기.bat`(ASCII) + `tools/phone-link.js`(한글 안내·결정). 멈춘방-열기.bat · `tools/rc-open.js` 와 같은 모양.
  1 지금 켜기(5초 뒤 기본) · 2 바탕화면 단추 · 3/4 윈도 켤 때 저절로 켜기 켬/끔.
  서버 모드 `claude remote-control --name pureunall-PC --spawn same-dir` — worktree 는 pureunall_auto.bat 의 `git add -A` 가 main 에 올려서 뺐다.
  권한 인자는 안 준다(폰에 허락을 그대로 묻는다). 시작프로그램이 켠 것만 오류로 꺼지면 한도 안에서 다시 켠다.
- 검사: `tests/phone-link.test.js` 7개 — 일부러 어긴 10가지를 모두 잡는 것을 확인했다.
- ⚠ 윈도에서 돌려 보지 못했다(이 상자에 윈도·PowerShell 없음). 처음 켤 때 Remote Control 동의·폴더 믿기 질문에 y.
- 남은 일: 대표 PC 에서 `git pull` 뒤 실행. 팀·엔터프라이즈 플랜이면 관리자 설정에서 Remote Control 이 켜져 있어야 한다.
