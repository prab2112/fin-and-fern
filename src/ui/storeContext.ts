import { createContext, useContext } from 'react';
import type { GameStore, Store } from '../state/store';

export interface AppServices {
  store: GameStore;
  /** Writes the current game to a save slot now. */
  saveNow: () => void;
  nowMs: () => number;
}

export const ServicesContext = createContext<AppServices | null>(null);

export function useServices(): AppServices {
  const s = useContext(ServicesContext);
  if (!s) throw new Error('ServicesContext missing');
  return s;
}

/** Subscribes to a slice of the store. Return primitives or stable references. */
export function useGame<T>(selector: (s: Store) => T): T {
  return useServices().store(selector);
}
