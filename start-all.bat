@echo off
title Aura - Clinical Viewer + MedGemma
cd /d "%~dp0"

echo ============================================================
echo   Aura  -  Universal DICOM Viewer  +  MedGemma (free Colab)
echo   App: http://localhost:4477
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

REM 1) Open the MedGemma Colab notebook (first time: Colab asks to
REM    authorize GitHub for this private repo - a one-time click).
start "" "https://colab.research.google.com/github/ys941/aura-clinical-viewer/blob/main/colab/medgemma_aura_colab.ipynb"

REM 2) Install app dependencies on first run
if not exist "node_modules" (
  echo Installing app dependencies ^(first run, this can take a few minutes^)...
  call npm install
  echo.
)

REM 3) Open the app shortly after the dev server starts
start "" /b cmd /c "timeout /t 6 /nobreak >nul & start http://localhost:4477/viewer"

echo Starting the app... (close this window to stop everything)
echo.
call npm run dev

echo.
echo Server stopped. Press any key to close.
pause >nul
