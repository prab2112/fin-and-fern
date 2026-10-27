import type { GameState } from '../sim/types';
import { CURRENT_VERSION, migrate } from './migrations';
import { envelopeSchema, stateV1Schema } from './schema';

/** JSON for one save. Events are transient and not stored. */
export function serialize(state: GameState, savedAtMs: number): string {
  const { events: _events, ...rest } = state;
  return JSON.stringify({ version: CURRENT_VERSION, savedAtMs, state: rest });
}

/** Parses, migrates and validates a save. Throws on anything invalid. */
export function deserializeWithTime(json: string): { state: GameState; savedAtMs: number } {
  const envelope = envelopeSchema.parse(JSON.parse(json));
  const { state } = migrate(envelope);
  return { state: { ...stateV1Schema.parse(state), events: [] }, savedAtMs: envelope.savedAtMs };
}

export function deserialize(json: string): GameState {
  return deserializeWithTime(json).state;
}
