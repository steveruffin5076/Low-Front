import { PALETTE } from './palette';

/**
 * Outdoor lighting, sky and fog (plan section 6). Faceted low-poly look: a strong warm sun
 * against a weaker, cool sky fill, so each flat face reads clearly as lit or in shade.
 */
export const LIGHTING = {
  sun: {
    color: 0xffeacc,
    intensity: 3.1,
    /** Sun position relative to the followed point (about 50° high, from the south-east). */
    offset: [45, 75, 35] as const,
    shadowMapSize: 2048,
    /** Shadow camera half-size: shadows cover about 80 m around the player. */
    shadowExtent: 40,
    shadowFar: 220,
  },
  hemi: { sky: 0xc4dcff, ground: 0x8a8174, intensity: 0.9 },
  sky: { top: 0x3f8fdc, horizon: 0xd3e8f5, radius: 380 },
  fog: { color: 0xd3e8f5, near: 110, far: 380 },
  /** First-person weapon and arms (their own scene): sky fill, a warm key and a cool rim that traces the edges of the dark rifle. Positions are in camera space. */
  viewmodel: {
    hemi: { sky: 0xeef6ff, ground: 0x55606a, intensity: 1.3 },
    key: { color: 0xfff1dc, intensity: 2.6, position: [-1, 2, 1.5] as const },
    fill: { color: 0xdfe9ff, intensity: 0.5, position: [1.5, 0.5, -1] as const },
    rim: { color: 0xcfe2ff, intensity: 2.2, position: [0.6, 1.2, -3] as const },
  },
  flag: { neutral: 0xe8e8e8, blue: PALETTE.blueTeam, red: PALETTE.redTeam, ringOpacity: 0.35 },
} as const;
