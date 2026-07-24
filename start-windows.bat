@echo off
setlocal

set "PROJECT_DIR=%~dp0"
set "FRONTEND_URL=http://localhost:58230"

REM curl.exe ships with Windows by default since build 17063 (2018) - both Windows 10 and 11
REM have it out of the box. If the frontend already answers, the app is running elsewhere
REM (e.g. someone left it up, or this was double-clicked twice) - just open a browser tab
REM instead of starting a second dev server, which would fail anyway since Vite's strictPort
REM refuses to reuse the port.
set "HTTP_CODE="
for /f %%i in ('curl -s -o NUL -w "%%{http_code}" "%FRONTEND_URL%" 2^>NUL') do set "HTTP_CODE=%%i"

if "%HTTP_CODE%"=="200" (
    start "" "%FRONTEND_URL%"
    exit /b 0
)

cd /d "%PROJECT_DIR%"
call yarn dev

REM Keeps the window open after `yarn dev` exits (success, crash, or Ctrl+C) so it's never
REM left blank or closes before you can read the output - same job as the "Press Enter to
REM close" prompt on the Linux/macOS launchers.
echo.
pause
