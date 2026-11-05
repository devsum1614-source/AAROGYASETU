@echo off
cd /d "%~dp0"
if exist "%~dp0AarogyaSetu\.tools\node-v26.13.0-win-x64\node.exe" (
    set "PATH=%~dp0AarogyaSetu\.tools\node-v26.13.0-win-x64;%PATH%"
)
cd /d "%~dp0frontend"
echo Starting AAROGYASETU (Milestone 1) React + TypeScript + Vite PWA on http://localhost:5173 ...
call npm.cmd run dev -- --host
