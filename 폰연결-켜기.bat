@echo off
rem ============================================================
rem  Phone link: open Remote Control for this folder, so the
rem  Claude app on the phone can give work to this PC.
rem
rem  Double-click this file and press a number:
rem    1  start now (picked by itself after 5 seconds)
rem    2  make a button on the desktop
rem    3  start with Windows - ON
rem    4  start with Windows - OFF
rem    5  check this PC (Chrome watch-along, phone link)
rem
rem  Everything you read on screen comes from tools/phone-link.js.
rem  NOTE: this .bat stays ASCII on purpose. Korean text inside a
rem  .bat is unreliable across cmd code pages, so the Korean is
rem  printed by node after chcp 65001 below.
rem
rem  Made 2026-10-22 for the request "make it" (phone link file).
rem ============================================================

rem UTF-8 so the Korean that node prints is readable
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

rem The desktop button and the Windows-start shortcut call this file with --start
if /i "%~1"=="--start" goto start

node tools\phone-link.js --menu
choice /c 12345 /t 5 /d 1 /n
if errorlevel 5 goto check
if errorlevel 4 goto off
if errorlevel 3 goto on
if errorlevel 2 goto desk

:start
node tools\phone-link.js --start %*
goto end

:desk
node tools\phone-link.js --desktop
goto end

:on
node tools\phone-link.js --startup-on
goto end

:off
node tools\phone-link.js --startup-off
goto end

:check
node tools\phone-link.js --check

:end
echo.
pause
