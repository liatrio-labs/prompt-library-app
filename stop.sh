#!/bin/bash

# Prompt Library Stop Script
# Stops the Next.js dev server and ngrok tunnel

echo "🛑 Stopping Prompt Library services..."
echo ""

# Kill Next.js dev server
echo "Stopping Next.js dev server..."
pkill -f "next dev"

# Kill ngrok
echo "Stopping ngrok tunnel..."
pkill -f "ngrok http"

sleep 2

echo ""
echo "✅ All services stopped"
