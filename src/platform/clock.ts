/** Wall-clock adapter. src/sim never imports this. */
export interface Clock {
  /** Epoch ms (save timestamps; real-day logic from M4). */
  nowMs(): number;
  /** Monotonic ms for frame timing. */
  monotonicMs(): number;
}

export const webClock: Clock = {
  nowMs: () => Date.now(),
  monotonicMs: () => performance.now(),
};
