import { content } from '../content';
import { fishValue, isSick, phenotype } from '../sim/fish';
import { stageOf } from '../sim/stage';
import type { Fish, Tank } from '../sim/types';
import { drawFish, type FishLook } from './fishDraw';
import { MAX_DRAWN, MotionPool } from './motion';

/** Canvas 2D renderer for the open tank (GDD §14). Only this tank animates. */
export interface TankRenderer {
  /** Syncs the drawn fish/plants with the sim. Called on store updates, not per frame. */
  setTank(tank: Tank | null): void;
  /** Scatters food flakes; fish swim to them. */
  dropFood(): void;
  /** Returns the id of the fish under a point in CSS px, or null. */
  hitTest(x: number, y: number): number | null;
  setShowFps(on: boolean): void;
  dispose(): void;
}

const DPR_CAP = 2;
const MAX_FLAKES = 24;
const MAX_BUBBLES = 10;
const STAGE_SCALE = { fry: 0.4, juvenile: 0.7, adult: 1 } as const;
/** Body height / length per species (render shape only). */
const ASPECT: Record<string, number> = {
  guppy: 0.2,
  platy: 0.27,
  molly: 0.26,
  swordtail: 0.22,
  danio: 0.17,
  neon: 0.18,
  goldfish: 0.33,
  betta: 0.22,
  angel: 0.42,
  discus: 0.46,
  flowerhorn: 0.32,
  arowana: 0.15,
};

const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

