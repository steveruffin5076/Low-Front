import { PALETTE } from '../palette';
import type { Rect, SolidBuildingDef } from './types';

/**
 * Deterministic block filler: solid buildings along the edges of a city block, cut by alleys
 * that run through an open courtyard. The same input always gives the same buildings.
 */
export interface BlockSpec {
  rect: Rect;
  /** Building depth from the block edge. */
  depth: number;
  /** Alley center lines (3.5 m wide): N–S alleys at these X, E–W alleys at these Z. */
  alleysX?: readonly number[];
  alleysZ?: readonly number[];
  /** Sides that get no buildings (open to a flag area or plaza). */
  openSides?: readonly ('n' | 's' | 'e' | 'w')[];
  /** Areas kept free of buildings (e.g. an enterable building placed by hand). */
  keepClear?: readonly Rect[];
  minFloors: number;
  maxFloors: number;
  /** Offsets the width/floor/color patterns so neighboring blocks look different. */
  variant: number;
}

const SIDEWALK = 2.5;
const ALLEY = 3.5;
const WIDTHS = [12, 9, 15, 11, 14, 10, 13, 16];
const FLOORS = [2, 4, 3, 5, 2, 6, 3, 4, 5, 2];
export const BUILDING_COLORS = [PALETTE.terracotta, PALETTE.teal, PALETTE.mustard, PALETTE.coral, PALETTE.mint, PALETTE.cream, PALETTE.slate];

function overlaps(a: Rect, b: Rect): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
}

/** Splits [a, b] into spans that avoid alley cuts. */
function spans(a: number, b: number, cuts: readonly number[]): [number, number][] {
  const out: [number, number][] = [];
  let start = a;
  for (const c of [...cuts].sort((x, y) => x - y)) {
    if (c - ALLEY / 2 <= start || c + ALLEY / 2 >= b) continue;
    out.push([start, c - ALLEY / 2]);
    start = c + ALLEY / 2;
  }
  out.push([start, b]);
  return out.filter(([s, e]) => e - s >= 5);
}

export function fillBlock(spec: BlockSpec): SolidBuildingDef[] {
  const r = { x0: spec.rect.x0 + SIDEWALK, z0: spec.rect.z0 + SIDEWALK, x1: spec.rect.x1 - SIDEWALK, z1: spec.rect.z1 - SIDEWALK };
  const D = spec.depth;
  const out: SolidBuildingDef[] = [];
  let k = spec.variant;
  const open = new Set(spec.openSides ?? []);

  const row = (along: 'x' | 'z', a: number, b: number, c0: number, c1: number, cuts: readonly number[]): void => {
    for (const [s, e] of spans(a, b, cuts)) {
      let pos = s;
      while (e - pos >= 5) {
        let width = WIDTHS[k % WIDTHS.length];
        if (e - pos - width < 6) width = e - pos;
        const floors = Math.min(spec.maxFloors, Math.max(spec.minFloors, FLOORS[(k * 3 + spec.variant) % FLOORS.length]));
        const color = BUILDING_COLORS[(k * 5 + spec.variant) % BUILDING_COLORS.length];
        const rect = along === 'x' ? { x0: pos, z0: c0, x1: pos + width, z1: c1 } : { x0: c0, z0: pos, x1: c1, z1: pos + width };
        if (!(spec.keepClear ?? []).some((kc) => overlaps(kc, rect))) {
          out.push({ x: (rect.x0 + rect.x1) / 2, z: (rect.z0 + rect.z1) / 2, w: rect.x1 - rect.x0, d: rect.z1 - rect.z0, floors, color });
        }
        pos += width;
        k++;
      }
    }
  };

  const ax = spec.alleysX ?? [];
  const az = spec.alleysZ ?? [];
  if (!open.has('n')) row('x', r.x0, r.x1, r.z0, r.z0 + D, ax);
  if (!open.has('s')) row('x', r.x0, r.x1, r.z1 - D, r.z1, ax);
  const zs = open.has('n') ? r.z0 : r.z0 + D;
  const ze = open.has('s') ? r.z1 : r.z1 - D;
  if (!open.has('w')) row('z', zs, ze, r.x0, r.x0 + D, az);
  if (!open.has('e')) row('z', zs, ze, r.x1 - D, r.x1, az);
  return out;
}
