import { PresenceDetector } from './presence-detector.js';

interface StatusMessage {
  type: string;
  isRunning: boolean;
}

class ScreenCaptureClient {
  private ws: WebSocket | null = null;
  private reconnectTimeout: number | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private presenceDetector: PresenceDetector | null = null;
  private isPresenceEnabled = false;
  private webcamInitialized = false;
  
  private elements = {
    connectionStatus: document.getElementById('connectionStatus') as HTMLElement,
    connectionText: document.getElementById('connectionText') as HTMLElement,
    statusDot: document.getElementById('statusDot') as HTMLElement,
    statusIndicator: document.getElementById('statusIndicator') as HTMLElement,
    statusIcon: document.getElementById('statusIcon') as HTMLElement,
    statusText: document.getElementById('statusText') as HTMLElement,
    statusDetails: document.getElementById('statusDetails') as HTMLElement,
    startBtn: document.getElementById('startBtn') as HTMLButtonElement,
    stopBtn: document.getElementById('stopBtn') as HTMLButtonElement,
    captureBtn: document.getElementById('captureBtn') as HTMLButtonElement,
    webcamVideo: document.getElementById('webcamVideo') as HTMLVideoElement,
    webcamOverlay: document.getElementById('webcamOverlay') as HTMLElement,
    presenceToggle: document.getElementById('presenceToggle') as HTMLInputElement,
    presenceStatus: document.getElementById('presenceStatus') as HTMLElement,
    presenceDot: document.getElementById('presenceDot') as HTMLElement,
    presenceText: document.getElementById('presenceText') as HTMLElement,
  };
  
  constructor() {
    this.initializeEventListeners();
    this.initializeWebcam();
    this.connect();
  }
  
  private initializeEventListeners(): void {
    this.elements.startBtn.addEventListener('click', () => {
      this.sendCommand('start');
    });
    
    this.elements.stopBtn.addEventListener('click', () => {
      this.sendCommand('stop');
    });
    
    this.elements.captureBtn.addEventListener('click', () => {
      this.sendCommand('capture-now');
    });
    
    this.elements.webcamOverlay.addEventListener('click', () => {
      this.startWebcam();
    });
    
    this.elements.presenceToggle.addEventListener('change', () => {
      this.togglePresenceDetection();
    });
  }
  
