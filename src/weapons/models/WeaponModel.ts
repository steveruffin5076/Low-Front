import type * as THREE from 'three';

export type WeaponLod = 'fp' | 'tp';

/** Moving parts used by animations and effects (plan section 7.2). */
export type NodeName =
  | 'magazine'
  | 'bolt'
  | 'chargingHandle'
  | 'slide'
  | 'hammer'
  | 'trigger'
  | 'selector'
  | 'dustCover'
  | 'boltRelease'
  | 'slideStop';

/** Empty Object3D markers. */
export type AttachmentName = 'muzzle' | 'ejectionPort' | 'sightAnchor' | 'rightHandGrip' | 'leftHandGrip' | 'magWell';

export const ATTACHMENT_NAMES: readonly AttachmentName[] = [
  'muzzle',
  'ejectionPort',
  'sightAnchor',
  'rightHandGrip',
  'leftHandGrip',
  'magWell',
];

/**
 * A built weapon. Units are meters, +Y up, the muzzle points along −Z, +X is the weapon's right side.
 * The origin is the `rightHandGrip` point.
 */
export interface WeaponModel {
  root: THREE.Group;
  nodes: Partial<Record<NodeName, THREE.Object3D>>;
  points: Record<AttachmentName, THREE.Object3D>;
  lod: WeaponLod;
}
