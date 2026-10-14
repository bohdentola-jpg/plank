@echo off
title MIDNIGHT FREQUENCY
cd /d "%~dp0"

rem ---- find a Python that actually runs (test by executing, not by PATH lookup)
set PY=
py -V >nul 2>nul && set PY=py
if not defined PY python -V >nul 2>nul && set PY=python
if not defined PY python3 -V >nul 2>nul && set PY=python3

if not defined PY (
  echo.
  echo  Python is needed to run the game server and wasn't found.
  echo.
  echo  1. Go to  https://python.org/downloads  and install it
  echo     ^(check the "Add python.exe to PATH" box in the installer^)
  echo  2. Then double-click race.bat again.
  echo.
  pause
  exit /b
)

echo.
echo  Starting the game server with "%PY%"...
echo  Your browser will open by itself in a moment.
echo.
%PY% serve.py --open racing/
pause
