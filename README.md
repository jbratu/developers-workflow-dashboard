# Screen Capture Dashboard

A TypeScript Deno application that provides a web-based dashboard for controlling automated screen capture on Windows systems.

## Features

- **WebSocket Server**: Real-time communication between dashboard and capture process
- **Responsive Dashboard**: Mobile-friendly UI with large, colorful buttons
- **Multi-Monitor Support**: Captures all connected monitors
- **Automated Capture**: Takes screenshots every 30 seconds when running
- **Organized Storage**: Screenshots saved in date-stamped folders with timestamp filenames
- **HTTPS Support**: Secure access with self-signed certificates for remote devices
- **Remote Access**: Control screen capture from any device on your network

## Requirements

- Deno (latest version)
- Windows OS (for PowerShell screen capture)
- PowerShell (pre-installed on Windows)

## Installation

1. Clone or download this repository
2. Ensure Deno is installed: https://deno.land/manual/getting_started/installation

## Quick Start

### Basic HTTP Setup (Local Network Only)

Start the server with:

```bash
deno task start
```

Or for development with auto-reload:

```bash
deno task dev
```

The dashboard will be available at:
- Local: http://localhost:8080
- Network: http://[your-ip]:8080

### HTTPS Setup (Recommended for Remote Access)

1. Generate self-signed certificates:
```bash
deno task cert:generate
```

2. Start the server:
```bash
deno task start
```

The dashboard will be available on both:
- HTTP: http://localhost:8080
- HTTPS: https://localhost:8443

## Remote Access Setup

### From Another Computer on Your Network

1. Find your computer's IP address (shown when server starts)
2. Open browser on remote device
3. Navigate to: `http://[server-ip]:8080` or `https://[server-ip]:8443`

### From Mobile Devices

1. Ensure your mobile device is on the same WiFi network
2. Open browser on your mobile device
3. Enter the server URL shown in the console
4. For HTTPS, accept the certificate warning:
   - **iOS**: Settings > General > About > Certificate Trust Settings
   - **Android**: Security > Encryption & Credentials > Install Certificate

### Certificate Trust Instructions

When using HTTPS with self-signed certificates, you'll see a security warning. This is normal.

**Chrome/Edge:**
1. Click "Advanced"
2. Click "Proceed to [hostname] (unsafe)"

**Firefox:**
1. Click "Advanced"
2. Click "Accept the Risk and Continue"

**Safari:**
1. Click "Show Details"
2. Click "visit this website"

### Firewall Configuration

If you can't connect from remote devices:

1. **Windows Firewall**: Allow inbound connections on ports 8080 and 8443
   ```powershell
   # Run as Administrator
   New-NetFirewallRule -DisplayName "Screen Capture Dashboard HTTP" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
   New-NetFirewallRule -DisplayName "Screen Capture Dashboard HTTPS" -Direction Inbound -LocalPort 8443 -Protocol TCP -Action Allow
   ```

2. **Router**: No configuration needed for local network access

## Usage

1. Open the dashboard in your browser (works great on mobile devices too!)
2. Click the green **START** button to begin capturing screenshots
3. Click the red **STOP** button to stop capturing
4. Screenshots are saved to `./screenshots/YYYY-MM-DD/` folders
5. Each screenshot is named: `YYYY-MM-DD_HH-MM-SS_monitor-X.png`

## Project Structure

- `server.ts` - WebSocket server and HTTP file server
- `capture.ts` - Screen capture logic using PowerShell
- `public/` - Dashboard files
  - `index.html` - Dashboard UI
  - `styles.css` - Responsive styles
  - `app.ts` - Client-side TypeScript (compiled to app.js)
- `screenshots/` - Screenshot storage (created automatically)

## How It Works

1. The server starts a WebSocket endpoint and serves the dashboard files
2. The dashboard connects via WebSocket for real-time status updates
3. When "START" is clicked, PowerShell captures screenshots of all monitors
4. Screenshots are taken every 30 seconds until "STOP" is clicked
5. Files are organized by date with timestamp-based filenames

## Security Note

This application requires the following Deno permissions:
- `--allow-net`: For the web server and WebSocket
- `--allow-read`: To serve dashboard files
- `--allow-write`: To save screenshots
- `--allow-run`: To execute PowerShell for screen capture