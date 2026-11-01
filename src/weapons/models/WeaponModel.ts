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
  | 'slideStop'
  | 'pump';

/** Empty Object3D markers. */
export type AttachmentName = 'muzzle' | 'ejectionPort' | 'sightAnchor' | 'rightHandGrip' | 'leftHandGrip' | 'magWell';

/** Where gunsmith attachments go (Blender models only). Each is an empty at the part's seat. */
export type MountSlot = 'optic' | 'muzzle' | 'underbarrel' | 'magazine';

export const MOUNT_SLOTS: readonly MountSlot[] = ['optic', 'muzzle', 'underbarrel', 'magazine'];

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
  /** Attachment mounts (models built in Blender). */
  mounts?: Partial<Record<MountSlot, THREE.Object3D>>;
  lod: WeaponLod;
}
