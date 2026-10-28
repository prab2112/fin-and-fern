import { describe, expect, it } from 'vitest';
import { QUALITY_MAX, QualityGovernor } from '../../src/render/quality';

/** Feeds frames at `fps` for `seconds`, starting at time t; returns the end time. */
function run(q: QualityGovernor, t: number, fps: number, seconds: number): number {
  const dt = 1000 / fps;
  const end = t + seconds * 1000;
  let now = t;
  while (now < end) {
    now += dt;
    q.frame(now);
  }
  return now;
}

describe('adaptive quality (GDD §14)', () => {
  it('stays at full quality on a device that holds 60 fps', () => {
    const q = new QualityGovernor(0);
    run(q, 0, 60, 30);
    expect(q.quality).toBe(QUALITY_MAX);
  });

  it('steps down one level per window while the device is below 48 fps', () => {
    const q = new QualityGovernor(0);
    let t = run(q, 0, 30, 2.1);
    expect(q.quality).toBe(QUALITY_MAX - 1);
    t = run(q, t, 30, 2.1);
    expect(q.quality).toBe(0);
    run(q, t, 30, 10);
    expect(q.quality).toBe(0);
  });

  it('steps back up after 10 s of smooth frames', () => {
    const q = new QualityGovernor(0);
    let t = run(q, 0, 30, 4.2);
    expect(q.quality).toBe(0);
    // The window that straddles the change isn't smooth yet, so allow one extra window.
    t = run(q, t, 60, 12.5);
    expect(q.quality).toBe(1);
    run(q, t, 60, 10.5);
    expect(q.quality).toBe(2);
  });

  it('a pause (app in the background, a build) is not a slow device', () => {
    const q = new QualityGovernor(0);
    let t = run(q, 0, 60, 1.5);
    // Two app switches in quick succession: 5 s and 3 s without frames.
    t += 5000;
    t = run(q, t, 60, 1.5);
    t += 3000;
    run(q, t, 60, 3);
    expect(q.quality).toBe(QUALITY_MAX);
  });

  it('a step up that does not hold backs off for a minute', () => {
    const q = new QualityGovernor(0);
    let t = run(q, 0, 30, 2.1);
    expect(q.quality).toBe(1);
    t = run(q, t, 60, 10.5);
    expect(q.quality).toBe(2);
    // Too much for this device after all.
    t = run(q, t, 30, 2.1);
    expect(q.quality).toBe(1);
    t = run(q, t, 60, 30);
    expect(q.quality).toBe(1);
    run(q, t, 60, 45);
    expect(q.quality).toBe(2);
  });
});
