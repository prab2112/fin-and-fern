import { mix, rgba, type FishLook, type SpeciesShape } from './fishLook';

/**
 * Procedural fish (GDD §14). Drawn in body units: tail base at x = −38, nose at x = +50 (88 units
 * long), facing right. The pose maps that onto the screen, foreshortened by the 3D heading.
 * Path calls and cached paints only: the frame loop allocates nothing.
 */
export const BODY_UNITS = 88;
const TAIL_X = -38;
const FIN_RAY = 'rgba(0,0,0,0.16)';
const GILL = 'rgba(0,0,0,0.22)';
const OUTLINE = 'rgba(0,0,0,0.3)';
const TAU = Math.PI * 2;

/** Foreshortens points behind the middle of the body (x < 0) by rx. */
function rear(x: number, rx: number): number {
  return x < 0 ? x * rx : x;
}

/** Where and how to draw one fish this frame (one mutable object per renderer). */
export interface Pose {
  x: number;
  y: number;
  /** Pitch: tilt within the fish's own plane, nose down positive. */
  angle: number;
  /** Signed x scale (facing × foreshortening × size) and y scale (size). */
  sx: number;
  sy: number;
  /** Tail swing angle (rad, out of the screen plane). */
  tail: number;
  /** Foreshortening of the tail and of the rear of the body. */
  tailK: number;
  rearK: number;
  pec: number;
  pecAmp: number;
  /** Mouth opening 0..1 and gill flare 0..1. */
  mouth: number;
  gill: number;
  /** Iridescence 0..1 (changes as the fish turns). */
  shimmer: number;
  /** Full detail, or a cheap version for small / far fish. */
  detail: boolean;
}

export function makePose(): Pose {
  return {
    x: 0,
    y: 0,
    angle: 0,
    sx: 1,
    sy: 1,
    tail: 0,
    tailK: 1,
    rearK: 1,
    pec: 0,
    pecAmp: 0,
    mouth: 0,
    gill: 0,
    shimmer: 0,
    detail: true,
  };
}

/**
 * Paints cached per fish, made when its look changes (never per frame). The body, markings,
 * gill line and outline are baked into a small sprite, so each frame draws one image instead of a
 * clipped pattern and a stroke; tail, fins, sheen, pectoral fins, mouth and eye stay live.
 */
export interface FishGfx {
  body: CanvasGradient;
  tail: CanvasGradient;
  fin: string;
  pec: string;
  sheen: CanvasGradient;
  sprite: HTMLCanvasElement | null;
  /** Sprite rectangle in body units. */
  spriteX: number;
  spriteY: number;
  spriteW: number;
  spriteH: number;
}

export function makeSheen(ctx: CanvasRenderingContext2D): CanvasGradient {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  return g;
}

function countershade(
  g: CanvasRenderingContext2D,
  look: FishLook,
  hT: number,
  hB: number,
): CanvasGradient {
  // Dark back, true colour on the flank, light belly.
  const body = g.createLinearGradient(0, -hT, 0, hB);
  body.addColorStop(0, mix(look.body, '#000000', 0.42));
  body.addColorStop(0.42, look.body);
  body.addColorStop(0.78, mix(look.body, '#ffffff', 0.18));
  body.addColorStop(1, mix(look.body, '#ffffff', 0.42));
  return body;
}

/** Bakes body, markings, gill line and outline at `pxPerUnit` device px per body unit. */
function bakeBody(look: FishLook, pxPerUnit: number, gfx: FishGfx): void {
  const s = look.shape;
  const hT = s.hTop;
  const hB = s.hBot * look.bellyMul;
  const x0 = -41;
  const x1 = 53;
  const y0 = -(hT + (look.hump > 0 ? look.hump * 1.9 : 0) + 3);
  const y1 = hB + 3;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil((x1 - x0) * pxPerUnit));
  c.height = Math.max(1, Math.ceil((y1 - y0) * pxPerUnit));
  const g = c.getContext('2d');
  if (!g) return;
  g.setTransform(pxPerUnit, 0, 0, pxPerUnit, -x0 * pxPerUnit, -y0 * pxPerUnit);
  g.fillStyle = countershade(g, look, hT, hB);
  bodyPath(g, s, hT, hB, 1);
  g.fill();
  if (look.hump > 0) {
    g.beginPath();
    g.ellipse(s.peakX + 22, -hT * 0.8, look.hump * 1.25, look.hump, -0.3, 0, TAU);
    g.fill();
  }
  g.save();
  bodyPath(g, s, hT, hB, 1);
  g.clip();
  drawPattern(g, look, hT, hB, 0.5);
  g.strokeStyle = GILL;
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(30, -hT * 0.55 + s.noseY);
  g.quadraticCurveTo(23, s.noseY, 30, hB * 0.55 + s.noseY);
  g.stroke();
  g.restore();
  g.strokeStyle = OUTLINE;
  g.lineWidth = Math.max(0.6, 1.5 / pxPerUnit);
  bodyPath(g, s, hT, hB, 1);
  g.stroke();
  gfx.sprite = c;
  gfx.spriteX = x0;
  gfx.spriteY = y0;
  gfx.spriteW = x1 - x0;
  gfx.spriteH = y1 - y0;
}