export function createTankRenderer(canvas: HTMLCanvasElement): TankRenderer {
  const ctxOrNull = canvas.getContext('2d', { alpha: false });
  if (!ctxOrNull) throw new Error('Canvas 2D is not available');
  const ctx: CanvasRenderingContext2D = ctxOrNull;

  // ---- preallocated state ----
  const pool = new MotionPool();
  const slotId = new Int32Array(MAX_DRAWN);
  const looks: FishLook[] = Array.from({ length: MAX_DRAWN }, () => ({
    body: '#999999',
    fin: '#999999',
    eye: '#111111',
    finScale: 1,
    aspect: 0.2,
    sick: false,
  }));
  const slotOf = new Map<number, number>();

  const flakeX = new Float32Array(MAX_FLAKES);
  const flakeY = new Float32Array(MAX_FLAKES);
  const flakeVy = new Float32Array(MAX_FLAKES);
  const flakeAge = new Float32Array(MAX_FLAKES).fill(-1);

  const bubbleX = new Float32Array(MAX_BUBBLES);
  const bubbleY = new Float32Array(MAX_BUBBLES);
  const bubbleR = new Float32Array(MAX_BUBBLES);

  const plantMass = new Float32Array(16);
  let plantCount = 0;

  let tankId = -1;
  let dirt = 0;
  let algae = 0;
  let hiddenCount = 0;
  let hiddenLabel = '';
  let w = 1;
  let h = 1;
  let water: CanvasGradient | null = null;
  let showFps = false;
  let fpsText = '';
  let frames = 0;
  let fpsT0 = performance.now();
  let last = performance.now();
  let raf = 0;
  let disposed = false;

  const floorH = () => Math.max(18, h * 0.08);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
    w = Math.max(1, rect.width);
    h = Math.max(1, rect.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    water = ctx.createLinearGradient(0, 0, 0, h);
    water.addColorStop(0, '#2a7f8f');
    water.addColorStop(1, '#0f3d4a');
    for (let i = 0; i < MAX_BUBBLES; i++) {
      bubbleX[i] = w * 0.9 + Math.random() * 8;
      bubbleY[i] = Math.random() * h;
      bubbleR[i] = 1.5 + Math.random() * 2.5;
    }
    for (let i = 0; i < pool.count; i++) {
      pool.x[i] = Math.min(w - 4, pool.x[i] as number);
      pool.y[i] = Math.min(h - floorH() - 4, pool.y[i] as number);
    }
  }

  function fishLength(f: Fish): number {
    const size = content.speciesById[f.speciesId]?.size ?? 1;
    const base = Math.min(34, Math.max(18, w * 0.075));
    const sexScale = f.sex === 'F' ? 1.12 : 1;
    return base * Math.sqrt(size) * STAGE_SCALE[stageOf(f.ageH)] * sexScale;
  }

  function updateLook(i: number, f: Fish) {
    const look = looks[i] as FishLook;
    const [colour, second] = phenotype(f);
    look.body = colour?.body ?? '#999999';
    look.fin = colour?.fin ?? '#999999';
    look.eye = colour?.eye ?? '#15171a';
    look.finScale = second?.finScale ?? 1;
    look.aspect = ASPECT[f.speciesId] ?? 0.22;
    look.sick = isSick(f);
    pool.len[i] = fishLength(f);
    const hungry = f.hunger > content.balance.health.hungerProblemAbove;
    pool.speedMul[i] = look.sick ? 0.45 : hungry ? 0.75 : 1;
    pool.depthBias[i] = look.sick ? 0.85 : 0.25 + 0.45 * hash01(f.id);
  }

  function removeSlot(i: number) {
    const lastIdx = pool.count - 1;
    slotOf.delete(slotId[i] as number);
    if (i !== lastIdx) {
      pool.copy(lastIdx, i);
      slotId[i] = slotId[lastIdx] as number;
      const a = looks[i] as FishLook;
      looks[i] = looks[lastIdx] as FishLook;
      looks[lastIdx] = a;
      slotOf.set(slotId[i] as number, i);
    }
    pool.count--;
  }

  function setTank(tank: Tank | null) {
    if (!tank) {
      pool.count = 0;
      slotOf.clear();
      plantCount = 0;
      tankId = -1;
      return;
    }
    if (tank.id !== tankId) {
      pool.count = 0;
      slotOf.clear();
      flakeAge.fill(-1);
      tankId = tank.id;
    }
    dirt = tank.dirt;
    algae = tank.algae;
    plantCount = Math.min(plantMass.length, tank.plants.length);
    for (let i = 0; i < plantCount; i++) plantMass[i] = tank.plants[i]?.mass ?? 1;

    // GDD §14 safeguard: draw the 60 most valuable fish and show "+N".
    let shown: readonly Fish[] = tank.fish;
    if (tank.fish.length > MAX_DRAWN) {
      const price = (f: Fish) => content.speciesById[f.speciesId]?.basePrice ?? 0;
      shown = [...tank.fish]
        .sort((a, b) => fishValue(b, price(b)) - fishValue(a, price(a)))
        .slice(0, MAX_DRAWN);
    }
    hiddenCount = tank.fish.length - shown.length;
    hiddenLabel = hiddenCount > 0 ? `+${hiddenCount}` : '';

    const keep = new Set(shown.map((f) => f.id));
    for (let i = pool.count - 1; i >= 0; i--) if (!keep.has(slotId[i] as number)) removeSlot(i);
    for (const f of shown) {
      let i = slotOf.get(f.id);
      if (i === undefined) {
        i = pool.count++;
        slotId[i] = f.id;
        slotOf.set(f.id, i);
        pool.spawn(i, w, h - floorH(), Math.random);
      }
      updateLook(i, f);
    }
  }

  function dropFood() {
    for (let i = 0; i < MAX_FLAKES; i++) {
      flakeX[i] = w * (0.3 + 0.4 * Math.random());
      flakeY[i] = h * 0.06 + Math.random() * 10;
      flakeVy[i] = 12 + Math.random() * 14;
      flakeAge[i] = 0;
    }
  }

  function drawScene() {
    ctx.fillStyle = water ?? '#174f5c';
    ctx.fillRect(0, 0, w, h);

    // Light rays.
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 3; i++) {
      const x0 = w * (0.15 + 0.3 * i);
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.lineTo(x0 + w * 0.12, 0);
      ctx.lineTo(x0 + w * 0.02, h);
      ctx.lineTo(x0 - w * 0.1, h);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Sand.
    const fh = floorH();
    ctx.fillStyle = '#c9b48a';
    ctx.fillRect(0, h - fh, w, fh);
    ctx.fillStyle = '#b39d72';
    ctx.fillRect(0, h - fh, w, 3);

    // Plants (Java Fern style leaves, scaled by mass).
    for (let p = 0; p < plantCount; p++) {
      const baseX = w * ((p + 1) / (plantCount + 1)) + (p % 2 === 0 ? -w * 0.18 : w * 0.18);
      const baseY = h - fh + 4;
      const m = plantMass[p] as number;
      const leafLen = Math.min(h * 0.45, h * 0.18 * Math.sqrt(m) + 10);
      for (let k = 0; k < 6; k++) {
        const ang = -Math.PI / 2 + (k - 2.5) * 0.28;
        const sway = Math.sin(last / 1400 + k + p) * 0.05;
        const len = leafLen * (0.7 + 0.3 * ((k * 7) % 5) * 0.25);
        ctx.save();
        ctx.translate(baseX, baseY);
        ctx.rotate(ang + Math.PI / 2 + sway);
        ctx.fillStyle = k % 2 === 0 ? '#2f7a3a' : '#3d8f45';
        ctx.beginPath();
        ctx.ellipse(0, -len / 2, Math.max(4, len * 0.13), len / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Filter bubbles.
    ctx.fillStyle = 'rgba(220,245,255,0.55)';
    for (let i = 0; i < MAX_BUBBLES; i++) {
      ctx.beginPath();
      ctx.arc(bubbleX[i] as number, bubbleY[i] as number, bubbleR[i] as number, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function frame(now: number) {
    if (disposed) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;

    // Bubbles.
    for (let i = 0; i < MAX_BUBBLES; i++) {
      bubbleY[i] = (bubbleY[i] as number) - (30 + (bubbleR[i] as number) * 8) * dt;
      if ((bubbleY[i] as number) < 0) bubbleY[i] = h - floorH();
    }

    // Food flakes sink; fish are drawn to their centre and eat them.
    let fx = 0;
    let fy = 0;
    let live = 0;
    for (let i = 0; i < MAX_FLAKES; i++) {
      if ((flakeAge[i] as number) < 0) continue;
      flakeAge[i] = (flakeAge[i] as number) + dt;
      flakeY[i] = (flakeY[i] as number) + (flakeVy[i] as number) * dt;
      if ((flakeAge[i] as number) > 6 || (flakeY[i] as number) > h - floorH()) {
        flakeAge[i] = -1;
        continue;
      }
      for (let j = 0; j < pool.count; j++) {
        const dx = (pool.x[j] as number) - (flakeX[i] as number);
        const dy = (pool.y[j] as number) - (flakeY[i] as number);
        const r = (pool.len[j] as number) * 0.5;
        if (dx * dx + dy * dy < r * r) {
          flakeAge[i] = -1;
          break;
        }
      }
      if ((flakeAge[i] as number) >= 0) {
        fx += flakeX[i] as number;
        fy += flakeY[i] as number;
        live++;
      }
    }
    pool.step(dt, w, h, floorH(), live > 0 ? fx / live : NaN, live > 0 ? fy / live : NaN);

    drawScene();

    ctx.fillStyle = '#e9d29a';
    for (let i = 0; i < MAX_FLAKES; i++) {
      if ((flakeAge[i] as number) < 0) continue;
      ctx.fillRect((flakeX[i] as number) - 1.5, (flakeY[i] as number) - 1.5, 3, 3);
    }

    for (let i = 0; i < pool.count; i++)
      drawFish(
        ctx,
        looks[i] as FishLook,
        pool.x[i] as number,
        pool.y[i] as number,
        pool.vx[i] as number,
        pool.vy[i] as number,
        pool.len[i] as number,
        pool.phase[i] as number,
      );

    // Dirty water: a murky tint that deepens with D. Algae overlay: alpha = A / 150 (GDD §14).
    if (dirt > 0) {
      ctx.globalAlpha = Math.min(0.55, dirt / 180);
      ctx.fillStyle = '#5d5a2a';
      ctx.fillRect(0, 0, w, h);
    }
    if (algae > 0) {
      ctx.globalAlpha = Math.min(1, algae / 150);
      ctx.fillStyle = '#3f8f2f';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.globalAlpha = 1;

    if (hiddenCount > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(w - 58, 8, 50, 24);
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 14px system-ui, sans-serif';
      ctx.fillText(hiddenLabel, w - 50, 25);
    }

    frames++;
    if (now - fpsT0 >= 1000) {
      fpsText = `${Math.round((frames * 1000) / (now - fpsT0))} fps · ${pool.count} fish`;
      frames = 0;
      fpsT0 = now;
    }
    if (showFps) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(8, 8, 120, 22);
      ctx.fillStyle = '#9dff9d';
      ctx.font = '12px ui-monospace, monospace';
      ctx.fillText(fpsText, 14, 23);
    }

    raf = requestAnimationFrame(frame);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  raf = requestAnimationFrame(frame);

  return {
    setTank,
    dropFood,
    hitTest(x, y) {
      let best: number | null = null;
      let bestD = Infinity;
      for (let i = 0; i < pool.count; i++) {
        const dx = x - (pool.x[i] as number);
        const dy = y - (pool.y[i] as number);
        const d = dx * dx + dy * dy;
        // Generous radius: at least 24 px, so a tap target is ≥ 48 px across.
        const r = Math.max(24, (pool.len[i] as number) * 0.9);
        if (d < r * r && d < bestD) {
          bestD = d;
          best = slotId[i] as number;
        }
      }
      return best;
    },
    setShowFps(on) {
      showFps = on;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
    },
  };
}
