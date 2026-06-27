declare const blazeface: any;
declare const tf: any;

export interface PresenceDetectorConfig {
  detectionInterval?: number;
  absenceThreshold?: number;
  presenceThreshold?: number;
  minConfidence?: number;
}

// Abstract interface for face detection backends
interface FaceDetector {
  initialize(): Promise<void>;
  detect(video: HTMLVideoElement): Promise<{ hasPresence: boolean; faceCount: number; confidence: number }>;
  dispose(): void;
}

// BlazeFace detector (primary - uses TensorFlow.js + WebGL)
class BlazeFaceDetector implements FaceDetector {
  private model: any = null;
  private minConfidence: number;

  constructor(minConfidence: number) {
    this.minConfidence = minConfidence;
  }

  async initialize(): Promise<void> {
    console.log('Checking TensorFlow.js...');
    if (typeof tf === 'undefined') {
      throw new Error('TensorFlow.js not available');
    }
    await tf.ready();
    console.log('TensorFlow.js ready, backend:', tf.getBackend());

    console.log('Loading BlazeFace model...');
    this.model = await Promise.race([
      blazeface.load(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('BlazeFace load timeout (30s)')), 30000)
      )
    ]);
    console.log('BlazeFace model loaded successfully');
  }

  async detect(video: HTMLVideoElement): Promise<{ hasPresence: boolean; faceCount: number; confidence: number }> {
    const predictions = await this.model.estimateFaces(video, false);
    const validPredictions = predictions.filter((pred: any) => pred.probability[0] >= this.minConfidence);
    const maxConfidence = validPredictions.length > 0
      ? Math.max(...validPredictions.map((p: any) => p.probability[0]))
      : 0;

    return {
      hasPresence: validPredictions.length > 0,
      faceCount: validPredictions.length,
      confidence: maxConfidence
    };
  }

  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
  }
}

// Motion detector (fallback - no WebGL required, works in all browsers)
// Compares consecutive frames to detect any movement
class MotionDetector implements FaceDetector {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private previousFrame: Uint8ClampedArray | null = null;
  private motionThreshold: number;
  private pixelThreshold: number;

  constructor(_minConfidence: number) {
    // motionThreshold: percentage of pixels that must change to detect motion (0-1)
    this.motionThreshold = 0.01;  // 1% of pixels changing = motion
    // pixelThreshold: how much a pixel must change to count as different (0-255)
    this.pixelThreshold = 30;
  }

  async initialize(): Promise<void> {
    console.log('Initializing motion detector...');
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) {
      throw new Error('Failed to get 2D canvas context');
    }
    console.log('Motion detector ready');
  }

  async detect(video: HTMLVideoElement): Promise<{ hasPresence: boolean; faceCount: number; confidence: number }> {
    if (!this.canvas || !this.ctx) {
      throw new Error('Motion detector not initialized');
    }

    // Use smaller resolution for faster processing
    const width = 160;
    const height = 120;
    this.canvas.width = width;
    this.canvas.height = height;

    // Draw current frame
    this.ctx.drawImage(video, 0, 0, width, height);
    const currentFrame = this.ctx.getImageData(0, 0, width, height).data;

    // If no previous frame, store this one and return no motion
    if (!this.previousFrame) {
      this.previousFrame = new Uint8ClampedArray(currentFrame);
      return { hasPresence: false, faceCount: 0, confidence: 0 };
    }

    // Compare frames - count pixels that changed significantly
    let changedPixels = 0;
    const totalPixels = width * height;

    for (let i = 0; i < currentFrame.length; i += 4) {
      // Compare grayscale values (faster than comparing RGB separately)
      const prevGray = (this.previousFrame[i] + this.previousFrame[i + 1] + this.previousFrame[i + 2]) / 3;
      const currGray = (currentFrame[i] + currentFrame[i + 1] + currentFrame[i + 2]) / 3;

      if (Math.abs(prevGray - currGray) > this.pixelThreshold) {
        changedPixels++;
      }
    }

    // Store current frame for next comparison
    this.previousFrame = new Uint8ClampedArray(currentFrame);

    // Calculate motion score
    const motionScore = changedPixels / totalPixels;
    const hasMotion = motionScore > this.motionThreshold;

    return {
      hasPresence: hasMotion,
      faceCount: hasMotion ? 1 : 0,
      confidence: Math.min(motionScore * 10, 1.0)  // Scale up for visibility
    };
  }

  dispose(): void {
    this.canvas = null;
    this.ctx = null;
    this.previousFrame = null;
  }
}

