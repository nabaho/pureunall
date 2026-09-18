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

echo [1/3] 최신으로 맞춥니다...
git pull
if errorlevel 1 (
  echo.
  echo ✗ git pull 이 안 됐습니다. 위 메시지를 그대로 클로드에게 보여 주세요.
  echo.
  pause
  exit /b 1
)

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
