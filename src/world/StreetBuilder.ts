import { MAP, MAP_COLORS } from '../data/map/config';
import type { GroundArea, GroundKind, MapData, Rect, StreetDef } from '../data/map/types';
import type { Surface } from '../physics/collision';
import type { StaticSink } from './StaticSink';
import { volume, type Volume } from './Volume';

const GROUND_COLORS: Record<GroundKind, number> = {
  asphalt: MAP_COLORS.asphalt,
  sidewalk: MAP_COLORS.sidewalk,
  plaza: MAP_COLORS.plaza,
  grass: MAP_COLORS.grass,
  dirt: MAP_COLORS.dirt,
  gravel: MAP_COLORS.gravel,
  concrete: MAP_COLORS.concrete,
};

export function groundSurface(kind: GroundKind): Surface {
  return kind === 'grass' || kind === 'dirt' || kind === 'gravel' ? 'dirt' : 'concrete';
}

/** Heights of the flat ground layers above y = 0. */
const LAYER = { area: 0.03, street: 0.05, marking: 0.07 } as const;
const DASH = 3;
const GAP = 4;
const LINE = 0.18;

function inside(x: number, z: number, r: Rect): boolean {
  return x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
}

/** Ground, raised blocks with curbs, streets and lane markings (plan section 10.3). */
export function buildStreets(map: MapData, sink: StaticSink): Volume[] {
  const volumes: Volume[] = [];
  const ext = MAP.half + 30;
  sink.flat(-ext, -ext, ext, ext, 0, MAP_COLORS.ground);
  // The ground collider: one big slab (the character motor handles its center, see CharacterMotor).
  volumes.push(volume([0, -0.5, 0], [ext * 2, 1, ext * 2], 'floor', 'concrete'));

  // Flat areas first, then raised ones on top.
  const flatAreas = map.ground.filter((g) => !g.raised);
  const raised = map.ground.filter((g) => g.raised);
  // Layers are a few centimeters apart so they do not flicker at a distance.
  for (const g of flatAreas) sink.flat(g.rect.x0, g.rect.z0, g.rect.x1, g.rect.z1, LAYER.area, GROUND_COLORS[g.kind]);
  for (const s of map.streets) sink.flat(s.rect.x0, s.rect.z0, s.rect.x1, s.rect.z1, LAYER.street, MAP_COLORS.asphalt);
  for (const g of raised) raisedArea(g, sink, volumes);
  // Ground surfaces for impacts and footsteps (thin volumes just under the walking surface).
  for (const g of flatAreas) {
    if (groundSurface(g.kind) === 'concrete') continue;
    const r = g.rect;
    volumes.push(volume([(r.x0 + r.x1) / 2, -0.05, (r.z0 + r.z1) / 2], [r.x1 - r.x0, 0.1, r.z1 - r.z0], 'floor', 'dirt'));
  }
  for (const s of map.streets) markings(s, map.streets, sink);
  return volumes;
}

function raisedArea(g: GroundArea, sink: StaticSink, volumes: Volume[]): void {
  const r = g.rect;
  const h = MAP.curbHeight;
  sink.box([(r.x0 + r.x1) / 2, h / 2, (r.z0 + r.z1) / 2], [r.x1 - r.x0, h, r.z1 - r.z0], GROUND_COLORS[g.kind]);
  // Curb trim along the edges.
  const c = MAP_COLORS.curb;
  sink.box([(r.x0 + r.x1) / 2, h / 2 + 0.005, r.z0 + 0.15], [r.x1 - r.x0, h + 0.01, 0.3], c);
  sink.box([(r.x0 + r.x1) / 2, h / 2 + 0.005, r.z1 - 0.15], [r.x1 - r.x0, h + 0.01, 0.3], c);
  sink.box([r.x0 + 0.15, h / 2 + 0.005, (r.z0 + r.z1) / 2], [0.3, h + 0.01, r.z1 - r.z0], c);
  sink.box([r.x1 - 0.15, h / 2 + 0.005, (r.z0 + r.z1) / 2], [0.3, h + 0.01, r.z1 - r.z0], c);
  volumes.push(volume([(r.x0 + r.x1) / 2, h / 2, (r.z0 + r.z1) / 2], [r.x1 - r.x0, h, r.z1 - r.z0], 'floor', groundSurface(g.kind)));
}

/** Dashed lines along the street, skipped where another street crosses. */
function markings(s: StreetDef, all: readonly StreetDef[], sink: StaticSink): void {
  if (s.marking === 'none') return;
  const r = s.rect;
  const others = all.filter((o) => o !== s && o.axis !== s.axis);
  const alongX = s.axis === 'x';
  const a0 = alongX ? r.x0 : r.z0;
  const a1 = alongX ? r.x1 : r.z1;
  const mid = alongX ? (r.z0 + r.z1) / 2 : (r.x0 + r.x1) / 2;
  const half = alongX ? (r.z1 - r.z0) / 2 : (r.x1 - r.x0) / 2;
  const lines: { off: number; color: number; dashed: boolean }[] =
    s.marking === 'avenue'
      ? [
          { off: -half / 2, color: MAP_COLORS.lineWhite, dashed: true },
          { off: half / 2, color: MAP_COLORS.lineWhite, dashed: true },
          { off: -half + 0.6, color: MAP_COLORS.lineWhite, dashed: false },
          { off: half - 0.6, color: MAP_COLORS.lineWhite, dashed: false },
        ]
      : [{ off: 0, color: MAP_COLORS.lineYellow, dashed: true }];
  for (const line of lines) {
    for (let a = a0 + 1; a < a1 - 1; a += line.dashed ? DASH + GAP : DASH) {
      const b = Math.min(a + DASH, a1 - 1);
      const cA = (a + b) / 2;
      const x = alongX ? cA : mid + line.off;
      const z = alongX ? mid + line.off : cA;
      if (others.some((o) => inside(x, z, o.rect))) continue;
      if (alongX) sink.flat(a, z - LINE / 2, b, z + LINE / 2, LAYER.marking, line.color);
      else sink.flat(x - LINE / 2, a, x + LINE / 2, b, LAYER.marking, line.color);
    }
  }
}
