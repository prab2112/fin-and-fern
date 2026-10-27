import type { GameState } from '../sim/types';
import { deserialize, serialize } from './save';

/** GDD §15: export as a base64 string (UTF-8 safe). */
export function encodeExport(state: GameState, nowMs: number): string {
  const bytes = new TextEncoder().encode(serialize(state, nowMs));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Import validates and migrates. Throws on anything that isn't a valid save. */
export function decodeExport(code: string): GameState {
  const bin = atob(code.replace(/\s+/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return deserialize(new TextDecoder().decode(bytes));
}
