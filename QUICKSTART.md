# Prompt Library - Quick Start Guide

## 🚀 Starting the Application

From the `prompt-library-app` directory:

```bash
./start.sh
```

This will:
- Start the Next.js dev server on http://localhost:3000
- Start ngrok tunnel at https://jg.ngrok.io
- Display status and helpful commands

## 🛑 Stopping the Application

```bash
./stop.sh
```

This will stop both the Next.js dev server and ngrok tunnel.

## 📋 Manual Commands

If you prefer to run commands manually:

### Start Next.js Dev Server
```bash
npm run dev
```

### Start Ngrok Tunnel
```bash
ngrok http 3000 --domain=jg.ngrok.io
```

### Stop Services
```bash
pkill -f "next dev"
pkill -f "ngrok http"
```

## 🔍 Monitoring

### View Logs
```bash
# Next.js logs
tail -f /tmp/nextjs-dev.log

# Ngrok logs
tail -f /tmp/ngrok.log
```

### Ngrok Inspector
Access the ngrok request inspector at: http://localhost:4040

## 🌐 Access URLs

- **Local**: http://localhost:3000
- **Public**: https://jg.ngrok.io
- **Ngrok Inspector**: http://localhost:4040

## 🔧 Troubleshooting

### Port 3000 Already in Use
```bash
# Find and kill the process using port 3000
lsof -ti:3000 | xargs kill -9
```

### Ngrok Not Starting
1. Check if you're authenticated: `ngrok config check`
2. Verify your auth token is set
3. Check ngrok logs: `tail -f /tmp/ngrok.log`

### Next.js Build Errors
```bash
# Clear Next.js cache and rebuild
rm -rf .next
npm run dev
```
