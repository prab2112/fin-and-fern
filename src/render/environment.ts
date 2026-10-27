import { createRng } from '../sim/rng';
import { mix } from './fishLook';
import type { BubbleSource } from './particles';
import { floorY, scaleAt, screenX, screenY, type View } from './projection';

/**
 * The tank itself (GDD §14): back wall, side glass, the underside of the water surface, sloped
 * gravel with its front cross-section, and a sponge filter are drawn once per resize into a
 * background layer. A front layer holds the light falloff, vignette, glass reflections and rims.
 * Caustics, light shafts and the surface shimmer animate each frame from cached objects.
 */
export interface Backdrop {
  bg: HTMLCanvasElement;
  front: HTMLCanvasElement;
  /** Screen geometry of the box. */
  backL: number;
  backR: number;
  backSurf: number;
  backFloor: number;
  /** Bubble stream of the sponge filter (world px). */
  filter: BubbleSource;
}

const GRAVEL = [
  '#8b7355',
  '#a08566',
  '#6e5a44',
  '#b49c7c',
  '#5b4a3a',
  '#c2ab88',
  '#7a6a5a',
  '#4a4038',
  '#9a8f80',
];
const TAU = Math.PI * 2;

function layer(v: View, dpr: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(v.w * dpr));
  c.height = Math.max(1, Math.round(v.h * dpr));
  const g = c.getContext('2d');
  if (!g) throw new Error('Canvas 2D is not available');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return [c, g];
}

function quad(
  g: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
) {
  g.beginPath();
  g.moveTo(ax, ay);
  g.lineTo(bx, by);
  g.lineTo(cx, cy);
  g.lineTo(dx, dy);
  g.closePath();
}

function pebble(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  squash: number,
  colour: string,
) {
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.beginPath();
  g.ellipse(x + r * 0.15, y + r * 0.25 * squash, r, r * squash, 0, 0, TAU);
  g.fill();
  g.fillStyle = colour;
  g.beginPath();
  g.ellipse(x, y, r, r * squash, 0, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.2)';
  g.beginPath();
  g.ellipse(x - r * 0.3, y - r * 0.28 * squash, r * 0.5, r * 0.3 * squash, 0, 0, TAU);
  g.fill();
}

/**
 * Tileable caustic network, built once: the edges of a Worley (F2 − F1) cell pattern, bent into
 * curves by a periodic domain warp, so it reads as rippling light rather than a polygon grid.
 */
let causticTile: HTMLCanvasElement | null = null;
function getCausticTile(): HTMLCanvasElement | null {
  if (causticTile) return causticTile;
  const S = 160;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  if (!g) return null;
  const rng = createRng(4242);
  const N = 24;
  const px = new Float32Array(N);
  const py = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    px[i] = rng.next() * S;
    py[i] = rng.next() * S;
  }
  const A = S * 0.045;
  const w1 = (TAU * 2) / S;
  const w2 = (TAU * 3) / S;
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      // Periodic warp: whole numbers of waves per tile keep it seamless.
      const wx = x + A * Math.sin(y * w1 + 1.3) + A * 0.5 * Math.sin((x + y) * w2);
      const wy = y + A * Math.sin(x * w1 + 0.4) + A * 0.5 * Math.sin((x - y) * w2 + 2);
      let f1 = 1e9;
      let f2 = 1e9;
      for (let i = 0; i < N; i++)
        for (let oy = -S; oy <= S; oy += S)
          for (let ox = -S; ox <= S; ox += S) {
            const dx = wx - ((px[i] as number) + ox);
            const dy = wy - ((py[i] as number) + oy);
            const d = dx * dx + dy * dy;
            if (d < f1) {
              f2 = f1;
              f1 = d;
            } else if (d < f2) f2 = d;
          }
      const e = Math.sqrt(f2) - Math.sqrt(f1);
      const k = Math.max(0, 1 - e / (S * 0.045));
      const a = Math.pow(k, 2.6);
      const o = (y * S + x) * 4;
      img.data[o] = 225;
      img.data[o + 1] = 250;
      img.data[o + 2] = 255;
      img.data[o + 3] = Math.round(a * 255);
    }
  g.putImageData(img, 0, 0);
  causticTile = c;
  return c;
}

