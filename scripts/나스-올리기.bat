@echo off
chcp 65001 >nul
REM ══════════════════════════════════════════════════════════════════════════
REM  푸른이알피 — 나스 자동 백업 올리기 (2026-09-18 대표 지시 「한번에 할 수 있게」)
REM
REM  쓰는 법: 이 파일을 «두 번 누르면» 됩니다. 치실 것이 없습니다.
REM
REM  ⚠ 이 파일은 «자기가 어디 있는지»를 안다(%~dp0). 그래서 폴더를 찾아 헤맬 일이 없다 —
REM    2026-09-18 대표님이 C:\Users\fair0 에서 git pull 을 치시고 「not a git repository」를
REM    보신 자리가 그것이다. 사람에게 폴더를 찾게 하지 않는다.
REM ══════════════════════════════════════════════════════════════════════════

cd /d "%~dp0.."
echo.
echo ═══ 푸른이알피 — 나스 자동 백업 올리기 ═══
echo 폴더: %CD%
echo.

REM ⚠★ 「git pull」만 믿지 않는다 (2026-09-19 — .ps1 쪽과 같은 까닭)
REM   git pull 은 «지금 있는 가지»만 맞추지, main 의 «최신»인지는 안 살핀다.
REM   이 폴더는 사람이 편집하는 자리가 아니라 «올리기 전용 사본»이므로
REM   origin/main 으로 못박아도 된다.
echo [1/3] main 을 «그대로» 받습니다 (다른 가지·옛 커밋은 버립니다)...
git fetch origin main
if errorlevel 1 (
  echo.
  echo ✗ git fetch 가 안 됐습니다. 인터넷 연결을 확인하고, 위 메시지를 클로드에게 보여 주세요.
  echo.
  pause
  exit /b 1
)
git checkout -B main origin/main
git reset --hard origin/main

echo.
echo [2/3] 올립니다...
node scripts\nas-backup-deploy.js --deploy
if errorlevel 1 (
  echo.
  echo ✗ 올리지 못했습니다. 위 메시지를 그대로 클로드에게 보여 주세요.
  echo.
  pause
  exit /b 1
)

echo.
echo [3/3] 끝났습니다. 위에 찍힌 두 줄(URL, NAS_KEY)을 나스 스크립트에 넣으세요.
echo.
pause
