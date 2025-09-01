interface StatusMessage {
  type: string;
  isRunning: boolean;
}

class ScreenCaptureClient {
  private ws: WebSocket | null = null;
  private reconnectTimeout: number | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  
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
  };
  
  constructor() {
    this.initializeEventListeners();
    this.connect();
  }
  
  private initializeEventListeners(): void {
    this.elements.startBtn.addEventListener('click', () => {
      this.sendCommand('start');
    });
    
    this.elements.stopBtn.addEventListener('click', () => {
      this.sendCommand('stop');
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
  
  private handleMessage(data: StatusMessage): void {
    if (data.type === 'status') {
      this.updateStatus(data.isRunning);
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
  
  private sendCommand(type: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type }));
    } else {
      console.error('WebSocket is not connected');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ScreenCaptureClient();
});