import type { WeaponId } from './weapons';

/**
 * Gunsmith attachments (plan: enhancement-1 §5.7–5.8). Names are generic. Effects multiply the
 * weapon's stats (1 = no change); `magazineAdd` adds rounds. The totals are capped in `GUNSMITH`
 * so no build gets out of hand.
 */
export type AttachmentSlot = 'optic' | 'muzzle' | 'underbarrel' | 'magazine';
export type AttachmentId = 'reddot' | 'holo' | 'scope3x' | 'suppressor' | 'compensator' | 'vgrip' | 'agrip' | 'extmag';

export const ATTACHMENT_SLOTS: readonly AttachmentSlot[] = ['optic', 'muzzle', 'underbarrel', 'magazine'];
export const SLOT_NAMES: Record<AttachmentSlot, string> = { optic: 'Optic', muzzle: 'Muzzle', underbarrel: 'Underbarrel', magazine: 'Magazine' };

export interface AttachmentEffects {
  adsTime?: number;
  hipSpread?: number;
  adsSpread?: number;
  verticalRecoil?: number;
  horizontalRecoil?: number;
  moveSpeed?: number;
  /** Multiplies both falloff distances. */
  range?: number;
  reloadTime?: number;
  magazineAdd?: number;
}

export interface AttachmentDef {
  id: AttachmentId;
  name: string;
  slot: AttachmentSlot;
  /** One line for the gunsmith card. */
  blurb: string;
  effects: AttachmentEffects;
  /** Optics: field of view when aimed, and whether full aim shows the scope view (overlay). */
  optic?: { adsFov: number; scope: boolean };
  /** Muzzle: quieter shot, smaller flash, bots hear it from less far. */
  suppressed?: boolean;
}

export const ATTACHMENTS: Record<AttachmentId, AttachmentDef> = {
  reddot: {
    id: 'reddot', name: 'Red Dot', slot: 'optic', blurb: 'A clear dot over the iron sights. Slightly closer view.',
    effects: { adsTime: 1.02 }, optic: { adsFov: 52, scope: false },
  },
  holo: {
    id: 'holo', name: 'Holo Sight', slot: 'optic', blurb: 'Wide window with a ring reticle for fast targets.',
    effects: { adsTime: 1.04, adsSpread: 0.95 }, optic: { adsFov: 50, scope: false },
  },
  scope3x: {
    id: 'scope3x', name: '3× Scope', slot: 'optic', blurb: 'Three times zoom for long lanes. Slower to aim.',
    effects: { adsTime: 1.3, moveSpeed: 0.97, adsSpread: 0.85 }, optic: { adsFov: 25, scope: true },
  },
  suppressor: {
    id: 'suppressor', name: 'Suppressor', slot: 'muzzle', blurb: 'Quiet shots, small flash; bots hear you from less far. Less range.',
    effects: { range: 0.85, adsTime: 1.06, verticalRecoil: 0.92 }, suppressed: true,
  },
  compensator: {
    id: 'compensator', name: 'Compensator', slot: 'muzzle', blurb: 'Keeps the muzzle steady side to side. Louder, wider hip fire.',
    effects: { horizontalRecoil: 0.7, verticalRecoil: 0.92, hipSpread: 1.1 },
  },
  vgrip: {
    id: 'vgrip', name: 'Vertical Grip', slot: 'underbarrel', blurb: 'Less climb in long bursts. Slightly slower to aim.',
    effects: { verticalRecoil: 0.82, adsTime: 1.05 },
  },
  agrip: {
    id: 'agrip', name: 'Angled Grip', slot: 'underbarrel', blurb: 'Faster to aim, a bit steadier side to side.',
    effects: { adsTime: 0.9, horizontalRecoil: 0.9 },
  },
  extmag: {
    id: 'extmag', name: 'Extended Mag', slot: 'magazine', blurb: '40 rounds. Heavier: slower reload and aim.',
    effects: { magazineAdd: 10, reloadTime: 1.15, adsTime: 1.05, moveSpeed: 0.98 },
  },
};

export const ATTACHMENT_IDS = Object.keys(ATTACHMENTS) as AttachmentId[];

/** The attachments a weapon takes, by slot (only weapons with a Blender model have mounts). */
export const COMPATIBLE: Partial<Record<WeaponId, readonly AttachmentId[]>> = {
  m4a1: ATTACHMENT_IDS,
};

/** One attachment per slot at most. */
export type WeaponBuild = Partial<Record<AttachmentSlot, AttachmentId>>;

export const GUNSMITH = {
  /** Limits on the combined multipliers of a build. */
  caps: {
    adsTime: [0.8, 1.45],
    recoil: [0.6, 1.2],
    spread: [0.7, 1.25],
    moveSpeed: [0.92, 1.0],
    range: [0.8, 1.2],
    reloadTime: [0.85, 1.3],
  },
  /** Suppressed shots: sound gain, muzzle flash scale, and how far bots hear them (fraction of the hearing range). */
  suppressed: { gain: 0.35, flash: 0.35, hearing: 0.35 },
  /** Eye distance behind an optic's sight window (m). */
  eyeRelief: { reflex: 0.13, scope: 0.075 },
} as const;
