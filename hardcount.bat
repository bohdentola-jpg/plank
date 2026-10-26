@echo off
title HARD COUNT - 7-ON-7 FOOTBALL
cd /d "%~dp0"

rem ---- find a Python that actually runs (test by executing, not by PATH lookup)
set PY=
py -V >nul 2>nul && set PY=py
if not defined PY python -V >nul 2>nul && set PY=python
if not defined PY python3 -V >nul 2>nul && set PY=python3

if not defined PY (
  rem ---- no Python: Windows' own PowerShell can serve the game just as well
  echo.
  echo  Starting the game server...
  echo  Your browser will open by itself in a moment.
  echo  Keep this window open while you play.
  echo.
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Open hardcount/
  if errorlevel 1 (
    echo.
    echo  The built-in server couldn't start. Installing Python also works:
    echo  https://python.org/downloads  ^(tick "Add python.exe to PATH"^),
    echo  then double-click hardcount.bat again.
    echo.
  )
  pause
  exit /b
)

echo.
echo  Starting the game server with "%PY%"...
echo  Your browser will open by itself in a moment.
echo.
%PY% serve.py --open hardcount/
pause
