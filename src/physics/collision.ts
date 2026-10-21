import * as THREE from 'three';
import type { HitZone } from '../data/ballistics';
import type { PhysicsWorld } from './PhysicsWorld';

/**
 * Collision groups (Rapier InteractionGroups: membership << 16 | filter).
 * Two colliders interact when each one's membership is in the other's filter.
 */
export const GROUP = { WORLD: 1, PLAYER: 2, HITBOX: 4, BODY: 8, BULLET: 16 } as const;
const ALL = 0xffff;

export function groups(membership: number, filter: number): number {
  return ((membership & 0xffff) << 16) | (filter & 0xffff);
}

export const COLLISION = {
  /** Static map geometry: blocks movement and bullets. */
  world: groups(GROUP.WORLD, ALL),
  /** Player capsule: blocked by world, other characters and bodies; ignores hitboxes. */
  player: groups(GROUP.PLAYER, GROUP.WORLD | GROUP.PLAYER | GROUP.BODY),
  /** Character bodies that block walking but not bullets (bullets use hitboxes). */
  body: groups(GROUP.BODY, GROUP.WORLD | GROUP.PLAYER),
  /** Hitbox sensors: only bullets see them. */
  hitbox: groups(GROUP.HITBOX, GROUP.BULLET),
  /** Bullet ray queries: world and hitboxes. */
  bullet: groups(GROUP.BULLET, GROUP.WORLD | GROUP.HITBOX),
  /** View checks (lean, footsteps): world only. */
  view: groups(GROUP.BULLET, GROUP.WORLD),
} as const;

export type Surface = 'concrete' | 'dirt' | 'metal' | 'wood';

/** Something bullets can damage through its hitboxes. */
export interface Hittable {
  readonly label: string;
  applyHit(hit: ZoneHit): void;
}

export interface ZoneHit {
  zone: HitZone;
  damage: number;
  distance: number;
  point: THREE.Vector3;
  direction: THREE.Vector3;
  /** True when this hit killed the target. Set by the target. */
  killed?: boolean;
}

/** What a collider is, for impact effects and damage. */
export type ColliderTag = { kind: 'surface'; surface: Surface } | { kind: 'hitbox'; owner: Hittable; zone: HitZone };

export interface SegmentHit {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  /** Distance from the segment start. */
  distance: number;
  tag: ColliderTag | undefined;
}

const ray = { origin: new THREE.Vector3(), dir: new THREE.Vector3() };

/** First hit on the segment `from` → `to` for colliders in `filterGroups`, or null. */
export function raycastSegment(
  physics: PhysicsWorld,
  from: THREE.Vector3,
  to: THREE.Vector3,
  filterGroups: number,
): SegmentHit | null {
  ray.dir.subVectors(to, from);
  const length = ray.dir.length();
  if (length < 1e-6) return null;
  ray.dir.divideScalar(length);
  ray.origin.copy(from);
  const { rapier, world } = physics;
  const hit = world.castRayAndGetNormal(new rapier.Ray(ray.origin, ray.dir), length, true, undefined, filterGroups);
  if (!hit) return null;
  return {
    point: from.clone().addScaledVector(ray.dir, hit.timeOfImpact),
    normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z),
    distance: hit.timeOfImpact,
    tag: physics.tags.get(hit.collider.handle),
  };
}
