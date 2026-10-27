import { content } from '../content';
import { fishValue, isSick } from '../sim/fish';
import { stageOf } from '../sim/stage';
import type { Fish, Tank } from '../sim/types';
import { wq as waterQuality } from '../sim/water';
import {
  buildBackdrop,
  buildFrontOverlay,
  drawLight,
  drawSurface,
  makeLightLayer,
  type Backdrop,
  type LightLayer,
} from './environment';
import { BODY_UNITS, drawFish, makeGfx, makePose, makeSheen, type FishGfx } from './fishDraw';
import { allPhenotypeFish, lookFor, SHAPES, type FishLook } from './fishLook';
import { Particles } from './particles';
import {
  buildPlantSprite,
  buildWood,
  drawPlant,
  layoutPlants,
  makeLeafPaints,
  type PlantView,
} from './plants';
import { floorY, makeView, resizeView, scaleAt, screenX, screenY } from './projection';
import { MAX_SWIMMERS, Swimmers } from './swim';
import { DEFAULT_TEMPERAMENT, TEMPERAMENT } from './temperament';

/** Canvas 2D renderer for the open tank (GDD §14). Only this tank animates. */
export interface TankRenderer {
  /** Syncs fish, plants and water with the sim. Called on store updates, not per frame. */
  setTank(tank: Tank | null): void;
  /** Sprinkles food; the fish come up to eat it. */
  dropFood(): void;
  /** A tap on the glass that missed every fish: nearby fish startle. */
  poke(x: number, y: number): void;
  /** Id of the fish under a point in CSS px, or null. */
  hitTest(x: number, y: number): number | null;
  setShowFps(on: boolean): void;
  stats(): { fps: number; ms: number; fish: number; quality: number };
  dispose(): void;
}

/** Layer switches for profiling in dev builds (window.__finfernFlags). Always on in production. */
export const renderFlags = {
  light: true,
  haze: true,
  murk: true,
  shadows: true,
  plants: true,
  motes: true,
  detail: true,
  overlay: true,
};

const DPR_CAP = 2;
const MAX_PLANTS = 16;
const MAX_ITEMS = MAX_SWIMMERS + MAX_PLANTS + 1;
const PLANT_BASE = 1000;
const BUBBLES_ITEM = 2000;
const STAGE_SCALE = { fry: 0.4, juvenile: 0.7, adult: 1 } as const;
const HAZE_LEVELS = [0.66, 0.33];
const BACKDROP_CACHE = 3;

/**
 * Adaptive quality: the renderer watches its own frame rate and steps down when a device can't
 * keep up (light and plants refresh less often, less haze, fine detail only on larger fish; at the
 * lowest level no moving light, motes or shadows), then tries stepping back up after a stretch of
 * smooth frames.
 */
const QUALITY_MAX = 2;
const REFRESH_EVERY = [12, 6, 3];
const DETAIL_MIN_PX = [26, 18, 13];
const QUALITY_WINDOW_MS = 2000;
const QUALITY_DOWN_FPS = 48;
const QUALITY_UP_FPS = 58;
const QUALITY_UP_AFTER_MS = 10_000;
const QUALITY_UP_BACKOFF_MS = 60_000;
const HAZE = '#14505c';

