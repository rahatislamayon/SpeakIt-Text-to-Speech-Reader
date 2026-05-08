@echo off
echo ==========================================
echo   SpeakIt - Bangla TTS Server (gTTS)
echo ==========================================
echo.

:: Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH.
    echo Please install Python 3.6+ from https://python.org
    pause
    exit /b 1
)

:: Install dependencies if needed
echo Checking dependencies...
pip install gTTS flask flask-cors --quiet

echo.
echo Starting server on http://localhost:5588
echo Press Ctrl+C to stop.
echo.

python bangla_server.py

pause
