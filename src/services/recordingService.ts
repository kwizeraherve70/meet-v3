/**
 * Recording Service
 *
 * Records the full meeting room by:
 *  1. Compositing all participant video streams onto a canvas grid
 *     (via CanvasCompositor) — this produces one combined video track.
 *  2. Mixing all participant audio tracks into a single destination
 *     via the Web Audio API.
 *  3. Feeding the composite video + mixed audio into MediaRecorder.
 *
 * Pipeline:
 *   localStream + remoteStreams[]
 *     ├─ video tracks → CanvasCompositor → canvas.captureStream() → video track
 *     └─ audio tracks → AudioContext mixer → destination.stream → audio track
 *                                    ↓
 *                             MediaRecorder (.webm)
 *                                    ↓
 *                       Blob → upload to server or local download
 */
import { apiClient, API_BASE_URL } from '@/lib/api';
import { CanvasCompositor } from './canvasCompositor';

interface RecordingConfig {
  roomId: string;
  username: string;
}

interface RecordingState {
  isRecording: boolean;
  startTime: number | null;
  duration: number;
  mediaRecorder: MediaRecorder | null;
  recordedChunks: Blob[];
}

export class RecordingService {
  private recordingState: RecordingState = {
    isRecording: false,
    startTime: null,
    duration: 0,
    mediaRecorder: null,
    recordedChunks: [],
  };

  private durationInterval: NodeJS.Timeout | null = null;
  private config: RecordingConfig | null = null;
  private onDurationUpdateCallback: ((duration: number) => void) | null = null;

  // Resources that must be released after recording stops
  private audioContext: AudioContext | null = null;
  private compositor: CanvasCompositor | null = null;

  /**
   * Initialize recording service with room/user config.
   */
  init(config: RecordingConfig) {
    this.config = config;
  }

  /**
   * Start recording.
   *
   * @param streams Array of MediaStreams — index 0 is typically the local stream,
   *                the rest are remote participant streams.
   */
  async startRecording(streams: MediaStream[]): Promise<void> {
    if (this.recordingState.isRecording) {
      console.warn('Recording already in progress');
      return;
    }

    try {
      // ── 1. Mix all audio tracks ─────────────────────────────────────────────
      this.audioContext = new AudioContext();
      const audioDestination = this.audioContext.createMediaStreamDestination();

      streams.forEach((stream) => {
        stream.getAudioTracks().forEach((track) => {
          const source = this.audioContext!.createMediaStreamSource(
            new MediaStream([track])
          );
          source.connect(audioDestination);
        });
      });

      // ── 2. Compose all video streams on a canvas grid ───────────────────────
      this.compositor = new CanvasCompositor(1280, 720);
      streams.forEach((stream, index) => {
        this.compositor!.addStream(String(index), stream);
      });
      const canvasStream = this.compositor.start(30);

      // ── 3. Build final recording stream ─────────────────────────────────────
      const finalStream = new MediaStream();

      // One composited video track from the canvas
      canvasStream.getVideoTracks().forEach((track) => {
        finalStream.addTrack(track);
      });

      // One mixed audio track from the AudioContext destination
      audioDestination.stream.getAudioTracks().forEach((track) => {
        finalStream.addTrack(track);
      });

      // ── 4. Start MediaRecorder ───────────────────────────────────────────────
      const mimeType = this.getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(finalStream, {
        mimeType,
        videoBitsPerSecond: 2_500_000, // 2.5 Mbps
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordingState.recordedChunks.push(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
        this.stopRecording();
      };

      mediaRecorder.start(1000); // collect a chunk every second
      this.recordingState.mediaRecorder = mediaRecorder;
      this.recordingState.isRecording = true;
      this.recordingState.startTime = Date.now();
      this.recordingState.recordedChunks = [];

      this.startDurationTracking();
      console.log('Recording started — compositing', streams.length, 'stream(s)');
    } catch (error) {
      this.releaseResources();
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  /**
   * Stop recording and return the recorded Blob, or null if nothing was recorded.
   */
  async stopRecording(): Promise<Blob | null> {
    if (!this.recordingState.isRecording || !this.recordingState.mediaRecorder) {
      console.warn('No active recording');
      return null;
    }

    return new Promise((resolve) => {
      const mediaRecorder = this.recordingState.mediaRecorder!;

      mediaRecorder.onstop = () => {
        const mimeType = this.getSupportedMimeType();
        const blob = new Blob(this.recordingState.recordedChunks, {
          type: mimeType,
        });

        this.recordingState.isRecording = false;
        this.recordingState.startTime = null;
        this.recordingState.mediaRecorder = null;
        this.recordingState.recordedChunks = [];

        this.stopDurationTracking();
        this.releaseResources();

        console.log('Recording stopped — blob size:', blob.size, 'bytes');
        resolve(blob);
      };

      mediaRecorder.stop();
    });
  }

  /**
   * Get a snapshot of the current recording state.
   */
  getState(): RecordingState {
    return { ...this.recordingState };
  }

  /**
   * Register a callback that fires every second with the elapsed duration.
   */
  onDurationUpdate(callback: (duration: number) => void) {
    this.onDurationUpdateCallback = callback;
  }

  /**
   * Upload a recording Blob to the server.
   */
  async uploadRecording(blob: Blob, filename: string): Promise<string> {
    if (!this.config) {
      throw new Error('Recording service not initialized');
    }

    const formData = new FormData();
    formData.append('file', blob, filename);
    formData.append('roomId', this.config.roomId);
    formData.append('title', `Meeting Recording - ${this.config.username}`);
    formData.append('duration', this.recordingState.duration.toString());

    const token = apiClient.getAccessToken();
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/recordings/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload recording');
    }

    const data = await response.json();
    console.log('Recording uploaded:', data);
    return data.url;
  }

  /**
   * Trigger a browser download of the recording Blob.
   */
  downloadRecording(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Format a duration in seconds as HH:MM:SS.
   */
  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
  }

  /**
   * Stop any active recording and release all resources.
   * Call this on component unmount.
   */
  cleanup(): void {
    if (this.recordingState.isRecording) {
      this.stopRecording();
    }
    this.stopDurationTracking();
    this.releaseResources();
  }

  // ─── private ────────────────────────────────────────────────────────────────

  private getSupportedMimeType(): string {
    const candidates = [
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9,opus',
      'video/webm',
      'video/mp4',
    ];
    for (const type of candidates) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return 'video/webm';
  }

  private startDurationTracking(): void {
    this.stopDurationTracking();
    this.durationInterval = setInterval(() => {
      if (this.recordingState.startTime && this.recordingState.isRecording) {
        this.recordingState.duration = Math.floor(
          (Date.now() - this.recordingState.startTime) / 1000
        );
        this.onDurationUpdateCallback?.(this.recordingState.duration);
      }
    }, 1000);
  }

  private stopDurationTracking(): void {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
  }

  /**
   * Release the canvas compositor and AudioContext.
   * Safe to call multiple times.
   */
  private releaseResources(): void {
    this.compositor?.stop();
    this.compositor = null;
    this.audioContext?.close();
    this.audioContext = null;
  }
}

// Singleton instance used throughout the app
export const recordingService = new RecordingService();