/** `pxPerUnit`: device px per body unit at the fish's largest on-screen size (front glass). */
export function makeGfx(
  ctx: CanvasRenderingContext2D,
  look: FishLook,
  sheen: CanvasGradient,
  pxPerUnit: number,
): FishGfx {
  const s = look.shape;
  const T = s.tailLen * look.finMul * (look.tail === 'double' ? 1.45 : 1);
  const tail = ctx.createLinearGradient(TAIL_X, 0, TAIL_X - T * 1.1, 0);
  tail.addColorStop(0, rgba(look.fin, 0.95));
  tail.addColorStop(1, rgba(look.fin, 0.5));
  const gfx: FishGfx = {
    body: countershade(ctx, look, s.hTop, s.hBot * look.bellyMul),
    tail,
    fin: rgba(look.fin, 0.78),
    pec: rgba(look.fin, 0.55),
    sheen,
    sprite: null,
    spriteX: 0,
    spriteY: 0,
    spriteW: 0,
    spriteH: 0,
  };
  bakeBody(look, Math.max(0.5, pxPerUnit), gfx);
  return gfx;
}

/** Body outline; points behind the middle are foreshortened by `rx`. */
function bodyPath(
  ctx: CanvasRenderingContext2D,
  s: SpeciesShape,
  hT: number,
  hB: number,
  rx: number,
): void {
  const n = s.noseY;
  const px = s.peakX;
  const ped = s.ped;
  ctx.beginPath();
  ctx.moveTo(50, n);
  ctx.bezierCurveTo(50, n - hT * 0.55, px + 22, -hT, px, -hT);
  ctx.bezierCurveTo(rear(px - 22, rx), -hT, rear(-30, rx), -ped * 1.3, rear(TAIL_X, rx), -ped);
  ctx.lineTo(rear(TAIL_X, rx), ped);
  ctx.bezierCurveTo(rear(-30, rx), ped * 1.3, rear(px - 22, rx), hB, px, hB);
  ctx.bezierCurveTo(px + 22, hB, 50, n + hB * 0.5, 50, n);
  ctx.closePath();
}

