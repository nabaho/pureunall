@echo off
chcp 65001 >nul
rem Pureun AI router - Claude Code terminal (key is read from client_key.txt, never typed here)
set ANTHROPIC_BASE_URL=http://127.0.0.1:8787
set OPENAI_BASE_URL=http://127.0.0.1:8787/v1
set /p ANTHROPIC_API_KEY=<"%~dp0client_key.txt"
set /p OPENAI_API_KEY=<"%~dp0client_key.txt"
cmd /k
