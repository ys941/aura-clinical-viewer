@echo off
title Aura - Clinical Viewer
cd /d "%~dp0"

echo ============================================
echo   Aura - Universal DICOM Viewer
echo   http://localhost:4477
echo ============================================
echo.

REM Install dependencies on first run
if not exist "node_modules" (
  echo Installing dependencies ^(first run, this can take a few minutes^)...
  call npm install
  echo.
)

REM Open the app in the default browser shortly after the server starts
start "" /b cmd /c "timeout /t 6 /nobreak >nul & start http://localhost:4477/viewer"

echo Starting dev server... (close this window to stop)
echo.
call npm run dev

echo.
echo Server stopped. Press any key to close.
pause >nul
