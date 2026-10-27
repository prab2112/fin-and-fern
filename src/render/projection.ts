/**
 * Tank space → screen (GDD §14). The tank is a 3D box seen through the front glass:
 *   x: 0 (left) → w (right), y: 0 (rim) → h (bottom), z: 0 (front glass) → depth (back wall),
 * all in CSS px measured at the front glass. Things further back are drawn smaller, toward a
 * vanishing point slightly above the middle, so the gravel floor and the underside of the water
 * surface show as bands. One mutable View per renderer; nothing here allocates.
 */
export interface View {
  w: number;
  h: number;
  /** Tank depth in px. */
  depth: number;
  eyeX: number;
  eyeY: number;
  /** Perspective strength: scale at the back wall is 1 / (1 + persp). */
  persp: number;
  /** World y of the water line (just below the rim). */
  surface: number;
  /** World y of the gravel surface at the front glass and at the back wall (it slopes up). */
  floorFront: number;
  floorBack: number;
}

export function makeView(): View {
  return {
    w: 1,
    h: 1,
    depth: 1,
    eyeX: 0,
    eyeY: 0,
    persp: 0.4,
    surface: 0,
    floorFront: 1,
    floorBack: 1,
  };
}

/** Lays the view out for a canvas of w × h CSS px. */
export function resizeView(v: View, w: number, h: number): void {
  v.w = w;
  v.h = h;
  v.depth = w * 0.62;
  v.eyeX = w * 0.5;
  v.eyeY = h * 0.4;
  v.persp = 0.4;
  v.surface = h * 0.045;
  v.floorFront = h * 0.915;
  v.floorBack = h * 0.855;
}

/** Perspective scale at depth z (1 at the front glass). */
export function scaleAt(v: View, z: number): number {
  return 1 / (1 + (v.persp * z) / v.depth);
}

export function screenX(v: View, x: number, z: number): number {
  return v.eyeX + (x - v.eyeX) * scaleAt(v, z);
}

export function screenY(v: View, y: number, z: number): number {
  return v.eyeY + (y - v.eyeY) * scaleAt(v, z);
}

/** World x at depth z that projects to screen x `sx` (inverse of screenX). */
export function worldX(v: View, sx: number, z: number): number {
  return v.eyeX + (sx - v.eyeX) / scaleAt(v, z);
}

/** World y of the gravel surface at depth z. */
export function floorY(v: View, z: number): number {
  return v.floorFront + (v.floorBack - v.floorFront) * (z / v.depth);
}
