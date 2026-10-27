import { content } from './content';
import type { Stage } from './types';

/** GDD §5: fry 0–24 h, juvenile 24–72 h, adult ≥ 72 h. */
export function stageOf(ageH: number): Stage {
  const { juvenileAtH, adultAtH } = content.balance.stages;
  if (ageH >= adultAtH) return 'adult';
  if (ageH >= juvenileAtH) return 'juvenile';
  return 'fry';
}

/** GDD §3 stageFactor: fry 0.2, juvenile 0.5, adult 1.0. */
export function stageFactor(ageH: number): number {
  return content.balance.tank.stageFactor[stageOf(ageH)];
}
