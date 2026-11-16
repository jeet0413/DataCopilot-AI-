@echo off
REM AI Service Startup Script for Windows

echo 🚀 Starting AI Data Analyst Service...

REM Check if virtual environment exists
if not exist "venv" (
    echo 📦 Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
echo 🔧 Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo 📚 Installing dependencies...
pip install -r requirements.txt

REM Start the service
echo 🎯 Starting FastAPI service...
uvicorn app:app --host 0.0.0.0 --port 8001 --reload

echo ✅ AI Service is running on http://localhost:8001
pause
