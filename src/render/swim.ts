import { floorY, scaleAt, screenX, screenY, type View } from './projection';
import type { Temperament } from './temperament';

/**
 * Fish movement in the 3D tank (GDD §14). Each fish has a position and a heading (yaw in the
 * x–z plane, pitch up/down) that can only turn at its species' turn rate, so a fish reversing
 * direction swings through facing the viewer instead of flipping. Behaviour modes, schooling,
 * separation and wall avoidance steer the heading. All swimmers are preallocated objects that
 * are mutated in place: the frame loop allocates nothing.
 */
export const MAX_SWIMMERS = 60;

export const MODE = {
  cruise: 0,
  hover: 1,
  forage: 2,
  feed: 3,
  flee: 4,
  gasp: 5,
  beg: 6,
  rest: 7,
} as const;
export type Mode = (typeof MODE)[keyof typeof MODE];

/** A food flake as the swimmers see it (physics and drawing live in particles.ts). */
export interface Flake {
  alive: boolean;
  settled: boolean;
  x: number;
  y: number;
  z: number;
}

export interface Swimmer {
  /** Fish of the same species share a group (they school together). */
  group: number;
  /** Body length in px at the front glass. */
  len: number;
  t: Temperament;
  // Reactions to the sim (set from the tank state, see setEnv).
  speedMul: number;
  gaspP: number;
  begP: number;
  restP: number;
  /** 0..1, drives the breathing rate. */
  stress: number;
  // Kinematics.
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  speed: number;
  tx: number;
  ty: number;
  tz: number;
  mode: Mode;
  timer: number;
  arrived: boolean;
  turnDir: number;
  burst: boolean;
  bgTimer: number;
  fleeX: number;
  fleeY: number;
  fleeZ: number;
  food: number;
  // Steering scratch for this frame.
  dx: number;
  dy: number;
  dz: number;
  want: number;
  pitchHold: number;
  // Animation state read by the drawing code.
  tailPhase: number;
  tailAmp: number;
  /** Current tail swing angle (rad), out of the screen plane. */
  tail: number;
  pecPhase: number;
  pecAmp: number;
  breathPhase: number;
  /** Mouth snap 0..1 (eating, pecking). */
  snap: number;
  accel: boolean;
}

const TAU = Math.PI * 2;
const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);

export function wrapAngle(a: number): number {
  let r = (a + Math.PI) % TAU;
  if (r < 0) r += TAU;
  return r - Math.PI;
}

function blank(t: Temperament): Swimmer {
  return {
    group: 0,
    len: 20,
    t,
    speedMul: 1,
    gaspP: 0,
    begP: 0,
    restP: 0,
    stress: 0,
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    pitch: 0,
    speed: 0,
    tx: 0,
    ty: 0,
    tz: 0,
    mode: MODE.cruise,
    timer: 0,
    arrived: true,
    turnDir: 1,
    burst: false,
    bgTimer: 0,
    fleeX: 0,
    fleeY: 0,
    fleeZ: 0,
    food: -1,
    dx: 0,
    dy: 0,
    dz: 0,
    want: 0,
    pitchHold: NaN,
    tailPhase: 0,
    tailAmp: 0.2,
    tail: 0,
    pecPhase: 0,
    pecAmp: 0.4,
    breathPhase: 0,
    snap: 0,
    accel: false,
  };
}

export class Swimmers {
  readonly fish: Swimmer[] = [];
  count = 0;
  private readonly rand: () => number;

  constructor(rand: () => number = Math.random, placeholder?: Temperament) {
    this.rand = rand;
    const t = placeholder ?? {
      bandTop: 0,
      bandBottom: 1,
      cruise: 1,
      burst: 4,
      turnRate: 3,
      hover: 0,
      burstGlide: false,
      school: 0,
      forager: false,
      surface: 0,
    };
    for (let i = 0; i < MAX_SWIMMERS; i++) this.fish.push(blank(t));
  }

