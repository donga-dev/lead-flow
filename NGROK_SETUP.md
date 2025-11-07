# Ngrok Setup Guide

This guide explains how to set up ngrok to expose both your frontend and backend servers.

## Prerequisites

1. **Ngrok installed**: Make sure `ngrok.exe` is in your project root directory
2. **Auth token**: Your ngrok authtoken is already configured in `ngrok.yml`

## Configuration

The `ngrok.yml` file is already configured with:
- **Backend tunnel**: Port 3001
- **Frontend tunnel**: Port 3000
- **Auth token**: Already set

## Usage

### Option 1: Start Both Tunnels Together

```bash
npm run ngrok
```

This starts both frontend and backend tunnels. **Note**: On ngrok free tier, both tunnels may get the same URL. If this happens, use Option 2.

### Option 2: Start Tunnels Separately (Recommended)

**Terminal 1 - Backend:**
```bash
npm run ngrok:backend
```

**Terminal 2 - Frontend:**
```bash
npm run ngrok:frontend
```

Wait 10-15 seconds between starting each tunnel to ensure they get different URLs.

### Option 3: Run Directly

**Terminal 1:**
```bash
ngrok.exe start backend --config ngrok.yml
```

**Terminal 2:**
```bash
ngrok.exe start frontend --config ngrok.yml
```

## Getting Your URLs

After starting ngrok, you can get your URLs from:

1. **Terminal output**: Look for lines like:
   ```
   Forwarding  https://abc123.ngrok-free.app -> http://localhost:3001
   ```

2. **Ngrok web interface**: Open http://localhost:4040 in your browser

3. **API endpoint**: 
   ```powershell
   Invoke-WebRequest -Uri "http://localhost:4040/api/tunnels" | ConvertFrom-Json
   ```

## Frontend Configuration

After getting your backend ngrok URL, create a `.env` file in the root directory:

```env
REACT_APP_BACKEND_URL=https://your-backend-ngrok-url.ngrok-free.app
```

Replace `your-backend-ngrok-url.ngrok-free.app` with your actual backend ngrok URL.

**Important**: 
- Restart your React dev server after creating/updating `.env`
- Make sure to use the **backend** ngrok URL, not the frontend one

## Access Your App

- **Frontend**: Use the frontend ngrok URL (e.g., `https://xyz789.ngrok-free.app`)
- **Backend API**: Automatically uses the backend ngrok URL via `.env`
- **Webhooks**: Use the backend ngrok URL in Meta Business Manager

## Troubleshooting

### Both Tunnels Get Same URL

This is a limitation of ngrok free tier. Solutions:
1. Start tunnels separately with a delay (10-15 seconds)
2. Use only the backend tunnel and access frontend via `localhost:3000`
3. Upgrade to ngrok paid plan for static domains

### Ngrok Not Starting

1. Check that `ngrok.exe` exists in the project root
2. Verify the authtoken is correct in `ngrok.yml`
3. Try running ngrok directly: `ngrok.exe version`

### CORS Errors

Make sure:
1. `.env` file has the correct backend ngrok URL
2. React dev server is restarted after updating `.env`
3. Backend CORS is configured to allow all origins (already set)

## Quick Start

1. **Start your servers:**
   ```bash
   # Terminal 1
   npm run server
   
   # Terminal 2
   npm start
   ```

2. **Start ngrok tunnels:**
   ```bash
   # Terminal 3
   npm run ngrok:backend
   
   # Terminal 4 (wait 10-15 seconds)
   npm run ngrok:frontend
   ```

3. **Get backend URL** from Terminal 3 or http://localhost:4040

4. **Create `.env` file:**
   ```env
   REACT_APP_BACKEND_URL=https://your-backend-ngrok-url.ngrok-free.app
   ```

5. **Restart frontend:**
   ```bash
   # Stop (Ctrl+C) and restart
   npm start
   ```

6. **Access your app** via the frontend ngrok URL!

