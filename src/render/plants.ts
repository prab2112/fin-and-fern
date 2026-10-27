import { createRng } from '../sim/rng';
import type { PlantInstance } from '../sim/types';
import { floorY, scaleAt, screenX, screenY, type View } from './projection';

/**
 * Plants in the open tank (GDD §14). Java Fern grows tied to driftwood: lance-shaped leaves on a
 * creeping rhizome, darker at the base, with a midrib and brown spore dots on older leaves.
 * Leaves sway in the filter current and scale with mass. Layout is deterministic per tank, so a
 * tank always looks the same; leaves are drawn in unit space so two cached gradients serve all.
 */
export const MAX_LEAVES = 16;
const MAX_ROOTS = 9;

export interface PlantView {
  plantId: string;
  mass: number;
  /** Base position on the gravel (world px). */
  x: number;
  z: number;
  leaves: number;
  angle: Float32Array;
  length: Float32Array;
  width: Float32Array;
  bend: Float32Array;
  phase: Float32Array;
  attach: Float32Array;
  sori: Uint8Array;
  /** 0 old outer leaf (shaded), 1 mature, 2 young inner leaf. */
  young: Uint8Array;
  rootX: Float32Array;
  rootLen: Float32Array;
  /** Driftwood under the rhizome (world px). */
  woodW: number;
  woodH: number;
  wood: HTMLCanvasElement | null;
  /** The whole plant (wood + leaves) cached as a sprite, redrawn every few frames as it sways. */
  sprite: HTMLCanvasElement | null;
  spriteCtx: CanvasRenderingContext2D | null;
  /** Sprite placement relative to the plant base, in CSS px. */
  spriteX: number;
  spriteY: number;
  spriteW: number;
  spriteH: number;
  spriteScale: number;
  frame: number;
}

const TAU = Math.PI * 2;

export function layoutPlants(
  plants: readonly PlantInstance[],
  tankId: number,
  v: View,
): PlantView[] {
  const n = plants.length;
  return plants.map((pl, i) => {
    const rng = createRng(tankId * 977 + i * 131 + 7);
    const r = () => rng.next();
    let x = v.w * (0.2 + (0.6 * (i + 0.5)) / Math.max(1, n) + (r() - 0.5) * 0.1);
    const z = v.depth * (0.5 + 0.32 * r());
    // Keep clear of the sponge filter in the back right corner.
    if (x > v.w * 0.7 && z > v.depth * 0.7) x = v.w * 0.62;
    const leaves = Math.max(3, Math.min(MAX_LEAVES, Math.round(5 + 4 * pl.mass)));
    const pv: PlantView = {
      plantId: pl.plantId,
      mass: pl.mass,
      x,
      z,
      leaves,
      angle: new Float32Array(MAX_LEAVES),
      length: new Float32Array(MAX_LEAVES),
      width: new Float32Array(MAX_LEAVES),
      bend: new Float32Array(MAX_LEAVES),
      phase: new Float32Array(MAX_LEAVES),
      attach: new Float32Array(MAX_LEAVES),
      sori: new Uint8Array(MAX_LEAVES),
      young: new Uint8Array(MAX_LEAVES),
      rootX: new Float32Array(MAX_ROOTS),
      rootLen: new Float32Array(MAX_ROOTS),
      woodW: v.w * 0.24 * (0.85 + 0.3 * r()),
      woodH: v.h * 0.045,
      wood: null,
      sprite: null,
      spriteCtx: null,
      spriteX: 0,
      spriteY: 0,
      spriteW: 0,
      spriteH: 0,
      spriteScale: 1,
      frame: i,
    };
    // Spread the leaves across the fan, then draw the outermost (oldest, drooping) first and
    // the inner young ones last, on top.
    const angles = Array.from(
      { length: leaves },
      (_, k) => ((k + 0.5) / leaves - 0.5) * 1.6 + (r() - 0.5) * 0.25,
    );
    angles.sort((x, y) => Math.abs(y) - Math.abs(x));
    angles.forEach((a, k) => {
      const out = Math.min(1, Math.abs(a));
      const young = out < 0.3;
      pv.angle[k] = a * 0.95;
      pv.length[k] = v.h * (0.2 + 0.1 * r()) * Math.sqrt(pl.mass) * (young ? 0.72 : 1);
      pv.width[k] = (0.14 + 0.08 * r()) * (young ? 0.85 : 1);
      // Outer leaves arch outward and droop at the tips.
      pv.bend[k] = Math.sign(a) * (0.12 + 0.4 * out) + (r() - 0.5) * 0.12;
      pv.phase[k] = r() * TAU;
      pv.attach[k] = (r() - 0.5) * 0.9;
      pv.sori[k] = !young && r() < 0.45 ? 1 : 0;
      pv.young[k] = young ? 2 : out > 0.7 ? 0 : 1;
    });
    for (let k = 0; k < MAX_ROOTS; k++) {
      pv.rootX[k] = (r() - 0.5) * 0.6;
      pv.rootLen[k] = 0.4 + 0.6 * r();
    }
    return pv;
  });
}

