@echo off
echo Starting VidHarvest Pro...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if dependencies are installed
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo Error: Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Create downloads directory if it doesn't exist
if not exist "downloads" (
    mkdir downloads
    echo Created downloads directory
)

REM Start the application
echo Starting VidHarvest Pro server...
echo Open http://localhost:3000 in your browser
echo Press Ctrl+C to stop the server
echo.
npm start