/** GDD §1: a daily probability P becomes p = 1 − (1 − P)^(stepH / 24). */
export function perStepProbability(pDaily: number, stepH: number): number {
  return 1 - (1 - pDaily) ** (stepH / 24);
}

/**
 * Fixed-step accumulator (GDD §1). `acc` is in game hours.
 * Adds realDtS × speed / realSecondsPerGameHour and returns how many whole steps to run.
 */
export function advanceAccumulator(
  acc: number,
  realDtS: number,
  speed: number,
  realSecondsPerGameHour: number,
  stepH: number,
): { steps: number; acc: number } {
  if (speed <= 0) return { steps: 0, acc };
  const total = acc + (realDtS * speed) / realSecondsPerGameHour;
  // Small epsilon so 1 s at 1× gives exactly one 0.1 h step despite float error.
  const steps = Math.floor(total / stepH + 1e-9);
  return { steps, acc: Math.max(0, total - steps * stepH) };
}

export function gameDay(gameHours: number): number {
  return Math.floor(gameHours / 24) + 1;
}

export function clockOf(gameHours: number): { hh: number; mm: number } {
  const inDay = gameHours - Math.floor(gameHours / 24) * 24;
  const totalMin = Math.floor(inDay * 60 + 1e-6);
  return { hh: Math.floor(totalMin / 60), mm: totalMin % 60 };
}