  /** Adds a fish at a random spot in its preferred band. Returns its slot, or −1 when full. */
  add(group: number, len: number, t: Temperament, v: View): number {
    if (this.count >= MAX_SWIMMERS) return -1;
    const i = this.count++;
    const f = this.fish[i] as Swimmer;
    const r = this.rand;
    f.group = group;
    f.len = len;
    f.t = t;
    f.speedMul = 1;
    f.gaspP = 0;
    f.begP = 0;
    f.restP = 0;
    f.stress = 0;
    f.x = v.w * (0.15 + 0.7 * r());
    f.z = v.depth * (0.15 + 0.7 * r());
    f.y = this.bandY(f, v, f.z);
    f.yaw = r() * TAU - Math.PI;
    f.pitch = 0;
    f.speed = t.cruise * len * 0.5;
    f.mode = MODE.cruise;
    f.timer = 0;
    f.arrived = true;
    f.turnDir = 1;
    f.burst = false;
    f.bgTimer = 0;
    f.food = -1;
    f.tailPhase = r() * TAU;
    f.tailAmp = 0.2;
    f.tail = 0;
    f.pecPhase = r() * TAU;
    f.pecAmp = 0.4;
    f.breathPhase = r() * TAU;
    f.snap = 0;
    f.accel = false;
    return i;
  }

  /** Removes slot i by moving the last swimmer into it (callers mirror the same move). */
  removeAt(i: number, _v?: View): void {
    const last = this.count - 1;
    if (i < 0 || i > last) return;
    if (i !== last) {
      const a = this.fish[i] as Swimmer;
      this.fish[i] = this.fish[last] as Swimmer;
      this.fish[last] = a;
    }
    this.count--;
  }

  /** Reactions to the tank state: speed, gasping, begging and resting tendencies, breathing. */
  setEnv(
    i: number,
    speedMul: number,
    gaspP: number,
    begP: number,
    restP: number,
    stress: number,
  ): void {
    const f = this.fish[i];
    if (!f) return;
    // A real change in needs (fell sick, water turned bad, got hungry): rethink right away
    // instead of finishing the current cruise.
    const changed =
      Math.abs(restP - f.restP) > 0.15 ||
      Math.abs(gaspP - f.gaspP) > 0.15 ||
      Math.abs(begP - f.begP) > 0.15;
    if (changed && f.mode !== MODE.feed && f.mode !== MODE.flee) f.timer = Math.min(f.timer, 0);
    f.speedMul = speedMul;
    f.gaspP = gaspP;
    f.begP = begP;
    f.restP = restP;
    f.stress = stress;
  }

  /** A tap on the glass: nearby fish dart away from it. */
  poke(sx: number, sy: number, v: View): void {
    for (let i = 0; i < this.count; i++) {
      const f = this.fish[i] as Swimmer;
      const fx = screenX(v, f.x, f.z);
      const fy = screenY(v, f.y, f.z);
      const reach = 60 + f.len * scaleAt(v, f.z) * 2.5;
      const dx = fx - sx;
      const dy = fy - sy;
      if (dx * dx + dy * dy > reach * reach) continue;
      f.mode = MODE.flee;
      f.timer = 0.5 + 0.5 * this.rand();
      f.arrived = false;
      f.fleeX = dx >= 0 ? 1 : -1;
      f.fleeZ = 0.8;
      f.fleeY = clamp(dy / reach, -0.5, 0.5);
    }
  }

  step(dt: number, v: View, flakes: readonly Flake[]): void {
    for (let i = 0; i < this.count; i++) this.think(this.fish[i] as Swimmer, i, dt, v, flakes);
    for (let i = 0; i < this.count; i++) this.move(this.fish[i] as Swimmer, dt, v);
  }

  // ---------------------------------------------------------------- decisions

  private bandY(f: Swimmer, v: View, z: number): number {
    const top = v.surface + f.len * 0.5;
    const bottom = floorY(v, z) - f.len * 0.6;
    const a = f.t.bandTop + (f.t.bandBottom - f.t.bandTop) * this.rand();
    return top + (bottom - top) * a;
  }

