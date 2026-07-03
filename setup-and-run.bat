@echo off
title Aura - Setup ^& Run (one click)
cd /d "%~dp0"

echo ============================================================
echo   Aura - one-click setup and run
echo   Installs everything, you only paste your Clerk keys.
echo ============================================================
echo.

REM ---------- 1) Ensure Node.js is installed ----------
where node >nul 2>&1
if %errorlevel%==0 goto NODE_OK

echo Node.js not found - installing Node.js LTS...
where winget >nul 2>&1
if %errorlevel%==0 (
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
) else (
  echo winget not available - downloading the Node.js LTS installer...
  powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi' -OutFile \"$env:TEMP\node-lts.msi\" } catch { exit 1 }"
  if exist "%TEMP%\node-lts.msi" ( msiexec /i "%TEMP%\node-lts.msi" /qn /norestart ) else ( echo Download failed - install Node.js LTS from https://nodejs.org then re-run. & pause & exit /b 1 )
)
REM make node usable in THIS window without a restart
set "PATH=%ProgramFiles%\nodejs;%PATH%"

:NODE_OK
where node >nul 2>&1
if not %errorlevel%==0 (
  echo.
  echo Node.js was installed but this window can't see it yet.
  echo Please CLOSE this window, open it again, and run setup-and-run.bat once more.
  pause
  exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do echo Using Node %%v
echo.

REM ---------- 2) Install app dependencies ----------
if not exist "node_modules" (
  echo Installing app dependencies ^(first run - this can take a few minutes^)...
  call npm install
  if not %errorlevel%==0 ( echo. & echo npm install failed. Check your internet and re-run. & pause & exit /b 1 )
  echo.
)

REM ---------- 3) Create .env.local - everything pre-filled except the two sign-up keys ----------
if not exist ".env.local" (
  echo Creating .env.local with sensible defaults...
  (
    echo # ================= Aura environment =================
    echo # ONLY the two Clerk keys below need YOUR input.
    echo # Get them free ^(no card^) at https://dashboard.clerk.com  -^>  API Keys.
    echo # Everything else is already filled in and ready.
    echo.
    echo NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_REPLACE_ME
    echo CLERK_SECRET_KEY=sk_test_REPLACE_ME
    echo NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
    echo NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup
    echo NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/viewer
    echo NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/viewer
    echo.
    echo # ----- AI: MedGemma on free Colab ^(auto endpoint sync, nothing to sign up for^) -----
    echo AI_PROVIDER=openai
    echo MEDGEMMA_ENDPOINT=
    echo MEDGEMMA_NTFY_TOPIC=aura-med-9k3f7q2x8w
    echo MEDGEMMA_MODEL=medgemma1.5
    echo MEDGEMMA_NUM_CTX=8192
    echo.
    echo # ----- AI plan B: Google AI Studio ^(free key, optional^) -----
    echo # AI_PROVIDER=gemini
    echo # GEMINI_API_KEY=
    echo # GEMINI_MODEL=gemini-2.5-flash
  ) > ".env.local"
  echo.
  echo   ^>^> .env.local created. Paste your two Clerk keys ^(pk_test_... and sk_test_...^) into it and SAVE.
  start "" https://dashboard.clerk.com/last-active?path=api-keys
  start "" notepad ".env.local"
  echo.
  echo   Press any key AFTER you've saved your Clerk keys...
  pause >nul
)

REM ---------- 4) Warn if the keys are still placeholders ----------
findstr /C:"REPLACE_ME" ".env.local" >nul 2>&1
if %errorlevel%==0 (
  echo.
  echo   NOTE: .env.local still has REPLACE_ME - login will not work until you paste real Clerk keys.
  start "" notepad ".env.local"
  echo   Press any key to continue anyway...
  pause >nul
)

REM ---------- 5) Open the free MedGemma Colab notebook ----------
start "" "https://colab.research.google.com/gist/ys941/5d09f9d6abd2e8422baa7a072cd061b6/medgemma_aura_colab.ipynb"

REM ---------- 6) Open the app shortly after the dev server starts, then run it ----------
start "" /b cmd /c "timeout /t 9 /nobreak >nul & start http://localhost:4477/viewer"
echo.
echo Starting Aura at http://localhost:4477   ^(close this window to stop^)
echo.
call npm run dev

echo.
echo Server stopped. Press any key to close.
pause >nul
