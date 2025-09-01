import { serveDir } from "https://deno.land/std@0.220.0/http/file_server.ts";
import { CaptureManager } from "./capture.ts";
import { loadConfig } from "./config.ts";

// Load configuration
const config = await loadConfig();

const captureManager = new CaptureManager(config);
const connectedClients = new Set<WebSocket>();

function broadcast(message: string) {
  for (const client of connectedClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  
  if (url.pathname === "/ws") {
    const { socket, response } = Deno.upgradeWebSocket(req);
    
    socket.onopen = () => {
      console.log("WebSocket connection opened");
      connectedClients.add(socket);
      
      socket.send(JSON.stringify({
        type: "status",
        isRunning: captureManager.isRunning(),
      }));
      
      // Send config info
      socket.send(JSON.stringify({
        type: "config",
        config: config.screenshot,
      }));
    };
    
    socket.onmessage = async (e) => {
      try {
        const data = JSON.parse(e.data);
        
        switch (data.type) {
          case "start":
            if (!captureManager.isRunning()) {
              await captureManager.start();
              broadcast(JSON.stringify({
                type: "status",
                isRunning: true,
              }));
              console.log("Screen capture started");
            }
            break;
            
          case "stop":
            if (captureManager.isRunning()) {
              captureManager.stop();
              broadcast(JSON.stringify({
                type: "status",
                isRunning: false,
              }));
              console.log("Screen capture stopped");
            }
            break;
            
          case "status":
            socket.send(JSON.stringify({
              type: "status",
              isRunning: captureManager.isRunning(),
            }));
            break;
            
          case "capture-now":
            await captureManager.captureNow();
            socket.send(JSON.stringify({
              type: "capture-complete",
              message: "Screenshot captured successfully",
            }));
            console.log("On-demand screenshot captured");
            break;
        }
      } catch (error) {
        console.error("Error handling message:", error);
      }
    };
    
    socket.onclose = () => {
      console.log("WebSocket connection closed");
      connectedClients.delete(socket);
    };
    
    socket.onerror = (e) => {
      console.error("WebSocket error:", e);
      connectedClients.delete(socket);
    };
    
    return response;
  }
  
  if (url.pathname === "/") {
    url.pathname = "/index.html";
  }
  
  return serveDir(req, {
    fsRoot: "./public",
    urlRoot: "",
    showDirListing: false,
    enableCors: true,
  });
}

// Check for TLS certificates
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
      
      return { cert, key, available: true };
    }
  } catch (error) {
    console.error("Certificate error:", error.message);
  }
  
  console.log("Certificate files not found, will use HTTP only");
  console.log("Expected files:");
  console.log("  - ./certs/cert.pem");
  console.log("  - ./certs/key.pem");
  
  return { available: false };
}

// Get local IP addresses for display
function getLocalIPs(): string[] {
  const interfaces = Deno.networkInterfaces();
  const ips: string[] = [];
  
  for (const iface of interfaces) {
    if (iface.family === "IPv4" && !iface.address.startsWith("127.")) {
      ips.push(iface.address);
    }
  }
  
  return ips;
}

// Start servers
const HTTP_PORT = 8080;
const HTTPS_PORT = 8443;

const certs = await checkCertificates();
const localIPs = getLocalIPs();
const hostname = Deno.hostname();

console.log("========================================");
console.log("Screen Capture Dashboard Server");
console.log("========================================");

// Start HTTP server
const httpServer = Deno.serve({ port: HTTP_PORT }, handler);
console.log(`\n📡 HTTP Server running on:`);
console.log(`   Local:    http://localhost:${HTTP_PORT}`);
localIPs.forEach(ip => {
  console.log(`   Network:  http://${ip}:${HTTP_PORT}`);
});

// Start HTTPS server if certificates are available
if (certs.available) {
  const httpsServer = Deno.serve({
    port: HTTPS_PORT,
    cert: certs.cert!,
    key: certs.key!,
  }, handler);
  
  console.log(`\n🔒 HTTPS Server running on:`);
  console.log(`   Local:    https://localhost:${HTTPS_PORT}`);
  console.log(`   Domain:   https://jsrpdev11.local.pathtaken.com:${HTTPS_PORT}`);
  localIPs.forEach(ip => {
    console.log(`   Network:  https://${ip}:${HTTPS_PORT}`);
  });
  
  console.log("\n✅ HTTPS certificate loaded successfully!");
  console.log("   Use the domain URL for best certificate compatibility.");
} else {
  console.log("\n💡 Tip: To enable HTTPS:");
  console.log("   1. Install mkcert: choco install mkcert");
  console.log("   2. Run: deno task cert:mkcert");
  console.log("   Or use existing certificate files in certs/ folder");
}

console.log("\n========================================");
console.log("Dashboard ready! Open one of the URLs above in your browser.");
console.log("Press Ctrl+C to stop the server.");
console.log("========================================\n");