@echo off
rem ============================================================
rem  Phone mirror: show the phone (USB) on this PC, so Claude on
rem  this PC can see the real phone screen and fix the UI.
rem
rem  Double-click this file and press a number:
rem    1  open the mirror window (picked by itself after 5 seconds)
rem    2  take a phone screenshot
rem    3  measure the Pureun page open in phone Chrome (read only)
rem    4  check this PC
rem    5  install scrcpy (winget, you will see it)
rem
rem  Everything you read on screen comes from tools/phone-mirror.js.
rem  NOTE: this .bat stays ASCII on purpose (same as the phone link .bat).
rem
rem  Made 2026-10-24 for the request "mirror my phone to my PC".
rem ============================================================

chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [!] node was not found on this PC.
  echo     Install Node.js first: https://nodejs.org
  echo.
  pause
  exit /b 1
)

node tools\phone-mirror.js --menu
choice /c 12345 /t 5 /d 1 /n
if errorlevel 5 goto install
if errorlevel 4 goto check
if errorlevel 3 goto measure
if errorlevel 2 goto shot

:mirror
node tools\phone-mirror.js --mirror
goto end

:shot
node tools\phone-mirror.js --shot
goto end

:measure
node tools\phone-mirror.js --measure
goto end

:check
node tools\phone-mirror.js --check
goto end

:install
node tools\phone-mirror.js --install
goto end

:end
echo.
pause
