import { describe, expect, it } from 'vitest';
import { content } from '../../src/content';
import { wholesaleGenes } from '../../src/sim/genetics';
import { createRng } from '../../src/sim/rng';

describe('wholesale gene pool (GDD §5)', () => {
  it('each locus carries one random recessive allele 10% of the time', () => {
    const guppy = content.speciesById.guppy;
    if (!guppy) throw new Error('guppy missing');
    const rng = createRng(11);
    const n = 100_000;
    let colourRecessive = 0;
    let tailRecessive = 0;
    const recessiveColours = new Set<string>();
    for (let i = 0; i < n; i++) {
      const g = wholesaleGenes(guppy, rng);
      const c = g.locus1.filter((a) => a !== 'wild');
      if (c.length > 0) {
        colourRecessive++;
        expect(c).toHaveLength(1);
        recessiveColours.add(c[0] as string);
      }
      if (g.locus2?.some((a) => a !== 'normal')) tailRecessive++;
    }
    expect(colourRecessive / n).toBeCloseTo(0.1, 2);
    expect(tailRecessive / n).toBeCloseTo(0.1, 2);
    expect([...recessiveColours].sort()).toEqual(['albino', 'blue']);
  });
});
