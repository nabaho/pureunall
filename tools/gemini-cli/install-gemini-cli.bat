@echo off
setlocal
title Gemini CLI setup (Pureun)
rem Gemini CLI one-click: installs Node.js (if missing) and Gemini CLI, then starts it.
rem Login uses your Google subscription account ("Login with Google") - no API key is stored.
rem Details: docs (Gemini) in the repo.

where node >nul 2>&1
if errorlevel 1 (
  echo [1/3] Node.js not found - installing with winget...
  winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
  if errorlevel 1 (
    echo Node.js install failed. Install it from https://nodejs.org and run this file again.
    pause
    exit /b 1
  )
  set "PATH=%ProgramFiles%\nodejs;%PATH%"
) else (
  echo [1/3] Node.js found.
)

echo [2/3] Installing Gemini CLI (official package @google/gemini-cli)...
call npm install -g @google/gemini-cli
if errorlevel 1 (
  echo Gemini CLI install failed. Take a screenshot of this window and send it to Claude.
  pause
  exit /b 1
)
set "PATH=%APPDATA%\npm;%PATH%"

echo [3/3] Starting Gemini CLI.
echo   - When asked how to sign in, choose "Login with Google" and use the Ultra subscription account.
echo   - Do NOT choose "Use Gemini API key" (that is pay-per-use).
if exist "%~dp0..\..\GEMINI.md" cd /d "%~dp0..\.."
echo   Folder: %CD%
echo.
call gemini
pause
