@echo off
cd /d "%~dp0"
echo Launching AAROGYASETU (आरोग्यसेतु) — AIORA | Karavali Institute of Technology
start "AAROGYASETU Backend (Port 8000)" cmd /k "%~dp0start_backend.bat"
start "AAROGYASETU Frontend PWA (Port 5173)" cmd /k "%~dp0start_frontend.bat"
echo Both servers are starting:
echo   - Frontend PWA : http://localhost:5173
echo   - Backend API  : http://localhost:8000/docs
