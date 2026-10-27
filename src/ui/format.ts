import { clockOf, gameDay } from '../sim/time';

export const rupees = (n: number) => `₹${Math.floor(n).toLocaleString('en-IN')}`;

export function dayClock(gameHours: number): string {
  const { hh, mm } = clockOf(gameHours);
  return `Day ${gameDay(gameHours)} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
