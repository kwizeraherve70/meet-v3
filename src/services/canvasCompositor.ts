/**
 * CanvasCompositor
 *
 * Draws multiple participant MediaStreams onto a single <canvas> in a grid
 * layout and exposes canvas.captureStream() as a composited video track.
 *
 * Layout rules:
 *   1 stream  → full canvas
 *   2 streams → side-by-side (2×1)
 *   3–4       → 2×2 grid
 *   5–6       → 3×2 grid
 *   7–9       → 3×3 grid
 *   10+       → 4×N grid
 *
 * Each cell letterboxes the video (black bars) to preserve aspect ratio.
 */

interface CompositorStream {
  video: HTMLVideoElement;
  stream: MediaStream;
  // Cached letterbox rect — recomputed only when video dimensions or cell size change
  lastVW: number;
  lastVH: number;
  lastCellW: number;
  lastCellH: number;
  drawX: number;
  drawY: number;
  drawW: number;
  drawH: number;
}

export class CanvasCompositor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private streams: Map<string, CompositorStream> = new Map();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly width: number;
  private readonly height: number;

  // Cached grid state — recomputed only when ready-stream count changes
  private cachedReadyCount = -1;
  private cachedCols = 1;
  private cachedRows = 1;
  private cachedCellW = 0;
  private cachedCellH = 0;

  // Reusable buffer — avoids allocating a new array every frame
  private readyBuffer: CompositorStream[] = [];

  constructor(width = 1280, height = 720) {
    this.width = width;
    this.height = height;
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D canvas context');
    this.ctx = ctx;
    // Set once — reused every frame without reassignment
    this.ctx.fillStyle = '#000';
  }

  /**
   * Add a participant stream. Safe to call before or after start().
   */
  addStream(id: string, stream: MediaStream): void {
    if (this.streams.has(id)) return;

    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.muted = true; // audio is mixed separately via AudioContext
    video.playsInline = true;
    video.play().catch(() => {});

    this.streams.set(id, {
      video,
      stream,
      lastVW: -1,
      lastVH: -1,
      lastCellW: -1,
      lastCellH: -1,
      drawX: 0,
      drawY: 0,
      drawW: 0,
      drawH: 0,
    });
  }

  /**
   * Remove a participant stream (e.g. when they leave mid-recording).
   */
  removeStream(id: string): void {
    const entry = this.streams.get(id);
    if (!entry) return;
    entry.video.srcObject = null;
    this.streams.delete(id);
    // Force grid recompute on next frame
    this.cachedReadyCount = -1;
  }

  /**
   * Begin the render loop and return the composited video stream.
   *
   * Uses setInterval (not requestAnimationFrame) so the canvas keeps drawing
   * even when the browser tab is hidden or loses focus — which would otherwise
   * throttle rAF and freeze the recorded video while audio continues.
   *
   * @param fps Frames per second for canvas.captureStream (default 30)
   */
  start(fps = 30): MediaStream {
    const intervalMs = Math.floor(1000 / fps);
    this.intervalId = setInterval(() => this.draw(), intervalMs);
    this.draw(); // first frame immediately — avoids blank opening chunk
    return this.canvas.captureStream(fps);
  }

  /**
   * Stop the render loop and release all video elements.
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.streams.forEach(({ video }) => {
      video.srcObject = null;
    });
    this.streams.clear();
    this.readyBuffer.length = 0;
    this.cachedReadyCount = -1;
  }

  // ─── private ────────────────────────────────────────────────────────────────

  private draw(): void {
    const ctx = this.ctx;

    // Populate the reusable buffer without allocating a new array
    this.readyBuffer.length = 0;
    this.streams.forEach((entry) => {
      if (entry.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        this.readyBuffer.push(entry);
      }
    });

    ctx.fillRect(0, 0, this.width, this.height);

    const count = this.readyBuffer.length;
    if (count === 0) return;

    // Recompute grid dimensions only when the number of visible streams changes
    if (count !== this.cachedReadyCount) {
      this.cachedReadyCount = count;
      const { cols, rows } = this.gridLayout(count);
      this.cachedCols = cols;
      this.cachedRows = rows;
      this.cachedCellW = this.width / cols;
      this.cachedCellH = this.height / rows;
    }

    const { cachedCols, cachedCellW, cachedCellH } = this;

    for (let i = 0; i < count; i++) {
      const entry = this.readyBuffer[i];
      const { video } = entry;

      const cellX = (i % cachedCols) * cachedCellW;
      const cellY = Math.floor(i / cachedCols) * cachedCellH;

      const vw = video.videoWidth || cachedCellW;
      const vh = video.videoHeight || cachedCellH;

      // Recompute letterbox rect only when video intrinsic size or cell size changes
      if (
        vw !== entry.lastVW ||
        vh !== entry.lastVH ||
        cachedCellW !== entry.lastCellW ||
        cachedCellH !== entry.lastCellH
      ) {
        const scale = Math.min(cachedCellW / vw, cachedCellH / vh);
        entry.drawW = vw * scale;
        entry.drawH = vh * scale;
        entry.lastVW = vw;
        entry.lastVH = vh;
        entry.lastCellW = cachedCellW;
        entry.lastCellH = cachedCellH;
      }

      entry.drawX = cellX + (cachedCellW - entry.drawW) / 2;
      entry.drawY = cellY + (cachedCellH - entry.drawH) / 2;

      try {
        ctx.drawImage(video, entry.drawX, entry.drawY, entry.drawW, entry.drawH);
      } catch {
        // frame not yet decoded — skip silently
      }
    }
  }

  private gridLayout(count: number): { cols: number; rows: number } {
    if (count === 1) return { cols: 1, rows: 1 };
    if (count === 2) return { cols: 2, rows: 1 };
    if (count <= 4) return { cols: 2, rows: 2 };
    if (count <= 6) return { cols: 3, rows: 2 };
    if (count <= 9) return { cols: 3, rows: 3 };
    return { cols: 4, rows: Math.ceil(count / 4) };
  }
}
