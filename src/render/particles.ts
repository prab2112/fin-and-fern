import { floorY, scaleAt, screenX, screenY, type View } from './projection';
import type { Flake } from './swim';

/**
 * Small moving things in the open tank (GDD §14): food flakes, filter bubbles, suspended
 * particles, surface ripples and tap rings. Every pool is preallocated; nothing allocates per frame.
 */

export interface FoodFlake extends Flake {
  /** 0 floating on the surface, 1 sinking, 2 lying on the gravel. */
  phase: number;
  vy: number;
  rot: number;
  spin: number;
  drift: number;
  wobble: number;
  size: number;
  colour: string;
  timer: number;
}

interface Bubble {
  alive: boolean;
  x: number;
  y: number;
  z: number;
  r: number;
  vy: number;
  wobble: number;
  inTube: boolean;
}

interface Mote {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
}

interface Ripple {
  alive: boolean;
  x: number;
  z: number;
  age: number;
  max: number;
}

interface Ring {
  alive: boolean;
  x: number;
  y: number;
  age: number;
}

/** Where the filter's bubbles come from (world px), set by the environment. */
export interface BubbleSource {
  x: number;
  z: number;
  /** Top of the sponge, where bubbles enter the uplift tube. */
  yStart: number;
  /** Top of the uplift tube, where bubbles leave it. */
  yTubeTop: number;
  tubeR: number;
}

const MAX_FLAKES = 64;
const MAX_BUBBLES = 48;
const MAX_MOTES = 160;
const MAX_RIPPLES = 16;
const MAX_RINGS = 6;
const FLAKE_COLOURS = ['#c8452f', '#e3a33b', '#8a5a2b', '#d9c37a', '#6f9a3c', '#b8322a'];
const FLAKE_LIFE_ON_GRAVEL_S = 25;
const TAU = Math.PI * 2;

export class Particles {
  readonly flakes: FoodFlake[] = [];
  private readonly bubbles: Bubble[] = [];
  private readonly motes: Mote[] = [];
  private readonly ripples: Ripple[] = [];
  private readonly rings: Ring[] = [];
  private bubbleClock = 0;
  moteCount = 30;
  private readonly rand: () => number;

