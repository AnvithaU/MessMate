@echo off
title MessMate Launcher
echo ========================================================
echo   Starting MessMate Digital Mess Management Platform
echo ========================================================

echo Starting Backend Server on port 5000...
start "MessMate Backend" cmd /k "cd server && npm run dev"

timeout /t 3 /nobreak >nul

echo Starting Frontend Server on port 3000...
start "MessMate Frontend" cmd /k "cd client && npm run dev"

timeout /t 2 /nobreak >nul

echo Opening browser at http://localhost:3000/
start http://localhost:3000/

echo.
echo MessMate is running!
echo - Frontend: http://localhost:3000/
echo - Backend:  http://localhost:5000/
echo ========================================================
