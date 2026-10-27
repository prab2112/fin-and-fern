import { describe, expect, it } from 'vitest';
import { applyAction } from '../../src/sim/actions';
import { newGame } from '../../src/sim/newGame';
import { createRng } from '../../src/sim/rng';
import { tick } from '../../src/sim/tick';
import type { GameState } from '../../src/sim/types';
import { decodeExport, encodeExport } from '../../src/save/exportCode';
import { CURRENT_VERSION, migrate, type Migrations } from '../../src/save/migrations';
import { deserialize, serialize } from '../../src/save/save';
import { loadNewest, writeSlot, SLOT_COUNT, type KeyValueStorage } from '../../src/save/slots';

const played = (): GameState => {
  const rng = createRng(5);
  let s = newGame(5);
  s = applyAction(s, { type: 'debugSpawnFish', tankId: 2, speciesId: 'guppy', count: 7 }, rng);
  s = tick(s, 30, rng);
  s = applyAction(s, { type: 'feed', tankId: 1 }, rng);
  return s;
};

const memoryStorage = (): KeyValueStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v) };
};

describe('save round-trip (GDD §15)', () => {
  it('serialize → deserialize gives back the same state (events are not saved)', () => {
    const s = played();
    const back = deserialize(serialize(s, 1000));
    expect(back).toEqual({ ...s, events: [] });
  });

  it('the saved JSON carries the version and the save time', () => {
    const raw = JSON.parse(serialize(played(), 1234)) as { version: number; savedAtMs: number };
    expect(raw.version).toBe(CURRENT_VERSION);
    expect(raw.savedAtMs).toBe(1234);
  });

  it('rejects invalid saves', () => {
    expect(() => deserialize('not json')).toThrow();
    expect(() =>
      deserialize(JSON.stringify({ version: 1, savedAtMs: 0, state: { money: 'lots' } })),
    ).toThrow();
    expect(() => deserialize(JSON.stringify({ version: 99, savedAtMs: 0, state: {} }))).toThrow(
      /newer/,
    );
  });

  it('a reloaded game continues identically (rng state is saved)', () => {
    const s = played();
    const a = tick(
      applyAction(
        s,
        { type: 'debugSpawnFish', tankId: 2, speciesId: 'guppy', count: 3 },
        createRng(0, s.rngState),
      ),
      5,
      createRng(0, s.rngState),
    );
    const r = deserialize(serialize(s, 0));
    const b = tick(
      applyAction(
        r,
        { type: 'debugSpawnFish', tankId: 2, speciesId: 'guppy', count: 3 },
        createRng(0, r.rngState),
      ),
      5,
      createRng(0, r.rngState),
    );
    expect(b).toEqual(a);
  });
});

describe('migration chain', () => {
  it('is a no-op at the current version', () => {
    const state = { ...played(), events: [] };
    expect(migrate({ version: CURRENT_VERSION, state })).toEqual({
      version: CURRENT_VERSION,
      state,
    });
  });

  it('runs every step in order up to the target version', () => {
    const chain: Migrations = {
      1: (s) => ({ ...(s as object), a: 1 }),
      2: (s) => ({ ...(s as object), b: 2 }),
    };
    expect(migrate({ version: 1, state: {} }, chain, 3)).toEqual({
      version: 3,
      state: { a: 1, b: 2 },
    });
    expect(migrate({ version: 2, state: {} }, chain, 3)).toEqual({ version: 3, state: { b: 2 } });
  });

  it('fails when a step is missing', () => {
    expect(() => migrate({ version: 1, state: {} }, {}, 2)).toThrow(/migrate_v1_to_v2/);
  });
});

describe('rotating slots', () => {
  it(`rotates writes across ${SLOT_COUNT} slots and loads the newest`, () => {
    const store = memoryStorage();
    const s = played();
    for (let i = 1; i <= 4; i++) writeSlot(store, { ...s, money: i }, i * 1000);
    const slotKeys = [...store.data.keys()].filter((k) => k.startsWith('finfern.save.slot'));
    expect(slotKeys).toHaveLength(3);
    expect(loadNewest(store)?.money).toBe(4);
  });

  it('skips a corrupt slot and falls back to the newest valid one', () => {
    const store = memoryStorage();
    const s = played();
    writeSlot(store, { ...s, money: 1 }, 1000);
    writeSlot(store, { ...s, money: 2 }, 2000);
    const newestKey = [...store.data.entries()].find(([, v]) =>
      v.includes('"savedAtMs":2000'),
    )?.[0];
    store.set(newestKey as string, '{"version":1,"savedAtMs":9999,"state":{broken');
    expect(loadNewest(store)?.money).toBe(1);
  });

  it('returns null with no saves', () => {
    expect(loadNewest(memoryStorage())).toBeNull();
  });
});

describe('export / import code', () => {
  it('round-trips through a base64 string', () => {
    const s = played();
    const code = encodeExport(s, 42);
    expect(code).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(decodeExport(code)).toEqual({ ...s, events: [] });
  });

  it('ignores surrounding whitespace and rejects junk', () => {
    const s = played();
    expect(decodeExport(`  ${encodeExport(s, 1)}\n`)).toEqual({ ...s, events: [] });
    expect(() => decodeExport('hello')).toThrow();
  });
});