export function buildBackdrop(v: View, dpr: number, seed: number): Backdrop {
  const rng = createRng(seed);
  const r = () => rng.next();
  const [bg, g] = layer(v, dpr);
  const { w, h } = v;
  const D = v.depth;
  const backL = screenX(v, 0, D);
  const backR = screenX(v, w, D);
  const backSurf = screenY(v, v.surface, D);
  const backFloor = screenY(v, v.floorBack, D);
  const frontFloor = v.floorFront;

  // Water volume (seen through the side glass).
  g.fillStyle = '#0a2a31';
  g.fillRect(0, 0, w, h);

  // Back wall: lit from above, dark below.
  let grad = g.createLinearGradient(0, backSurf, 0, backFloor);
  grad.addColorStop(0, '#2a7f8a');
  grad.addColorStop(0.45, '#17505a');
  grad.addColorStop(1, '#0c3038');
  g.fillStyle = grad;
  g.fillRect(backL, backSurf, backR - backL, backFloor - backSurf);
  const glow = g.createRadialGradient(
    w * 0.5,
    backSurf + (backFloor - backSurf) * 0.2,
    0,
    w * 0.5,
    backSurf,
    (backR - backL) * 0.75,
  );
  glow.addColorStop(0, 'rgba(140,215,220,0.28)');
  glow.addColorStop(1, 'rgba(120,200,210,0)');
  g.fillStyle = glow;
  g.fillRect(backL, backSurf, backR - backL, backFloor - backSurf);

  // Side glass panes.
  grad = g.createLinearGradient(0, 0, backL, 0);
  grad.addColorStop(0, '#0c333b');
  grad.addColorStop(1, '#165560');
  g.fillStyle = grad;
  quad(g, 0, v.surface, backL, backSurf, backL, backFloor, 0, frontFloor);
  g.fill();
  grad = g.createLinearGradient(w, 0, backR, 0);
  grad.addColorStop(0, '#0c333b');
  grad.addColorStop(1, '#165560');
  g.fillStyle = grad;
  quad(g, w, v.surface, backR, backSurf, backR, backFloor, w, frontFloor);
  g.fill();
  g.strokeStyle = 'rgba(170,230,240,0.14)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(backL, backSurf);
  g.lineTo(backL, backFloor);
  g.moveTo(backR, backSurf);
  g.lineTo(backR, backFloor);
  g.stroke();

  // Underside of the water surface: a bright mirror band.
  grad = g.createLinearGradient(0, v.surface, 0, backSurf);
  grad.addColorStop(0, 'rgba(170,225,232,0.75)');
  grad.addColorStop(0.5, 'rgba(90,170,180,0.55)');
  grad.addColorStop(1, 'rgba(40,110,120,0.6)');
  g.fillStyle = grad;
  quad(g, 0, v.surface, w, v.surface, backR, backSurf, backL, backSurf);
  g.fill();
  g.strokeStyle = 'rgba(200,240,245,0.35)';
  g.beginPath();
  g.moveTo(backL, backSurf);
  g.lineTo(backR, backSurf);
  g.stroke();

  // Air gap above the water line, and the bright meniscus.
  grad = g.createLinearGradient(0, 0, 0, v.surface);
  grad.addColorStop(0, '#0b1416');
  grad.addColorStop(1, '#1d3236');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, v.surface);
  g.fillStyle = 'rgba(220,250,255,0.75)';
  g.fillRect(0, v.surface - 0.5, w, 1.5);

  // Gravel floor, back to front.
  grad = g.createLinearGradient(0, backFloor, 0, frontFloor);
  grad.addColorStop(0, '#3e3429');
  grad.addColorStop(1, '#6b5a44');
  g.fillStyle = grad;
  quad(g, 0, frontFloor, w, frontFloor, backR, backFloor, backL, backFloor);
  g.fill();
  const N = Math.round((w * (frontFloor - backFloor)) / 9);
  const zs = new Float32Array(N);
  for (let i = 0; i < N; i++) zs[i] = r();
  zs.sort();
  for (let i = N - 1; i >= 0; i--) {
    const z = (zs[i] as number) * D;
    const p = scaleAt(v, z);
    const x = screenX(v, r() * w, z);
    const y = screenY(v, floorY(v, z), z);
    const rad = (1.1 + 2.6 * r() * r()) * p;
    const base = GRAVEL[Math.floor(r() * GRAVEL.length)] as string;
    pebble(g, x, y, rad, 0.62, mix(base, r() < 0.5 ? '#000000' : '#ffffff', r() * 0.18));
  }
  // Depth haze on the gravel and a pool of light in the middle.
  grad = g.createLinearGradient(0, backFloor, 0, frontFloor);
  grad.addColorStop(0, 'rgba(10,45,52,0.55)');
  grad.addColorStop(1, 'rgba(10,45,52,0)');
  g.fillStyle = grad;
  quad(g, 0, frontFloor, w, frontFloor, backR, backFloor, backL, backFloor);
  g.fill();

  // Front cross-section of the gravel bed, pressed against the glass.
  g.fillStyle = '#3a3026';
  g.fillRect(0, frontFloor, w, h - frontFloor);
  const M = Math.round((w * (h - frontFloor)) / 6);
  for (let i = 0; i < M; i++) {
    const base = GRAVEL[Math.floor(r() * GRAVEL.length)] as string;
    pebble(
      g,
      r() * w,
      frontFloor + r() * (h - frontFloor + 4),
      1.6 + 2.8 * r(),
      0.85,
      mix(base, '#000000', 0.15 + r() * 0.25),
    );
  }
  grad = g.createLinearGradient(0, frontFloor, 0, h);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = grad;
  g.fillRect(0, frontFloor, w, h - frontFloor);
  g.fillStyle = 'rgba(255,255,255,0.1)';
  g.fillRect(0, frontFloor - 0.5, w, 1);

  // Sponge filter in the back right corner, with its uplift tube and airline.
  const fz = D * 0.84;
  const fx = w * 0.84;
  const p = scaleAt(v, fz);
  const baseY = floorY(v, fz);
  const spongeH = v.h * 0.15;
  const spongeW = w * 0.085;
  const tubeR = w * 0.012;
  const tubeTop = v.surface + (baseY - v.surface) * 0.3;
  const sx = screenX(v, fx, fz);
  const sBot = screenY(v, baseY, fz);
  const sTop = screenY(v, baseY - spongeH, fz);
  const sw = spongeW * p;
  // Weighted base.
  g.fillStyle = '#2b2f31';
  g.beginPath();
  g.ellipse(sx, sBot, sw * 0.62, sw * 0.16, 0, 0, TAU);
  g.fill();
  // Sponge body.
  grad = g.createLinearGradient(sx - sw / 2, 0, sx + sw / 2, 0);
  grad.addColorStop(0, '#45494b');
  grad.addColorStop(0.45, '#2b2f30');
  grad.addColorStop(1, '#17191a');
  g.fillStyle = grad;
  g.beginPath();
  g.roundRect(sx - sw / 2, sTop, sw, sBot - sTop - sw * 0.08, sw * 0.18);
  g.fill();
  for (let i = 0; i < 120; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.08)';
    g.fillRect(sx - sw / 2 + r() * sw, sTop + r() * (sBot - sTop - sw * 0.1), 1, 1);
  }
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath();
  g.ellipse(sx, sTop + 1, sw / 2, sw * 0.12, 0, 0, TAU);
  g.fill();
  // Transparent uplift tube.
  const tTop = screenY(v, tubeTop, fz);
  const tw = tubeR * p;
  g.fillStyle = 'rgba(190,230,235,0.16)';
  g.fillRect(sx - tw, tTop, tw * 2, sTop - tTop);
  g.strokeStyle = 'rgba(210,240,245,0.45)';
  g.lineWidth = 0.8;
  g.strokeRect(sx - tw, tTop, tw * 2, sTop - tTop);
  g.fillStyle = 'rgba(220,245,250,0.25)';
  g.fillRect(sx - tw * 0.6, tTop, tw * 0.35, sTop - tTop);
  // Airline up and out of the water.
  g.strokeStyle = 'rgba(20,30,34,0.75)';
  g.lineWidth = 1.4 * p;
  g.beginPath();
  g.moveTo(sx + tw * 0.4, tTop);
  g.quadraticCurveTo(sx + tw * 2.5, tTop - (tTop - v.surface) * 0.5, sx + tw * 1.5, 0);
  g.stroke();

  // ---------------- front overlay
  const [front, f] = layer(v, dpr);
  grad = f.createLinearGradient(0, h * 0.35, 0, h);
  grad.addColorStop(0, 'rgba(0,12,16,0)');
  grad.addColorStop(1, 'rgba(0,12,16,0.22)');
  f.fillStyle = grad;
  f.fillRect(0, 0, w, h);
  const vig = f.createRadialGradient(
    w * 0.5,
    h * 0.45,
    Math.min(w, h) * 0.35,
    w * 0.5,
    h * 0.45,
    Math.max(w, h) * 0.8,
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.3)');
  f.fillStyle = vig;
  f.fillRect(0, 0, w, h);
  f.fillStyle = 'rgba(255,255,255,0.035)';
  quad(f, w * 0.06, 0, w * 0.15, 0, w * 0.26, h, w * 0.17, h);
  f.fill();
  f.fillStyle = 'rgba(255,255,255,0.022)';
  quad(f, w * 0.7, 0, w * 0.74, 0, w * 0.82, h, w * 0.78, h);
  f.fill();
  f.fillStyle = '#0b1012';
  f.fillRect(0, 0, w, 4);
  f.fillRect(0, h - 4, w, 4);
  f.fillStyle = 'rgba(255,255,255,0.08)';
  f.fillRect(0, 4, w, 1);

  return {
    bg,
    front,
    backL,
    backR,
    backSurf,
    backFloor,
    filter: { x: fx, z: fz, yStart: baseY - spongeH, yTubeTop: tubeTop, tubeR },
  };
}

