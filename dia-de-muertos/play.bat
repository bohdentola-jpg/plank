@echo off
title The Marigold Path - El Camino de Cempasuchil
cd /d "%~dp0"

rem ---- find a Python that actually runs (test by executing, not by PATH lookup)
set PY=
py -V >nul 2>nul && set PY=py
if not defined PY python -V >nul 2>nul && set PY=python
if not defined PY python3 -V >nul 2>nul && set PY=python3

if not defined PY (
  echo.
  echo  Python wasn't found, but you don't need it!
  echo  Just double-click  play-offline.html  to play in your browser.
  echo.
  pause
  exit /b
)

echo.
echo  Starting the game server with "%PY%"...
echo  Your browser will open by itself in a moment.
echo.
%PY% serve.py
pause
