@echo off
title DRM Offline Agent Hub
cd /d "%~dp0"
set PORT=8795
REM Let the hub page talk to the local AI (only affects Ollama started from this window)
set OLLAMA_ORIGINS=*

echo ==============================================
echo   DRM Offline Agent Hub  (St. Croix, local only)
echo ==============================================

REM ---- 1. Find Ollama ----
set "OLLAMA_EXE="
where ollama >nul 2>nul && set "OLLAMA_EXE=ollama"
if not defined OLLAMA_EXE if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" set "OLLAMA_EXE=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
if not defined OLLAMA_EXE if exist "%ProgramFiles%\Ollama\ollama.exe" set "OLLAMA_EXE=%ProgramFiles%\Ollama\ollama.exe"

if not defined OLLAMA_EXE (
  echo [!] Ollama is not installed. The hub will open in offline fallback mode.
  echo     See README_WINDOWS.md to install it from a USB stick.
  goto :web
)

REM ---- 2. Start Ollama if it is not already answering ----
powershell -NoProfile -Command "try{Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://127.0.0.1:11434/api/version ^| Out-Null; exit 0}catch{exit 1}"
if %errorlevel%==0 (
  echo [ok] Ollama already running.
) else (
  echo [..] Starting Ollama ...
  start "Ollama (keep open)" /min "%OLLAMA_EXE%" serve
  timeout /t 4 /nobreak >nul
)

:web
REM ---- 3. Serve the hub on http://localhost:%PORT% ----
where python >nul 2>nul
if %errorlevel%==0 (
  echo [ok] Serving hub with Python on http://localhost:%PORT%
  start "DRM Hub web server (keep open)" /min python -m http.server %PORT% --bind 127.0.0.1
  timeout /t 2 /nobreak >nul
  start "" "http://localhost:%PORT%/index.html"
  goto :done
)
if exist "%~dp0serve_hub.ps1" (
  echo [ok] Serving hub with PowerShell on http://localhost:%PORT%
  start "DRM Hub web server (keep open)" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve_hub.ps1" -Port %PORT%
  timeout /t 2 /nobreak >nul
  start "" "http://localhost:%PORT%/index.html"
  goto :done
)
echo [..] No web server found, opening index.html directly.
start "" "%~dp0index.html"

:done
echo.
echo Hub is open in your browser. Leave the small minimized windows open while you use it.
echo Close this window any time.
timeout /t 8 >nul
