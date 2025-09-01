# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Deno-based Windows screen capture dashboard that takes periodic screenshots of all monitors. The system uses a persistent PowerShell process for efficient screen capture and provides a web-based control interface with WebSocket communication.

## Commands

### Development
- `deno task dev` - Run server with auto-reload
- `deno task start` - Run server in production mode
- `deno task build` - Compile TypeScript client code (public/app.ts → public/app.js)
- `deno task build:watch` - Compile with auto-rebuild

### Certificate Management
- `deno task cert:generate` - Generate self-signed certificates using PowerShell
- `deno task cert:mkcert` - Generate certificates using mkcert tool
- `deno task test:https` - Test HTTPS configuration

## Architecture

### Core Components

1. **server.ts** - Main entry point
   - Loads configuration from config.json
   - Creates CaptureManager instance with config
   - Handles WebSocket connections for real-time communication
   - Serves static files from public/ directory
   - Supports both HTTP (8080) and HTTPS (8443) if certificates exist

2. **capture.ts** - Screenshot capture system
   - Maintains persistent PowerShell process to avoid startup overhead
   - Uses stdin/stdout communication protocol with PowerShell
   - Commands: "capture", "exit"
   - Supports configurable intervals, formats (PNG/JPG), and quality settings
   - Auto-restarts PowerShell if it crashes

3. **config.ts** - Configuration management
   - Loads and validates config.json
   - Provides defaults if config missing
   - Validates format, quality, interval, and output folder settings

### PowerShell Communication Protocol

The system uses a persistent PowerShell process with a command-based protocol:
- Deno → PowerShell: Text commands via stdin ("capture\n", followed by parameters)
- PowerShell → Deno: Prefixed messages via stdout (READY:, INFO:, SUCCESS:, ERROR:)
- Parameters sent for capture: timestamp, folder path, format, quality

### WebSocket Message Types

Client → Server:
- `start` - Begin automatic capture loop
- `stop` - Stop automatic capture
- `status` - Request current capture status
- `capture-now` - Take immediate screenshot

Server → Client:
- `status` - Current running state
- `config` - Configuration details for UI display
- `capture-complete` - Confirmation of manual capture

### Configuration System

The `config.json` file controls:
- `format`: "png", "jpg", or "jpeg"
- `quality`: 1-100 (JPEG only)
- `captureInterval`: Seconds between captures
- `outputFolder`: Base directory for screenshots

Changes require server restart. Screenshots are organized as:
`{outputFolder}/{YYYY-MM-DD}/{timestamp}_combined.{png|jpg}`

### Key Implementation Details

1. **DPI Awareness**: PowerShell script sets Per-Monitor V2 DPI awareness to handle scaled displays correctly

2. **Multi-Monitor Support**: Calculates combined bounds of all screens, creates single bitmap containing all monitors in their actual desktop arrangement

3. **Performance Optimization**: Persistent PowerShell process eliminates ~200-400ms startup overhead per capture

4. **Error Recovery**: Automatic PowerShell process restart on crash, with error handling in capture pipeline

## Required Permissions

The application needs these Deno permissions:
- `--allow-net`: Web server and WebSocket
- `--allow-read`: Serve dashboard files, read config
- `--allow-write`: Save screenshots, create folders
- `--allow-run`: Execute PowerShell
- `--allow-sys`: System information (hostname, network interfaces)

## Testing Changes

When modifying the capture system:
1. Test with multiple monitors of different DPI scales
2. Verify JPEG quality settings work correctly
3. Ensure PowerShell process restarts after errors
4. Check that config changes are reflected in UI

When modifying the web interface:
1. Test WebSocket reconnection logic
2. Verify button states update correctly
3. Test on mobile devices for responsive design