function tailPath(ctx: CanvasRenderingContext2D, look: FishLook, T: number, S: number): void {
  const p = look.shape.ped;
  const x0 = TAIL_X + 2;
  const e = TAIL_X - T;
  ctx.beginPath();
  ctx.moveTo(x0, -p);
  switch (look.tail) {
    case 'fan':
      ctx.quadraticCurveTo(TAIL_X - T * 0.5, -S * 0.9, e, -S);
      ctx.quadraticCurveTo(TAIL_X - T * 1.12, 0, e, S);
      ctx.quadraticCurveTo(TAIL_X - T * 0.5, S * 0.9, x0, p);
      break;
    case 'fork':
      ctx.quadraticCurveTo(TAIL_X - T * 0.6, -S * 0.5, e, -S);
      ctx.quadraticCurveTo(TAIL_X - T * 0.7, -S * 0.3, TAIL_X - T * 0.55, 0);
      ctx.quadraticCurveTo(TAIL_X - T * 0.7, S * 0.3, e, S);
      ctx.quadraticCurveTo(TAIL_X - T * 0.6, S * 0.5, x0, p);
      break;
    case 'round':
      ctx.bezierCurveTo(
        TAIL_X - T * 0.4,
        -S * 1.1,
        TAIL_X - T * 1.1,
        -S * 0.8,
        TAIL_X - T * 1.05,
        0,
      );
      ctx.bezierCurveTo(TAIL_X - T * 1.1, S * 0.8, TAIL_X - T * 0.4, S * 1.1, x0, p);
      break;
    case 'lyre':
      ctx.quadraticCurveTo(TAIL_X - T * 0.8, -S * 0.7, TAIL_X - T * 1.7, -S * 1.15);
      ctx.quadraticCurveTo(TAIL_X - T * 0.8, -S * 0.45, TAIL_X - T * 0.7, 0);
      ctx.quadraticCurveTo(TAIL_X - T * 0.8, S * 0.45, TAIL_X - T * 1.7, S * 1.15);
      ctx.quadraticCurveTo(TAIL_X - T * 0.8, S * 0.7, x0, p);
      break;
    case 'double':
      ctx.bezierCurveTo(
        TAIL_X - T * 0.4,
        -S * 0.4,
        TAIL_X - T * 0.8,
        -S * 1.2,
        TAIL_X - T * 1.1,
        -S * 0.9,
      );
      ctx.quadraticCurveTo(TAIL_X - T * 0.6, -S * 0.2, TAIL_X - T * 0.78, 0);
      ctx.quadraticCurveTo(TAIL_X - T * 0.6, S * 0.2, TAIL_X - T * 1.1, S * 0.9);
      ctx.bezierCurveTo(TAIL_X - T * 0.8, S * 1.2, TAIL_X - T * 0.4, S * 0.4, x0, p);
      break;
    case 'veil':
      ctx.bezierCurveTo(
        TAIL_X - T * 0.6,
        -S * 0.7,
        TAIL_X - T * 1.1,
        -S * 0.2,
        TAIL_X - T * 1.05,
        S * 0.8,
      );
      ctx.bezierCurveTo(TAIL_X - T * 0.9, S * 1.5, TAIL_X - T * 0.3, S * 1.1, x0, p);
      break;
    case 'halfmoon':
      ctx.quadraticCurveTo(TAIL_X - T * 0.15, -S * 1.35, TAIL_X - T * 0.7, -S * 1.3);
      ctx.quadraticCurveTo(TAIL_X - T * 1.05, -S * 0.7, TAIL_X - T * 1.05, 0);
      ctx.quadraticCurveTo(TAIL_X - T * 1.05, S * 0.7, TAIL_X - T * 0.7, S * 1.3);
      ctx.quadraticCurveTo(TAIL_X - T * 0.15, S * 1.35, x0, p);
      break;
    case 'angel':
      ctx.lineTo(TAIL_X - T * 1.45, -S * 1.15);
      ctx.quadraticCurveTo(TAIL_X - T * 0.85, 0, TAIL_X - T * 1.45, S * 1.15);
      ctx.lineTo(x0, p);
      break;
  }
  ctx.closePath();
}

