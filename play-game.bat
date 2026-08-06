@echo off
rem play-game.bat — start "game" (the stickman multiplayer game) on Windows.
rem VARSITY 27 still starts with play.bat — the two run side by side.
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
  py serve.py --dir game
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  python serve.py --dir game
  goto :eof
)
echo Python was not found. Install it from https://www.python.org/downloads/
echo (check "Add python.exe to PATH" during install), then run this again.
pause
