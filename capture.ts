import { ensureDir } from "https://deno.land/std@0.220.0/fs/ensure_dir.ts";
import { format } from "https://deno.land/std@0.220.0/datetime/format.ts";
import { TextLineStream } from "https://deno.land/std@0.220.0/streams/text_line_stream.ts";
import { Config } from "./config.ts";

export class CaptureManager {
  private intervalId: number | null = null;
  private running = false;
  private captureInterval: number;
  private powershellProcess: Deno.ChildProcess | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private reader: ReadableStreamDefaultReader<string> | null = null;
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();
  private config: Config;
  
  constructor(config: Config) {
    this.config = config;
    this.captureInterval = config.screenshot.captureInterval * 1000; // Convert to milliseconds
  }
  
  isRunning(): boolean {
    return this.running;
  }
  
  async captureNow(): Promise<void> {
    // Ensure PowerShell process is running
    if (!this.powershellProcess || !this.writer) {
      await this.startPowerShellProcess();
    }
    
    // Capture a screenshot immediately, regardless of timer
    await this.captureScreenshots();
  }
  
  async start(): Promise<void> {
    if (this.running) return;
    
    this.running = true;
    
    // Start the persistent PowerShell process
    await this.startPowerShellProcess();
    
    // Trigger first capture immediately
    await this.captureScreenshots();
    
    // Set up interval for subsequent captures
    this.intervalId = setInterval(async () => {
      await this.captureScreenshots();
    }, this.captureInterval);
  }
  
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    // Stop the PowerShell process
    this.stopPowerShellProcess();
    
