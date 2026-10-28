/**
 * Adaptive quality (GDD §14). The renderer reports every frame; when the device can't hold
 * 48 fps over a 2 s window, quality steps down one level (light and plants refresh less often,
 * less haze, fine detail only on larger fish; at 0 no moving light, motes or shadows). After 10 s
 * of smooth frames it steps back up; a step up that doesn't hold backs off for a minute.
 * A long gap between frames is a pause (app in the background, a one-off build), not a slow
 * device: it restarts the measurement instead of counting against the device.
 */
export const QUALITY_MAX = 2;

const WINDOW_MS = 2000;
const DOWN_FPS = 48;
const UP_FPS = 58;
const UP_AFTER_MS = 10_000;
const UP_BACKOFF_MS = 60_000;
/** A failed step up is one that drops again within this long. */
const FAILED_UP_MS = WINDOW_MS * 3;
/** Frames further apart than this are a pause, not slowness. */
const PAUSE_MS = 250;

// Slots in the timing array (doubles written in place: no per-frame allocation).
const WINDOW_START = 0;
const LAST = 1;
const SMOOTH = 2;
const STEPPED_UP_AT = 3;
const BLOCKED_UNTIL = 4;

export class QualityGovernor {
  quality = QUALITY_MAX;
  private frames = 0;
  private readonly t = new Float64Array(5);

  constructor(now: number) {
    this.t[WINDOW_START] = now;
    this.t[LAST] = now;
    this.t[STEPPED_UP_AT] = -Infinity;
  }

  /** Call once per frame; returns the quality level to draw at. */
  frame(now: number): number {
    const t = this.t;
    const gap = now - (t[LAST] as number);
    t[LAST] = now;
    if (gap > PAUSE_MS) {
      t[WINDOW_START] = now;
      this.frames = 0;
      return this.quality;
    }
    this.frames++;
    const span = now - (t[WINDOW_START] as number);
    if (span < WINDOW_MS) return this.quality;

    const fps = (this.frames * 1000) / span;
    if (fps < DOWN_FPS && this.quality > 0) {
      if (now - (t[STEPPED_UP_AT] as number) < FAILED_UP_MS) t[BLOCKED_UNTIL] = now + UP_BACKOFF_MS;
      this.quality--;
      t[SMOOTH] = 0;
    } else if (fps >= UP_FPS) {
      t[SMOOTH] = (t[SMOOTH] as number) + span;
      if (
        (t[SMOOTH] as number) >= UP_AFTER_MS &&
        this.quality < QUALITY_MAX &&
        now >= (t[BLOCKED_UNTIL] as number)
      ) {
        this.quality++;
        t[STEPPED_UP_AT] = now;
        t[SMOOTH] = 0;
      }
    } else t[SMOOTH] = 0;
    this.frames = 0;
    t[WINDOW_START] = now;
    return this.quality;
  }
}
