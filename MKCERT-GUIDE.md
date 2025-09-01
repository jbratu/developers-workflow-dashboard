# mkcert Certificate Guide for Network Access

This guide explains how to generate and deploy trusted HTTPS certificates for accessing the Screen Capture Dashboard from other computers on your network.

## Overview

mkcert creates locally-trusted development certificates that work seamlessly with browsers, eliminating certificate warnings. This is perfect for secure access from other devices on your local network.

## Prerequisites

### On the Server Computer (Windows)

1. **Install mkcert** (choose one method):

   **Option A: Chocolatey (Recommended)**
   ```powershell
   choco install mkcert
   ```

   **Option B: Scoop**
   ```powershell
   scoop bucket add extras
   scoop install mkcert
   ```

   **Option C: Manual Download**
   - Download from: https://github.com/FiloSottile/mkcert/releases
   - Get `mkcert-v*-windows-amd64.exe`
   - Rename to `mkcert.exe` and add to PATH

2. **Install the Certificate Authority**
   ```powershell
   mkcert -install
   ```
   This installs mkcert's root certificate in your system's trust store.

## Generating Certificates for Network Access

### Step 1: Identify Your Network Details

Find your computer's network information:
```powershell
# Get your computer name
hostname

# Get your IP address
ipconfig | findstr /i "IPv4"
```

### Step 2: Generate Certificate with Multiple Names

Create a certificate that works for all access methods:

```powershell
# Navigate to your project directory
cd C:\Users\YourName\repos\developers-workflow-dashboard

# Create certs directory if it doesn't exist
mkdir certs -ErrorAction SilentlyContinue

# Generate certificate with all possible names
mkcert -cert-file certs/cert.pem -key-file certs/key.pem `
  localhost `
  127.0.0.1 `
  ::1 `
  YOUR-COMPUTER-NAME `
  YOUR-COMPUTER-NAME.local `
  192.168.1.XXX `
  YOUR-CUSTOM-DOMAIN.local
```

**Example with actual values:**
```powershell
mkcert -cert-file certs/cert.pem -key-file certs/key.pem `
  localhost `
  127.0.0.1 `
  ::1 `
  DESKTOP-ABC123 `
  DESKTOP-ABC123.local `
  192.168.1.100 `
  jsrpdev11.local.pathtaken.com
```

### Step 3: Start the Server

```powershell
deno task start
```

The server will automatically detect and use the certificates in the `certs/` folder.

## Trusting Certificates on Client Devices

For other computers to trust your certificate, you need to export and install mkcert's root CA.

### On the Server Computer: Export Root CA

```powershell
# Find the root CA location
mkcert -CAROOT

# This will show something like:
# C:\Users\YourName\AppData\Local\mkcert

# Copy the rootCA.pem file to a shared location or USB drive
```

### On Client Computers (Windows)

1. **Copy the root CA file** from the server to the client computer

2. **Install the root certificate:**
   ```powershell
   # Option 1: Using PowerShell (Run as Administrator)
   Import-Certificate -FilePath "path\to\rootCA.pem" -CertStoreLocation Cert:\LocalMachine\Root

   # Option 2: Using GUI
   # 1. Double-click rootCA.pem
   # 2. Click "Install Certificate"
   # 3. Choose "Local Machine"
   # 4. Select "Place all certificates in the following store"
   # 5. Browse and select "Trusted Root Certification Authorities"
   # 6. Click Next, then Finish
   ```

3. **Restart browsers** for the changes to take effect

### On Client Computers (macOS)

```bash
# Using Terminal
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain path/to/rootCA.pem

# Or use Keychain Access GUI:
# 1. Open Keychain Access
# 2. Drag rootCA.pem to "System" keychain
# 3. Double-click the certificate
# 4. Set "Always Trust" for SSL
```

### On Client Computers (Linux)

