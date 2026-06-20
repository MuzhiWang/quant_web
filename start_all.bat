@echo off
REM =====================================================================
REM  Windows full-stack launcher for the QMT dashboard:
REM    1) FastAPI API server (:8001, db mode)
REM    2) Express BFF        (:3000)
REM    3) React client       (:3001)
REM
REM  Does NOT start the trading engine (main.py) — that is the live trader
REM  and is normally run as the NSSM service. See qmt_trading\OPERATIONS.md.
REM
REM  Override the backend location if it lives elsewhere:
REM    set QMT_TRADING_DIR=C:\path\to\qmt_trading
REM  Override service mode (db / qmt / all):
REM    set API_SERVICE=all
REM =====================================================================
setlocal

if "%QMT_TRADING_DIR%"=="" set QMT_TRADING_DIR=%~dp0..\quant\joinquant\strategy\realtime_trading\trading_component\qmt_trading
if "%API_SERVICE%"==""     set API_SERVICE=db

echo ===============================================
echo QMT Trading System - Full Stack Launcher
echo ===============================================
echo Backend dir : %QMT_TRADING_DIR%
echo API mode    : %API_SERVICE%
echo.

if not exist "%QMT_TRADING_DIR%\server\start_server.py" (
  echo ERROR: cannot find start_server.py under %QMT_TRADING_DIR%
  echo Set QMT_TRADING_DIR to the qmt_trading folder and retry.
  pause
  exit /b 1
)

REM Prefer the project venv's Python so deps (uvicorn, fastapi, ...) resolve.
set PY=python
if exist "%QMT_TRADING_DIR%\.venv\Scripts\python.exe" set PY=%QMT_TRADING_DIR%\.venv\Scripts\python.exe
echo Python: %PY%

echo Starting FastAPI API server (Port 8001)...
start "QMT API" cmd /k "cd /d %QMT_TRADING_DIR% && "%PY%" server\start_server.py --service %API_SERVICE%"

echo Starting Node.js BFF (Port 3000)...
start "Node.js BFF" cmd /k "cd /d %~dp0 && npm start"

echo Starting React Client (Port 3001)...
start "React Client" cmd /k "cd /d %~dp0client && set PORT=3001 && npm start"

echo.
echo ===============================================
echo  API:    http://localhost:8001/api/docs
echo  BFF:    http://localhost:3000/health
echo  Client: http://localhost:3001  ^<-- open this
echo ===============================================
echo.
pause