/**
 * Caustics on the gravel and light shafts, drawn into a half-resolution layer every few frames
 * and laid over the scene with one blit. Both are soft light, so the lower resolution doesn't
 * show, and it keeps the fill cost low on phones.
 */
export interface LightLayer {
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  caustics: CanvasPattern | null;
  ray: CanvasGradient;
  frame: number;
}

const LIGHT_RES = 0.5;

export function makeLightLayer(v: View): LightLayer | null {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(v.w * LIGHT_RES));
  canvas.height = Math.max(1, Math.ceil(v.h * LIGHT_RES));
  const g = canvas.getContext('2d');
  if (!g) return null;
  const tile = getCausticTile();
  const ray = g.createLinearGradient(0, v.surface, 0, v.floorFront);
  ray.addColorStop(0, 'rgba(240,255,250,0.2)');
  ray.addColorStop(0.6, 'rgba(240,255,250,0.06)');
  ray.addColorStop(1, 'rgba(235,255,250,0)');
  return { canvas, g, caustics: tile ? g.createPattern(tile, 'repeat') : null, ray, frame: 0 };
}

function renderLight(L: LightLayer, v: View, b: Backdrop, t: number, light: number): void {
  const g = L.g;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.clearRect(0, 0, L.canvas.width, L.canvas.height);
  if (light <= 0) return;
  g.setTransform(LIGHT_RES, 0, 0, LIGHT_RES, 0, 0);
  g.globalCompositeOperation = 'lighter';

  if (L.caustics) {
    g.save();
    quad(g, 0, v.floorFront, v.w, v.floorFront, b.backR, b.backFloor, b.backL, b.backFloor);
    g.clip();
    g.fillStyle = L.caustics;
    g.globalAlpha = 0.26 * light;
    g.save();
    g.translate(0, b.backFloor);
    g.scale(1.5, 0.5);
    g.translate((t * 9) % 160, (t * 5) % 160);
    g.fillRect(-320, -320, v.w + 640, v.h * 2 + 640);
    g.restore();
    g.globalAlpha = 0.2 * light;
    g.translate(0, b.backFloor);
    g.scale(2.1, 0.7);
    g.translate(-((t * 6) % 160), (t * 7) % 160);
    g.fillRect(-320, -320, v.w + 640, v.h * 2 + 640);
    g.restore();
  }

  g.fillStyle = L.ray;
  for (let i = 0; i < 4; i++) {
    const cx = v.w * (0.16 + 0.23 * i) + Math.sin(t * 0.11 + i * 1.7) * v.w * 0.05;
    const top = v.w * 0.04;
    const bot = v.w * (0.1 + 0.03 * (i % 2));
    const slant = v.w * 0.07;
    g.globalAlpha = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.37 + i * 2.1))) * 0.75 * light;
    quad(
      g,
      cx - top,
      v.surface,
      cx + top,
      v.surface,
      cx + slant + bot,
      v.floorFront,
      cx + slant - bot,
      v.floorFront,
    );
    g.fill();
  }
}