```bash
# Ubuntu/Debian
sudo cp rootCA.pem /usr/local/share/ca-certificates/mkcert-rootCA.crt
sudo update-ca-certificates

# Fedora/RHEL
sudo cp rootCA.pem /etc/pki/ca-trust/source/anchors/
sudo update-ca-trust
```

### On Mobile Devices

**iOS:**
1. Email or AirDrop the `rootCA.pem` file to your device
2. Open the file and install the profile
3. Go to Settings → General → About → Certificate Trust Settings
4. Enable trust for the mkcert certificate

**Android:**
1. Copy `rootCA.pem` to the device
2. Go to Settings → Security → Encryption & Credentials
3. Tap "Install from storage" or "Install certificates"
4. Select the CA certificate option
5. Browse and select the rootCA.pem file

## Accessing the Dashboard

Once certificates are installed, access the dashboard using any of these URLs:

- `https://localhost:8443` (on server computer)
- `https://COMPUTER-NAME:8443` (from network)
- `https://192.168.1.XXX:8443` (using IP address)
- `https://your-domain.local:8443` (if configured)

## Troubleshooting

### Certificate Not Trusted

1. **Verify root CA is installed:**
   ```powershell
   # Windows: Check if root CA is in store
   Get-ChildItem Cert:\LocalMachine\Root | Where-Object {$_.Subject -match "mkcert"}
   ```

2. **Clear browser cache** and restart the browser

3. **Check certificate details** in browser:
   - Click the padlock icon in address bar
   - View certificate details
   - Verify the issuer shows mkcert

### Connection Refused

1. **Check firewall rules:**
   ```powershell
   # Allow HTTPS port through Windows Firewall
   New-NetFirewallRule -DisplayName "Screen Capture HTTPS" `
     -Direction Inbound -LocalPort 8443 -Protocol TCP -Action Allow
   ```

2. **Verify server is running** and listening on the correct port

3. **Test local connection first** before trying from remote devices

### DNS Resolution Issues

If using custom domain names:

1. **Add to hosts file** on client computers:
   ```
   # Windows: C:\Windows\System32\drivers\etc\hosts
   # macOS/Linux: /etc/hosts
   
   192.168.1.100  jsrpdev11.local.pathtaken.com
   ```

2. **Or use IP address directly** instead of domain name

## Security Notes

- mkcert certificates are for **development/local use only**
- Never share the root CA private key (`rootCA-key.pem`)
- The root CA allows creating certificates for any domain
- Remove the root CA from client devices when no longer needed:
  ```powershell
  # Windows
  Get-ChildItem Cert:\LocalMachine\Root | 
    Where-Object {$_.Subject -match "mkcert"} | 
    Remove-Item
  ```

## Quick Setup Script

Save this as `setup-network-cert.ps1`:

```powershell
# Install mkcert if not present
if (!(Get-Command mkcert -ErrorAction SilentlyContinue)) {
    Write-Host "Installing mkcert..." -ForegroundColor Yellow
    choco install mkcert -y
}

# Install CA
mkcert -install

# Get network info
$hostname = hostname
$ip = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias Wi-Fi).IPAddress

# Generate certificate
Write-Host "Generating certificate for network access..." -ForegroundColor Green
mkcert -cert-file certs/cert.pem -key-file certs/key.pem `
    localhost 127.0.0.1 ::1 `
    $hostname "$hostname.local" `
    $ip

Write-Host "`nCertificate created! Access the dashboard at:" -ForegroundColor Green
Write-Host "  https://${hostname}:8443" -ForegroundColor Cyan
Write-Host "  https://${ip}:8443" -ForegroundColor Cyan

# Show root CA location for sharing
$caRoot = mkcert -CAROOT
Write-Host "`nTo trust this certificate on other devices, share:" -ForegroundColor Yellow
Write-Host "  $caRoot\rootCA.pem" -ForegroundColor Cyan
```

Run with: `powershell -ExecutionPolicy Bypass -File setup-network-cert.ps1`