function drawTail(
  ctx: CanvasRenderingContext2D,
  look: FishLook,
  gfx: FishGfx,
  pose: Pose,
  detail: boolean,
): void {
  const s = look.shape;
  const T = s.tailLen * look.finMul;
  const S = s.tailSpread * Math.pow(look.finMul, 0.75);
  ctx.save();
  // The tail sweeps out of the screen plane: seen from the side it foreshortens.
  ctx.translate(TAIL_X * pose.rearK, 0);
  ctx.scale(pose.tailK, 1);
  ctx.rotate(pose.tail * 0.12);
  ctx.translate(-TAIL_X, 0);
  ctx.fillStyle = gfx.tail;
  if (look.tail === 'double') {
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * 0.55;
    ctx.save();
    ctx.translate(-3, 3);
    tailPath(ctx, look, T * 1.45, S * 1.2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = a;
    tailPath(ctx, look, T * 1.45, S * 1.2);
  } else tailPath(ctx, look, T, S);
  ctx.fill();

  if (detail) {
    ctx.strokeStyle = FIN_RAY;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) {
      ctx.moveTo(TAIL_X, 0);
      ctx.lineTo(TAIL_X - T * 0.9, S * i * 0.38);
    }
    ctx.stroke();
  }

  // Male swordtail: the long lower "sword", edged dark.
  if (look.sword) {
    ctx.fillStyle = gfx.fin;
    ctx.beginPath();
    ctx.moveTo(TAIL_X - T * 0.3, S * 0.4);
    ctx.lineTo(TAIL_X - T * 2.2, S * 0.85);
    ctx.lineTo(TAIL_X - T * 2.1, S * 1.05);
    ctx.lineTo(TAIL_X - T * 0.4, S * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1d1f24';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(TAIL_X - T * 0.4, S * 0.82);
    ctx.lineTo(TAIL_X - T * 2.1, S * 1.05);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFins(
  ctx: CanvasRenderingContext2D,
  look: FishLook,
  gfx: FishGfx,
  hT: number,
  hB: number,
  wag: number,
  rx: number,
): void {
  const s = look.shape;
  const f = look.finMul;
  const yt = -hT * 0.92;
  const yb = hB * 0.9;
  const p = s.ped;
  ctx.fillStyle = gfx.fin;

  // Discus fringe: the body outline, slightly taller, behind the body.
  if (s.dorsal === 'fringe') {
    ctx.save();
    ctx.scale(1, 1.16);
    bodyPath(ctx, s, hT, hB, rx);
    ctx.fill();
    ctx.restore();
  }

  ctx.beginPath();
  switch (look.dorsal) {
    case 'small':
      ctx.moveTo(4, yt);
      ctx.quadraticCurveTo(rear(-4, rx), yt - 10 * f, rear(-14, rx), yt - 8 * f);
      ctx.lineTo(rear(-12, rx), yt + 3);
      break;
    case 'mid':
      ctx.moveTo(10, yt);
      ctx.quadraticCurveTo(0, yt - 14 * f, rear(-16, rx), yt - 12 * f);
      ctx.lineTo(rear(-18, rx), yt + 4);
      break;
    case 'sail':
      ctx.moveTo(18, yt);
      ctx.quadraticCurveTo(8, yt - 26 * f, rear(-20, rx), yt - 22 * f);
      ctx.quadraticCurveTo(rear(-27, rx), yt - 10, rear(-24, rx), yt + 5);
      break;
    case 'long':
      ctx.moveTo(6, yt);
      ctx.bezierCurveTo(
        rear(-6, rx),
        yt - 14 * f,
        rear(-26, rx),
        yt - 18 * f,
        rear(-44, rx),
        yt - 6 * f + wag * 2,
      );
      ctx.lineTo(rear(-34, rx), -p);
      break;
    case 'angel':
      ctx.moveTo(16, yt);
      ctx.bezierCurveTo(
        4,
        yt - 30 * f,
        rear(-10, rx),
        yt - 46 * f,
        rear(-34, rx),
        yt - 52 * f + wag * 2,
      );
      ctx.quadraticCurveTo(rear(-24, rx), yt - 18, rear(-34, rx), -p - 2);
      break;
    case 'spiny':
      ctx.moveTo(26, yt + 2);
      ctx.quadraticCurveTo(0, yt - 12 * f, rear(-30, rx), yt - 9 * f);
      ctx.quadraticCurveTo(rear(-42, rx), yt - 2, rear(-38, rx), -p);
      ctx.lineTo(rear(-30, rx), -p - 1);
      break;
    case 'rear':
      ctx.moveTo(rear(-6, rx), yt);
      ctx.quadraticCurveTo(rear(-20, rx), yt - 9 * f, rear(-40, rx), -p - 6);
      ctx.lineTo(rear(-36, rx), -p);
      break;
    case 'fringe':
      break;
  }
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  switch (s.anal) {
    case 'small':
      ctx.moveTo(rear(-6, rx), yb);
      ctx.quadraticCurveTo(rear(-14, rx), yb + 8 * f, rear(-22, rx), yb + 6 * f);
      ctx.lineTo(rear(-20, rx), yb - 2);
      break;
    case 'long':
      ctx.moveTo(10, yb);
      ctx.bezierCurveTo(
        rear(-4, rx),
        yb + 16 * f,
        rear(-24, rx),
        yb + 20 * f,
        rear(-42, rx),
        yb + 8 * f + wag * 2,
      );
      ctx.lineTo(rear(-34, rx), p);
      break;
    case 'angel':
      ctx.moveTo(14, yb);
      ctx.bezierCurveTo(
        2,
        yb + 28 * f,
        rear(-10, rx),
        yb + 44 * f,
        rear(-32, rx),
        yb + 50 * f + wag * 2,
      );
      ctx.quadraticCurveTo(rear(-24, rx), yb + 18, rear(-34, rx), p + 2);
      break;
    case 'rear':
      ctx.moveTo(rear(-4, rx), yb);
      ctx.quadraticCurveTo(rear(-20, rx), yb + 10 * f, rear(-40, rx), p + 6);
      ctx.lineTo(rear(-36, rx), p);
      break;
    case 'none':
    case 'fringe':
      break;
  }
  ctx.closePath();
  ctx.fill();

  // Angelfish belly filaments.
  if (s.filaments) {
    ctx.strokeStyle = gfx.fin;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(22, hB * 0.75);
    ctx.quadraticCurveTo(18, hB + 20 * f, 8 + wag * 3, hB + 42 * f);
    ctx.moveTo(19, hB * 0.78);
    ctx.quadraticCurveTo(14, hB + 18 * f, 3 + wag * 3, hB + 38 * f);
    ctx.stroke();
  }
}

// Static marking layouts: [x, y as a fraction of body half-height, r].
const DALMATIAN = [
  30, -0.3, 2.6, 18, 0.25, 3.2, 8, -0.5, 2.4, 0, 0.1, 3.6, -10, -0.35, 2.8, -14, 0.45, 2.2, -24, 0,
  3, -30, -0.4, 2, 22, 0.6, 2, -4, 0.7, 2.4, 12, -0.05, 2, -20, 0.75, 1.8,
];
const KOI = [24, -0.4, 8, 6, 0.2, 9, -14, -0.3, 7, -26, 0.3, 5];
const CALICO = [20, -0.3, 7, 0, 0.35, 8, -18, -0.2, 6, 30, 0.4, 4];
const PEARL_DOTS = [
  20, -0.4, 14, 0.1, 6, -0.55, 4, 0.35, -6, -0.2, -12, 0.55, -18, -0.5, -22, 0.15, 10, 0.65, -28,
  -0.2, 26, 0.15, 0, -0.75,
];

function dots(
  ctx: CanvasRenderingContext2D,
  table: readonly number[],
  hT: number,
  hB: number,
): void {
  for (let i = 0; i < table.length; i += 3) {
    const y = table[i + 1] as number;
    ctx.beginPath();
    ctx.arc(table[i] as number, y * (y < 0 ? hT : hB), table[i + 2] as number, 0, TAU);
    ctx.fill();
  }
}

function drawPattern(
  ctx: CanvasRenderingContext2D,
  look: FishLook,
  hT: number,
  hB: number,
  shimmer: number,
): void {
  const a0 = ctx.globalAlpha;
  ctx.fillStyle = look.accent;
  switch (look.pattern) {
    case 'guppySpots':
      ctx.globalAlpha = a0 * 0.55;
      ctx.fillStyle = look.fin;
      ctx.fillRect(-40, -hT, 28, hT + hB);
      ctx.globalAlpha = a0 * 0.95;
      ctx.fillStyle = look.accent;
      ctx.beginPath();
      ctx.arc(-10, -2, 5, 0, TAU);
      ctx.arc(4, 3, 3.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = look.accent2;
      ctx.beginPath();
      ctx.arc(-22, 1, 3.4, 0, TAU);
      ctx.fill();
      break;
    case 'hstripes':
      ctx.globalAlpha = a0 * (0.7 + 0.25 * shimmer);
      for (let i = 0; i < 4; i++) ctx.fillRect(-40, -hT * 0.62 + i * (hT + hB) * 0.29, 86, 2.4);
      break;
    case 'neon':
      ctx.fillStyle = look.accent2;
      ctx.fillRect(-40, 1.5, 56, hB);
      // The iridescent stripe flashes as the fish turns.
      ctx.fillStyle = look.accent;
      ctx.globalAlpha = a0 * (0.6 + 0.4 * shimmer);
      ctx.fillRect(-32, -hT * 0.45, 74, hT * 0.42);
      break;
    case 'spots':
      dots(ctx, DALMATIAN, hT, hB);
      break;
    case 'calico':
      ctx.globalAlpha = a0 * 0.8;
      dots(ctx, CALICO, hT, hB);
      ctx.fillStyle = look.accent2;
      ctx.beginPath();
      ctx.arc(10, -hT * 0.6, 4, 0, TAU);
      ctx.arc(-8, hB * 0.2, 3, 0, TAU);
      ctx.arc(-26, -hT * 0.3, 3.5, 0, TAU);
      ctx.fill();
      break;
    case 'vbars':
      ctx.globalAlpha = a0 * 0.85;
      ctx.fillRect(34, -hT, 4, hT + hB);
      ctx.fillRect(12, -hT, 5, hT + hB);
      ctx.fillRect(-12, -hT, 5, hT + hB);
      break;
    case 'marble':
      ctx.strokeStyle = look.accent;
      ctx.lineWidth = 4.5;
      ctx.globalAlpha = a0 * 0.75;
      ctx.beginPath();
      ctx.moveTo(40, -hT);
      ctx.bezierCurveTo(20, -hT * 0.2, 30, hB * 0.4, 10, hB);
      ctx.moveTo(14, -hT);
      ctx.bezierCurveTo(-6, -hT * 0.3, 8, hB * 0.3, -14, hB);
      ctx.moveTo(-10, -hT);
      ctx.bezierCurveTo(-26, 0, -20, hB * 0.2, -36, hB * 0.4);
      ctx.stroke();
      break;
    case 'koi':
      dots(ctx, KOI, hT, hB);
      ctx.fillStyle = look.accent2;
      ctx.beginPath();
      ctx.arc(14, -hT * 0.5, 3.5, 0, TAU);
      ctx.arc(-6, hB * 0.4, 3, 0, TAU);
      ctx.fill();
      break;
    case 'discusBars':
      ctx.globalAlpha = a0 * 0.35;
      for (let i = 0; i < 9; i++) ctx.fillRect(38 - i * 9, -hT, 2.6, hT + hB);
      break;
    case 'blotches':
      ctx.globalAlpha = a0 * 0.9;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(18 - i * 9, 1, 4.2 - i * 0.35, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = look.accent2;
      ctx.globalAlpha = a0 * 0.7;
      for (let i = 0; i < PEARL_DOTS.length; i += 2) {
        const y = PEARL_DOTS[i + 1] as number;
        ctx.fillRect((PEARL_DOTS[i] as number) - 0.8, y * (y < 0 ? hT : hB) - 0.8, 1.6, 1.6);
      }
      break;
    case 'pearl':
      ctx.fillStyle = look.accent2;
      ctx.globalAlpha = a0 * 0.45;
      ctx.beginPath();
      ctx.ellipse(36, -2, 16, hT * 0.9, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = look.accent;
      ctx.globalAlpha = a0 * 0.95;
      for (let i = 0; i < PEARL_DOTS.length; i += 2) {
        const y = PEARL_DOTS[i + 1] as number;
        ctx.beginPath();
        ctx.arc(PEARL_DOTS[i] as number, y * (y < 0 ? hT : hB), 1.7, 0, TAU);
        ctx.fill();
      }
      break;
    case 'scales':
      ctx.strokeStyle = look.accent;
      ctx.globalAlpha = a0 * 0.45;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let y = -hT + 4; y < hB; y += 7)
        for (let x = 26; x > -36; x -= 8) {
          ctx.moveTo(x + 3, y - 3.2);
          ctx.arc(x, y, 4.2, -0.85, 0.85);
        }
      ctx.stroke();
      break;
    case 'lateral':
      ctx.strokeStyle = look.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(40, -1);
      ctx.lineTo(-40, 1);
      ctx.stroke();
      break;
    case 'tailSpot':
      ctx.beginPath();
      ctx.arc(-30, 0, 4.5, 0, TAU);
      ctx.fill();
      break;
    case 'none':
      break;
  }
  if (look.pattern2 === 'snakeskin') {
    ctx.strokeStyle = look.accent;
    ctx.globalAlpha = a0 * 0.55;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let r = 0; r < 7; r++) {
      const y0 = -hT * 0.8 + r * hT * 0.27;
      ctx.moveTo(44, y0);
      for (let x = 44; x > -40; x -= 6) ctx.lineTo(x, y0 + Math.sin(x * 0.35 + r) * 2.2);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = a0;
}

/** Draws one fish at its pose. */
export function drawFish(
  ctx: CanvasRenderingContext2D,
  look: FishLook,
  gfx: FishGfx,
  pose: Pose,
): void {
  const s = look.shape;
  const hT = s.hTop;
  const hB = s.hBot * look.bellyMul;
  const rx = pose.rearK;
  const wag = Math.sin(pose.tail * 4);
  const detail = pose.detail;

  ctx.save();
  // The fish is a cutout in a vertical plane that turns with its heading: pitch tilts it
  // within that plane (rotate first), the heading squeezes it horizontally (scale after).
  ctx.translate(pose.x, pose.y);
  ctx.scale(pose.sx, pose.sy);
  ctx.rotate(pose.angle);
  ctx.translate(-6, 0);
  ctx.globalAlpha = look.alpha;

  drawTail(ctx, look, gfx, pose, detail);
  drawFins(ctx, look, gfx, hT, hB, wag, rx);

  // Body, markings and outline: the baked sprite (or a plain countershaded body as a fallback).
  if (gfx.sprite) ctx.drawImage(gfx.sprite, gfx.spriteX, gfx.spriteY, gfx.spriteW, gfx.spriteH);
  else {
    ctx.fillStyle = gfx.body;
    bodyPath(ctx, s, hT, hB, 1);
    ctx.fill();
  }

  if (detail) {
    // Iridescent stripe that flashes as the fish turns (neon tetra).
    if (look.pattern === 'neon') {
      ctx.fillStyle = look.accent;
      ctx.globalAlpha = look.alpha * 0.45 * pose.shimmer;
      ctx.fillRect(-30, -hT * 0.42, 70, hT * 0.36);
    }
    // Sheen along the upper flank; brighter as the fish turns into the light.
    ctx.fillStyle = gfx.sheen;
    ctx.globalAlpha = look.alpha * (0.15 + 0.3 * pose.shimmer);
    ctx.save();
    ctx.translate(s.peakX + 8, -hT * 0.38);
    ctx.scale(28, Math.max(3, hT * 0.3));
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = look.alpha;

    // Pectoral fin sculling.
    ctx.fillStyle = gfx.pec;
    ctx.beginPath();
    ctx.ellipse(22, hB * 0.3, 8, 3, 0.6 + pose.pecAmp * 0.6 * Math.sin(pose.pec), 0, TAU);
    ctx.fill();

    // Mouth: opens with each breath, wide when snapping at food.
    if (pose.mouth > 0.05) {
      ctx.fillStyle = 'rgba(25,15,15,0.75)';
      ctx.beginPath();
      ctx.moveTo(50.5, s.noseY - 0.5);
      ctx.lineTo(45, s.noseY + 0.4);
      ctx.lineTo(50.5, s.noseY + 0.6 + pose.mouth * 3.2);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Eye: iris ring, pupil, glint.
  const er = s.eyeR * look.eyeScale;
  const ex = 38;
  const ey = s.noseY - hT * 0.2;
  if (detail) {
    ctx.fillStyle = look.iris;
    ctx.beginPath();
    ctx.arc(ex, ey, er * 1.3, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = look.eye;
  ctx.beginPath();
  ctx.arc(ex + 0.6, ey, er * (detail ? 0.85 : 1), 0, TAU);
  ctx.fill();
  if (detail) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex + 2, ey - 1.6, er * 0.3, 0, TAU);
    ctx.fill();
  }

  if (s.barbels) {
    ctx.strokeStyle = gfx.fin;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(48, s.noseY + 2);
    ctx.lineTo(60, s.noseY - 3 + wag);
    ctx.moveTo(47, s.noseY + 3);
    ctx.lineTo(59, s.noseY + 1 + wag);
    ctx.stroke();
  }
  ctx.restore();
}

/** Static side-on fish for the gallery (no swim pose needed). */
export function drawFishStatic(
  ctx: CanvasRenderingContext2D,
  look: FishLook,
  gfx: FishGfx,
  pose: Pose,
  x: number,
  y: number,
  len: number,
  tailPhase: number,
): void {
  pose.x = x;
  pose.y = y;
  pose.angle = 0;
  pose.sx = len / BODY_UNITS;
  pose.sy = len / BODY_UNITS;
  pose.tail = 0.25 * Math.sin(tailPhase);
  pose.tailK = Math.cos(pose.tail);
  pose.rearK = 1;
  pose.pec = tailPhase;
  pose.pecAmp = 0.5;
  pose.mouth = 0.3;
  pose.gill = 0.5;
  pose.shimmer = 0.6;
  pose.detail = true;
  drawFish(ctx, look, gfx, pose);
}
