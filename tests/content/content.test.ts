import { describe, expect, it } from 'vitest';
import balanceJson from '../../src/content/balance.json';
import equipmentJson from '../../src/content/equipment.json';
import plantsJson from '../../src/content/plants.json';
import speciesJson from '../../src/content/species.json';
import startJson from '../../src/content/start.json';
import tanksJson from '../../src/content/tanks.json';
import { content, crossCheck, parseContent } from '../../src/content';
import {
  balanceFileSchema,
  equipmentFileSchema,
  plantsFileSchema,
  speciesFileSchema,
  startFileSchema,
  tanksFileSchema,
} from '../../src/content/schema';

describe('content files pass their schemas', () => {
  it.each([
    ['species.json', speciesFileSchema, speciesJson],
    ['equipment.json', equipmentFileSchema, equipmentJson],
    ['tanks.json', tanksFileSchema, tanksJson],
    ['plants.json', plantsFileSchema, plantsJson],
    ['start.json', startFileSchema, startJson],
    ['balance.json', balanceFileSchema, balanceJson],
  ] as const)('%s', (_name, schema, json) => {
    const r = schema.safeParse(json);
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues, null, 2)).toBe(true);
  });

  it('cross-references resolve', () => {
    expect(crossCheck(content)).toEqual([]);
  });

  it('rejects a broken file', () => {
    expect(() => parseContent({ ...rawFiles(), balance: { time: {} } })).toThrow();
  });
});

describe('species.json (GDD §5)', () => {
  it('has all 12 species with unique ids', () => {
    const ids = content.species.map((s) => s.id);
    expect(ids).toEqual([
      'guppy',
      'danio',
      'platy',
      'neon',
      'molly',
      'swordtail',
      'goldfish',
      'betta',
      'angel',
      'discus',
      'flowerhorn',
      'arowana',
    ]);
  });

  it('11 breedable species × 6 phenotypes + 2 arowana variants = 68 Aquadex entries', () => {
    const entries = content.species.reduce(
      (n, s) => n + s.loci.reduce((m, l) => m * l.alleles.length, 1),
      0,
    );
    expect(entries).toBe(68);
  });

  it('matches the GDD guppy row and morph multipliers', () => {
    const g = content.speciesById.guppy;
    expect(g).toMatchObject({ size: 1, tempMin: 22, tempMax: 28, basePrice: 30, unlockLevel: 1 });
    expect(g?.loci[0]?.alleles.map((a) => [a.id, a.mult])).toEqual([
      ['wild', 1],
      ['blue', 1.5],
      ['albino', 4],
    ]);
    expect(g?.loci[1]?.alleles.map((a) => [a.id, a.mult])).toEqual([
      ['normal', 1],
      ['fancy', 2],
    ]);
  });

  it('every colour allele has render colours', () => {
    for (const s of content.species)
      for (const a of s.loci[0]?.alleles ?? []) {
        expect(a.body, `${s.id}.${a.id}`).toBeDefined();
        expect(a.fin, `${s.id}.${a.id}`).toBeDefined();
      }
  });

  it('discus is sensitive, betta territorial, flowerhorn solitary, danio/neon school 6', () => {
    const by = content.speciesById;
    expect(by.discus?.traits.sensitive).toBe(true);
    expect(by.betta?.traits.territorialMales).toBe(true);
    expect(by.flowerhorn?.traits.solitary).toBe(true);
    expect(by.danio?.traits.school).toBe(6);
    expect(by.neon?.traits.school).toBe(6);
  });
});

describe('start.json (GDD §2)', () => {
  it('starts with ₹1,000, 50 food, two 40 L tanks and 4 guppies in Tank A', () => {
    const s = content.start;
    expect(s.money).toBe(1000);
    expect(s.food).toBe(50);
    expect(s.tanks.map((t) => content.tankTypeById[t.tankType]?.volumeL)).toEqual([40, 40]);
    expect(s.tanks[0]?.fish).toHaveLength(4);
    expect(s.tanks[0]?.plants).toEqual([
      { plantId: 'javafern', mass: 1 },
      { plantId: 'javafern', mass: 1 },
    ]);
    expect(s.tanks[1]?.fish).toHaveLength(0);
    expect(s.fish).toEqual({ hp: 100, hunger: 20, ageH: 72 });
  });
});

function rawFiles() {
  return {
    species: speciesJson,
    equipment: equipmentJson,
    tanks: tanksJson,
    plants: plantsJson,
    start: startJson,
    balance: balanceJson,
  };
}
