import { content } from '../content';
import type { Clock } from '../platform/clock';
import type { Lifecycle } from '../platform/lifecycle';
import { advanceAccumulator } from '../sim/time';
import type { GameStore } from './store';

/** Longest real frame gap we simulate; a longer gap (tab switch, debugger) is dropped. */
const MAX_FRAME_S = 0.25;

/**
 * Fixed-step sim loop (GDD §1): accumulates realDt × speed / 10 game hours and runs whole
 * 0.1 h steps. The sim clock stops while the page is hidden.
 */
export function startSimLoop(store: GameStore, clock: Clock, lifecycle: Lifecycle): () => void {
  const { simStepH, realSecondsPerGameHour } = content.balance.time;
  let acc = 0;
  let last = clock.monotonicMs();
  let raf = 0;
  let running = true;

  const frame = () => {
    if (!running) return;
    const now = clock.monotonicMs();
    const dt = Math.min(MAX_FRAME_S, (now - last) / 1000);
    last = now;
    const r = advanceAccumulator(
      acc,
      dt,
      store.getState().game.speed,
      realSecondsPerGameHour,
      simStepH,
    );
    acc = r.acc;
    if (r.steps > 0) store.getState().advance(r.steps);
    raf = requestAnimationFrame(frame);
  };

  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };
  const resume = () => {
    if (!running || raf) return;
    last = clock.monotonicMs();
    raf = requestAnimationFrame(frame);
  };

  const offHidden = lifecycle.onHidden(stop);
  const offVisible = lifecycle.onVisible(resume);
  if (!lifecycle.isHidden()) resume();

  return () => {
    running = false;
    stop();
    offHidden();
    offVisible();
  };
}
