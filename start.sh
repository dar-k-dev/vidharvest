#!/bin/bash

echo "Starting VidHarvest Pro..."
echo

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed or not in PATH"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "Error: Failed to install dependencies"
        exit 1
    fi
fi

# Create downloads directory if it doesn't exist
if [ ! -d "downloads" ]; then
    mkdir downloads
    echo "Created downloads directory"
fi

# Start the application
echo "Starting VidHarvest Pro server..."
echo "Open http://localhost:3000 in your browser"
echo "Press Ctrl+C to stop the server"
echo
npm start