#!/bin/bash

# Detect OS
OS="$(uname)"
CHROME_PATH=""

if [[ "$OS" == "Darwin" ]]; then
    # MacOS
    CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
elif [[ "$OS" == "Linux" ]]; then
    # Linux (Ubuntu/Debian)
    CHROME_PATH="google-chrome"
elif [[ "$OS" == "MINGW"* || "$OS" == "CYGWIN"* || "$OS" == "MSYS"* ]]; then
    # Windows (Git Bash)
    CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
fi

# Check if Chrome path exists or is runnable
if [ -z "$CHROME_PATH" ]; then
    echo "Unsupported OS or Chrome path not found automatically."
    echo "Please edit this script to set CHROME_PATH manually."
    exit 1
fi

echo "Launching Chrome from: $CHROME_PATH"
"$CHROME_PATH" --remote-debugging-port=9222 --user-data-dir="/tmp/chrome_dev_test"
