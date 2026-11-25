@echo off
title CHROMA CLASH
cd /d "%~dp0"
set PY=
py -V >nul 2>nul && set PY=py
if not defined PY python -V >nul 2>nul && set PY=python
if not defined PY python3 -V >nul 2>nul && set PY=python3
if not defined PY (
  echo.
  echo  Python is needed to run the game server and wasn't found.
  echo  Install it from https://python.org/downloads  ^(tick "Add python.exe to PATH"^)
  echo  then double-click play.bat again.
  echo.
  pause
  exit /b
)
echo.
echo  Starting CHROMA CLASH with "%PY%"... your browser will open in a moment.
echo.
%PY% serve.py
pause
