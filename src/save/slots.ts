import type { GameState } from '../sim/types';
import { deserializeWithTime, serialize } from './save';

/** Minimal synchronous key-value store (implemented in src/platform/storage.ts). */
export interface KeyValueStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export const SLOT_COUNT = 3;
const slotKey = (i: number) => `finfern.save.slot${i}`;
const LAST_KEY = 'finfern.save.last';

/** GDD §15: writes rotate across 3 slots. */
export function writeSlot(storage: KeyValueStorage, state: GameState, nowMs: number): void {
  const last = Number(storage.get(LAST_KEY) ?? -1);
  const next = Number.isInteger(last) && last >= 0 ? (last + 1) % SLOT_COUNT : 0;
  storage.set(slotKey(next), serialize(state, nowMs));
  storage.set(LAST_KEY, String(next));
}

/** GDD §15: load takes the newest slot that parses and validates. */
export function loadNewest(storage: KeyValueStorage): GameState | null {
  let best: { state: GameState; savedAtMs: number } | null = null;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const raw = storage.get(slotKey(i));
    if (!raw) continue;
    try {
      const s = deserializeWithTime(raw);
      if (!best || s.savedAtMs > best.savedAtMs) best = s;
    } catch {
      // Corrupt or invalid slot: skip it.
    }
  }
  return best?.state ?? null;
}
