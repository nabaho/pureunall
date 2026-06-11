@echo off
cd /d "%~dp0"
git add -A
git commit -m "update"
git push https://nabaho@github.com/nabaho/pureunall.git
echo.
echo ===== UPLOAD DONE =====
pause
