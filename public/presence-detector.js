// public/presence-detector.ts
var PresenceDetector = class extends EventTarget {
  video = null;
  model = null;
  isDetecting = false;
  detectionInterval;
  absenceThreshold;
  presenceThreshold;
  minConfidence;
  detectionTimer = null;
  absenceCounter = 0;
  presenceCounter = 0;
  currentPresence = false;
  stream = null;
  constructor(config = {}) {
    super();
    this.detectionInterval = config.detectionInterval || 1e3;
    this.absenceThreshold = config.absenceThreshold || 3;
    this.presenceThreshold = config.presenceThreshold || 1;
    this.minConfidence = config.minConfidence || 0.7;
  }
  async initialize(videoElement) {
    this.video = videoElement;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: {
            ideal: 320
          },
          height: {
            ideal: 240
          }
        }
      });
      this.video.srcObject = this.stream;
      await new Promise((resolve) => {
        this.video.onloadedmetadata = resolve;
      });
      console.log("Loading BlazeFace model...");
      this.model = await blazeface.load();
      console.log("BlazeFace model loaded successfully");
      this.dispatchEvent(new CustomEvent("initialized"));
    } catch (error) {
      console.error("Failed to initialize presence detector:", error);
      this.dispatchEvent(new CustomEvent("error", {
        detail: error
      }));
      throw error;
    }
  }
  start() {
    if (!this.model || !this.video) {
      console.error("Presence detector not initialized");
      return;
    }
    if (this.isDetecting) {
      return;
    }
    this.isDetecting = true;
    this.runDetection();
    this.dispatchEvent(new CustomEvent("started"));
  }
  stop() {
    this.isDetecting = false;
    if (this.detectionTimer) {
      clearTimeout(this.detectionTimer);
      this.detectionTimer = null;
    }
    this.dispatchEvent(new CustomEvent("stopped"));
  }
  async runDetection() {
    if (!this.isDetecting) {
      return;
    }
    try {
      const predictions = await this.model.estimateFaces(this.video, false);
      const hasPresence = predictions.length > 0 && predictions.some((pred) => pred.probability[0] >= this.minConfidence);
      if (hasPresence) {
        this.presenceCounter++;
        this.absenceCounter = 0;
        if (!this.currentPresence && this.presenceCounter >= this.presenceThreshold) {
          this.currentPresence = true;
          this.dispatchEvent(new CustomEvent("presenceDetected", {
            detail: {
              faceCount: predictions.length,
              confidence: Math.max(...predictions.map((p) => p.probability[0]))
            }
          }));
        }
      } else {
        this.absenceCounter++;
        this.presenceCounter = 0;
        if (this.currentPresence && this.absenceCounter >= this.absenceThreshold) {
          this.currentPresence = false;
          this.dispatchEvent(new CustomEvent("absenceDetected"));
        }
      }
      this.dispatchEvent(new CustomEvent("detection", {
        detail: {
          hasPresence,
          faceCount: predictions.length,
          currentPresence: this.currentPresence
        }
      }));
    } catch (error) {
      console.error("Detection error:", error);
      this.dispatchEvent(new CustomEvent("error", {
        detail: error
      }));
    }
    this.detectionTimer = window.setTimeout(() => {
      this.runDetection();
    }, this.detectionInterval);
  }
  isPresent() {
    return this.currentPresence;
  }
  dispose() {
    this.stop();
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
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
};
export {
  PresenceDetector
};
