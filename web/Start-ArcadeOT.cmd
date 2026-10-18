@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 LTS, then run this launcher again.
  pause
  exit /b 1
)
node -e "if (Number(process.versions.node.split('.')[0]) < 24) process.exit(1)"
if errorlevel 1 (
  echo Node.js 24 LTS or newer is required.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm ci --no-audit --no-fund
  if errorlevel 1 goto :failed
)
call npm run build
if errorlevel 1 goto :failed
echo Open http://127.0.0.1:3001 after the gateway ready message appears.
call npm start
if errorlevel 1 goto :failed
exit /b 0
:failed
echo ArcadeOT could not start. Review the error above.
pause
exit /b 1