export function createTankRenderer(canvas: HTMLCanvasElement): TankRenderer {
  const ctxOrNull = canvas.getContext('2d', { alpha: false });
  if (!ctxOrNull) throw new Error('Canvas 2D is not available');
  const ctx: CanvasRenderingContext2D = ctxOrNull;

  const view = makeView();
  const swim = new Swimmers(Math.random, DEFAULT_TEMPERAMENT);
  const particles = new Particles();
  const pose = makePose();
  const sheen = makeSheen(ctx);
  const leafPaints = makeLeafPaints(ctx);

  // Per-slot data, parallel to swim.fish (the same slot index everywhere).
  const slotId = new Int32Array(MAX_SWIMMERS);
  const placeholder = lookFor(allPhenotypeFish()[0] as Fish);
  const looks: FishLook[] = Array.from({ length: MAX_SWIMMERS }, () => placeholder);
  const placeholderGfx = makeGfx(ctx, placeholder, sheen, 0.5);
  const gfx: FishGfx[] = Array.from({ length: MAX_SWIMMERS }, () => placeholderGfx);
  /** What the cached look was built from: rebuilt only when this changes. */
  const lookKey = new Int32Array(MAX_SWIMMERS);
  const scrX = new Float32Array(MAX_SWIMMERS);
  const scrY = new Float32Array(MAX_SWIMMERS);
  const scrL = new Float32Array(MAX_SWIMMERS);
  const slotOf = new Map<number, number>();
  const keep = new Set<number>();

  // Depth sorting of everything that can overlap: fish, plants, the bubble column.
  const order = new Int32Array(MAX_ITEMS);
  const keys = new Float32Array(MAX_ITEMS);

  let plants: PlantView[] = [];
  /** Signature of the plants last laid out; null forces a new layout. */
  let plantSig: string | null = null;
  let backdrop: Backdrop | null = null;
  /** Recent tanks' backdrops, so switching back and forth doesn't rebuild the gravel. */
  const backdropCache = new Map<number, Backdrop>();
  let front: HTMLCanvasElement | null = null;
  let lightLayer: LightLayer | null = null;
  let tankId = -1;
  let dirt = 0;
  let algae = 0;
  let light = 1;
  let hiddenLabel = '';
  let dpr = 1;
  let showFps = false;
  let fpsText = '';
  let frames = 0;
  let drawMsSum = 0;
  let lastFps = 0;
  let lastMs = 0;
  let fpsT0 = performance.now();
  let last = performance.now();
  let raf = 0;
  let disposed = false;
  let quality = QUALITY_MAX;
  let qT0 = performance.now();
  let qFrames = 0;
  let smoothMs = 0;
  let steppedUpAt = -Infinity;
  let upBlockedUntil = 0;

  function adaptQuality(now: number) {
    qFrames++;
    const span = now - qT0;
    if (span < QUALITY_WINDOW_MS) return;
    const fps = (qFrames * 1000) / span;
    if (fps < QUALITY_DOWN_FPS && quality > 0) {
      // A step up that didn't hold: don't retry for a while.
      if (now - steppedUpAt < QUALITY_WINDOW_MS * 3) upBlockedUntil = now + QUALITY_UP_BACKOFF_MS;
      quality--;
      smoothMs = 0;
    } else if (fps >= QUALITY_UP_FPS) {
      smoothMs += span;
      if (smoothMs >= QUALITY_UP_AFTER_MS && quality < QUALITY_MAX && now >= upBlockedUntil) {
        quality++;
        steppedUpAt = now;
        smoothMs = 0;
      }
    } else smoothMs = 0;
    qFrames = 0;
    qT0 = now;
  }

  /** Plants double as cover that frightened fish hide by. */
  function updateCover() {
    swim.setCover(
      plants.map((pv) => pv.x),
      plants.map((pv) => pv.z),
      plants.map((pv) => {
        let h = 0;
        for (let k = 0; k < pv.leaves; k++) h = Math.max(h, pv.length[k] as number);
        return h * 0.8;
      }),
    );
  }

  /** The current tank's backdrop, from the cache when it was built recently. */
  function useBackdrop() {
    const cached = backdropCache.get(tankId);
    if (cached) {
      backdropCache.delete(tankId);
      backdropCache.set(tankId, cached);
      backdrop = cached;
    } else {
      backdrop = buildBackdrop(view, dpr, 9001 + Math.max(0, tankId));
      backdropCache.set(tankId, backdrop);
      if (backdropCache.size > BACKDROP_CACHE) {
        const oldest = backdropCache.keys().next().value;
        if (oldest !== undefined) backdropCache.delete(oldest);
      }
    }
  }

  /** On resize: everything sized to the canvas is rebuilt. */
  function rebuildStatic() {
    backdropCache.clear();
    useBackdrop();
    front = buildFrontOverlay(view, dpr);
    lightLayer = makeLightLayer(view);
    plants.forEach((pv, i) => {
      buildWood(pv, view, dpr, tankId * 31 + i);
      buildPlantSprite(pv, view, dpr);
    });
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    const oldW = view.w;
    const oldH = view.h;
    dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    resizeView(view, w, h);
    // Keep fish where they were, proportionally.
    for (let i = 0; i < swim.count; i++) {
      const f = swim.fish[i];
      if (!f) continue;
      f.x *= w / oldW;
      f.y *= h / oldH;
      f.z *= w / oldW;
    }
    particles.seedMotes(view);
    lookKey.fill(-1);
    plantSig = null;
    rebuildStatic();
  }

  function fishLength(f: Fish): number {
    const size = content.speciesById[f.speciesId]?.size ?? 1;
    const base = Math.min(40, Math.max(20, view.w * 0.085));
    const sexScale = f.sex === 'F' ? (SHAPES[f.speciesId]?.femaleScale ?? 1) : 1;
    return base * Math.sqrt(size) * STAGE_SCALE[stageOf(f.ageH)] * sexScale;
  }

  /** How the fish reacts to its tank: speed, gasping, begging, resting, breathing. */
  function applyEnv(i: number, f: Fish, tank: Tank) {
    const sp = content.speciesById[f.speciesId];
    const wq = waterQuality(tank.dirt);
    const cold = sp ? tank.tempC < sp.tempMin : false;
    const hot = sp ? tank.tempC > sp.tempMax : false;
    const sick = isSick(f);
    const starving = f.hunger > content.balance.health.hungerProblemAbove;
    const hungry = f.hunger > content.balance.alerts.hungerAbove;
    let speedMul = 1;
    if (sick) speedMul *= 0.45;
    if (cold) speedMul *= 0.6;
    if (starving) speedMul *= 0.8;
    if (hot) speedMul *= 1.1;
    if (wq < content.balance.health.wqSevereBelow) speedMul *= 0.75;
    let gaspP =
      wq < content.balance.health.wqSevereBelow
        ? 0.7
        : wq < content.balance.health.wqProblemBelow
          ? 0.3
          : 0;
    if (hot) gaspP += 0.25;
    const begP = sick ? 0 : starving ? 0.25 : hungry ? 0.45 : 0.03;
    const restP = sick ? 0.85 : starving ? 0.2 : cold ? 0.35 : 0;
    const sum = gaspP + begP + restP;
    const k = sum > 0.95 ? 0.95 / sum : 1;
    const stress = Math.min(
      1,
      Math.max(wq < 50 ? (50 - wq) / 50 + 0.3 : 0, hot ? 0.6 : 0, sick ? 0.5 : 0),
    );
    swim.setEnv(i, speedMul, gaspP * k, begP * k, restP * k, stress);
  }

  function lookKeyOf(f: Fish): number {
    const hungerBand =
      f.hunger < 15 ? 0 : f.hunger > content.balance.health.hungerProblemAbove ? 2 : 1;
    const stage = stageOf(f.ageH);
    return (
      (isSick(f) ? 1 : 0) |
      (f.pregnancy ? 2 : 0) |
      (hungerBand << 2) |
      ((stage === 'fry' ? 0 : stage === 'juvenile' ? 1 : 2) << 4) |
      (1 << 8)
    );
  }

  function moveSlot(from: number, to: number) {
    slotId[to] = slotId[from] as number;
    looks[to] = looks[from] as FishLook;
    gfx[to] = gfx[from] as FishGfx;
    lookKey[to] = lookKey[from] as number;
    slotOf.set(slotId[to] as number, to);
  }

  function setTank(tank: Tank | null) {
    if (!tank) {
      while (swim.count > 0) swim.removeAt(swim.count - 1);
      slotOf.clear();
      plants = [];
      plantSig = null;
      tankId = -1;
      updateCover();
      return;
    }
    if (tank.id !== tankId) {
      while (swim.count > 0) swim.removeAt(swim.count - 1);
      slotOf.clear();
      particles.clearFood();
      tankId = tank.id;
      plantSig = null;
      useBackdrop();
    }
    dirt = tank.dirt;
    algae = tank.algae;
    light =
      (tank.lightLevel <= 1 ? 0.95 : tank.lightLevel === 2 ? 1.05 : 1.15) *
      Math.max(0.25, 1 - dirt / 130);

    // Plants: re-lay out only when they change.
    let sig = '';
    for (const p of tank.plants) sig += `${p.plantId}:${p.mass.toFixed(2)};`;
    if (sig !== plantSig) {
      plantSig = sig;
      plants = layoutPlants(tank.plants.slice(0, MAX_PLANTS), tank.id, view);
      plants.forEach((pv, i) => {
        buildWood(pv, view, dpr, tank.id * 31 + i);
        buildPlantSprite(pv, view, dpr);
      });
      updateCover();
    }

    // GDD §14 safeguard: draw the 60 most valuable fish and show "+N".
    let shown: readonly Fish[] = tank.fish;
    if (tank.fish.length > MAX_SWIMMERS) {
      const price = (f: Fish) => content.speciesById[f.speciesId]?.basePrice ?? 0;
      shown = [...tank.fish]
        .sort((a, b) => fishValue(b, price(b)) - fishValue(a, price(a)))
        .slice(0, MAX_SWIMMERS);
    }
    const hidden = tank.fish.length - shown.length;
    hiddenLabel = hidden > 0 ? `+${hidden}` : '';

    keep.clear();
    for (const f of shown) keep.add(f.id);
    for (let i = swim.count - 1; i >= 0; i--) {
      const id = slotId[i] as number;
      if (keep.has(id)) continue;
      slotOf.delete(id);
      const lastSlot = swim.count - 1;
      swim.removeAt(i);
      if (i !== lastSlot) moveSlot(lastSlot, i);
    }
    for (const f of shown) {
      let i = slotOf.get(f.id);
      const len = fishLength(f);
      if (i === undefined) {
        const species = content.species.findIndex((s) => s.id === f.speciesId);
        i = swim.add(
          species + 1,
          len,
          TEMPERAMENT[f.speciesId] ?? DEFAULT_TEMPERAMENT,
          view,
          f.sex === 'M',
        );
        if (i < 0) continue;
        slotId[i] = f.id;
        slotOf.set(f.id, i);
        lookKey[i] = -1;
      }
      const key = lookKeyOf(f);
      if (lookKey[i] !== key) {
        const look = lookFor(f);
        looks[i] = look;
        gfx[i] = makeGfx(ctx, look, sheen, (len / BODY_UNITS) * dpr);
        lookKey[i] = key;
      }
      const s = swim.fish[i];
      if (s) s.len = len;
      applyEnv(i, f, tank);
    }
  }

  function dropFood() {
    particles.dropFood(Math.max(10, Math.min(48, swim.count * 3)), view);
  }

  function sortItems(): number {
    let n = 0;
    for (let i = 0; i < swim.count; i++) {
      order[n] = i;
      keys[n] = (swim.fish[i]?.z ?? 0) / view.depth;
      n++;
    }
    for (let j = 0; j < plants.length; j++) {
      order[n] = PLANT_BASE + j;
      keys[n] = (plants[j]?.z ?? 0) / view.depth;
      n++;
    }
    if (backdrop) {
      order[n] = BUBBLES_ITEM;
      keys[n] = backdrop.filter.z / view.depth;
      n++;
    }
    // Insertion sort, far to near. Nearly sorted frame to frame, so this is cheap.
    for (let a = 1; a < n; a++) {
      const k = keys[a] as number;
      const o = order[a] as number;
      let b = a - 1;
      while (b >= 0 && (keys[b] as number) < k) {
        keys[b + 1] = keys[b] as number;
        order[b + 1] = order[b] as number;
        b--;
      }
      keys[b + 1] = k;
      order[b + 1] = o;
    }
    return n;
  }

  function drawHaze() {
    ctx.globalAlpha = 0.055;
    ctx.fillStyle = HAZE;
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.globalAlpha = 1;
  }

  function drawOneFish(i: number) {
    const f = swim.fish[i];
    const look = looks[i];
    const g = gfx[i];
    if (!f || !look || !g) return;
    const p = scaleAt(view, f.z);
    const cy = Math.cos(f.yaw);
    const facing = cy >= 0 ? 1 : -1;
    const proj = Math.max(0.22, Math.abs(cy));
    const k = (f.len / BODY_UNITS) * p;
    const cyc = Math.abs(cy) < 0.25 ? (cy < 0 ? -0.25 : 0.25) : cy;
    pose.x = screenX(view, f.x, f.z);
    pose.y = screenY(view, f.y, f.z);
    // A thick body doesn't look steeper when foreshortened: keep the on-screen tilt at the pitch.
    pose.angle = Math.atan(proj * Math.tan(f.pitch));
    pose.sx = facing * proj * k;
    pose.sy = k;
    pose.tail = f.tail;
    pose.tailK = Math.min(1.7, Math.max(0.15, Math.cos(f.yaw + f.tail) / cyc));
    pose.rearK = Math.min(1.25, Math.max(0.7, Math.cos(f.yaw + f.tail * 0.35) / cyc));
    pose.pec = f.pecPhase;
    pose.pecAmp = f.pecAmp;
    const breath = 0.5 + 0.5 * Math.sin(f.breathPhase);
    pose.gill = breath;
    pose.mouth = Math.max(f.snap, breath * (0.2 + 0.8 * f.stress));
    pose.shimmer = 0.5 + 0.5 * Math.sin(f.yaw * 3 + f.x * 0.015);
    pose.flare = f.flare;
    pose.detail = renderFlags.detail && f.len * p * proj > (DETAIL_MIN_PX[quality] as number);
    drawFish(ctx, look, g, pose);
    scrX[i] = pose.x;
    scrY[i] = pose.y;
    scrL[i] = f.len * p;
  }

  function drawShadows() {
    ctx.fillStyle = '#000000';
    for (let i = 0; i < swim.count; i++) {
      const f = swim.fish[i];
      if (!f) continue;
      const fy = floorY(view, f.z);
      const above = fy - f.y;
      const a = 0.2 * Math.max(0, 1 - above / (view.h * 0.55)) * light;
      if (a < 0.01) continue;
      const p = scaleAt(view, f.z);
      const rx = f.len * p * 0.42 * (1 + above / view.h);
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.ellipse(
        screenX(view, f.x, f.z),
        screenY(view, fy, f.z),
        rx,
        rx * 0.22,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawSickBadges() {
    for (let i = 0; i < swim.count; i++) {
      const look = looks[i];
      if (!look?.sick) continue;
      const x = scrX[i] as number;
      const y = (scrY[i] as number) - (scrL[i] as number) * 0.45 - 8;
      ctx.fillStyle = '#ff5c5c';
      ctx.beginPath();
      ctx.arc(x, y, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 3, y - 0.9, 6, 1.8);
      ctx.fillRect(x - 0.9, y - 3, 1.8, 6);
    }
  }

  function frame(now: number) {
    if (disposed) return;
    const t0 = performance.now();
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const t = now / 1000;
    const b = backdrop;

    particles.step(dt, view, b ? b.filter : null, dirt);
    swim.step(dt, view, particles.flakes);
    for (let i = 0; i < swim.count; i++) {
      const f = swim.fish[i];
      if (!f?.pecked) continue;
      f.pecked = false;
      particles.puff(f.x + Math.cos(f.yaw) * f.len * 0.5, floorY(view, f.z) - 1, f.z);
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    if (b) {
      ctx.drawImage(b.bg, 0, 0, view.w, view.h);
      if (renderFlags.light && lightLayer && quality > 0)
        drawLight(ctx, lightLayer, view, b, t, light, REFRESH_EVERY[quality] as number);
      drawSurface(ctx, view, b, t);
    }
    particles.drawRipples(ctx, view);
    if (renderFlags.motes && quality > 0) particles.drawMotes(ctx, view, true, dirt > 35);
    if (renderFlags.shadows && quality > 0) drawShadows();

    const n = sortItems();
    let haze = 0;
    for (let k = 0; k < n; k++) {
      const z = keys[k] as number;
      while (haze < HAZE_LEVELS.length && z < (HAZE_LEVELS[haze] as number)) {
        if (renderFlags.haze && haze < quality) drawHaze();
        haze++;
      }
      const item = order[k] as number;
      if (item === BUBBLES_ITEM) particles.drawBubbles(ctx, view);
      else if (item >= PLANT_BASE) {
        const pv = plants[item - PLANT_BASE];
        if (pv && renderFlags.plants)
          drawPlant(ctx, pv, view, t, leafPaints, REFRESH_EVERY[quality] as number);
      } else drawOneFish(item);
    }
    while (haze < HAZE_LEVELS.length) {
      if (renderFlags.haze && haze < quality) drawHaze();
      haze++;
    }

    particles.drawFlakes(ctx, view);
    particles.drawPuffs(ctx, view);
    if (renderFlags.motes && quality > 0) particles.drawMotes(ctx, view, false, dirt > 35);

    // Dirty water turns murky green-brown. Algae (M6) films the glass: alpha = A / 150.
    if (dirt > 0 && renderFlags.murk) {
      ctx.globalAlpha = Math.min(0.5, dirt / 200);
      ctx.fillStyle = '#4d5a2c';
      ctx.fillRect(0, 0, view.w, view.h);
    }
    if (algae > 0) {
      ctx.globalAlpha = Math.min(1, algae / 150);
      ctx.fillStyle = '#3f8f2f';
      ctx.fillRect(0, 0, view.w, view.h);
    }
    ctx.globalAlpha = 1;
    if (front && renderFlags.overlay) ctx.drawImage(front, 0, 0, view.w, view.h);
    particles.drawRings(ctx);
    drawSickBadges();

    if (hiddenLabel) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(view.w - 58, 10, 50, 24);
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 14px system-ui, sans-serif';
      ctx.fillText(hiddenLabel, view.w - 50, 27);
    }

    adaptQuality(now);
    frames++;
    drawMsSum += performance.now() - t0;
    if (now - fpsT0 >= 1000) {
      lastFps = Math.round((frames * 1000) / (now - fpsT0));
      lastMs = drawMsSum / frames;
      fpsText = `${lastFps} fps · ${lastMs.toFixed(1)} ms · Q${quality} · ${swim.count} fish`;
      frames = 0;
      drawMsSum = 0;
      fpsT0 = now;
    }
    if (showFps) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(8, 10, 196, 22);
      ctx.fillStyle = '#9dff9d';
      ctx.font = '12px ui-monospace, monospace';
      ctx.fillText(fpsText, 14, 25);
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
    poke(x, y) {
      swim.poke(x, y, view);
      particles.ring(x, y);
    },
    hitTest(x, y) {
      let best: number | null = null;
      let bestD = Infinity;
      for (let i = 0; i < swim.count; i++) {
        const dx = x - (scrX[i] as number);
        const dy = y - (scrY[i] as number);
        const d = dx * dx + dy * dy;
        // Generous radius: at least 24 px, so a tap target is ≥ 48 px across.
        const r = Math.max(24, (scrL[i] as number) * 0.7);
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
    stats() {
      return { fps: lastFps, ms: lastMs, fish: swim.count, quality };
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
    },
  };
}
