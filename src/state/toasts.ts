import { content } from '../content';
import type { GameState, SimEvent } from '../sim/types';

export type ToastTone = 'info' | 'warn' | 'sad';
export interface ToastSpec {
  tone: ToastTone;
  text: string;
}

const REJECT_TEXT: Record<string, string> = {
  noFood: 'Out of food.',
  empty: 'No fish to feed here.',
  cooldown: 'Water change needs a game hour to settle.',
  noHeater: 'This tank has no heater.',
};

/** Turns one batch of sim events into toast texts (GDD §13 Toasts, §4 gentle death toast). */
export function toastsFor(events: readonly SimEvent[], state: GameState): ToastSpec[] {
  const tankName = (id: number) => state.tanks.find((t) => t.id === id)?.name ?? 'a tank';
  const out: ToastSpec[] = [];
  const deathsByTank = new Map<number, { n: number; speciesId: string }>();
  const seen = new Set<string>();
  const push = (key: string, spec: ToastSpec) => {
    if (seen.has(key)) return;
    seen.add(key);
    out.push(spec);
  };

  for (const e of events) {
    if (e.type === 'death') {
      const d = deathsByTank.get(e.tankId);
      deathsByTank.set(e.tankId, { n: (d?.n ?? 0) + 1, speciesId: e.speciesId });
    } else if (e.type === 'alert') {
      const name = tankName(e.tankId);
      const text =
        e.kind === 'hunger'
          ? `${name} is hungry.`
          : e.kind === 'wq'
            ? `${name} water is getting dirty.`
            : `A fish in ${name} is sick.`;
      push(`alert:${e.kind}:${e.tankId}`, { tone: 'warn', text });
    } else {
      push(`rejected:${e.reason}`, {
        tone: 'info',
        text: REJECT_TEXT[e.reason] ?? 'Not possible right now.',
      });
    }
  }
  for (const [tankId, d] of deathsByTank) {
    const species = content.speciesById[d.speciesId]?.name ?? 'fish';
    const text =
      d.n === 1
        ? `A ${species} passed away in ${tankName(tankId)}.`
        : `${d.n} fish passed away in ${tankName(tankId)}.`;
    out.unshift({ tone: 'sad', text });
  }
  return out;
}
