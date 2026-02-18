@echo off
setlocal
cd /d "%~dp0"
node qa-smoke.js
echo.
if errorlevel 1 (
  echo Smoke test failed.
) else (
  echo Smoke test passed.
)
pause