  private clampX(f: Swimmer, v: View, x: number): number {
    return clamp(x, f.len, v.w - f.len);
  }

  private clampZ(f: Swimmer, v: View, z: number): number {
    return clamp(z, f.len * 0.6, v.depth - f.len * 0.6);
  }

  private nearestFlake(f: Swimmer, flakes: readonly Flake[], maxD2: number): number {
    let best = -1;
    let bestD2 = maxD2;
    for (let k = 0; k < flakes.length; k++) {
      const fl = flakes[k] as Flake;
      if (!fl.alive || (fl.settled && !f.t.forager)) continue;
      const dx = fl.x - f.x;
      const dy = fl.y - f.y;
      const dz = fl.z - f.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = k;
      }
    }
    return best;
  }

  /** Picks the next thing to do once the current one is done. */
  private choose(f: Swimmer, i: number, v: View): void {
    const r = this.rand;
    const L = f.len;
    const t = f.t;
    const was = f.mode;
    f.arrived = false;
    f.pitchHold = NaN;
    let p = r();
    if (p < f.restP) {
      f.mode = MODE.rest;
      f.tx = this.clampX(f, v, f.x + (r() - 0.5) * L * 4);
      f.tz = this.clampZ(f, v, f.z + (r() - 0.5) * L * 3);
      f.ty = floorY(v, f.tz) - L * 0.45;
      f.timer = 4 + 5 * r();
      return;
    }
    p -= f.restP;
    if (p < f.gaspP) {
      f.mode = MODE.gasp;
      f.tx = this.clampX(f, v, f.x + (r() - 0.5) * L * 4);
      f.tz = this.clampZ(f, v, f.z + (r() - 0.5) * L * 3);
      f.ty = v.surface + L * 0.3;
      f.timer = 3 + 4 * r();
      return;
    }
    p -= f.gaspP;
    if (p < f.begP) {
      f.mode = MODE.beg;
      f.tx = this.clampX(f, v, v.w * (0.2 + 0.6 * r()));
      f.tz = this.clampZ(f, v, L * (0.6 + r()));
      const top = v.surface + L * 0.5;
      f.ty = top + (floorY(v, f.tz) - top) * (0.1 + 0.3 * r());
      f.timer = 4 + 4 * r();
      return;
    }
    if (was === MODE.cruise && r() < t.hover) {
      f.mode = MODE.hover;
      f.tx = f.x;
      f.ty = f.y;
      f.tz = f.z;
      f.arrived = true;
      f.timer = 1.2 + 2.8 * r();
      return;
    }
    if (t.forager && r() < 0.25) {
      f.mode = MODE.forage;
      f.tx = this.clampX(f, v, f.x + (r() - 0.5) * L * 8);
      f.tz = this.clampZ(f, v, f.z + (r() - 0.5) * L * 6);
      f.ty = floorY(v, f.tz) - L * 0.45;
      f.timer = 3 + 3 * r();
      return;
    }
    f.mode = MODE.cruise;
    f.timer = 6 + 6 * r();
    // Strong schoolers follow the first fish of their group around the tank.
    if (t.school >= 0.8) {
      for (let j = 0; j < i; j++) {
        const g = this.fish[j] as Swimmer;
        if (g.group !== f.group || g.mode !== MODE.cruise) continue;
        f.tx = this.clampX(f, v, g.tx + (r() - 0.5) * L * 3);
        f.tz = this.clampZ(f, v, g.tz + (r() - 0.5) * L * 3);
        f.ty = clamp(g.ty + (r() - 0.5) * L * 2, v.surface + L * 0.5, floorY(v, f.tz) - L * 0.6);
        return;
      }
    }
    f.tx = this.clampX(f, v, v.w * (0.08 + 0.84 * r()));
    // Fish mostly patrol along the glass: most waypoints stay near the current depth.
    f.tz = this.clampZ(
      f,
      v,
      r() < 0.75 ? f.z + (r() - 0.5) * v.depth * 0.45 : v.depth * (0.08 + 0.84 * r()),
    );
    f.ty = r() < t.surface ? v.surface + L * 0.4 : this.bandY(f, v, f.tz);
  }

  private think(f: Swimmer, i: number, dt: number, v: View, flakes: readonly Flake[]): void {
    const L = f.len;
    const t = f.t;
    const r = this.rand;
    f.timer -= dt;
    f.snap = Math.max(0, f.snap - dt * 3);

    // Food beats everything except fright. Resting (sick) fish only take food that drifts close.
    if (f.mode !== MODE.flee) {
      const reach = f.mode === MODE.rest ? L * 4 : v.w * 1.5;
      const k = this.nearestFlake(f, flakes, reach * reach);
      if (k >= 0) {
        f.mode = MODE.feed;
        f.food = k;
        f.arrived = false;
      } else if (f.mode === MODE.feed) {
        f.mode = MODE.cruise;
        f.timer = 0;
      }
    }

    if (f.mode === MODE.feed) {
      const fl = flakes[f.food] as Flake;
      f.tx = fl.x;
      f.ty = fl.y;
      f.tz = fl.z;
      const cp = Math.cos(f.pitch);
      const hx = f.x + Math.cos(f.yaw) * cp * L * 0.5 - fl.x;
      const hy = f.y + Math.sin(f.pitch) * L * 0.5 - fl.y;
      const hz = f.z + Math.sin(f.yaw) * cp * L * 0.5 - fl.z;
      if (hx * hx + hy * hy + hz * hz < L * L * 0.2) {
        fl.alive = false;
        f.snap = 1;
        f.speed *= 0.6;
      }
    } else {
      const ex = f.tx - f.x;
      const ey = f.ty - f.y;
      const ez = f.tz - f.z;
      const near = Math.max(L * 0.8, 6);
      if (!f.arrived && ex * ex + ey * ey + ez * ez < near * near) {
        f.arrived = true;
        if (f.mode === MODE.cruise) f.timer = Math.min(f.timer, 0);
      }
      // Begging fish pace along the front glass; foraging fish peck at the gravel.
      if (f.mode === MODE.beg && f.arrived && f.timer > 0) {
        f.tx = this.clampX(f, v, f.x + (r() < 0.5 ? -1 : 1) * L * (2 + 3 * r()));
        f.arrived = false;
      }
      if (f.mode === MODE.forage && f.arrived && r() < dt * 1.5) f.snap = 1;
      if (f.timer <= 0) this.choose(f, i, v);
    }

    // ---- desired direction
    let dx: number;
    let dy: number;
    let dz: number;
    let dist = 0;
    if (f.mode === MODE.flee) {
      dx = f.fleeX;
      dy = f.fleeY;
      dz = f.fleeZ;
    } else {
      dx = f.tx - f.x;
      dy = f.ty - f.y;
      dz = f.tz - f.z;
      dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > 1e-6) {
        dx /= dist;
        dy /= dist;
        dz /= dist;
      }
      if (f.arrived) {
        // Hold station: drift gently back to the spot.
        const k = Math.min(1, dist / L) * 0.3;
        dx *= k;
        dy *= k;
        dz *= k;
      }
    }

    // Separation from everyone, plus alignment and cohesion with schoolmates.
    let ax = 0;
    let ay = 0;
    let az = 0;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    let n = 0;
    const schoolR2 = L * L * 25;
    for (let j = 0; j < this.count; j++) {
      if (j === i) continue;
      const g = this.fish[j] as Swimmer;
      const ex = f.x - g.x;
      const ey = f.y - g.y;
      const ez = f.z - g.z;
      const e2 = ex * ex + ey * ey + ez * ez;
      const minD = (L + g.len) * 0.55;
      if (e2 < minD * minD && e2 > 1e-6) {
        const e = Math.sqrt(e2);
        const push = ((minD - e) / minD) * 2;
        dx += (ex / e) * push;
        dy += (ey / e) * push;
        dz += (ez / e) * push;
      }
      if (t.school > 0 && g.group === f.group && e2 < schoolR2) {
        n++;
        const gp = Math.cos(g.pitch);
        ax += Math.cos(g.yaw) * gp;
        ay += Math.sin(g.pitch);
        az += Math.sin(g.yaw) * gp;
        cx += g.x;
        cy += g.y;
        cz += g.z;
      }
    }
    if (n > 0 && (f.mode === MODE.cruise || f.mode === MODE.hover)) {
      const k = t.school;
      dx += (ax / n) * 0.7 * k;
      dy += (ay / n) * 0.7 * k;
      dz += (az / n) * 0.7 * k;
      const qx = cx / n - f.x;
      const qy = cy / n - f.y;
      const qz = cz / n - f.z;
      const q = Math.sqrt(qx * qx + qy * qy + qz * qz);
      if (q > L) {
        dx += (qx / q) * 0.6 * k;
        dy += (qy / q) * 0.6 * k;
        dz += (qz / q) * 0.6 * k;
      }
    }

    // Soft walls.
    const m = L * 1.5;
    if (f.x < m) dx += ((m - f.x) / m) * 2.5;
    else if (f.x > v.w - m) dx -= ((f.x - (v.w - m)) / m) * 2.5;
    const mz = L * 1.2;
    if (f.z < mz && f.mode !== MODE.beg) dz += ((mz - f.z) / mz) * 2.5;
    else if (f.z > v.depth - mz) dz -= ((f.z - (v.depth - mz)) / mz) * 2.5;
    const top = v.surface + L * 0.5;
    const bottom = floorY(v, f.z) - L * 0.5;
    if (f.y < top && f.mode !== MODE.gasp && f.mode !== MODE.feed) dy += ((top - f.y) / L) * 1.5;
    if (f.y > bottom && f.mode !== MODE.rest && f.mode !== MODE.forage && f.mode !== MODE.feed)
      dy -= ((f.y - bottom) / L) * 1.5;

    f.dx = dx;
    f.dy = dy;
    f.dz = dz;

    // ---- desired speed (px/s)
    const cruise = t.cruise * L * f.speedMul;
    let want: number;
    switch (f.mode) {
      case MODE.cruise:
        if (t.burstGlide) {
          f.bgTimer -= dt;
          if (f.bgTimer <= 0) {
            f.burst = !f.burst;
            f.bgTimer = f.burst ? 0.2 + 0.25 * r() : 0.4 + 0.8 * r();
          }
          want = cruise * (f.burst ? 1.9 : 0.35);
        } else want = cruise;
        break;
      case MODE.hover:
        want = 0.06 * L;
        break;
      case MODE.rest:
        want = f.arrived ? 0.03 * L : 0.5 * cruise + 0.25 * L;
        break;
      case MODE.forage:
        want = f.arrived ? 0.05 * L : 0.8 * cruise;
        break;
      case MODE.gasp:
        want = f.arrived ? 0.04 * L : 0.9 * cruise + 0.2 * L;
        break;
      case MODE.beg:
        want = f.arrived ? 0.1 * L : 0.8 * cruise + 0.3 * L;
        break;
      case MODE.feed:
        want =
          Math.min(t.burst, 2.4 * t.cruise) *
          L *
          Math.sqrt(f.speedMul) *
          clamp(dist / (2 * L), 0.35, 1);
        break;
      case MODE.flee:
        want = t.burst * L;
        break;
    }
    f.want = want;
    f.pitchHold =
      !f.arrived || f.mode === MODE.cruise
        ? NaN
        : f.mode === MODE.gasp
          ? -0.35
          : f.mode === MODE.forage
            ? 0.5
            : f.mode === MODE.rest
              ? 0.08
              : 0;
  }

  // ---------------------------------------------------------------- physics

  private move(f: Swimmer, dt: number, v: View): void {
    const L = f.len;
    const t = f.t;
    const d = Math.sqrt(f.dx * f.dx + f.dy * f.dy + f.dz * f.dz);
    let turnSlow = 1;
    let wantPitch = f.pitchHold === f.pitchHold ? f.pitchHold : 0;
    if (d > 0.05) {
      const horiz = Math.sqrt(f.dx * f.dx + f.dz * f.dz);
      if (horiz > d * 0.15) {
        let dYaw = wrapAngle(Math.atan2(f.dz, f.dx) - f.yaw);
        // Keep turning the same way through a full reversal instead of dithering.
        if (Math.abs(dYaw) > 2.8) dYaw = Math.abs(dYaw) * f.turnDir;
        else f.turnDir = dYaw >= 0 ? 1 : -1;
        const cruise = t.cruise * L;
        const rate =
          t.turnRate * (f.mode === MODE.flee ? 1 : 0.35 + 0.65 * Math.min(1, f.speed / cruise));
        const maxTurn = rate * dt;
        f.yaw = wrapAngle(f.yaw + clamp(dYaw, -maxTurn, maxTurn));
        turnSlow = 0.55 + 0.45 * Math.max(0, Math.cos(Math.min(Math.abs(dYaw), Math.PI)));
      }
      if (f.pitchHold !== f.pitchHold) {
        // Cruising fish stay fairly level; diving to food, the gravel or the surface is steeper,
        // and nimble species (high turn rate) can climb more steeply than big stiff ones.
        const agile = Math.min(0.8, 0.1 + 0.12 * t.turnRate);
        const lim = f.mode === MODE.cruise || f.mode === MODE.hover ? Math.min(0.3, agile) : agile;
        wantPitch = clamp(Math.atan2(f.dy, Math.max(horiz, 1e-6)), -lim, lim);
      }
    }
    f.pitch += clamp(wantPitch - f.pitch, -1.6 * dt, 1.6 * dt);

    const want = f.want * turnSlow;
    f.accel = want > f.speed * 1.05 + 0.02 * L;
    const up = (f.mode === MODE.flee ? 40 : f.mode === MODE.feed ? 12 : 5) * L;
    const down = 1.8 * L;
    f.speed +=
      want > f.speed ? Math.min(want - f.speed, up * dt) : -Math.min(f.speed - want, down * dt);

    const cp = Math.cos(f.pitch);
    f.x = clamp(f.x + Math.cos(f.yaw) * cp * f.speed * dt, L * 0.3, v.w - L * 0.3);
    f.z = clamp(f.z + Math.sin(f.yaw) * cp * f.speed * dt, L * 0.3, v.depth - L * 0.3);
    // Resting (sick or chilled) fish lose some buoyancy control and sink toward the gravel.
    const sink = f.mode === MODE.rest && !f.arrived ? 0.8 * L : 0;
    f.y = clamp(
      f.y + (Math.sin(f.pitch) * f.speed + sink) * dt,
      v.surface + L * 0.12,
      floorY(v, f.z) - L * 0.22,
    );

    // Tail beat: faster and wider when accelerating, almost still while gliding.
    const gliding = f.want < f.speed * 0.8;
    const sNorm = f.speed / Math.max(1e-3, t.cruise * L);
    let amp = f.accel
      ? 0.55
      : gliding
        ? 0.06
        : f.speed < 0.25 * L
          ? 0.12
          : 0.22 + 0.12 * Math.min(1.5, sNorm);
    if (f.mode === MODE.flee) amp = 0.7;
    f.tailAmp += (amp - f.tailAmp) * Math.min(1, dt * 7);
    const freq = Math.min(14, 1.1 + 1.4 * (f.speed / L) + (f.accel ? 2.5 : 0));
    f.tailPhase = (f.tailPhase + TAU * freq * dt) % TAU;
    f.tail = f.tailAmp * Math.sin(f.tailPhase);
    // Pectoral fins scull when hovering; gills breathe faster under stress.
    const slow = f.speed < 0.4 * L;
    f.pecAmp += ((slow ? 0.9 : 0.35) - f.pecAmp) * Math.min(1, dt * 4);
    f.pecPhase = (f.pecPhase + TAU * (slow ? 3.2 : 1.5) * dt) % TAU;
    f.breathPhase = (f.breathPhase + TAU * (1 + 1.8 * f.stress) * dt) % TAU;
  }
}
