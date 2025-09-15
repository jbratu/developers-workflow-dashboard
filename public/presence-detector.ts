declare const blazeface: any;

export interface PresenceDetectorConfig {
  detectionInterval?: number;
  absenceThreshold?: number;
  presenceThreshold?: number;
  minConfidence?: number;
}

export class PresenceDetector extends EventTarget {
  private video: HTMLVideoElement | null = null;
  private model: any = null;
  private isDetecting = false;
  private detectionInterval: number;
  private absenceThreshold: number;
  private presenceThreshold: number;
  private minConfidence: number;
  private detectionTimer: number | null = null;
  private absenceCounter = 0;
  private presenceCounter = 0;
  private currentPresence = false;
  private stream: MediaStream | null = null;

  constructor(config: PresenceDetectorConfig = {}) {
    super();
    this.detectionInterval = config.detectionInterval || 1000;
    this.absenceThreshold = config.absenceThreshold || 3;
    this.presenceThreshold = config.presenceThreshold || 1;
    this.minConfidence = config.minConfidence || 0.7;
  }

  async initialize(videoElement: HTMLVideoElement): Promise<void> {
    this.video = videoElement;
    
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 320 },
          height: { ideal: 240 }
        }
      });
      
      this.video.srcObject = this.stream;
      
      await new Promise((resolve) => {
        this.video!.onloadedmetadata = resolve;
      });
      
      console.log('Loading BlazeFace model...');
      this.model = await blazeface.load();
      console.log('BlazeFace model loaded successfully');
      
      this.dispatchEvent(new CustomEvent('initialized'));
    } catch (error) {
      console.error('Failed to initialize presence detector:', error);
      this.dispatchEvent(new CustomEvent('error', { detail: error }));
      throw error;
    }
  }

  start(): void {
    if (!this.model || !this.video) {
      console.error('Presence detector not initialized');
      return;
    }

    if (this.isDetecting) {
      return;
    }

    this.isDetecting = true;
    this.runDetection();
    
    this.dispatchEvent(new CustomEvent('started'));
  }

  stop(): void {
    this.isDetecting = false;
    
    if (this.detectionTimer) {
      clearTimeout(this.detectionTimer);
      this.detectionTimer = null;
    }
    
    this.dispatchEvent(new CustomEvent('stopped'));
  }

  private async runDetection(): Promise<void> {
    if (!this.isDetecting) {
      return;
    }

    try {
      const predictions = await this.model.estimateFaces(this.video, false);
      
      const hasPresence = predictions.length > 0 && 
                         predictions.some((pred: any) => pred.probability[0] >= this.minConfidence);
      
      if (hasPresence) {
        this.presenceCounter++;
        this.absenceCounter = 0;
        
        if (!this.currentPresence && this.presenceCounter >= this.presenceThreshold) {
          this.currentPresence = true;
          this.dispatchEvent(new CustomEvent('presenceDetected', {
            detail: { 
              faceCount: predictions.length,
              confidence: Math.max(...predictions.map((p: any) => p.probability[0]))
            }
          }));
        }
      } else {
        this.absenceCounter++;
        this.presenceCounter = 0;
        
        if (this.currentPresence && this.absenceCounter >= this.absenceThreshold) {
          this.currentPresence = false;
          this.dispatchEvent(new CustomEvent('absenceDetected'));
        }
      }
      
      this.dispatchEvent(new CustomEvent('detection', {
        detail: {
          hasPresence,
          faceCount: predictions.length,
          currentPresence: this.currentPresence
        }
      }));
      
    } catch (error) {
      console.error('Detection error:', error);
      this.dispatchEvent(new CustomEvent('error', { detail: error }));
    }

    this.detectionTimer = window.setTimeout(() => {
      this.runDetection();
    }, this.detectionInterval);
  }

  isPresent(): boolean {
    return this.currentPresence;
  }

  dispose(): void {
    this.stop();
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
    
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
  }
}