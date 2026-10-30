import type * as THREE from 'three';
import type { WeaponId } from '../../data/weapons';
import type { NodeName } from './WeaponModel';

/**
 * Simple test motions for the weapon viewer, to check that moving parts move correctly.
 * The real keyframed animations arrive in Phase 3.
 */
export interface PartTest {
  label: string;
  /** Seconds. */
  duration: number;
  nodes: readonly NodeName[];
  /** Applies the pose at `t` (0–1). Nodes are reset to their rest pose before each call. */
  apply(n: Partial<Record<NodeName, THREE.Object3D>>, t: number): void;
}

/** 0 → 1 → 0 */
const pulse = (t: number): number => Math.sin(Math.PI * t);
/** Rises quickly, holds, then returns. */
const hold = (t: number): number => (t < 0.25 ? t / 0.25 : t > 0.75 ? (1 - t) / 0.25 : 1);

export const PART_TESTS: Record<WeaponId, readonly PartTest[]> = {
  m4a1: [
    { label: 'Bolt cycle', duration: 0.6, nodes: ['bolt'], apply: (n, t) => void (n.bolt!.position.z += 0.07 * pulse(t)) },
    {
      label: 'Charging handle',
      duration: 1.2,
      nodes: ['chargingHandle', 'bolt'],
      apply: (n, t) => {
        n.chargingHandle!.position.z += 0.06 * hold(t);
        n.bolt!.position.z += 0.06 * hold(t);
      },
    },
    { label: 'Dust cover', duration: 1.5, nodes: ['dustCover'], apply: (n, t) => void (n.dustCover!.rotation.z = -2.0 * hold(t)) },
    { label: 'Trigger', duration: 0.5, nodes: ['trigger'], apply: (n, t) => void (n.trigger!.rotation.x = -0.35 * pulse(t)) },
    { label: 'Selector', duration: 1.2, nodes: ['selector'], apply: (n, t) => void (n.selector!.rotation.x = (Math.PI / 2) * hold(t)) },
    { label: 'Bolt release', duration: 0.5, nodes: ['boltRelease'], apply: (n, t) => void (n.boltRelease!.position.x += 0.0025 * pulse(t)) },
    { label: 'Magazine out', duration: 1.5, nodes: ['magazine'], apply: (n, t) => void (n.magazine!.position.y -= 0.25 * hold(t)) },
  ],
  ak47: [
    { label: 'Charging handle', duration: 0.8, nodes: ['chargingHandle'], apply: (n, t) => void (n.chargingHandle!.position.z += 0.1 * pulse(t)) },
    { label: 'Selector', duration: 1.2, nodes: ['selector'], apply: (n, t) => void (n.selector!.rotation.x = -0.3 * hold(t)) },
    { label: 'Trigger', duration: 0.5, nodes: ['trigger'], apply: (n, t) => void (n.trigger!.rotation.x = -0.35 * pulse(t)) },
    {
      label: 'Magazine out',
      duration: 1.5,
      nodes: ['magazine'],
      apply: (n, t) => {
        // AK magazines rock forward out of the well.
        n.magazine!.rotation.x = 0.35 * hold(t);
        n.magazine!.position.y -= 0.2 * hold(t);
      },
    },
  ],
  sr9: [
    { label: 'Bolt cycle', duration: 0.5, nodes: ['bolt'], apply: (n, t) => void (n.bolt!.position.z += 0.04 * pulse(t)) },
    { label: 'Cocking handle', duration: 0.8, nodes: ['chargingHandle'], apply: (n, t) => void (n.chargingHandle!.position.z += 0.06 * hold(t)) },
    { label: 'Trigger', duration: 0.5, nodes: ['trigger'], apply: (n, t) => void (n.trigger!.rotation.x = -0.35 * pulse(t)) },
    { label: 'Selector', duration: 1.2, nodes: ['selector'], apply: (n, t) => void (n.selector!.rotation.x = (Math.PI / 2) * hold(t)) },
    { label: 'Magazine out', duration: 1.5, nodes: ['magazine'], apply: (n, t) => void (n.magazine!.position.y -= 0.25 * hold(t)) },
  ],
  m1911: [
    {
      label: 'Slide cycle',
      duration: 0.6,
      nodes: ['slide', 'hammer'],
      apply: (n, t) => {
        n.slide!.position.z += 0.035 * pulse(t);
        n.hammer!.rotation.x = 0.9 * Math.min(1, t / 0.3);
      },
    },
    {
      label: 'Slide lock',
      duration: 1.5,
      nodes: ['slide', 'slideStop'],
      apply: (n, t) => {
        n.slide!.position.z += 0.035 * hold(t);
        n.slideStop!.rotation.x = -0.25 * hold(t);
      },
    },
    { label: 'Hammer cock', duration: 1.2, nodes: ['hammer'], apply: (n, t) => void (n.hammer!.rotation.x = 0.9 * hold(t)) },
    { label: 'Trigger', duration: 0.5, nodes: ['trigger'], apply: (n, t) => void (n.trigger!.position.z += 0.003 * pulse(t)) },
    {
      label: 'Magazine out',
      duration: 1.5,
      nodes: ['magazine'],
      apply: (n, t) => {
        n.magazine!.position.y -= 0.15 * hold(t);
        n.magazine!.position.z += 0.024 * hold(t);
      },
    },
  ],
};
