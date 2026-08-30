@echo off
title Aura - Clinical Viewer + MedGemma
cd /d "%~dp0"

REM ============================================================
REM  Usage:
REM    start-all.bat        -> Dev mode  (hot-reload, everyday)
REM    start-all.bat prod   -> Prod mode (optimized build, faster)
REM ============================================================

set "MODE=dev"
if /I "%~1"=="prod" set "MODE=prod"

echo ============================================================
echo   Aura  -  Universal DICOM Viewer  +  MedGemma (free Colab)
echo   Mode: %MODE%    App: http://localhost:4477
echo ============================================================
echo.
echo A Colab notebook will open in your browser for the AI model.
echo Once it loads:
echo    1) Runtime  -^>  Change runtime type  -^>  T4 GPU
echo    2) Runtime  -^>  Run all
echo    3) Keep that tab open.
echo.
echo The AI endpoint auto-syncs to the app (no copy/paste, no .env
echo editing). Then just click the "AI" button in the Viewer.
echo.

REM 1) Open the MedGemma Colab notebook via gist (opens instantly,
REM    no GitHub / private-repo authorization prompt).
start "" "https://colab.research.google.com/gist/ys941/5d09f9d6abd2e8422baa7a072cd061b6/medgemma_aura_colab.ipynb"

REM 2) Install app dependencies on first run
if not exist "node_modules" (
  echo Installing app dependencies ^(first run, this can take a few minutes^)...
  call npm install
  echo.
)

REM 3) Open the app shortly after the server starts
start "" /b cmd /c "timeout /t 6 /nobreak >nul & start http://localhost:4477/viewer"

REM goto/label style below (not a nested "if (...) else (...)" block): cmd.exe's
REM block parser breaks on ANY literal "(" or ")" found inside a parenthesized
REM block, even a matched pair in plain echo text. This file used to have
REM "(close this window to stop everything)" inside such a block on both
REM branches - reproduced: cmd silently swallowed the closing ")" from the
REM printed text and mis-tracked the block boundary. Restructuring avoids the
REM trap outright instead of relying on escaping every paren correctly forever.
if /I "%MODE%"=="prod" goto MODE_PROD
goto MODE_DEV

:MODE_PROD
echo Building optimized production bundle...
call npm run build
if errorlevel 1 (
  echo.
  echo Build FAILED. Fix the errors above and try again.
  pause
  exit /b 1
)
echo.
echo Starting production server - close this window to stop everything.
echo.
call npm run start:local
goto MODE_DONE

:MODE_DEV
echo Starting the app in dev mode - close this window to stop everything.
echo.
call npm run dev

:MODE_DONE

echo.
echo Server stopped. Press any key to close.
pause >nul
