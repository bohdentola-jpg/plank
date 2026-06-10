@echo off
title Friday Night Gridiron '04
cd /d "%~dp0"

rem ---- find a working Python (py launcher first, then real python)
set PY=
where py >/dev/null 2>/dev/null && set PY=py
if not defined PY (
  python -V >/dev/null 2>/dev/null && set PY=python
)
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

rem ---- open the browser once the server has had a moment to start
start "" /min cmd /c "timeout /t 2 >/dev/null & start http://localhost:8000"

echo.
echo  FRIDAY NIGHT GRIDIRON '04
echo  Keep this window open while you play. Close it (or press Ctrl+C) to stop.
echo.
%PY% serve.py
pause
