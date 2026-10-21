import { PALETTE } from './palette';

/** Outdoor lighting, sky and fog (plan section 6). */
export const LIGHTING = {
  sun: {
    color: 0xfff4e0,
    intensity: 2.4,
    /** Sun position relative to the followed point. */
    offset: [40, 70, 25] as const,
    shadowMapSize: 2048,
    /** Shadow camera half-size: shadows cover about 80 m around the player. */
    shadowExtent: 40,
    shadowFar: 220,
  },
  hemi: { sky: 0xdff1ff, ground: 0x8a8577, intensity: 1.15 },
  sky: { top: 0x4f9de0, horizon: 0xcfe6f5, radius: 380 },
  fog: { color: 0xcfe6f5, near: 90, far: 360 },
  flag: { neutral: 0xe8e8e8, blue: PALETTE.blueTeam, red: PALETTE.redTeam, ringOpacity: 0.35 },
} as const;
