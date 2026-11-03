@echo off
setlocal EnableExtensions DisableDelayedExpansion
title FastF1 Live - Setup and Collector
pushd "%~dp0"
if errorlevel 1 goto folder_error
echo FastF1 Live launcher v2
echo.
if not exist "collector.py" goto files_missing
if not exist "requirements.txt" goto files_missing

echo [1/3] Checking Python 3.12 or newer...
set "F1_PYTHON="
call :try_python py -3
if defined F1_PYTHON goto python_found
call :try_python python
if defined F1_PYTHON goto python_found
call :try_python py -3.14
if defined F1_PYTHON goto python_found
call :try_python py -3.13
if defined F1_PYTHON goto python_found
call :try_python py -3.12
if not defined F1_PYTHON goto python_missing

:python_found
%F1_PYTHON% --version
echo.
echo [2/3] Preparing local environment. This can take a few minutes.
echo Setup details are saved in setup.log. F1 login is NOT logged.
echo FastF1 Live setup v2 > "setup.log"
if exist ".venv\Scripts\python.exe" goto check_venv
%F1_PYTHON% -m venv .venv >> "setup.log" 2>&1
if errorlevel 1 goto setup_failed
:check_venv
".venv\Scripts\python.exe" -c "import sys; sys.exit(0 if sys.version_info >= (3,12) else 1)" >> "setup.log" 2>&1
if errorlevel 1 goto venv_failed
".venv\Scripts\python.exe" -m pip install -r requirements.txt >> "setup.log" 2>&1
if errorlevel 1 goto setup_failed

echo.
echo [3/3] Starting collector. Enter F1 credentials only in this window.
".venv\Scripts\python.exe" collector.py
set "F1_EXIT=%ERRORLEVEL%"
echo.
echo Collector stopped. Exit code: %F1_EXIT%
echo If an error appeared, read the lines ABOVE this message.
echo Do not share passwords or tokens.
goto finish

:try_python
%* -c "import sys; sys.exit(0 if sys.version_info >= (3,12) else 1)" >nul 2>&1
if not errorlevel 1 set "F1_PYTHON=%*"
exit /b

:python_missing
echo.
echo [ERROR: PYTHON_NOT_FOUND] No working Python 3.12+ was found.
echo Install Python from https://www.python.org/downloads/windows/
echo Enable 'Add python.exe to PATH' if that option is offered.
echo Close this window and run START_WINDOWS.cmd again after installation.
goto failed

:files_missing
echo [ERROR: EXTRACT_ZIP] Required files are missing.
echo Use 'Extract All' on FastF1-Live.zip before running this file.
echo Keep collector.py, requirements.txt and START_WINDOWS.cmd together.
goto failed

:venv_failed
echo [ERROR: VENV_INVALID] The existing .venv is broken or uses old Python.
echo Extract a fresh copy of the download into a NEW folder and try again.
goto show_log

:setup_failed
echo [ERROR: SETUP_FAILED] Environment or package installation failed.
:show_log
echo Open setup.log in this folder for the cause.
echo.
type "setup.log"
goto failed

:folder_error
echo [ERROR: FOLDER_ACCESS] Cannot open the extracted folder.
:failed
set "F1_EXIT=1"
:finish
echo.
echo Press any key to CLOSE this window. This is not a setup step.
pause >nul
exit /b %F1_EXIT%
