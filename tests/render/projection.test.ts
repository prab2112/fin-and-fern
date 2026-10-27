import { describe, expect, it } from 'vitest';
import {
  floorY,
  makeView,
  resizeView,
  scaleAt,
  screenX,
  screenY,
  worldX,
} from '../../src/render/projection';

describe('tank projection', () => {
  const v = makeView();
  resizeView(v, 328, 450);

  it('the front glass maps 1:1 and the back wall is smaller', () => {
    expect(scaleAt(v, 0)).toBe(1);
    expect(scaleAt(v, v.depth)).toBeCloseTo(1 / 1.4, 9);
    expect(screenX(v, 10, 0)).toBe(10);
    expect(screenY(v, 300, 0)).toBe(300);
  });

  it('far things move toward the vanishing point', () => {
    expect(screenX(v, 0, v.depth)).toBeGreaterThan(0);
    expect(screenX(v, v.w, v.depth)).toBeLessThan(v.w);
    expect(screenX(v, v.eyeX, v.depth)).toBeCloseTo(v.eyeX, 9);
    // The gravel at the back shows higher on screen than at the front: a visible floor.
    expect(screenY(v, floorY(v, v.depth), v.depth)).toBeLessThan(floorY(v, 0) - 40);
    // The water surface at the back shows lower than at the front: its underside is visible.
    expect(screenY(v, v.surface, v.depth)).toBeGreaterThan(v.surface + 20);
  });

  it('worldX inverts screenX at any depth', () => {
    for (const z of [0, v.depth * 0.3, v.depth])
      expect(screenX(v, worldX(v, 77, z), z)).toBeCloseTo(77, 9);
  });

  it('the gravel slopes up toward the back', () => {
    expect(floorY(v, 0)).toBe(v.floorFront);
    expect(floorY(v, v.depth)).toBe(v.floorBack);
    expect(floorY(v, v.depth)).toBeLessThan(floorY(v, 0));
  });
});
