# Generate trusted certificate using mkcert for jsrpdev11.local.pathtaken.com
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Certificate Generation with mkcert" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

$mkcertPath = Get-Command mkcert -ErrorAction SilentlyContinue

if (!$mkcertPath) {
    Write-Host "`nmkcert not found. Please install it first:" -ForegroundColor Red
    Write-Host ""
    Write-Host "Option 1: Using Chocolatey (recommended):" -ForegroundColor Yellow
    Write-Host "  choco install mkcert" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Option 2: Using Scoop:" -ForegroundColor Yellow
    Write-Host "  scoop bucket add extras" -ForegroundColor Cyan
    Write-Host "  scoop install mkcert" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Option 3: Download directly:" -ForegroundColor Yellow
    Write-Host "  1. Go to: https://github.com/FiloSottile/mkcert/releases" -ForegroundColor Cyan
    Write-Host "  2. Download mkcert-v*-windows-amd64.exe" -ForegroundColor Cyan
    Write-Host "  3. Rename to mkcert.exe and add to PATH" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

Write-Host "`nFound mkcert at: $($mkcertPath.Path)" -ForegroundColor Green

# Install local CA if not already done
Write-Host "`nInstalling local Certificate Authority..." -ForegroundColor Yellow
& mkcert -install 2>&1 | Out-String | Write-Host

# Create certs directory if it doesn't exist
if (!(Test-Path certs)) {
    New-Item -ItemType Directory -Path certs | Out-Null
    Write-Host "Created certs directory" -ForegroundColor Yellow
}

# Generate certificate for the specific domain
$domain = "jsrpdev11.local.pathtaken.com"
$additionalNames = @("localhost", "127.0.0.1", "::1")

Write-Host "`nGenerating certificate for:" -ForegroundColor Cyan
Write-Host "  Primary: $domain" -ForegroundColor White
foreach ($name in $additionalNames) {
    Write-Host "  Additional: $name" -ForegroundColor White
}

$certPath = ".\certs\cert.pem"
$keyPath = ".\certs\key.pem"

# Generate the certificate
Write-Host "`nGenerating certificate..." -ForegroundColor Yellow
$allNames = @($domain) + $additionalNames
& mkcert -cert-file $certPath -key-file $keyPath $allNames

if ((Test-Path $certPath) -and (Test-Path $keyPath)) {
    Write-Host "`n✅ Certificate generated successfully!" -ForegroundColor Green
    Write-Host "  Certificate: $certPath" -ForegroundColor White
    Write-Host "  Private Key: $keyPath" -ForegroundColor White
    
    # Verify the certificate
    Write-Host "`nVerifying certificate..." -ForegroundColor Yellow
    $certInfo = & openssl x509 -in $certPath -text -noout 2>&1 | Select-String "Subject:", "DNS:"
    $certInfo | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "✅ Certificate Ready for Use!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "The certificate is trusted by your system and browsers." -ForegroundColor Green
    Write-Host "You can now access the server at:" -ForegroundColor White
    Write-Host "  https://jsrpdev11.local.pathtaken.com:8443" -ForegroundColor Cyan
    Write-Host "  https://localhost:8443" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host "`n❌ Failed to generate certificate!" -ForegroundColor Red
    exit 1
}