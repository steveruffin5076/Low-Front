import type { EnterableDef, GroundArea, PropDef, Rect, SolidBuildingDef, SpawnDef, StreetDef } from './types';

/**
 * Point symmetry (plan section 10.1): (x, z) → (−x, −z), rotations + 180°.
 * Content authored for one half is mirrored so both teams get the same geometry.
 */
export function mirrorRect(r: Rect): Rect {
  return { x0: -r.x1, z0: -r.z1, x1: -r.x0, z1: -r.z0 };
}

const turn = (rot: number): number => {
  const a = (rot + Math.PI) % (Math.PI * 2);
  return Math.abs(a) < 1e-9 ? 0 : a;
};

export const mirror = {
  rect: mirrorRect,
  ground: (g: GroundArea): GroundArea => ({ ...g, rect: mirrorRect(g.rect) }),
  street: (s: StreetDef): StreetDef => ({ ...s, rect: mirrorRect(s.rect) }),
  solid: (b: SolidBuildingDef): SolidBuildingDef => ({ ...b, x: -b.x, z: -b.z }),
  enterable: (b: EnterableDef): EnterableDef => ({ ...b, x: -b.x, z: -b.z, rotY: turn(b.rotY) }),
  prop: (p: PropDef): PropDef => ({ ...p, x: -p.x, z: -p.z, rotY: turn(p.rotY) }),
  spawn: (s: SpawnDef): SpawnDef => ({ ...s, x: -s.x, z: -s.z, yaw: turn(s.yaw) }),
};

/** The list plus its mirror image. */
export function withMirror<T>(items: readonly T[], fn: (t: T) => T): T[] {
  return [...items, ...items.map(fn)];
}
