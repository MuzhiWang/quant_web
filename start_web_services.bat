@echo off
echo ===============================================
echo QMT Trading System - Web Services Launcher
echo ===============================================
echo Starting Node.js Server and React Client...
echo (Python Backend should already be running)
echo.

echo Starting Node.js Server (Port 3000)...
start "Node.js Server" cmd /k "npm start"

echo Starting React Client (Port 3001)...
start "React Client" cmd /k "cd client && npm start"

echo.
echo ===============================================
echo Services Status:
echo ===============================================
echo Python Backend:  http://localhost:8000 (external)
echo Node.js Server:  http://localhost:3000 (starting)
echo React Client:    http://localhost:3001 (starting)
echo ===============================================
echo.
echo Access the dashboard at: http://localhost:3001
echo.
pause
