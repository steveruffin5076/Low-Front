import { PALETTE } from '../palette';
import { MAP_COLORS } from './config';
import type { PlanId } from './types';
import type { FloorPlan } from '../../world/plan';

/**
 * Enterable building floor plans (plan section 10.4). Local frame: origin at the footprint
 * center, sides n = −Z, s = +Z, e = +X, w = −X. Floor height 3 m (the depot hall is one tall storey).
 */
const DOOR = { bottom: 0, height: 2.3 } as const;
const WIDE_DOOR = { bottom: 0, height: 2.6 } as const;

export const PLANS: Record<PlanId, FloorPlan> = {
  /** C: City Hall, 3 floors. Main doors face the plaza (+X); back door and side doors for routes. */
  cityHall: {
    w: 24,
    d: 20,
    floors: 3,
    floorHeight: 3,
    wallColor: PALETTE.cream,
    trimColor: 0xd7c7a3,
    floorColor: MAP_COLORS.slab,
    openings: [
      { side: 'e', u: 0, width: 3.2, ...WIDE_DOOR, floors: 'ground' },
      { side: 'w', u: 0, width: 1.8, ...DOOR, floors: 'ground' },
      { side: 'n', u: 6, width: 1.6, ...DOOR, floors: 'ground' },
      { side: 's', u: -6, width: 1.6, ...DOOR, floors: 'ground' },
    ],
    windows: { sides: ['n', 's', 'e', 'w'], spacing: 3, width: 1.3, bottom: 0.9, height: 1.6, floors: 'all' },
    interiorWalls: [
      // Central corridor along X with rooms north and south.
      { from: [-12, -3], to: [12, -3], doors: [6, 18] },
      { from: [-12, 3], to: [12, 3], doors: [6, 18] },
      { from: [0, -10], to: [0, -3], doors: [3.5] },
      { from: [0, 3], to: [0, 10], doors: [3.5] },
    ],
    stairs: [{ x: -7.5, z: -6.5, rot: -Math.PI / 2 }],
    roof: 'flat',
    extras: [
      // Portico columns in front of the main doors.
      { center: [13.2, 2.0, -4.5], size: [0.7, 4.0, 0.7], color: 0xf3ead6, solid: true },
      { center: [13.2, 2.0, -1.8], size: [0.7, 4.0, 0.7], color: 0xf3ead6, solid: true },
      { center: [13.2, 2.0, 1.8], size: [0.7, 4.0, 0.7], color: 0xf3ead6, solid: true },
      { center: [13.2, 2.0, 4.5], size: [0.7, 4.0, 0.7], color: 0xf3ead6, solid: true },
      { center: [13.2, 4.15, 0], size: [1.4, 0.3, 11], color: 0xf3ead6, solid: false },
    ],
  },

  /** C: 6-floor office tower with rooftop access. Front faces the plaza (−X). */
  officeTower: {
    w: 20,
    d: 20,
    floors: 6,
    floorHeight: 3,
    wallColor: 0x4f7ea6,
    trimColor: 0xd9e3ea,
    floorColor: MAP_COLORS.slab,
    openings: [
      { side: 'w', u: 0, width: 3.2, ...WIDE_DOOR, floors: 'ground' },
      { side: 'e', u: 0, width: 1.8, ...DOOR, floors: 'ground' },
      { side: 'n', u: -5, width: 1.6, ...DOOR, floors: 'ground' },
      { side: 's', u: 5, width: 1.6, ...DOOR, floors: 'ground' },
    ],
    windows: { sides: ['n', 's', 'e', 'w'], spacing: 2.5, width: 1.8, bottom: 0.8, height: 1.8, floors: 'all' },
    interiorWalls: [
      { from: [-10, -5], to: [-4, -5], floors: 'upper' },
      { from: [4, 5], to: [10, 5], floors: 'upper' },
      { from: [-5, 4], to: [-5, 10], floors: 'upper' },
      { from: [5, -10], to: [5, -4], floors: 'upper' },
    ],
    stairs: [{ x: 0, z: 0.5, rot: 0, toRoof: true }],
    roof: 'access',
  },

  /** B: 4-floor apartment. Courtyard on the +Z side with balconies; corridor along X. */
  apartment: {
    w: 48,
    d: 12,
    floors: 4,
    floorHeight: 3,
    wallColor: PALETTE.coral,
    trimColor: 0xf6e7d2,
    floorColor: MAP_COLORS.slab,
    openings: [
      { side: 's', u: -5, width: 1.6, ...DOOR, floors: 'ground' },
      { side: 's', u: 11, width: 1.6, ...DOOR, floors: 'ground' },
      { side: 'n', u: 3, width: 1.6, ...DOOR, floors: 'ground' },
      { side: 'e', u: 0, width: 1.6, ...DOOR, floors: 'all' },
      // Balcony doors.
      { side: 's', u: -13, width: 1.2, bottom: 0, height: 2.2, floors: 'upper' },
      { side: 's', u: -5, width: 1.2, bottom: 0, height: 2.2, floors: 'upper' },
      { side: 's', u: 3, width: 1.2, bottom: 0, height: 2.2, floors: 'upper' },
      { side: 's', u: 11, width: 1.2, bottom: 0, height: 2.2, floors: 'upper' },
      { side: 's', u: 19, width: 1.2, bottom: 0, height: 2.2, floors: 'upper' },
    ],
    windows: { sides: ['n', 's', 'w'], spacing: 4, width: 1.4, bottom: 0.9, height: 1.5, floors: 'all' },
    interiorWalls: [
      { from: [-17.6, -1], to: [24, -1], doors: [4.6, 12.6, 20.6, 28.6, 36.6] },
      { from: [-17.6, 1], to: [24, 1], doors: [4.6, 12.6, 20.6, 28.6, 36.6] },
      { from: [-9, -6], to: [-9, -1] },
      { from: [-1, -6], to: [-1, -1] },
      { from: [7, -6], to: [7, -1] },
      { from: [15, -6], to: [15, -1] },
      { from: [-9, 1], to: [-9, 6] },
      { from: [-1, 1], to: [-1, 6] },
      { from: [7, 1], to: [7, 6] },
      { from: [15, 1], to: [15, 6] },
    ],
    stairs: [{ x: -20.6, z: 0, rot: -Math.PI / 2 }],
    roof: 'flat',
    balconies: [{ side: 's', us: [-13, -5, 3, 11, 19], width: 2.6, depth: 1.4, floors: [1, 2, 3] }],
  },

  /** D: unfinished 4-floor concrete frame: columns, open slabs, stair core, low block walls. */
  constructionFrame: {
    w: 30,
    d: 20,
    floors: 4,
    floorHeight: 3,
    wallColor: 0xa29d92,
    trimColor: 0x8d887e,
    floorColor: MAP_COLORS.concrete,
    openings: [],
    interiorWalls: [
      { from: [-12, -6], to: [-4, -6], height: 1.2 },
      { from: [2, 4], to: [8, 4], height: 1.2 },
      { from: [-6, 2], to: [-6, 8], height: 1.2, floors: [1, 2] },
      { from: [4, -8], to: [4, -2], height: 1.2, floors: [0, 3] },
    ],
    stairs: [{ x: 10, z: 5, rot: 0 }],
    roof: 'none',
    frame: true,
  },

  /** E: rail station, 2 floors, roof not accessible. */
  station: {
    w: 24,
    d: 10,
    floors: 2,
    floorHeight: 3,
    wallColor: PALETTE.mustard,
    trimColor: 0xf3e5c0,
    floorColor: MAP_COLORS.slab,
    openings: [
      { side: 'n', u: 0, width: 3.0, ...WIDE_DOOR, floors: 'ground' },
      { side: 's', u: 3, width: 1.6, ...DOOR, floors: 'ground' },
      { side: 'e', u: 0, width: 1.6, ...DOOR, floors: 'ground' },
    ],
    windows: { sides: ['n', 's', 'e', 'w'], spacing: 3, width: 1.4, bottom: 0.9, height: 1.5, floors: 'all' },
    interiorWalls: [{ from: [-4, -5], to: [-4, 5], doors: [5] }],
    stairs: [{ x: -8.6, z: 0, rot: -Math.PI / 2 }],
    roof: 'flat',
  },

  /** A: bus depot hall, one tall storey with bus bays on both long sides. */
  depotHall: {
    w: 40,
    d: 24,
    floors: 1,
    floorHeight: 7.5,
    wallColor: PALETTE.slate,
    trimColor: 0xc9ced3,
    floorColor: MAP_COLORS.concrete,
    openings: [
      { side: 'n', u: -12, width: 7, bottom: 0, height: 5.5, floors: 'ground' },
      { side: 'n', u: 0, width: 7, bottom: 0, height: 5.5, floors: 'ground' },
      { side: 'n', u: 12, width: 7, bottom: 0, height: 5.5, floors: 'ground' },
      { side: 's', u: -12, width: 7, bottom: 0, height: 5.5, floors: 'ground' },
      { side: 's', u: 0, width: 7, bottom: 0, height: 5.5, floors: 'ground' },
      { side: 's', u: 12, width: 7, bottom: 0, height: 5.5, floors: 'ground' },
      { side: 'w', u: 0, width: 1.8, ...DOOR, floors: 'ground' },
    ],
    windows: { sides: ['n', 's', 'e', 'w'], spacing: 4, width: 2.4, bottom: 5.9, height: 1.0, floors: 'all' },
    interiorWalls: [
      { from: [-6, -4], to: [-6, 4], height: 1.2 },
      { from: [6, -4], to: [6, 4], height: 1.2 },
    ],
    stairs: [],
    roof: 'flat',
  },

  /** A: depot office annex, 2 floors with roof access (high ground over the depot). */
  depotOffice: {
    w: 12,
    d: 10,
    floors: 2,
    floorHeight: 3,
    wallColor: PALETTE.cream,
    trimColor: 0xb9c2c9,
    floorColor: MAP_COLORS.slab,
    openings: [
      { side: 'n', u: 3, width: 1.6, ...DOOR, floors: 'ground' },
      { side: 's', u: 3, width: 1.6, ...DOOR, floors: 'ground' },
    ],
    windows: { sides: ['n', 's', 'e', 'w'], spacing: 3, width: 1.3, bottom: 0.9, height: 1.5, floors: 'all' },
    interiorWalls: [],
    stairs: [{ x: -2.6, z: -1.8, rot: -Math.PI / 2, toRoof: true }],
    roof: 'access',
  },

  /** Flank routes: 2-floor corner shop with doors on three sides. */
  cornerShop: {
    w: 14,
    d: 14,
    floors: 2,
    floorHeight: 3,
    wallColor: PALETTE.teal,
    trimColor: 0xf1e3c8,
    floorColor: MAP_COLORS.slab,
    openings: [
      { side: 'n', u: 2, width: 2.4, ...WIDE_DOOR, floors: 'ground' },
      { side: 'n', u: -3, width: 3.0, bottom: 0.6, height: 1.8, floors: 'ground' },
      { side: 'e', u: -3, width: 1.6, ...DOOR, floors: 'ground' },
      { side: 'w', u: -3, width: 1.6, ...DOOR, floors: 'ground' },
      { side: 's', u: 3, width: 1.6, ...DOOR, floors: 'ground' },
    ],
    windows: { sides: ['n', 's', 'e', 'w'], spacing: 3, width: 1.3, bottom: 0.9, height: 1.5, floors: 'upper' },
    interiorWalls: [{ from: [1, -7], to: [1, 7], doors: [4, 10] }],
    stairs: [{ x: -4.5, z: 3.5, rot: 0 }],
    roof: 'flat',
  },
};
