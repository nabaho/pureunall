# 리멤버·메일 가져오기 — 터미널 프로그램 (배포 안 됨)

대표 지시 2026-10-24: 「피시는 켜져 있는데 자동으로 터미널에서 연결해서 가지고 올 수 없나」 → 진행.
확장(tools/remember-ext)을 설치하지 않고, 윈도우 작업 스케줄러가 1시간마다 이 프로그램을 돌린다.

## 이 PC 에 깔린 자리
- 실행 폴더: `C:\Users\fair0\Documents\pu-remember-pull` (이 폴더를 복사 + `npm install`)
- 전용 크롬 프로필·기록: `%LOCALAPPDATA%\pu-remember-chrome` (`run.log` 에 개수만)
- 예약 작업: `pu-remember-pull` — 1시간마다 `wscript hidden.vbs` → `run.cmd` → `node run.js` (창 안 뜸)

## 처음 한 번 — 로그인 (사람이 직접)
```
node run.js login
```
전용 크롬 창이 뜬다. 리멤버와 푸른 포털에 **대표님이 직접** 로그인하고 창을 닫는다.
AI 는 비밀번호를 넣지 않는다. 로그인이 풀리면 기록에 `stop: … 로그인` 이 남고 같은 일을 한 번 더 한다.

## 한 회차가 하는 일
1. `remember-intake.html` 을 열어 지난 기준(cp)을 묻는다 (첫 회차는 기준만 잡는다 — 옛 자료는 이미 들어와 있다)
2. 리멤버 화면이 스스로 쓰는 머리를 그 자리에서 빌려 수정순으로 기준 뒤 명함만 받는다 — 머리는 메모리에만
3. 앞면 그림(remember-cdn 만)과 함께 받는 화면에 넘긴다 → 명함·사진첩
4. 받는 화면이 열려 있는 동안 메일 서명 명함·메일 첨부 서류도 처리되고, 끝나면 닫는다

## 예약 작업 다시 만들기 (PowerShell)
```
$a = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument '"C:\Users\fair0\Documents\pu-remember-pull\hidden.vbs"'
$t = New-ScheduledTaskTrigger -Once -At (Get-Date).Date.AddHours((Get-Date).Hour + 1) -RepetitionInterval (New-TimeSpan -Hours 1)
Register-ScheduledTask -TaskName 'pu-remember-pull' -Action $a -Trigger $t
```
`hidden.vbs`: `CreateObject("WScript.Shell").Run """<폴더>\run.cmd""", 0, False`
`run.cmd`: `cd /d "%~dp0"` 다음 `"C:\Program Files\nodejs\node.exe" run.js`
