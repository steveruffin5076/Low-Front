import { PALETTE } from '../palette';

/** Map construction constants (plan sections 10 and 14). Meters. */
export const MAP = {
  half: 180,
  /** Invisible walls stop the player here; 180–190 is the out-of-bounds zone. */
  hardLimit: 190,
  outOfBoundsTime: 10,
  chunkSize: 60,
  floorHeight: 3,
  wallThickness: 0.3,
  slabThickness: 0.3,
  /** Raised blocks and floors sit this high above the street. */
  curbHeight: 0.15,
  parapetHeight: 1.0,
  railingHeight: 1.0,
  doorHeight: 2.3,
  /** Stairs: stairwell size and the landing depth at the far end. */
  stairWidth: 3.0,
  stairLength: 6.0,
  stairLanding: 1.4,
  stepsPerFlight: 9,
  flagRadius: 12,
  flagPoleHeight: 8,
  /** Window pattern on solid buildings. */
  windowSpacing: 3.2,
  windowWidth: 1.4,
  windowHeight: 1.5,
  windowSill: 0.9,
} as const;

export const MAP_COLORS = {
  ground: 0x8f8a7c,
  asphalt: PALETTE.road,
  sidewalk: PALETTE.sidewalk,
  plaza: 0xd8cdb4,
  grass: PALETTE.grass,
  dirt: 0x9b7653,
  gravel: 0x8c877d,
  concrete: 0xa7a59f,
  curb: 0xcfd2d6,
  lineYellow: PALETTE.roadLineYellow,
  lineWhite: PALETTE.roadLineWhite,
  window: 0x2c3a4a,
  windowFrame: 0xe9e2d0,
  ledge: 0xdcd5c4,
  roof: 0x6e7781,
  acUnit: 0xc9ccd0,
  slab: 0xb9b6ae,
  interiorWall: 0xeee6d6,
  stairs: 0x9a978f,
  railing: 0x4a525c,
  column: 0xa9a7a1,
  rebar: 0x7a4b2f,
} as const;
