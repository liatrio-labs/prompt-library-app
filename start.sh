#!/bin/bash

# Prompt Library Start Script
# Starts the Next.js dev server and ngrok tunnel

echo "🚀 Starting Prompt Library..."
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must run this script from the prompt-library-app directory"
    exit 1
fi

# Kill any existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f "next dev"
pkill -f "ngrok http"
sleep 2

# Start Next.js dev server in background
echo "▶️  Starting Next.js dev server..."
npm run dev > /tmp/nextjs-dev.log 2>&1 &
NEXTJS_PID=$!

# Wait for Next.js to start
echo "⏳ Waiting for dev server to start..."
sleep 5

# Check if Next.js started successfully
if ! ps -p $NEXTJS_PID > /dev/null; then
    echo "❌ Failed to start Next.js dev server"
    echo "Check logs: tail -f /tmp/nextjs-dev.log"
    exit 1
fi

echo "✅ Next.js dev server running (PID: $NEXTJS_PID)"
echo "   Local: http://localhost:3000"
echo ""

# Start ngrok with custom domain
echo "▶️  Starting ngrok tunnel..."
ngrok http 3000 --domain=jg.ngrok.io --log=stdout > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!

# Wait for ngrok to start
sleep 3

# Check if ngrok started successfully
if ! ps -p $NGROK_PID > /dev/null; then
    echo "❌ Failed to start ngrok"
    echo "Check logs: tail -f /tmp/ngrok.log"
    exit 1
fi

echo "✅ Ngrok tunnel running (PID: $NGROK_PID)"
echo "   Public URL: https://jg.ngrok.io"
echo "   Inspector: http://localhost:4040"
echo ""
echo "🎉 Prompt Library is ready!"
echo ""
echo "📋 Useful commands:"
echo "   View Next.js logs: tail -f /tmp/nextjs-dev.log"
echo "   View ngrok logs: tail -f /tmp/ngrok.log"
echo "   Stop services: pkill -f 'next dev' && pkill -f 'ngrok http'"
echo ""
