@echo off
title Aura + MedGemma (Colab)
cd /d "%~dp0"

echo ============================================================
echo   Aura  +  MedGemma on Google Colab (free GPU)
echo ============================================================
echo.
echo A Colab notebook will open in your browser. Do this once it loads:
echo    1) Runtime  -^>  Change runtime type  -^>  T4 GPU
echo    2) Runtime  -^>  Run all
echo    3) Keep that tab open.
echo.
echo The endpoint auto-syncs to the app (via ntfy) - no copy/paste,
echo no .env editing. Just click the "AI" button in the Viewer.
echo.

REM Open the MedGemma Colab notebook (first time: Colab asks to authorize
REM GitHub for this private repo - a one-time "Include private repositories").
start "" "https://colab.research.google.com/github/ys941/aura-clinical-viewer/blob/main/colab/medgemma_aura_colab.ipynb"

REM Install deps on first run
if not exist "node_modules" (
  echo Installing app dependencies (first run)...
  call npm install
  echo.
)

REM Open the app shortly after the dev server starts
start "" /b cmd /c "timeout /t 6 /nobreak >nul & start http://localhost:4477/viewer"

echo Starting the app... (close this window to stop)
echo.
call npm run dev

echo.
echo Server stopped. Press any key to close.
pause >nul