/** Refreshes the light layer every `every` frames and lays it over the scene. */
export function drawLight(
  ctx: CanvasRenderingContext2D,
  L: LightLayer,
  v: View,
  b: Backdrop,
  t: number,
  light: number,
  every: number,
): void {
  if (L.frame++ % every === 0) renderLight(L, v, b, t, light);
  // Plain alpha blending of faint white light looks the same as additive here and is the
  // cheapest compositing path on every device.
  ctx.drawImage(L.canvas, 0, 0, v.w, v.h);
}

/** Glinting ripples on the underside of the surface. */
export function drawSurface(ctx: CanvasRenderingContext2D, v: View, b: Backdrop, t: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = '#e1fcff';
  ctx.lineWidth = 1;
  const band = b.backSurf - v.surface;
  for (let k = 0; k < 4; k++) {
    const y0 = v.surface + band * (0.18 + 0.22 * k);
    const amp = 0.7 + k * 0.45;
    ctx.globalAlpha = 0.1 + 0.05 * (k % 2);
    ctx.beginPath();
    for (let s = 0; s <= 20; s++) {
      const x = (v.w * s) / 20;
      const y =
        y0 +
        Math.sin(x * 0.05 + t * (1.1 + k * 0.3) + k * 1.9) * amp +
        Math.sin(x * 0.13 - t * (0.7 + k * 0.2) + k) * amp * 0.5;
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Drifting glints where the surface catches the light.
  ctx.fillStyle = '#f2feff';
  for (let g = 0; g < 10; g++) {
    const x = (g * 73.7 + t * (10 + g * 1.7)) % v.w;
    const y = v.surface + band * (0.12 + 0.76 * ((g * 0.37) % 1));
    ctx.globalAlpha = 0.18 * (0.5 + 0.5 * Math.sin(t * 2.1 + g * 1.3));
    ctx.beginPath();
    ctx.ellipse(x, y, 5 + (g % 3) * 3, 0.9, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
