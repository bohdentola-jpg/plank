@echo off
title RIM CITY
cd /d "%~dp0\.."

rem ---- find a Python that actually runs (test by executing, not by PATH lookup)
set PY=
py -V >/dev/null 2>/dev/null && set PY=py
if not defined PY python -V >/dev/null 2>/dev/null && set PY=python
if not defined PY python3 -V >/dev/null 2>/dev/null && set PY=python3

if not defined PY (
  echo.
  echo  Python is needed to run the game server and wasn't found.
  echo.
  echo  1. Go to  https://python.org/downloads  and install it
  echo     ^(check the "Add python.exe to PATH" box in the installer^)
  echo  2. Then double-click play.bat again.
  echo.
  pause
  exit /b
)

echo.
echo  Starting RIM CITY with "%PY%"...
echo  Your browser will open by itself in a moment.
echo.
%PY% serve.py rimcity
pause
