// Simple HTTPS test server for Deno
// This creates a minimal HTTPS server to test certificate configuration

async function checkCertificates(): Promise<{ cert?: string; key?: string; available: boolean }> {
  const certPath = "./certs/cert.pem";
  const keyPath = "./certs/key.pem";
  
  try {
    const [certExists, keyExists] = await Promise.all([
      Deno.stat(certPath).then(() => true).catch(() => false),
      Deno.stat(keyPath).then(() => true).catch(() => false),
    ]);
    
    if (certExists && keyExists) {
      const [cert, key] = await Promise.all([
        Deno.readTextFile(certPath),
        Deno.readTextFile(keyPath),
      ]);
      
      console.log("✅ Found certificate files:");
      console.log("   cert.pem:", certPath);
      console.log("   key.pem:", keyPath);
      
      // Display certificate info
      const certLines = cert.split('\n');
      console.log("\n📜 Certificate preview:");
      console.log("   " + certLines[0]);
      console.log("   [...certificate content...]");
      console.log("   " + certLines[certLines.length - 2]);
      
      return { cert, key, available: true };
    }
  } catch (error) {
    console.error("❌ Certificate error:", error.message);
  }
  
  console.log("❌ Certificate files not found!");
  console.log("   Expected:");
  console.log("   - ./certs/cert.pem");
  console.log("   - ./certs/key.pem");
  
  return { available: false };
}

// Simple request handler that returns Hello World
function handler(req: Request): Response {
  const url = new URL(req.url);
  
  // Create a simple HTML response
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>HTTPS Test</title>
    <style>
        body {
            font-family: -apple-system, system-ui, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container {
            text-align: center;
            padding: 40px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            backdrop-filter: blur(10px);
        }
        h1 { 
            font-size: 48px; 
            margin: 0 0 20px 0;
        }
        .status {
            font-size: 24px;
            margin: 20px 0;
        }
        .success {
            color: #4ade80;
        }
        .info {
            margin-top: 30px;
            padding: 20px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 10px;
        }
        .url {
            font-family: monospace;
            background: rgba(0, 0, 0, 0.3);
            padding: 5px 10px;
            border-radius: 5px;
            margin: 5px;
            display: inline-block;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔒 Hello World!</h1>
        <p class="status success">✅ HTTPS is working!</p>
        <div class="info">
            <p>You successfully accessed this page via HTTPS</p>
            <p>URL: <span class="url">${req.url}</span></p>
            <p>Protocol: <span class="url">${url.protocol}</span></p>
            <p>Host: <span class="url">${url.hostname}</span></p>
            <p>Port: <span class="url">${url.port || (url.protocol === 'https:' ? '443' : '80')}</span></p>
        </div>
    </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}

// Main server startup
console.log("\n========================================");
console.log("🧪 HTTPS Test Server for Deno");
console.log("========================================\n");

const certs = await checkCertificates();

if (!certs.available) {
  console.log("\n❌ Cannot start HTTPS server without certificates!");
  console.log("\nTo generate certificates:");
  console.log("1. Install mkcert: choco install mkcert");
  console.log("2. Run: powershell .\\generate-mkcert.ps1");
  console.log("3. Or for testing: deno task cert:generate");
  Deno.exit(1);
}

const HTTPS_PORT = 9443;
const HTTP_PORT = 9080;

// Start HTTPS server
console.log("\n🚀 Starting servers...\n");

try {
  // Start HTTPS server
  const httpsServer = Deno.serve({
    port: HTTPS_PORT,
    cert: certs.cert!,
    key: certs.key!,
    handler,
  });

  console.log("🔒 HTTPS Server running:");
  console.log(`   https://localhost:${HTTPS_PORT}`);
  console.log(`   https://jsrpdev11.local.pathtaken.com:${HTTPS_PORT}`);
  console.log(`   https://127.0.0.1:${HTTPS_PORT}`);

  // Also start HTTP server for comparison
  const httpServer = Deno.serve({
    port: HTTP_PORT,
    handler,
  });

  console.log("\n🌐 HTTP Server running (for comparison):");
  console.log(`   http://localhost:${HTTP_PORT}`);

  console.log("\n========================================");
  console.log("✅ Test servers are ready!");
  console.log("========================================");
  console.log("\nOpen the HTTPS URL in Chrome to test the certificate.");
  console.log("You should see 'Hello World!' with a valid HTTPS connection.");
  console.log("\nPress Ctrl+C to stop the servers.\n");

} catch (error) {
  console.error("\n❌ Failed to start server:", error.message);
  console.error("\nPossible issues:");
  console.error("- Port already in use (try: netstat -an | findstr :8443)");
  console.error("- Certificate format issue");
  console.error("- Missing permissions");
  Deno.exit(1);
}