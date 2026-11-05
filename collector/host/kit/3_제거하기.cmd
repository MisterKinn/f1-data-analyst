@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0kit.ps1" -Action uninstall
echo.
pause
