import type { FishLook, SpeciesShape } from './fishLook';

/**
 * Procedural fish (GDD §14). Drawn in body units: tail base at x = −38, nose at x = +50,
 * so the body is 88 units long and `len` px on screen. Path calls only: no allocations.
 */
const BODY_UNITS = 88;
const TAIL_X = -38;
const FIN_RAY = 'rgba(0,0,0,0.16)';
const GILL = 'rgba(0,0,0,0.2)';

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

function bodyPath(ctx: CanvasRenderingContext2D, s: SpeciesShape, hT: number, hB: number): void {
  const n = s.noseY;
  const px = s.peakX;
  const ped = s.ped;
  ctx.beginPath();
  ctx.moveTo(50, n);
  ctx.bezierCurveTo(50, n - hT * 0.55, px + 22, -hT, px, -hT);
  ctx.bezierCurveTo(px - 22, -hT, -30, -ped * 1.3, TAIL_X, -ped);
  ctx.lineTo(TAIL_X, ped);
  ctx.bezierCurveTo(-30, ped * 1.3, px - 22, hB, px, hB);
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

function drawTail(ctx: CanvasRenderingContext2D, look: FishLook, wag: number): void {
  const s = look.shape;
  const T = s.tailLen * look.finMul;
  const S = s.tailSpread * Math.pow(look.finMul, 0.75);
  ctx.save();
  ctx.translate(TAIL_X, 0);
  ctx.rotate(wag * 0.16);
  ctx.translate(-TAIL_X, 0);

  ctx.fillStyle = look.fin;
  if (look.tail === 'double') {
    ctx.globalAlpha = 0.5;
    ctx.save();
    ctx.translate(-3, 3);
    tailPath(ctx, look, T * 1.45, S * 1.2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 0.85;
    tailPath(ctx, look, T * 1.45, S * 1.2);
  } else {
    ctx.globalAlpha = 0.88;
    tailPath(ctx, look, T, S);
  }
  ctx.fill();

  // Fin rays.
  ctx.globalAlpha = 1;
  ctx.strokeStyle = FIN_RAY;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  for (let i = -2; i <= 2; i++) {
    ctx.moveTo(TAIL_X, 0);
    ctx.lineTo(TAIL_X - T * 0.9, S * i * 0.38);
  }
  ctx.stroke();

  // Male swordtail: the long lower "sword", edged dark.
  if (look.sword) {
    ctx.fillStyle = look.fin;
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
  hT: number,
  hB: number,
  wag: number,
): void {
  const s = look.shape;
  const f = look.finMul;
  const yt = -hT * 0.92;
  const yb = hB * 0.9;
  const p = s.ped;
  ctx.fillStyle = look.fin;
  ctx.globalAlpha = 0.85;

  // Discus fringe: the body outline, slightly taller, behind the body.
  if (s.dorsal === 'fringe') {
    ctx.save();
    ctx.scale(1, 1.16);
    bodyPath(ctx, s, hT, hB);
    ctx.fill();
    ctx.restore();
  }

  ctx.beginPath();
  switch (look.dorsal) {
    case 'small':
      ctx.moveTo(4, yt);
      ctx.quadraticCurveTo(-4, yt - 10 * f, -14, yt - 8 * f);
      ctx.lineTo(-12, yt + 3);
      break;
    case 'mid':
      ctx.moveTo(10, yt);
      ctx.quadraticCurveTo(0, yt - 14 * f, -16, yt - 12 * f);
      ctx.lineTo(-18, yt + 4);
      break;
    case 'sail':
      ctx.moveTo(18, yt);
      ctx.quadraticCurveTo(8, yt - 26 * f, -20, yt - 22 * f);
      ctx.quadraticCurveTo(-27, yt - 10, -24, yt + 5);
      break;
    case 'long':
      ctx.moveTo(6, yt);
      ctx.bezierCurveTo(-6, yt - 14 * f, -26, yt - 18 * f, -44, yt - 6 * f + wag * 2);
      ctx.lineTo(-34, -p);
      break;
    case 'angel':
      ctx.moveTo(16, yt);
      ctx.bezierCurveTo(4, yt - 30 * f, -10, yt - 46 * f, -34, yt - 52 * f + wag * 2);
      ctx.quadraticCurveTo(-24, yt - 18, -34, -p - 2);
      break;
    case 'spiny':
      ctx.moveTo(26, yt + 2);
      ctx.quadraticCurveTo(0, yt - 12 * f, -30, yt - 9 * f);
      ctx.quadraticCurveTo(-42, yt - 2, -38, -p);
      ctx.lineTo(-30, -p - 1);
      break;
    case 'rear':
      ctx.moveTo(-6, yt);
      ctx.quadraticCurveTo(-20, yt - 9 * f, -40, -p - 6);
      ctx.lineTo(-36, -p);
      break;
    case 'fringe':
      break;
  }
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  switch (s.anal) {
    case 'small':
      ctx.moveTo(-6, yb);
      ctx.quadraticCurveTo(-14, yb + 8 * f, -22, yb + 6 * f);
      ctx.lineTo(-20, yb - 2);
      break;
    case 'long':
      ctx.moveTo(10, yb);
      ctx.bezierCurveTo(-4, yb + 16 * f, -24, yb + 20 * f, -42, yb + 8 * f + wag * 2);
      ctx.lineTo(-34, p);
      break;
    case 'angel':
      ctx.moveTo(14, yb);
      ctx.bezierCurveTo(2, yb + 28 * f, -10, yb + 44 * f, -32, yb + 50 * f + wag * 2);
      ctx.quadraticCurveTo(-24, yb + 18, -34, p + 2);
      break;
    case 'rear':
      ctx.moveTo(-4, yb);
      ctx.quadraticCurveTo(-20, yb + 10 * f, -40, p + 6);
      ctx.lineTo(-36, p);
      break;
    case 'none':
    case 'fringe':
      break;
  }
  ctx.closePath();
  ctx.fill();

  // Angelfish belly filaments.
  if (s.filaments) {
    ctx.strokeStyle = look.fin;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(22, hB * 0.75);
    ctx.quadraticCurveTo(18, hB + 20 * f, 8 + wag * 3, hB + 42 * f);
    ctx.moveTo(19, hB * 0.78);
    ctx.quadraticCurveTo(14, hB + 18 * f, 3 + wag * 3, hB + 38 * f);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function dots(
  ctx: CanvasRenderingContext2D,
  table: readonly number[],
  hT: number,
  hB: number,
): void {
  for (let i = 0; i < table.length; i += 3) {
    const y = table[i + 1] as number;
    ctx.beginPath();
    ctx.arc(table[i] as number, y * (y < 0 ? hT : hB), table[i + 2] as number, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPattern(ctx: CanvasRenderingContext2D, look: FishLook, hT: number, hB: number): void {
  ctx.fillStyle = look.accent;
  switch (look.pattern) {
    case 'guppySpots':
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = look.fin;
      ctx.fillRect(-38, -hT, 26, hT + hB);
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = look.accent;
      ctx.beginPath();
      ctx.arc(-10, -2, 5, 0, Math.PI * 2);
      ctx.arc(4, 3, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = look.accent2;
      ctx.beginPath();
      ctx.arc(-22, 1, 3.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'hstripes':
      ctx.globalAlpha = 0.85;
      for (let i = 0; i < 4; i++) ctx.fillRect(-38, -hT * 0.62 + i * (hT + hB) * 0.29, 84, 2.4);
      break;
    case 'neon':
      ctx.fillStyle = look.accent2;
      ctx.fillRect(-38, 1.5, 54, hB);
      ctx.fillStyle = look.accent;
      ctx.globalAlpha = 0.95;
      ctx.fillRect(-30, -hT * 0.45, 72, hT * 0.42);
      break;
    case 'spots':
      dots(ctx, DALMATIAN, hT, hB);
      break;
    case 'calico':
      ctx.globalAlpha = 0.8;
      dots(ctx, CALICO, hT, hB);
      ctx.fillStyle = look.accent2;
      ctx.beginPath();
      ctx.arc(10, -hT * 0.6, 4, 0, Math.PI * 2);
      ctx.arc(-8, hB * 0.2, 3, 0, Math.PI * 2);
      ctx.arc(-26, -hT * 0.3, 3.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'vbars':
      ctx.globalAlpha = 0.85;
      ctx.fillRect(34, -hT, 4, hT + hB);
      ctx.fillRect(12, -hT, 5, hT + hB);
      ctx.fillRect(-12, -hT, 5, hT + hB);
      break;
    case 'marble':
      ctx.strokeStyle = look.accent;
      ctx.lineWidth = 4.5;
      ctx.globalAlpha = 0.75;
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
      ctx.arc(14, -hT * 0.5, 3.5, 0, Math.PI * 2);
      ctx.arc(-6, hB * 0.4, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'discusBars':
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < 9; i++) ctx.fillRect(38 - i * 9, -hT, 2.6, hT + hB);
      break;
    case 'blotches':
      ctx.globalAlpha = 0.9;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(18 - i * 9, 1, 4.2 - i * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = look.accent2;
      ctx.globalAlpha = 0.7;
      for (let i = 0; i < PEARL_DOTS.length; i += 2) {
        const y = PEARL_DOTS[i + 1] as number;
        ctx.fillRect((PEARL_DOTS[i] as number) - 0.8, y * (y < 0 ? hT : hB) - 0.8, 1.6, 1.6);
      }
      break;
    case 'pearl':
      ctx.fillStyle = look.accent2;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.ellipse(36, -2, 16, hT * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = look.accent;
      ctx.globalAlpha = 0.95;
      for (let i = 0; i < PEARL_DOTS.length; i += 2) {
        const y = PEARL_DOTS[i + 1] as number;
        ctx.beginPath();
        ctx.arc(PEARL_DOTS[i] as number, y * (y < 0 ? hT : hB), 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'scales':
      ctx.strokeStyle = look.accent;
      ctx.globalAlpha = 0.45;
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
      ctx.lineTo(-38, 1);
      ctx.stroke();
      break;
    case 'tailSpot':
      ctx.beginPath();
      ctx.arc(-30, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'none':
      break;
  }
  if (look.pattern2 === 'snakeskin') {
    ctx.strokeStyle = look.accent;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let r = 0; r < 7; r++) {
      const y0 = -hT * 0.8 + r * hT * 0.27;
      ctx.moveTo(44, y0);
      for (let x = 44; x > -38; x -= 6) ctx.lineTo(x, y0 + Math.sin(x * 0.35 + r) * 2.2);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/**
 * Draws one fish with its body centre at (x, y), facing right when vx ≥ 0.
 * `len` is the body length in px (tail extra), `phase` drives the swim wag.
 */
export function drawFish(
  ctx: CanvasRenderingContext2D,
  look: FishLook,
  x: number,
  y: number,
  vx: number,
  vy: number,
  len: number,
  phase: number,
): void {
  const s = look.shape;
  const k = len / BODY_UNITS;
  const facing = vx >= 0 ? 1 : -1;
  const speed = Math.sqrt(vx * vx + vy * vy) + 1e-3;
  const pitch = Math.max(-0.5, Math.min(0.5, vy / speed)) * 0.6;
  const wag = Math.sin(phase);
  const hT = s.hTop;
  const hB = s.hBot * look.bellyMul;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * k, k);
  ctx.rotate(pitch * facing);
  ctx.translate(-6, 0);

  drawTail(ctx, look, wag);
  drawFins(ctx, look, hT, hB, wag);

  // Body and forehead hump (flowerhorn).
  ctx.fillStyle = look.body;
  bodyPath(ctx, s, hT, hB);
  ctx.fill();
  if (look.hump > 0) {
    ctx.beginPath();
    ctx.ellipse(s.peakX + 22, -hT * 0.8, look.hump * 1.25, look.hump, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Markings, belly shading and gill line, clipped to the body.
  ctx.save();
  bodyPath(ctx, s, hT, hB);
  ctx.clip();
  drawPattern(ctx, look, hT, hB);
  ctx.fillStyle = look.belly;
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.ellipse(s.peakX + 4, hB * 0.75, 40, hB * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = GILL;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(32, -hT * 0.55 + s.noseY);
  ctx.quadraticCurveTo(26, s.noseY, 32, hB * 0.55 + s.noseY);
  ctx.stroke();
  ctx.restore();

  // Pectoral fin.
  ctx.fillStyle = look.fin;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.ellipse(22, hB * 0.3, 8, 3, 0.7 + wag * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Eye.
  const ex = 38;
  const ey = s.noseY - hT * 0.2;
  ctx.fillStyle = look.eyeRing;
  ctx.beginPath();
  ctx.arc(ex, ey, s.eyeR * 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = look.eye;
  ctx.beginPath();
  ctx.arc(ex + 0.6, ey, s.eyeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(ex + 2, ey - 1.6, s.eyeR * 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Arowana chin barbels.
  if (s.barbels) {
    ctx.strokeStyle = look.fin;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(48, s.noseY + 2);
    ctx.lineTo(60, s.noseY - 3 + wag);
    ctx.moveTo(47, s.noseY + 3);
    ctx.lineTo(59, s.noseY + 1 + wag);
    ctx.stroke();
  }
  ctx.restore();

  if (look.sick) {
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(x, y - (hT / BODY_UNITS) * len - 8, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