/** Draws a driftwood branch into a sprite at the plant's depth scale. */
export function buildWood(pv: PlantView, v: View, dpr: number, seed: number): void {
  const p = scaleAt(v, pv.z);
  const w = pv.woodW * p;
  const h = pv.woodH * p * 1.6;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * dpr));
  c.height = Math.max(1, Math.round(h * dpr));
  const g = c.getContext('2d');
  if (!g) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const rng = createRng(seed);
  const r = () => rng.next();
  const grad = g.createLinearGradient(0, h * 0.2, 0, h);
  grad.addColorStop(0, '#86603d');
  grad.addColorStop(0.45, '#5a3c24');
  grad.addColorStop(1, '#2a1a0e');
  g.fillStyle = grad;
  // Two short stubs where side branches broke off.
  const stub = (x0: number, dir: number, len: number) => {
    g.beginPath();
    g.moveTo(w * x0 - h * 0.12, h * 0.5);
    g.quadraticCurveTo(w * x0 + dir * w * 0.03, h * 0.2, w * x0 + dir * w * len, h * 0.04);
    g.lineTo(w * x0 + dir * w * len + h * 0.12, h * 0.1);
    g.quadraticCurveTo(w * x0 + dir * w * 0.05 + h * 0.1, h * 0.3, w * x0 + h * 0.14, h * 0.5);
    g.closePath();
    g.fill();
  };
  stub(0.68 + 0.08 * r(), 1, 0.12 + 0.06 * r());
  stub(0.22 + 0.08 * r(), -1, 0.08 + 0.05 * r());
  // The log itself.
  g.beginPath();
  g.moveTo(w * 0.03, h * 0.66);
  g.bezierCurveTo(w * 0.1, h * 0.38, w * 0.35, h * (0.3 + 0.1 * r()), w * 0.55, h * 0.38);
  g.bezierCurveTo(w * 0.75, h * 0.45, w * 0.9, h * 0.32, w * 0.98, h * 0.5);
  g.quadraticCurveTo(w * 1.0, h * 0.75, w * 0.9, h * 0.86);
  g.bezierCurveTo(w * 0.6, h * 0.98, w * 0.3, h * 0.95, w * 0.06, h * 0.9);
  g.quadraticCurveTo(w * 0.0, h * 0.8, w * 0.03, h * 0.66);
  g.closePath();
  g.fill();
  // Grain, cracks and a lit upper edge.
  g.strokeStyle = 'rgba(25,14,6,0.55)';
  g.lineWidth = 0.7;
  for (let k = 0; k < 7; k++) {
    const y = h * (0.48 + 0.06 * k);
    g.beginPath();
    g.moveTo(w * (0.06 + 0.08 * r()), y);
    g.bezierCurveTo(
      w * 0.35,
      y + (r() - 0.5) * 3,
      w * 0.6,
      y + (r() - 0.5) * 3,
      w * (0.82 + 0.12 * r()),
      y + (r() - 0.5) * 2,
    );
    g.stroke();
  }
  g.strokeStyle = 'rgba(255,225,180,0.22)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(w * 0.1, h * 0.46);
  g.bezierCurveTo(w * 0.35, h * 0.33, w * 0.6, h * 0.4, w * 0.92, h * 0.4);
  g.stroke();
  pv.wood = c;
}

