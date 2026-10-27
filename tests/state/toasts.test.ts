import { describe, expect, it } from 'vitest';
import { newGame } from '../../src/sim/newGame';
import { toastsFor } from '../../src/state/toasts';

describe('event → toast text', () => {
  const s = newGame(1);

  it('death is gentle and names the tank', () => {
    const t = toastsFor([{ type: 'death', tankId: 1, fishId: 3, speciesId: 'guppy' }], s);
    expect(t).toEqual([{ tone: 'sad', text: 'A Guppy passed away in Tank A.' }]);
  });

  it('alerts and rejections', () => {
    expect(
      toastsFor([{ type: 'alert', kind: 'hunger', tankId: s.tanks[1]?.id ?? -1 }], s)[0]?.text,
    ).toBe('Tank B is hungry.');
    expect(toastsFor([{ type: 'alert', kind: 'wq', tankId: 1 }], s)[0]?.text).toBe(
      'Tank A water is getting dirty.',
    );
    expect(toastsFor([{ type: 'alert', kind: 'hp', tankId: 1, fishId: 3 }], s)[0]?.text).toBe(
      'A fish in Tank A is sick.',
    );
    expect(toastsFor([{ type: 'rejected', action: 'feed', reason: 'noFood' }], s)[0]?.text).toBe(
      'Out of food.',
    );
    expect(toastsFor([{ type: 'rejected', action: 'feed', reason: 'empty' }], s)[0]?.text).toBe(
      'No fish to feed here.',
    );
  });

  it('collapses repeated toasts within one batch', () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      type: 'death' as const,
      tankId: 1,
      fishId: i,
      speciesId: 'guppy',
    }));
    expect(toastsFor(many, s)).toEqual([{ tone: 'sad', text: '5 fish passed away in Tank A.' }]);
  });
});