  private connect(): void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.onConnected();
        this.reconnectDelay = 1000;
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data: StatusMessage = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      };
      
      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.onDisconnected();
        this.scheduleReconnect();
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.scheduleReconnect();
    }
  }
  
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.reconnectTimeout = window.setTimeout(() => {
      console.log('Attempting to reconnect...');
      this.connect();
    }, this.reconnectDelay);
    
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }
  
  private onConnected(): void {
    this.elements.statusDot.className = 'status-dot connected';
    this.elements.connectionText.textContent = 'Connected';
    
    this.sendCommand('status');
  }
  
  private onDisconnected(): void {
    this.elements.statusDot.className = 'status-dot disconnected';
    this.elements.connectionText.textContent = 'Disconnected';
    
    this.elements.startBtn.disabled = true;
    this.elements.stopBtn.disabled = true;
  }
  
  private handleMessage(data: any): void {
    switch (data.type) {
      case 'status':
        this.updateStatus(data.isRunning);
        break;
      case 'config':
        this.updateConfig(data.config);
        break;
      case 'capture-complete':
        console.log('Screenshot captured:', data.message);
        break;
    }
  }
  
  private updateStatus(isRunning: boolean): void {
    if (isRunning) {
      this.elements.statusIcon.classList.add('running');
      this.elements.statusText.textContent = 'Screen Capture Running';
      this.elements.statusDetails.textContent = 'Capturing screenshots every 30 seconds...';
      this.elements.startBtn.disabled = true;
      this.elements.stopBtn.disabled = false;
    } else {
      this.elements.statusIcon.classList.remove('running');
      this.elements.statusText.textContent = 'Screen Capture Stopped';
      this.elements.statusDetails.textContent = 'Press START to begin capturing screenshots every 30 seconds';
      this.elements.startBtn.disabled = false;
      this.elements.stopBtn.disabled = true;
    }
  }
  
  private sendCommand(type: string, metadata?: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = metadata ? { type, ...metadata } : { type };
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
    }
  }
  
  private initializeWebcam(): void {
    this.elements.webcamVideo.style.display = 'none';
  }
  
  private async startWebcam(): Promise<void> {
    if (this.webcamInitialized) return;
    
    try {
      this.elements.webcamOverlay.style.display = 'none';
      this.elements.webcamVideo.style.display = 'block';
      
      this.presenceDetector = new PresenceDetector({
        detectionInterval: 1000,
        absenceThreshold: 3,
        presenceThreshold: 1,
        minConfidence: 0.7
      });
      
      await this.presenceDetector.initialize(this.elements.webcamVideo);
      
      this.presenceDetector.addEventListener('presenceDetected', (event: any) => {
        console.log('Presence detected:', event.detail);
        this.updatePresenceStatus(true);
        
        if (this.isPresenceEnabled) {
          this.sendCommand('start', { reason: 'presence_detected' });
        }
      });
      
      this.presenceDetector.addEventListener('absenceDetected', () => {
        console.log('Absence detected');
        this.updatePresenceStatus(false);
        
        if (this.isPresenceEnabled) {
          this.sendCommand('stop', { reason: 'absence_detected' });
        }
      });
      
      this.presenceDetector.addEventListener('error', (event: any) => {
        console.error('Presence detector error:', event.detail);
      });
      
      this.webcamInitialized = true;
      this.elements.presenceToggle.disabled = false;
      this.updatePresenceStatus(false);
      
    } catch (error) {
      console.error('Failed to start webcam:', error);
      alert('Failed to access webcam. Please ensure camera permissions are granted.');
      this.elements.webcamOverlay.style.display = 'flex';
      this.elements.webcamVideo.style.display = 'none';
    }
  }
  
  private togglePresenceDetection(): void {
    this.isPresenceEnabled = this.elements.presenceToggle.checked;
    
    if (this.isPresenceEnabled && this.presenceDetector) {
      this.presenceDetector.start();
      console.log('Presence detection enabled');
    } else if (this.presenceDetector) {
      this.presenceDetector.stop();
      console.log('Presence detection disabled');
    }
  }
  
  private updatePresenceStatus(isPresent: boolean): void {
    if (!this.webcamInitialized) {
      this.elements.presenceDot.className = 'presence-dot inactive';
      this.elements.presenceText.textContent = 'Webcam not active';
      return;
    }
    
    if (isPresent) {
      this.elements.presenceDot.className = 'presence-dot present';
      this.elements.presenceText.textContent = 'Person detected';
    } else {
      this.elements.presenceDot.className = 'presence-dot absent';
      this.elements.presenceText.textContent = 'No person detected';
    }
  }
  
  private updateConfig(config: any): void {
    const outputFolder = document.getElementById('outputFolder');
    const captureInterval = document.getElementById('captureInterval');
    const fileFormat = document.getElementById('fileFormat');
    const qualityInfo = document.getElementById('qualityInfo') as HTMLElement;
    const jpegQuality = document.getElementById('jpegQuality');
    
    if (outputFolder) outputFolder.textContent = config.outputFolder || './screenshots/[date]/';
    if (captureInterval) captureInterval.textContent = config.captureInterval || '30';
    if (fileFormat) fileFormat.textContent = (config.format || 'png').toUpperCase();
    
    if (config.format === 'jpg' || config.format === 'jpeg') {
      if (qualityInfo) qualityInfo.style.display = 'block';
      if (jpegQuality) jpegQuality.textContent = config.quality || '90';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ScreenCaptureClient();
});