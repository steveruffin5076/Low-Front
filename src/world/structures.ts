import { MAP_COLORS } from '../data/map/config';
import type { PropDef } from '../data/map/types';
import { LocalFrame } from './LocalFrame';
import type { StaticSink } from './StaticSink';

/** Footbridge deck height: the same as a second floor so the nav grid shares the level. */
const DECK_TOP = 6.15;
const DECK_LENGTH = 22;
const WIDTH = 3;
const STAIR_RUN = 9;
const STEPS = 18;

/**
 * Footbridge over the rail tracks (flag E): a deck at 6 m on columns with railings and a
 * staircase at each end. Local frame: deck along Z.
 */
export function buildFootbridge(def: PropDef, sink: StaticSink): LocalFrame {
  const f = new LocalFrame(sink, def.rotY, def.x, def.z);
  const steel = 0x5b6b7a;
  f.boxFromTo([-WIDTH / 2, DECK_TOP - 0.3, -DECK_LENGTH / 2], [WIDTH / 2, DECK_TOP, DECK_LENGTH / 2], MAP_COLORS.concrete, { kind: 'floor', surface: 'metal' });
  for (const s of [-1, 1]) {
    f.boxFromTo([s * WIDTH / 2 - 0.05, DECK_TOP, -DECK_LENGTH / 2], [s * WIDTH / 2 + 0.05, DECK_TOP + 1.1, DECK_LENGTH / 2], steel, { kind: 'solid', surface: 'metal', noCover: true });
    for (const z of [-DECK_LENGTH / 2 + 1, 0, DECK_LENGTH / 2 - 1]) {
      f.boxFromTo([s * (WIDTH / 2 - 0.3) - 0.2, 0, z - 0.2], [s * (WIDTH / 2 - 0.3) + 0.2, DECK_TOP - 0.3, z + 0.2], steel, { kind: 'solid', surface: 'metal' });
    }
  }
  const angle = Math.atan2(DECK_TOP, STAIR_RUN);
  for (const end of [-1, 1]) {
    const z0 = end * DECK_LENGTH / 2;
    // Visual steps, rising toward the deck.
    for (let k = 0; k < STEPS; k++) {
      const h = (DECK_TOP * (k + 1)) / STEPS;
      const depth = STAIR_RUN / STEPS;
      const zc = z0 + end * (STAIR_RUN - depth * (k + 0.5));
      f.boxFromTo([-WIDTH / 2 + 0.1, h - 0.25, zc - depth / 2], [WIDTH / 2 - 0.1, h, zc + depth / 2], MAP_COLORS.stairs);
    }
    const len = Math.hypot(STAIR_RUN, DECK_TOP) + 0.3;
    const zMid = z0 + (end * STAIR_RUN) / 2;
    f.box([0, DECK_TOP / 2 - 0.12 / Math.cos(angle), zMid], [WIDTH - 0.2, 0.2, len], -1, { kind: 'ramp', surface: 'metal', tilt: end * angle, noCover: true });
    for (const s of [-1, 1]) {
      f.box([s * (WIDTH / 2 - 0.05), DECK_TOP / 2 + 0.55, zMid], [0.08, 1.1, len], steel, { kind: 'solid', surface: 'metal', tilt: end * angle, noCover: true });
    }
    f.link(f.point(0, 0, z0 + end * (STAIR_RUN + 0.8)), f.point(0, DECK_TOP, z0 - end * 1.0), [f.point(0, DECK_TOP / 2, zMid)]);
  }
  return f;
}
