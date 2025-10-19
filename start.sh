#!/bin/bash
cd "$(dirname "$0")"        # Always work from project root
pkill -f "node app.js"
node app.js &
ngrok http 3000
