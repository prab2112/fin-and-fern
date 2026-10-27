/** Procedural fish (GDD §14): body ellipse plus a tail shaped by the tail/fin phenotype. */

export interface FishLook {
  body: string;
  fin: string;
  eye: string;
  /** Tail/fin scale from the locus-2 phenotype (Fancy tail ≈ 1.9). */
  finScale: number;
  /** Body height / length. */
  aspect: number;
  /** Shown as a small red marker above sick fish. */
  sick: boolean;
}

/**
 * Draws one fish centred at (x, y), facing right when vx ≥ 0. `len` is the body length in px.
 * Uses only canvas path calls, so it allocates nothing.
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
  const facing = vx >= 0 ? 1 : -1;
  const speed = Math.sqrt(vx * vx + vy * vy) + 1e-3;
  const pitch = Math.max(-0.5, Math.min(0.5, vy / speed)) * 0.6;
  const half = len * 0.5;
  const bodyH = len * look.aspect;
  const tailLen = len * 0.42 * look.finScale;
  const tailSpread = bodyH * 0.9 * (0.75 + 0.35 * look.finScale);
  const wag = Math.sin(phase) * tailSpread * 0.25;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  ctx.rotate(pitch * facing);

  // Tail (fan): wider and longer for fancy phenotypes.
  ctx.fillStyle = look.fin;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(-half * 0.8, 0);
  ctx.quadraticCurveTo(
    -half - tailLen * 0.4,
    -tailSpread * 0.5 + wag,
    -half - tailLen,
    -tailSpread + wag,
  );
  ctx.quadraticCurveTo(-half - tailLen * 0.75, wag, -half - tailLen, tailSpread + wag);
  ctx.quadraticCurveTo(-half - tailLen * 0.4, tailSpread * 0.5 + wag, -half * 0.8, 0);
  ctx.fill();

  // Dorsal fin.
  ctx.beginPath();
  ctx.moveTo(-half * 0.2, -bodyH * 0.8);
  ctx.quadraticCurveTo(
    -half * 0.55,
    -bodyH * (1.1 + 0.25 * look.finScale),
    -half * 0.7,
    -bodyH * 0.5,
  );
  ctx.lineTo(-half * 0.1, -bodyH * 0.6);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Body.
  ctx.fillStyle = look.body;
  ctx.beginPath();
  ctx.ellipse(0, 0, half, bodyH, 0, 0, Math.PI * 2);
  ctx.fill();

  // Belly highlight.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.ellipse(half * 0.05, bodyH * 0.35, half * 0.6, bodyH * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eye.
  const eyeR = Math.max(1.2, len * 0.065);
  ctx.fillStyle = '#f4f4f0';
  ctx.beginPath();
  ctx.arc(half * 0.55, -bodyH * 0.2, eyeR * 1.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = look.eye;
  ctx.beginPath();
  ctx.arc(half * 0.58, -bodyH * 0.2, eyeR, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  if (look.sick) {
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(x, y - bodyH - 7, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
