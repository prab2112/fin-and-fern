import type { Clock } from '../platform/clock';
import type { Lifecycle } from '../platform/lifecycle';
import { writeSlot, type KeyValueStorage } from '../save/slots';
import type { GameStore } from './store';

const AUTOSAVE_INTERVAL_MS = 10_000;

/** GDD §15: autosave every 10 real seconds and on hidden / pagehide. */
export function startAutosave(
  store: GameStore,
  storage: KeyValueStorage,
  clock: Clock,
  lifecycle: Lifecycle,
): { stop: () => void; saveNow: () => void } {
  const saveNow = () => writeSlot(storage, store.getState().game, clock.nowMs());
  const maybeSave = () => {
    if (store.getState().autosaveEnabled) saveNow();
  };
  const timer = setInterval(maybeSave, AUTOSAVE_INTERVAL_MS);
  const offHidden = lifecycle.onHidden(maybeSave);
  return {
    saveNow,
    stop: () => {
      clearInterval(timer);
      offHidden();
    },
  };
}
