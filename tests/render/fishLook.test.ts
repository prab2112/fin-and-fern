import { describe, expect, it } from 'vitest';
import { content } from '../../src/content';
import { allPhenotypeFish, lookFor, SHAPES } from '../../src/render/fishLook';

describe('fish looks', () => {
  it('every species has a shape', () => {
    for (const s of content.species) expect(SHAPES[s.id], s.id).toBeDefined();
  });

  it('every phenotype × sex resolves to valid colours (68 phenotypes × 2 sexes)', () => {
    const fish = allPhenotypeFish();
    expect(fish).toHaveLength(68 * 2);
    for (const f of fish) {
      const look = lookFor(f);
      for (const c of [look.body, look.belly, look.fin, look.eye, look.accent, look.accent2])
        expect(c, `${f.speciesId} ${f.genes.locus1.join('/')}`).toMatch(/^#[0-9a-f]{6}$/);
      expect(look.finMul).toBeGreaterThan(0);
    }
  });

  it('morphs change shape, not just colour', () => {
    const pick = (species: string, l1: string, l2: string | undefined, sex: 'F' | 'M') => {
      const f = allPhenotypeFish().find(
        (x) =>
          x.speciesId === species &&
          x.genes.locus1[0] === l1 &&
          x.genes.locus2?.[0] === l2 &&
          x.sex === sex,
      );
      if (!f) throw new Error(`${species} ${l1} ${l2}`);
      return lookFor(f);
    };
    expect(pick('guppy', 'wild', 'fancy', 'M').finMul).toBeGreaterThan(
      pick('guppy', 'wild', 'normal', 'M').finMul,
    );
    expect(pick('goldfish', 'orange', 'fantail', 'F').tail).toBe('double');
    expect(pick('betta', 'red', 'halfmoon', 'M').tail).toBe('halfmoon');
    expect(pick('swordtail', 'green', 'normal', 'M').sword).toBe(true);
    expect(pick('swordtail', 'green', 'normal', 'F').sword).toBe(false);
    expect(pick('flowerhorn', 'classic', 'bigkok', 'M').hump).toBeGreaterThan(
      pick('flowerhorn', 'classic', 'small', 'M').hump,
    );
    expect(pick('molly', 'black', 'balloon', 'F').bellyMul).toBeGreaterThan(1);
    expect(pick('discus', 'brown', 'snakeskin', 'F').pattern2).toBe('snakeskin');
    expect(pick('platy', 'wild', 'hifin', 'F').dorsal).toBe('sail');
  });
});
