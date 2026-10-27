/**
 * Fish motion for the open tank: wander steering with wall avoidance (GDD §14).
 * All state lives in preallocated typed arrays so the frame loop allocates nothing.
 */
export const MAX_DRAWN = 60;

export class MotionPool {
  readonly x = new Float32Array(MAX_DRAWN);
  readonly y = new Float32Array(MAX_DRAWN);
  readonly vx = new Float32Array(MAX_DRAWN);
  readonly vy = new Float32Array(MAX_DRAWN);
  readonly wander = new Float32Array(MAX_DRAWN);
  readonly phase = new Float32Array(MAX_DRAWN);
  /** Body length in CSS px. */
  readonly len = new Float32Array(MAX_DRAWN);
  /** 1 = healthy speed; sick fish swim slower (GDD §14). */
  readonly speedMul = new Float32Array(MAX_DRAWN);
  /** 0..1 preferred depth bias; sick fish swim lower. */
  readonly depthBias = new Float32Array(MAX_DRAWN);
  count = 0;

  /** Places a fish at a random spot (only on spawn, not per frame). */
  spawn(i: number, w: number, h: number, rand: () => number): void {
    this.x[i] = w * (0.15 + 0.7 * rand());
    this.y[i] = h * (0.2 + 0.55 * rand());
    const a = rand() * Math.PI * 2;
    this.vx[i] = Math.cos(a) * 20;
    this.vy[i] = Math.sin(a) * 6;
    this.wander[i] = a;
    this.phase[i] = rand() * Math.PI * 2;
  }

  copy(from: number, to: number): void {
    this.x[to] = this.x[from] as number;
    this.y[to] = this.y[from] as number;
    this.vx[to] = this.vx[from] as number;
    this.vy[to] = this.vy[from] as number;
    this.wander[to] = this.wander[from] as number;
    this.phase[to] = this.phase[from] as number;
    this.len[to] = this.len[from] as number;
    this.speedMul[to] = this.speedMul[from] as number;
    this.depthBias[to] = this.depthBias[from] as number;
  }

  /**
   * Steps every fish by dt seconds inside a w × h box (sand height `floor` at the bottom).
   * When `attractX` is not NaN, fish also steer toward that point (feeding).
   */
  step(dt: number, w: number, h: number, floor: number, attractX: number, attractY: number): void {
    const top = h * 0.08;
    const bottom = h - floor;
    for (let i = 0; i < this.count; i++) {
      const len = this.len[i] as number;
      const sp = this.speedMul[i] as number;
      const cruise = (18 + len * 0.9) * sp;

      // Wander: a slowly drifting desired heading.
      let wa = (this.wander[i] as number) + (Math.random() - 0.5) * 2.4 * dt;
      // Keep headings mostly horizontal, like real fish.
      const desiredVx = Math.cos(wa) * cruise;
      let desiredVy = Math.sin(wa) * cruise * 0.35;

      // Depth preference (sick fish sink toward the bottom).
      const targetY = top + (bottom - top) * (this.depthBias[i] as number);
      desiredVy += ((targetY - (this.y[i] as number)) / h) * 8;

      let ax = (desiredVx - (this.vx[i] as number)) * 1.2;
      let ay = (desiredVy - (this.vy[i] as number)) * 1.2;

      if (attractX === attractX) {
        const dx = attractX - (this.x[i] as number);
        const dy = attractY - (this.y[i] as number);
        const d = Math.sqrt(dx * dx + dy * dy) + 1;
        ax += (dx / d) * 90 * sp;
        ay += (dy / d) * 90 * sp;
      }

      // Wall avoidance: push back from edges within a margin, and turn the wander heading.
      const margin = Math.max(24, len * 1.5);
      const x = this.x[i] as number;
      const y = this.y[i] as number;
      if (x < margin) {
        ax += (margin - x) * 6;
        if (Math.cos(wa) < 0) wa = Math.PI - wa;
      } else if (x > w - margin) {
        ax -= (x - (w - margin)) * 6;
        if (Math.cos(wa) > 0) wa = Math.PI - wa;
      }
      if (y < top + margin * 0.5) ay += (top + margin * 0.5 - y) * 6;
      else if (y > bottom - margin * 0.5) ay -= (y - (bottom - margin * 0.5)) * 6;
      this.wander[i] = wa;

      let vx = (this.vx[i] as number) + ax * dt;
      let vy = (this.vy[i] as number) + ay * dt;
      const speed = Math.sqrt(vx * vx + vy * vy);
      const maxSpeed = cruise * 2.2;
      if (speed > maxSpeed) {
        vx = (vx / speed) * maxSpeed;
        vy = (vy / speed) * maxSpeed;
      }
      this.vx[i] = vx;
      this.vy[i] = vy;
      this.x[i] = Math.min(w - 2, Math.max(2, x + vx * dt));
      this.y[i] = Math.min(bottom - 2, Math.max(top, y + vy * dt));
      this.phase[i] = (this.phase[i] as number) + dt * (4 + speed * 0.12);
    }
  }
}
