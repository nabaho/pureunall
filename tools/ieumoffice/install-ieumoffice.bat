@echo off
rem IeumOffice installer - downloads the official Windows setup from github.com/pblsketch/ieumoffice and runs it.
rem Details: docs (IeumOffice) - see docs folder
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
pause
