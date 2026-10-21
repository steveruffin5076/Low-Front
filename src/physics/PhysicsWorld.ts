import RAPIER from '@dimforge/rapier3d-compat';
import { ENGINE } from '../data/engine';

export type Rapier = typeof RAPIER;

/** Wrapper around the Rapier world. Call `PhysicsWorld.create()` (async, loads WASM). */
export class PhysicsWorld {
  /** Time spent in the last `step()` call, in milliseconds. */
  lastStepMs = 0;

  private constructor(
    readonly rapier: Rapier,
    readonly world: RAPIER.World,
  ) {}

  static async create(): Promise<PhysicsWorld> {
    await RAPIER.init();
    const world = new RAPIER.World({ x: 0, y: ENGINE.gravityY, z: 0 });
    world.timestep = 1 / ENGINE.fixedHz;
    return new PhysicsWorld(RAPIER, world);
  }

  step(): void {
    const t0 = performance.now();
    this.world.step();
    this.lastStepMs = performance.now() - t0;
  }
}
