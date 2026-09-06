@echo off
title Gridiron Galaxy: The Long Bomb
cd /d "%~dp0"
set PY=
py -V >nul 2>nul && set PY=py
if not defined PY python -V >nul 2>nul && set PY=python
if not defined PY python3 -V >nul 2>nul && set PY=python3
if not defined PY (
  echo.
  echo  Python is needed to run the local game server and wasn't found.
  echo  Install it from https://python.org/downloads  ^(check "Add python.exe to PATH"^) then run play.bat again.
  echo.
  pause
  exit /b
)
echo.
echo  Starting Gridiron Galaxy... your browser will open in a moment.
echo.
%PY% serve.py
pause
