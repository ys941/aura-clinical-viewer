@echo off
title Aura - Clinical Viewer (Production)
cd /d "%~dp0"

echo ============================================
echo   Aura - Production build + start
echo   http://localhost:4477
echo ============================================
echo.

if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
  echo.
)

echo Building optimized production bundle...
call npm run build
if errorlevel 1 (
  echo.
  echo Build FAILED. Fix the errors above and try again.
  pause
  exit /b 1
)

echo.
echo Starting production server... (close this window to stop)
start "" /b cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:4477/viewer"
call npm run start:local

echo.
echo Server stopped. Press any key to close.
pause >nul