export class PresenceDetector extends EventTarget {
  private video: HTMLVideoElement | null = null;
  private detector: FaceDetector | null = null;
  private detectorType: 'blazeface' | 'motion' = 'blazeface';
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
      // Phase 1: Get camera stream
      console.log('Requesting camera access...');
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 320 },
          height: { ideal: 240 }
        }
      });
      console.log('Camera stream obtained');

      this.video.srcObject = this.stream;

      // Phase 2: Wait for video metadata with race condition fix and timeout
      console.log('Waiting for video metadata...');
      await Promise.race([
        new Promise<void>((resolve) => {
          // Fix race condition: check if metadata already loaded
          // readyState >= 1 means HAVE_METADATA
          if (this.video!.readyState >= 1) {
            console.log('Video metadata already loaded (readyState:', this.video!.readyState, ')');
            resolve();
          } else {
            this.video!.onloadedmetadata = () => {
              console.log('Video metadata loaded via event');
              resolve();
            };
          }
        }),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Video metadata load timeout (10s)')), 10000)
        )
      ]);

      // Ensure video is playing
      await this.video.play();
      console.log('Video playback started');

      // Phase 3: Try BlazeFace first, fall back to motion detection
      try {
        console.log('Attempting BlazeFace initialization...');
        const blazeFaceDetector = new BlazeFaceDetector(this.minConfidence);
        await blazeFaceDetector.initialize();

        // Warm up the model
        console.log('Warming up BlazeFace model...');
        await blazeFaceDetector.detect(this.video);
        console.log('BlazeFace model warmed up');

        this.detector = blazeFaceDetector;
        this.detectorType = 'blazeface';
        console.log('Using BlazeFace for face detection');
      } catch (blazeError) {
        console.warn('BlazeFace initialization failed, falling back to motion detection:', blazeError);

        // Use motion detection fallback
        const motionDetector = new MotionDetector(this.minConfidence);
        await motionDetector.initialize();

        this.detector = motionDetector;
        this.detectorType = 'motion';
        console.log('Using motion detection (fallback)');
      }

      this.dispatchEvent(new CustomEvent('initialized', {
        detail: { detectorType: this.detectorType }
      }));
    } catch (error) {
      console.error('Failed to initialize presence detector:', error);
      // Clean up stream if we got one
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }
      if (this.video) {
        this.video.srcObject = null;
      }
      this.dispatchEvent(new CustomEvent('error', { detail: error }));
      throw error;
    }
  }

  getDetectorType(): string {
    return this.detectorType;
  }

  start(): void {
    if (!this.detector || !this.video) {
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
    if (!this.isDetecting || !this.detector || !this.video) {
      return;
    }

    try {
      const result = await this.detector.detect(this.video);
      const hasPresence = result.hasPresence;

      if (hasPresence) {
        this.presenceCounter++;
        this.absenceCounter = 0;

        if (!this.currentPresence && this.presenceCounter >= this.presenceThreshold) {
          this.currentPresence = true;
          this.dispatchEvent(new CustomEvent('presenceDetected', {
            detail: {
              faceCount: result.faceCount,
              confidence: result.confidence
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
          faceCount: result.faceCount,
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

    if (this.detector) {
      this.detector.dispose();
      this.detector = null;
    }
  }
}
