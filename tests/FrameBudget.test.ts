import { describe, expect, it } from 'vitest';
import { createBotMatch } from './sim/botMatch';

/**
 * CPU frame budget (performance-optimization skill): a 16 vs 16 match on real physics, nav and
 * bullets, timed for 40 s of game time after the bots spread out. Steps run at 60 Hz, so one
 * frame is 16.7 ms; the simulation must leave most of it for rendering. Headless: says nothing
 * about GPU time. Budgets have headroom for slower CI machines; locally a step is about 2 ms.
 */
const BUDGET = { averageMs: 8, p95Ms: 16.7 };

describe('frame budget', () => {
  it(`a 32-soldier match step averages under ${BUDGET.averageMs} ms, p95 under ${BUDGET.p95Ms} ms`, async () => {
    const m = await createBotMatch(7);
    // Skip loading and the first spread-out (first-use spikes), as in a real profile.
    for (let i = 0; i < 20 * 60; i++) m.step();
    const ms: number[] = [];
    for (let i = 0; i < 40 * 60; i++) {
      const t0 = performance.now();
      m.step();
      ms.push(performance.now() - t0);
    }
    ms.sort((a, b) => a - b);
    const avg = ms.reduce((s, v) => s + v, 0) / ms.length;
    const p95 = ms[Math.floor(ms.length * 0.95)];
    const p99 = ms[Math.floor(ms.length * 0.99)];
    console.log(`FRAME avg=${avg.toFixed(2)}ms p95=${p95.toFixed(2)}ms p99=${p99.toFixed(2)}ms max=${ms[ms.length - 1].toFixed(2)}ms`);
    expect(avg).toBeLessThan(BUDGET.averageMs);
    expect(p95).toBeLessThan(BUDGET.p95Ms);
  }, 180_000);
});