  constructor(rand: () => number = Math.random) {
    this.rand = rand;
    for (let i = 0; i < MAX_FLAKES; i++)
      this.flakes.push({
        alive: false,
        settled: false,
        x: 0,
        y: 0,
        z: 0,
        phase: 0,
        vy: 0,
        rot: 0,
        spin: 0,
        drift: 0,
        wobble: 0,
        size: 2,
        colour: FLAKE_COLOURS[0] as string,
        timer: 0,
      });
    for (let i = 0; i < MAX_BUBBLES; i++)
      this.bubbles.push({ alive: false, x: 0, y: 0, z: 0, r: 1, vy: 0, wobble: 0, inTube: true });
    for (let i = 0; i < MAX_MOTES; i++)
      this.motes.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 1 });
    for (let i = 0; i < MAX_RIPPLES; i++)
      this.ripples.push({ alive: false, x: 0, z: 0, age: 0, max: 1 });
    for (let i = 0; i < MAX_RINGS; i++) this.rings.push({ alive: false, x: 0, y: 0, age: 0 });
  }

  /** Scatters motes through the water (on resize). */
  seedMotes(v: View): void {
    const r = this.rand;
    for (const m of this.motes) {
      m.x = r() * v.w;
      m.z = r() * v.depth;
      m.y = v.surface + r() * (floorY(v, m.z) - v.surface);
      m.vx = (r() - 0.5) * 3;
      m.vy = (r() - 0.5) * 2;
      m.vz = (r() - 0.5) * 3;
      m.size = 0.7 + r() * 0.9;
    }
  }

  clearFood(): void {
    for (const f of this.flakes) f.alive = false;
  }

  /** A pinch of flakes lands on the surface, floats a moment, then sinks. */
  dropFood(count: number, v: View): void {
    const r = this.rand;
    const cx = v.w * (0.35 + 0.3 * r());
    const cz = v.depth * (0.15 + 0.35 * r());
    let made = 0;
    for (const f of this.flakes) {
      if (made >= count) break;
      if (f.alive) continue;
      made++;
      f.alive = true;
      f.settled = false;
      f.phase = 0;
      f.x = Math.min(v.w - 4, Math.max(4, cx + (r() - 0.5) * v.w * 0.4));
      f.z = Math.min(v.depth - 4, Math.max(4, cz + (r() - 0.5) * v.depth * 0.4));
      f.y = v.surface + 0.5;
      f.vy = 0;
      f.rot = r() * TAU;
      f.spin = (r() - 0.5) * 3;
      f.drift = (r() - 0.5) * 6;
      f.wobble = r() * TAU;
      f.size = 1.4 + r() * 1.4;
      f.colour = FLAKE_COLOURS[Math.floor(r() * FLAKE_COLOURS.length)] as string;
      f.timer = 0.8 + 2.5 * r();
      if (made % 4 === 1) this.ripple(f.x, f.z, 10 + r() * 8);
    }
  }

  ripple(x: number, z: number, max: number): void {
    for (const p of this.ripples)
      if (!p.alive) {
        p.alive = true;
        p.x = x;
        p.z = z;
        p.age = 0;
        p.max = max;
        return;
      }
  }

  /** A tap on the front glass leaves a fading ring. */
  ring(sx: number, sy: number): void {
    for (const p of this.rings)
      if (!p.alive) {
        p.alive = true;
        p.x = sx;
        p.y = sy;
        p.age = 0;
        return;
      }
  }

  step(dt: number, v: View, src: BubbleSource | null, dirt: number): void {
    const r = this.rand;

    for (const f of this.flakes) {
      if (!f.alive) continue;
      if (f.phase === 0) {
        // Floating: drifts on the surface film, then soaks and sinks.
        f.x += f.drift * dt;
        f.timer -= dt;
        if (f.timer <= 0) {
          f.phase = 1;
          f.vy = 0;
        }
      } else if (f.phase === 1) {
        f.vy = Math.min(9 + f.size * 3, f.vy + 20 * dt);
        f.wobble += dt * 2.2;
        f.x += Math.sin(f.wobble) * 6 * dt;
        f.y += f.vy * dt;
        f.rot += f.spin * dt;
        const fy = floorY(v, f.z) - 0.5;
        if (f.y >= fy) {
          f.y = fy;
          f.phase = 2;
          f.settled = true;
          f.timer = FLAKE_LIFE_ON_GRAVEL_S;
        }
      } else {
        f.timer -= dt;
        if (f.timer <= 0) f.alive = false;
      }
      if (f.x < 2 || f.x > v.w - 2) f.drift = -f.drift;
      f.x = Math.min(v.w - 2, Math.max(2, f.x));
    }

    if (src) {
      this.bubbleClock -= dt;
      if (this.bubbleClock <= 0) {
        this.bubbleClock = 0.05 + r() * 0.07;
        for (const b of this.bubbles)
          if (!b.alive) {
            b.alive = true;
            b.inTube = true;
            b.x = src.x + (r() - 0.5) * src.tubeR;
            b.z = src.z + (r() - 0.5) * src.tubeR;
            b.y = src.yStart;
            b.r = 0.9 + r() * 1.5;
            b.vy = 30 + r() * 30;
            b.wobble = r() * TAU;
            break;
          }
      }
      for (const b of this.bubbles) {
        if (!b.alive) continue;
        b.vy = Math.min(150 + b.r * 30, b.vy + 260 * dt);
        b.y -= b.vy * dt;
        b.wobble += dt * (9 + b.r * 2);
        if (b.inTube) {
          b.x = src.x + Math.sin(b.wobble) * src.tubeR * 0.35;
          if (b.y <= src.yTubeTop) b.inTube = false;
        } else {
          b.x += Math.sin(b.wobble) * 26 * dt;
          b.r += dt * 0.25;
        }
        if (b.y <= v.surface + b.r) {
          b.alive = false;
          if (r() < 0.3) this.ripple(b.x, b.z, 6 + r() * 6);
        }
      }
    }

    // Suspended particles: more of them, and browner, in dirty water.
    this.moteCount = Math.min(MAX_MOTES, 26 + Math.floor(dirt * 1.3));
    for (let i = 0; i < this.moteCount; i++) {
      const m = this.motes[i] as Mote;
      m.vx += (r() - 0.5) * 6 * dt;
      m.vy += ((r() - 0.5) * 4 + 0.15) * dt;
      m.vz += (r() - 0.5) * 6 * dt;
      m.vx *= 0.995;
      m.vy *= 0.995;
      m.vz *= 0.995;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.z += m.vz * dt;
      if (m.x < 0) m.x += v.w;
      else if (m.x > v.w) m.x -= v.w;
      if (m.z < 0) m.z += v.depth;
      else if (m.z > v.depth) m.z -= v.depth;
      const fy = floorY(v, m.z);
      if (m.y > fy) m.y = v.surface + 2;
      else if (m.y < v.surface) m.y = fy - 2;
    }

    for (const p of this.ripples) {
      if (!p.alive) continue;
      p.age += dt;
      if (p.age > 1.4) p.alive = false;
    }
    for (const p of this.rings) {
      if (!p.alive) continue;
      p.age += dt;
      if (p.age > 0.6) p.alive = false;
    }
  }

  liveFlakes(): number {
    let n = 0;
    for (const f of this.flakes) if (f.alive) n++;
    return n;
  }

  // ---------------------------------------------------------------- drawing

  drawFlakes(ctx: CanvasRenderingContext2D, v: View): void {
    for (const f of this.flakes) {
      if (!f.alive) continue;
      const p = scaleAt(v, f.z);
      const s = f.size * p;
      ctx.globalAlpha = f.phase === 2 ? Math.min(1, f.timer / 3) * 0.85 : 0.95;
      ctx.fillStyle = f.colour;
      ctx.save();
      ctx.translate(screenX(v, f.x, f.z), screenY(v, f.y, f.z));
      ctx.rotate(f.rot);
      ctx.scale(1, f.phase === 0 ? 0.45 : 0.8);
      ctx.fillRect(-s, -s * 0.6, s * 2, s * 1.2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  drawBubbles(ctx: CanvasRenderingContext2D, v: View): void {
    ctx.lineWidth = 0.8;
    for (const b of this.bubbles) {
      if (!b.alive) continue;
      const p = scaleAt(v, b.z);
      const x = screenX(v, b.x, b.z);
      const y = screenY(v, b.y, b.z);
      const r = Math.max(0.6, b.r * p);
      ctx.globalAlpha = b.inTube ? 0.55 : 0.85;
      ctx.fillStyle = 'rgba(200,240,250,0.18)';
      ctx.strokeStyle = 'rgba(230,250,255,0.85)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.32, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** Back half (behind the fish) or front half of the suspended particles. */
  drawMotes(ctx: CanvasRenderingContext2D, v: View, back: boolean, dirty: boolean): void {
    ctx.fillStyle = dirty ? '#b9b08a' : '#d6ece6';
    const half = v.depth * 0.5;
    for (let i = 0; i < this.moteCount; i++) {
      const m = this.motes[i] as Mote;
      if (m.z > half !== back) continue;
      const p = scaleAt(v, m.z);
      const s = m.size * p;
      ctx.globalAlpha = 0.18 + 0.3 * p - (back ? 0.1 : 0);
      ctx.fillRect(screenX(v, m.x, m.z), screenY(v, m.y, m.z), s, s);
    }
    ctx.globalAlpha = 1;
  }

  drawRipples(ctx: CanvasRenderingContext2D, v: View): void {
    ctx.strokeStyle = '#e6fbff';
    ctx.lineWidth = 1;
    for (const p of this.ripples) {
      if (!p.alive) continue;
      const k = p.age / 1.4;
      const s = scaleAt(v, p.z);
      const rad = (2 + p.max * k) * s;
      ctx.globalAlpha = 0.5 * (1 - k);
      ctx.beginPath();
      ctx.ellipse(screenX(v, p.x, p.z), screenY(v, v.surface, p.z), rad, rad * 0.25, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawRings(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    for (const p of this.rings) {
      if (!p.alive) continue;
      const k = p.age / 0.6;
      ctx.globalAlpha = 0.45 * (1 - k);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6 + 28 * k, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
