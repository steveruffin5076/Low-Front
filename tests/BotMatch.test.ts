import { describe, expect, it } from 'vitest';
import { createBotMatch } from './sim/botMatch';

declare const process: { env: Record<string, string | undefined> };

/**
 * A full headless Conquest match (plan section 12 check): 31 bots, real physics, nav and
 * bullets, run until a result. Slow (minutes), so it runs only with `npm run test:match`.
 */
/** `BOT_MATCH_SEEDS=7,11,23` plays one match per seed. */
const SEEDS = (process.env.BOT_MATCH_SEEDS ?? '7').split(',').map(Number);

describe.skipIf(!process.env.BOT_MATCH)('bot match', () => {
  it.each(SEEDS)('seed %i plays to a winner with no bot stuck over 5 s', async (seed) => {
    const m = await createBotMatch(seed);
    const t0 = performance.now();
    let kills = 0;
    let flips = 0;
    let reloads = 0;
    let maxStuck = 0;
    const byWeapon: Record<string, number> = {};
    m.match.events.on('kill', (k) => {
      kills++;
      byWeapon[k.weapon] = (byWeapon[k.weapon] ?? 0) + 1;
    });
    const owners = new Map(m.match.zones.map((z) => [z.flag.id, z.owner]));
    for (const b of m.bots.bots) b.weapons.events.on('reloadStart', () => reloads++);
    const limit = 60 * 60 * 26;
    let i = 0;
    for (; i < limit && !m.match.result; i++) {
      m.step();
      for (const z of m.match.zones) {
        if (z.owner && owners.get(z.flag.id) !== z.owner) flips++;
        owners.set(z.flag.id, z.owner);
      }
      for (const b of m.bots.bots) if (b.alive) maxStuck = Math.max(maxStuck, b.stuckFor);
      if (i % (60 * 120) === 0) {
        const t = m.match.tickets.count;
        console.log(`t=${(i / 60).toFixed(0)}s tickets ${t.blue}/${t.red} kills ${kills} flags ${m.match.zones.map((z) => z.flag.id + (z.owner?.[0] ?? '-')).join(' ')}`);
      }
    }
    const msPerStep = (performance.now() - t0) / i;
    console.log(`seed ${seed}: result ${JSON.stringify(m.match.result)} at ${(i / 60).toFixed(0)}s, kills ${kills}, flips ${flips}, reloads ${reloads}, longest stuck ${maxStuck.toFixed(1)}s, unsticks ${m.bots.bots.reduce((n, b) => n + b.unsticks, 0)}, resupplies ${m.bots.resupply.uses}, ${msPerStep.toFixed(2)} ms per step`);
    const carried: Record<string, number> = {};
    for (const b of m.bots.bots) carried[b.weapons.weapons.primary.def.name] = (carried[b.weapons.weapons.primary.def.name] ?? 0) + 1;
    console.log(`kills by weapon ${JSON.stringify(byWeapon)}, bots by primary ${JSON.stringify(carried)}`);
    expect(m.match.result).not.toBeNull();
    expect(m.match.result!.winner).not.toBeNull();
    expect(kills).toBeGreaterThan(20);
    expect(flips).toBeGreaterThan(3);
    expect(reloads).toBeGreaterThan(10);
    expect(maxStuck).toBeLessThan(5);
  }, 3_600_000);
});
