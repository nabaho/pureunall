@echo off
rem Make a desktop shortcut for an already installed Google Antigravity (no download, no REA setup).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" -ShortcutOnly
