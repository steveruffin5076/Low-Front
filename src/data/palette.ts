/** Shared color palette (plan section 6). */
export const PALETTE = {
  blueTeam: 0x2f7de1,
  redTeam: 0xe5483b,
  terracotta: 0xd9734e,
  teal: 0x2a9d8f,
  mustard: 0xe9c46a,
  coral: 0xf4a261,
  mint: 0x8fd3b6,
  cream: 0xf1e3c8,
  slate: 0x5c6b7a,
  road: 0x3b3f45,
  roadLineYellow: 0xf2d14b,
  roadLineWhite: 0xffffff,
  sidewalk: 0xb8bcc2,
  grass: 0x6dbe45,
  gunMetal: 0x2b2e33,
  polymerBlack: 0x1e1f22,
  akWood: 0xa0522d,
  m1911GripWood: 0x7b4a2a,
  skyTop: 0x5fa8e8,
  skyHorizon: 0xcfe6f5,
} as const;

/** UI and placeholder colors. */
export const UI_PALETTE = {
  skin: 0xe0b48a,
  vest: 0x3a4652,
  boots: 0x2a2a2e,
  helmet: 0x2b5ea8,
  menuSky: 0x7cc4f0,
} as const;

/** Extra weapon colors. */
export const WEAPON_PALETTE = {
  boltSteel: 0x8b9097,
  interior: 0x141518,
} as const;

/** First-person arms and effects. */
export const FP_PALETTE = {
  glove: 0x1b1c1f,
  sleeve: PALETTE.blueTeam,
  cuff: 0x24548f,
  brass: 0xd4a640,
  flashCore: 0xfff1b0,
  flashOuter: 0xffa733,
} as const;
