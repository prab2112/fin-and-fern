import { content } from './content';
import type { Species } from '../content/schema';
import type { Rng } from './rng';
import type { FishGenes } from './types';

/**
 * GDD §5 wholesale gene pool: both alleles dominant, except a 10% chance per locus that one
 * allele is a random recessive.
 */
export function wholesaleGenes(species: Species, rng: Rng): FishGenes {
  const chance = content.balance.wholesale.recessiveChancePerLocus;
  const pairs = species.loci.map((locus): [string, string] => {
    const [dominant, ...recessive] = locus.alleles.map((a) => a.id);
    const d = dominant as string;
    if (recessive.length > 0 && rng.next() < chance) return [d, rng.pick(recessive)];
    return [d, d];
  });
  const [locus1, locus2] = pairs;
  if (!locus1) throw new Error(`${species.id} has no loci`);
  return locus2 ? { locus1, locus2 } : { locus1 };
}