    this.running = false;
  }
  
  private async startPowerShellProcess(): Promise<void> {
    console.log("Starting persistent PowerShell process...");
    
    // Create the PowerShell script that runs continuously
    const powershellScript = `
# Make the process DPI aware to get actual pixel dimensions
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class DPI {
    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();
    
    [DllImport("shcore.dll")]
    public static extern int SetProcessDpiAwareness(int value);
    
    [DllImport("user32.dll")]
    public static extern IntPtr MonitorFromPoint(POINT pt, uint dwFlags);
    
    [DllImport("shcore.dll")]
    public static extern int GetDpiForMonitor(IntPtr hMonitor, int dpiType, out uint dpiX, out uint dpiY);
    
    [StructLayout(LayoutKind.Sequential)]
    public struct POINT {
        public int X;
        public int Y;
        public POINT(int x, int y) {
            X = x;
            Y = y;
        }
    }
}
"@

# Try to set DPI awareness (Per-Monitor V2 if available, otherwise fall back to system DPI aware)
try {
    [DPI]::SetProcessDpiAwareness(2) # Per-Monitor V2 DPI awareness
    Write-Host "INIT:Set Per-Monitor V2 DPI awareness"
} catch {
    [DPI]::SetProcessDPIAware() # System DPI awareness
    Write-Host "INIT:Set System DPI awareness"
}

Write-Host "READY:PowerShell screenshot service started"

# Main command loop
while ($true) {
    $command = Read-Host
    
    if ($command -eq "exit") {
        Write-Host "EXITING:Shutting down screenshot service"
        break
    }
    elseif ($command -eq "capture") {
        try {
            # Get timestamp and folder path from stdin
            $timestamp = Read-Host
            $folderPath = Read-Host
            
            Write-Host "CAPTURING:Starting screenshot capture"
            
            $screens = [System.Windows.Forms.Screen]::AllScreens
            
            # Calculate the combined bounds of all screens
            $minX = [int]::MaxValue
            $minY = [int]::MaxValue
            $maxX = [int]::MinValue
            $maxY = [int]::MinValue
            
            foreach ($screen in $screens) {
                $bounds = $screen.Bounds
                if ($bounds.X -lt $minX) { $minX = $bounds.X }
                if ($bounds.Y -lt $minY) { $minY = $bounds.Y }
                if (($bounds.X + $bounds.Width) -gt $maxX) { $maxX = $bounds.X + $bounds.Width }
                if (($bounds.Y + $bounds.Height) -gt $maxY) { $maxY = $bounds.Y + $bounds.Height }
            }
            
            # Create a bitmap large enough to hold all screens
            $totalWidth = $maxX - $minX
            $totalHeight = $maxY - $minY
            
            Write-Host "INFO:Creating combined screenshot: $totalWidth x $totalHeight pixels"
            
            # Create the combined bitmap with higher DPI settings
            $combinedBitmap = New-Object System.Drawing.Bitmap $totalWidth, $totalHeight
            $combinedBitmap.SetResolution(96.0, 96.0)
            $graphics = [System.Drawing.Graphics]::FromImage($combinedBitmap)
            
            # Set high quality rendering
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            
            # Set background to black
            $graphics.Clear([System.Drawing.Color]::Black)
            
            # Copy each screen to the combined bitmap
            $screenIndex = 0
            foreach ($screen in $screens) {
                $bounds = $screen.Bounds
                $destX = $bounds.X - $minX
                $destY = $bounds.Y - $minY
                
                # Get DPI for this monitor
                $centerX = $bounds.X + ($bounds.Width / 2)
                $centerY = $bounds.Y + ($bounds.Height / 2)
                $point = New-Object DPI+POINT($centerX, $centerY)
                $monitor = [DPI]::MonitorFromPoint($point, 2)
                
                $dpiX = 0
                $dpiY = 0
                try {
                    [DPI]::GetDpiForMonitor($monitor, 0, [ref]$dpiX, [ref]$dpiY)
                    $scaleFactor = $dpiX / 96.0
                    Write-Host "INFO:Screen $screenIndex DPI=$dpiX Scale=$scaleFactor"
                } catch {
                    $scaleFactor = 1.0
                }
                
                # Capture the screen
                $graphics.CopyFromScreen($bounds.X, $bounds.Y, $destX, $destY, $bounds.Size)
                $screenIndex++
            }
            
            # Save the combined screenshot
            # Format and quality will be passed from Deno
            $format = Read-Host
            $quality = Read-Host
            
            if ($format -eq "jpg" -or $format -eq "jpeg") {
                $filename = "$folderPath/$timestamp" + "_combined.jpg"
                
                # Create encoder for JPEG with quality setting
                $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
                $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
                $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$quality)
                
                $combinedBitmap.Save($filename, $jpegCodec, $encoderParams)
            } else {
                $filename = "$folderPath/$timestamp" + "_combined.png"
                $combinedBitmap.Save($filename, [System.Drawing.Imaging.ImageFormat]::Png)
            }
            
            $graphics.Dispose()
            $combinedBitmap.Dispose()
            
            Write-Host "SUCCESS:Screenshot saved to $filename"
        }
        catch {
            Write-Host "ERROR:$($_.Exception.Message)"
        }
    }
    else {
        Write-Host "ERROR:Unknown command: $command"
    }
}
`;

    // Write script to temporary file
    const tempScriptPath = await Deno.makeTempFile({
      prefix: "screenshot_service_",
      suffix: ".ps1"
    });
    
    await Deno.writeTextFile(tempScriptPath, powershellScript);
    
    // Start PowerShell process
    const command = new Deno.Command("powershell", {
      args: [
        "-ExecutionPolicy",
        "Bypass",
        "-NoProfile",
        "-File",
        tempScriptPath
      ],
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    });
    
    this.powershellProcess = command.spawn();
    
    // Set up stdin writer
    if (this.powershellProcess.stdin) {
      this.writer = this.powershellProcess.stdin.getWriter();
    }
    
    // Set up stdout reader with line stream
    if (this.powershellProcess.stdout) {
      const lineStream = this.powershellProcess.stdout
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new TextLineStream());
      
      this.reader = lineStream.getReader();
      
      // Start reading output in background
      this.readPowerShellOutput();
    }
    
    // Wait for ready signal
    await this.waitForReady();
  }
  
  private async readPowerShellOutput(): Promise<void> {
    if (!this.reader) return;
    
    try {
      while (true) {
        const { value, done } = await this.reader.read();
        if (done) break;
        
        if (value) {
          // Parse output messages
          const [type, ...messageParts] = value.split(':');
          const message = messageParts.join(':');
          
          switch (type) {
            case 'READY':
            case 'INIT':
            case 'INFO':
              console.log(`[PowerShell] ${message}`);
              break;
            case 'SUCCESS':
              console.log(`✓ ${message}`);
              break;
            case 'ERROR':
              console.error(`✗ ${message}`);
              break;
            case 'CAPTURING':
              console.log(`📸 ${message}`);
              break;
            default:
              console.log(`[PowerShell] ${value}`);
          }
        }
      }
    } catch (error) {
      console.error("Error reading PowerShell output:", error);
    }
  }
  
  private async waitForReady(): Promise<void> {
    // Give PowerShell time to initialize
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds timeout
    
    while (attempts < maxAttempts) {
      // Check if we've received the ready signal by checking process status
      if (this.powershellProcess) {
        // Small delay to ensure process is ready
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
        
        // For now, we'll assume it's ready after a brief delay
        // In production, you'd want to properly wait for the READY message
        if (attempts === 5) {
          console.log("PowerShell process initialized");
          return;
        }
      }
    }
    
    throw new Error("PowerShell process failed to start");
  }
  
  private async stopPowerShellProcess(): Promise<void> {
    if (this.writer) {
      try {
        // Send exit command
        await this.writer.write(this.encoder.encode("exit\n"));
        await this.writer.close();
      } catch (error) {
        console.error("Error sending exit command:", error);
      }
    }
    
    if (this.powershellProcess) {
      try {
        // Give it a moment to exit gracefully
        await Promise.race([
          this.powershellProcess.status,
          new Promise(resolve => setTimeout(resolve, 2000))
        ]);
        
        // Force kill if still running
        try {
          this.powershellProcess.kill();
        } catch {
          // Process may have already exited
        }
      } catch (error) {
        console.error("Error stopping PowerShell process:", error);
      }
    }
    
    this.powershellProcess = null;
    this.writer = null;
    this.reader = null;
    
    console.log("PowerShell process stopped");
  }
  
  private async captureScreenshots(): Promise<void> {
    if (!this.writer) {
      console.error("PowerShell process not running");
      return;
    }
    
    try {
      const now = new Date();
      const dateFolder = format(now, "yyyy-MM-dd");
      const timestamp = format(now, "yyyy-MM-dd_HH-mm-ss");
      const folderPath = `${this.config.screenshot.outputFolder}/${dateFolder}`;
      
      await ensureDir(folderPath);
      
      const absoluteFolderPath = await Deno.realPath(folderPath);
      
      console.log(`Requesting screenshot at ${timestamp}`);
      
      // Send capture command followed by parameters
      await this.writer.write(this.encoder.encode("capture\n"));
      await this.writer.write(this.encoder.encode(`${timestamp}\n`));
      await this.writer.write(this.encoder.encode(`${absoluteFolderPath.replace(/\\/g, '/')}\n`));
      await this.writer.write(this.encoder.encode(`${this.config.screenshot.format}\n`));
      await this.writer.write(this.encoder.encode(`${this.config.screenshot.quality}\n`));
      
    } catch (error) {
      console.error("Error during screenshot capture:", error);
      
      // Try to restart the PowerShell process if it crashed
      if (this.running) {
        console.log("Attempting to restart PowerShell process...");
        await this.stopPowerShellProcess();
        await this.startPowerShellProcess();
      }
    }
  }
}