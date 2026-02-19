@echo off
setlocal
cd /d "%~dp0"
node qa-smoke.js
if errorlevel 1 goto :fail
node qa-ui-smoke.js
echo.
if errorlevel 1 (
  goto :fail
) else (
  echo Smoke tests passed.
)
goto :done
:fail
echo Smoke test failed.
:done
pause