export interface LeafPaints {
  shade: CanvasGradient;
  mature: CanvasGradient;
  young: CanvasGradient;
}

export function makeLeafPaints(ctx: CanvasRenderingContext2D): LeafPaints {
  const shade = ctx.createLinearGradient(0, 0, 0, -1);
  shade.addColorStop(0, '#163b1d');
  shade.addColorStop(0.4, '#22552a');
  shade.addColorStop(1, '#3f7a36');
  const mature = ctx.createLinearGradient(0, 0, 0, -1);
  mature.addColorStop(0, '#1d4a24');
  mature.addColorStop(0.35, '#2d6a31');
  mature.addColorStop(1, '#579643');
  const young = ctx.createLinearGradient(0, 0, 0, -1);
  young.addColorStop(0, '#2f6b30');
  young.addColorStop(0.4, '#4b8a3b');
  young.addColorStop(1, '#88c25f');
  return { shade, mature, young };
}

/** Draws the plant with its base at (bx, by) in the current transform. */
function renderPlant(
  ctx: CanvasRenderingContext2D,
  pv: PlantView,
  p: number,
  bx: number,
  by: number,
  t: number,
  paints: LeafPaints,
): void {
  const ww = pv.woodW * p;
  const wh = pv.woodH * p * 1.6;
  if (pv.wood) ctx.drawImage(pv.wood, bx - ww / 2, by - wh * 0.85, ww, wh);
  const rhizomeY = by - wh * 0.85 + wh * 0.4;

  // Brown, hair-like roots gripping the wood.
  ctx.strokeStyle = 'rgba(52,36,20,0.85)';
  ctx.lineWidth = Math.max(0.6, 0.9 * p);
  ctx.beginPath();
  for (let k = 0; k < MAX_ROOTS; k++) {
    const x = bx + (pv.rootX[k] as number) * ww;
    const len = (pv.rootLen[k] as number) * wh * 0.6;
    ctx.moveTo(x, rhizomeY + 1);
    ctx.quadraticCurveTo(x + len * 0.4, rhizomeY + len * 0.6, x + len * 0.15, rhizomeY + len);
  }
  ctx.stroke();

  // Leaves: outer (old, drooping, shaded) first, inner young leaves last on top.
  for (let k = 0; k < pv.leaves; k++) {
    const L = (pv.length[k] as number) * p;
    const a = pv.angle[k] as number;
    const ph = pv.phase[k] as number;
    const sway = Math.sin(t * 0.9 + ph) * 0.05 + Math.sin(t * 0.37 + ph * 1.3) * 0.035;
    const b = (pv.bend[k] as number) + Math.sin(t * 1.1 + ph) * 0.05;
    const wr = pv.width[k] as number;
    const age = pv.young[k] as number;
    ctx.save();
    ctx.translate(bx + (pv.attach[k] as number) * ww * 0.5, rhizomeY);
    ctx.rotate(a + sway);
    ctx.scale(L, L);
    ctx.fillStyle = age === 2 ? paints.young : age === 1 ? paints.mature : paints.shade;
    ctx.globalAlpha = 0.95;
    // Short stalk, then a lance-shaped blade, widest a third of the way up, slightly uneven.
    ctx.beginPath();
    ctx.moveTo(-0.008, 0);
    ctx.lineTo(b * 0.01 - 0.008, -0.1);
    ctx.bezierCurveTo(
      -wr * 0.9 + b * 0.1,
      -0.2,
      -wr * 1.05 + b * 0.3,
      -0.42,
      -wr * 0.75 + b * 0.5,
      -0.62,
    );
    ctx.bezierCurveTo(-wr * 0.48 + b * 0.7, -0.78, -wr * 0.16 + b * 0.86, -0.92, b, -1);
    ctx.bezierCurveTo(
      wr * 0.14 + b * 0.86,
      -0.9,
      wr * 0.46 + b * 0.7,
      -0.75,
      wr * 0.8 + b * 0.5,
      -0.58,
    );
    ctx.bezierCurveTo(wr * 1.08 + b * 0.3, -0.4, wr * 0.88 + b * 0.1, -0.2, b * 0.01 + 0.008, -0.1);
    ctx.lineTo(0.008, 0);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    // Midrib and faint side veins.
    ctx.strokeStyle = 'rgba(175,220,140,0.5)';
    ctx.lineWidth = 1.1 / L;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(b * 0.4, -0.5, b, -1);
    ctx.stroke();
    if (L > 18) {
      ctx.strokeStyle = 'rgba(175,220,140,0.2)';
      ctx.lineWidth = 0.8 / L;
      ctx.beginPath();
      for (let v = 1; v <= 5; v++) {
        const y = -0.12 - v * 0.13;
        const along = -y;
        const mx = b * along * along;
        const w = wr * 0.75 * (1 - Math.abs(along - 0.38) * 1.3);
        ctx.moveTo(mx, y);
        ctx.lineTo(mx - w, y - 0.07);
        ctx.moveTo(mx, y);
        ctx.lineTo(mx + w, y - 0.07);
      }
      ctx.stroke();
    }
    if (pv.sori[k] && L > 14) {
      ctx.fillStyle = 'rgba(92,60,28,0.85)';
      for (let s = 0; s < 6; s++) {
        const y = -0.3 - s * 0.1;
        const along = -y;
        const off = wr * 0.42 * (1 - along * 0.6);
        ctx.beginPath();
        ctx.arc(b * along * along + off, y, 0.01, 0, TAU);
        ctx.arc(b * along * along - off, y, 0.01, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // Rhizome along the top of the wood, over the leaf bases.
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#3f3219';
  ctx.lineWidth = Math.max(1.8, 4 * p);
  ctx.beginPath();
  ctx.moveTo(bx - ww * 0.3, rhizomeY + 1);
  ctx.quadraticCurveTo(bx, rhizomeY - 2 * p, bx + ww * 0.3, rhizomeY + 1);
  ctx.stroke();
  ctx.strokeStyle = '#6b5a33';
  ctx.lineWidth = Math.max(0.8, 1.6 * p);
  ctx.beginPath();
  ctx.moveTo(bx - ww * 0.29, rhizomeY);
  ctx.quadraticCurveTo(bx, rhizomeY - 2.6 * p, bx + ww * 0.29, rhizomeY);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

/** Sizes the plant's sprite to fit its leaves at full sway (on layout and resize). */
export function buildPlantSprite(pv: PlantView, v: View, dpr: number): void {
  const p = scaleAt(v, pv.z);
  let reach = 0;
  for (let k = 0; k < pv.leaves; k++) reach = Math.max(reach, pv.length[k] as number);
  reach = reach * p * 1.15 + 4;
  const ww = pv.woodW * p;
  pv.spriteW = Math.ceil(ww + reach * 2);
  pv.spriteH = Math.ceil(reach + pv.woodH * p * 1.6 + 4);
  pv.spriteX = -pv.spriteW / 2;
  pv.spriteY = -(pv.spriteH - 2);
  pv.spriteScale = dpr;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(pv.spriteW * dpr));
  c.height = Math.max(1, Math.ceil(pv.spriteH * dpr));
  pv.sprite = c;
  pv.spriteCtx = c.getContext('2d');
}

/** Draws the plant from its sprite, refreshing the sprite every `every` frames (staggered). */
export function drawPlant(
  ctx: CanvasRenderingContext2D,
  pv: PlantView,
  v: View,
  t: number,
  paints: LeafPaints,
  every: number,
): void {
  const p = scaleAt(v, pv.z);
  const bx = screenX(v, pv.x, pv.z);
  const by = screenY(v, floorY(v, pv.z), pv.z);
  const g = pv.spriteCtx;
  if (!pv.sprite || !g) {
    renderPlant(ctx, pv, p, bx, by, t, paints);
    return;
  }
  if (pv.frame++ % every === 0) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, pv.sprite.width, pv.sprite.height);
    g.setTransform(pv.spriteScale, 0, 0, pv.spriteScale, 0, 0);
    renderPlant(g, pv, p, -pv.spriteX, -pv.spriteY, t, paints);
  }
  ctx.drawImage(pv.sprite, bx + pv.spriteX, by + pv.spriteY, pv.spriteW, pv.spriteH);
}
