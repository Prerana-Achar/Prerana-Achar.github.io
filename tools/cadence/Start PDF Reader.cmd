@echo off
setlocal
cd /d "%~dp0"
title Cadence PDF Reader
echo Cadence PDF reader - keep this window open while using PDF scores.
echo Local practice page: http://127.0.0.1:18765/
echo.
if /I "%~1"=="--setup" goto setup
if not exist ".omr-venv\Scripts\python.exe" goto setup
".omr-venv\Scripts\python.exe" -c "import homr.main, music21, pypdfium2" >nul 2>&1
if errorlevel 1 goto setup
goto run

:setup
if exist ".omr-venv\Scripts\python.exe" goto install
where py >nul 2>&1
if errorlevel 1 goto python_missing
py -3.12 -m venv .omr-venv
if not errorlevel 1 goto install
py -3.11 -m venv .omr-venv
if errorlevel 1 goto python_missing

:install
echo Installing the reader. Internet access is needed for this step.
".omr-venv\Scripts\python.exe" -m pip install --disable-pip-version-check --timeout 30 --retries 2 -r recognizer\requirements.txt
if errorlevel 1 goto install_failed

:run
".omr-venv\Scripts\python.exe" -c "import json;from urllib.request import Request,urlopen;r=json.loads(urlopen(Request('http://127.0.0.1:18765/api/health',headers={'Origin':'https://prerana-achar.github.io'}),timeout=3).read());assert r.get('engine')=='homr' and r.get('apiVersion')==1 and r.get('installed')" >nul 2>&1
if not errorlevel 1 (
  echo The PDF reader is already running and ready for your GitHub website.
  echo Keep its original reader window open. You can close this extra window.
  pause
  exit /b 0
)
".omr-venv\Scripts\python.exe" recognizer\server.py
echo.
echo The reader has stopped. Check the message above before closing this window.
pause
exit /b

:python_missing
echo Install Python 3.12 from https://www.python.org/downloads/windows/
echo Enable the Python launcher during installation, then run this file again.
echo You can also use run-practice.ps1 -Setup -PythonPath with an installed Python.
pause
exit /b 1

:install_failed
echo Installation did not finish. Check your connection and run this file again.
pause
exit /b 1
