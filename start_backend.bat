@echo off
cd /d "%~dp0"
echo Starting AAROGYASETU (Milestone 1) FastAPI Backend on http://localhost:8000 ...
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
