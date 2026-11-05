@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0kit.ps1" -Action install -Role backup
echo.
pause
