import { MAP, MAP_COLORS } from '../data/map/config';
import { subtractRects, wallPieces, type Rect2, type Span } from './geometry2d';
import { LocalFrame } from './LocalFrame';
import type { FloorPlan, FloorSel, Opening, Side, StairDef } from './plan';
import type { StaticSink } from './StaticSink';

const T = MAP.wallThickness;
const INNER_T = 0.15;
const CURB = MAP.curbHeight;
const SLAB = MAP.slabThickness;
const DOOR_W = 1.6;
const STAIR_HOUSE_DEPTH = 1.6;
const STAIR_HOUSE_HEIGHT = 2.7;

function onFloor(sel: FloorSel | undefined, i: number, floors: number): boolean {
  if (sel === undefined || sel === 'all') return true;
  if (sel === 'ground') return i === 0;
  if (sel === 'upper') return i > 0 && i < floors;
  return sel.includes(i);
}

/**
 * Builds an enterable building from a floor plan (plan section 10.4): exterior walls with
 * door and window openings, slabs with stairwell holes, switchback stairs with ramp
 * colliders and nav links, stair cores, interior walls, balconies, roof and parapet.
 */
export class BuildingBuilder {
  private readonly f: LocalFrame;
  private readonly fh: number;

  constructor(
    private readonly p: FloorPlan,
    sink: StaticSink,
    x: number,
    z: number,
    rotY: number,
    private readonly wallColor = p.wallColor,
  ) {
    this.f = new LocalFrame(sink, rotY, x, z);
    this.fh = p.floorHeight;
  }

  build(): LocalFrame {
    const p = this.p;
    this.slabs();
    if (p.frame) this.columns();
    else this.exteriorWalls();
    for (const s of p.stairs) this.stair(s);
    this.interiorWalls();
    this.balconies();
    this.roof();
    for (const e of p.extras ?? []) this.f.box(e.center, e.size, e.color, e.solid ? { kind: 'solid' } : {});
    return this.f;
  }

  /** Floor surface height of storey i (0 = ground). */
  private fs(i: number): number {
    return i * this.fh + CURB;
  }

  private get topStorey(): number {
    return this.p.roof === 'none' ? this.p.floors - 1 : this.p.floors;
  }

  // --- Slabs ---

  private stairRect(s: StairDef): Rect2 {
    const along = Math.abs(Math.sin(s.rot)) > 0.5;
    const hw = (along ? MAP.stairLength : MAP.stairWidth) / 2;
    const hd = (along ? MAP.stairWidth : MAP.stairLength) / 2;
    return { x0: s.x - hw, z0: s.z - hd, x1: s.x + hw, z1: s.z + hd };
  }

  private stairTop(s: StairDef): number {
    return s.toRoof ? this.p.floors : this.p.floors - 1;
  }

  private slabs(): void {
    const p = this.p;
    // Slab edges sit inside the walls so their faces never coincide with the wall faces.
    const inset = p.frame ? 0 : T / 2;
    const outer = { x0: -p.w / 2 + inset, z0: -p.d / 2 + inset, x1: p.w / 2 - inset, z1: p.d / 2 - inset };
    this.f.boxFromTo([outer.x0, 0, outer.z0], [outer.x1, CURB, outer.z1], p.floorColor, { kind: 'floor' });
    const last = p.roof === 'none' ? p.floors - 1 : p.floors;
    for (let i = 1; i <= last; i++) {
      const holes = p.stairs.filter((s) => i > (s.from ?? 0) && i <= this.stairTop(s)).map((s) => this.stairRect(s));
      const color = i === p.floors ? MAP_COLORS.roof : p.floorColor;
      for (const r of subtractRects(outer, holes)) {
        this.f.boxFromTo([r.x0, this.fs(i) - SLAB, r.z0], [r.x1, this.fs(i), r.z1], color, { kind: 'floor' });
      }
    }
  }

  // --- Exterior walls ---

  private sideFrame(side: Side): { length: number; place: (u0: number, u1: number, y0: number, y1: number, t: number) => [number, number, number, number, number, number] } {
    const { w, d } = this.p;
    if (side === 'n' || side === 's') {
      const z = side === 'n' ? -d / 2 + T / 2 : d / 2 - T / 2;
      return { length: w, place: (u0, u1, y0, y1, t) => [-w / 2 + u0, y0, z - t / 2, -w / 2 + u1, y1, z + t / 2] };
    }
    const x = side === 'w' ? -w / 2 + T / 2 : w / 2 - T / 2;
    const len = d - 2 * T;
    return { length: len, place: (u0, u1, y0, y1, t) => [x - t / 2, y0, -len / 2 + u0, x + t / 2, y1, -len / 2 + u1] };
  }

  private openingsFor(side: Side, storey: number, length: number): Span[] {
    const p = this.p;
    const base = storey * this.fh + CURB;
    const own = p.openings.filter((o) => o.side === side && onFloor(o.floors, storey, p.floors));
    const toSpan = (o: Opening): Span => ({
      u0: length / 2 + o.u - o.width / 2,
      u1: length / 2 + o.u + o.width / 2,
      v0: base + o.bottom,
      v1: base + o.bottom + o.height,
    });
    const spans = own.map(toSpan);
    const win = p.windows;
    if (win && win.sides.includes(side) && onFloor(win.floors, storey, p.floors)) {
      const count = Math.floor(length / win.spacing);
      for (let k = 0; k < count; k++) {
        const u = -length / 2 + win.spacing * (k + 0.5) + (length - count * win.spacing) / 2;
        const s = toSpan({ side, u, width: win.width, bottom: win.bottom, height: win.height, floors: 'all' });
        if (s.u0 < 0.5 || s.u1 > length - 0.5) continue;
        if (spans.some((o) => s.u0 < o.u1 + 0.4 && s.u1 > o.u0 - 0.4)) continue;
        spans.push(s);
      }
    }
    return spans;
  }

  private exteriorWalls(): void {
    const p = this.p;
    const roofTop = this.fs(p.floors);
    const parapet = p.roof === 'access' ? MAP.parapetHeight : 0.5;
    for (const side of ['n', 's', 'e', 'w'] as const) {
      const sf = this.sideFrame(side);
      for (let i = 0; i < p.floors; i++) {
        const y0 = i * this.fh;
        const y1 = i === p.floors - 1 ? roofTop : (i + 1) * this.fh;
        for (const piece of wallPieces(sf.length, y0, y1, this.openingsFor(side, i, sf.length))) {
          const b = sf.place(piece.u0, piece.u1, piece.v0, piece.v1, T);
          this.f.boxFromTo([b[0], b[1], b[2]], [b[3], b[4], b[5]], this.wallColor, { kind: 'solid' });
        }
        // Floor ledge (trim) between storeys.
        if (i > 0) {
          const ledge = sf.place(-0.1, sf.length + 0.1, y0 - 0.12, y0 + 0.08, T + 0.16);
          this.f.boxFromTo([ledge[0], ledge[1], ledge[2]], [ledge[3], ledge[4], ledge[5]], p.trimColor);
        }
      }
      const top = sf.place(0, sf.length, roofTop, roofTop + parapet, T);
      this.f.boxFromTo([top[0], top[1], top[2]], [top[3], top[4], top[5]], p.trimColor, { kind: 'solid' });
    }
  }

  /** Unfinished frame: columns on a ~6 m grid, no walls. */
  private columns(): void {
    const p = this.p;
    const nx = Math.ceil(p.w / 6);
    const nz = Math.ceil(p.d / 6);
    const holes = p.stairs.map((s) => this.stairRect(s));
    for (let i = 0; i <= nx; i++) {
      for (let j = 0; j <= nz; j++) {
        const x = -p.w / 2 + 0.25 + ((p.w - 0.5) * i) / nx;
        const z = -p.d / 2 + 0.25 + ((p.d - 0.5) * j) / nz;
        if (holes.some((h) => x > h.x0 - 0.8 && x < h.x1 + 0.8 && z > h.z0 - 0.8 && z < h.z1 + 0.8)) continue;
        for (let s = 0; s <= this.topStorey - (p.roof === 'none' ? 0 : 1); s++) {
          const y1 = s < p.floors - 1 || p.roof !== 'none' ? this.fs(s + 1) - SLAB : this.fs(s) + 1.2;
          this.f.boxFromTo([x - 0.25, this.fs(s), z - 0.25], [x + 0.25, y1, z + 0.25], MAP_COLORS.column, { kind: 'solid' });
        }
      }
    }
    // Rebar sticking out of the top slab.
    const top = this.fs(p.floors - 1);
    for (let i = 0; i < 6; i++) {
      const x = -p.w / 2 + 2 + ((p.w - 4) * i) / 5;
      this.f.boxFromTo([x - 0.03, top, -p.d / 2 + 0.3], [x + 0.03, top + 0.9, -p.d / 2 + 0.36], MAP_COLORS.rebar);
    }
  }

  // --- Stairs ---

  private stair(s: StairDef): void {
    const W = MAP.stairWidth;
    const L = MAP.stairLength;
    const landing = MAP.stairLanding;
    const run = L - landing;
    const rise = this.fh / 2;
    const angle = Math.atan2(rise, run);
    const from = s.from ?? 0;
    const top = this.stairTop(s);
    const c = Math.cos(s.rot);
    const sn = Math.sin(s.rot);
    /** Stair-local (sx, y, sz) → building-local box with the stair's rotation. */
    const at = (sx: number, sz: number): [number, number] => [s.x + sx * c + sz * sn, s.z - sx * sn + sz * c];
    const box = (sx: number, y: number, sz: number, size: [number, number, number], color: number, o: Parameters<LocalFrame['box']>[3] = {}): void => {
      const [x, z] = at(sx, sz);
      this.f.box([x, y, z], size, color, { ...o, yaw: s.rot + (o.yaw ?? 0) });
    };
    const steps = MAP.stepsPerFlight;
    const half = W / 2 - 0.08;

    for (let st = from; st <= top; st++) {
      const y0 = this.fs(st);
      const bandTop = st === this.p.floors ? y0 + STAIR_HOUSE_HEIGHT : this.fs(st + 1) - SLAB;
      // Core walls: two long sides and the far end, on every storey the stair reaches.
      const zStart = st === this.p.floors ? -L / 2 - STAIR_HOUSE_DEPTH : -L / 2;
      const coreLen = L / 2 - zStart;
      for (const side of [-1, 1]) {
        box(side * (W / 2 + INNER_T / 2), (y0 + bandTop) / 2, zStart + coreLen / 2, [INNER_T, bandTop - y0, coreLen], this.p.trimColor, { kind: 'solid' });
      }
      box(0, (y0 + bandTop) / 2, L / 2 + INNER_T / 2, [W + 2 * INNER_T, bandTop - y0, INNER_T], this.p.trimColor, { kind: 'solid' });

      if (st < top) {
        // Flight 1 (half A, −X) up to the landing; flight 2 (half B, +X) back to the next floor.
        for (const [sx, dir, base] of [[-W / 4, 1, y0], [W / 4, -1, y0 + rise]] as const) {
          for (let k = 0; k < steps; k++) {
            const h = (rise * (k + 1)) / steps;
            const depth = run / steps;
            const zc = dir > 0 ? -L / 2 + depth * (k + 0.5) : L / 2 - landing - depth * (k + 0.5);
            box(sx, base + h / 2, zc, [half, h, depth], MAP_COLORS.stairs);
          }
          const len = Math.hypot(run, rise) + 0.2;
          const thick = 0.2;
          const yc = base + rise / 2 - thick / 2 / Math.cos(angle);
          box(sx, yc, -L / 2 + run / 2, [half, thick, len], -1, { kind: 'ramp', tilt: -dir * angle, noCover: true });
        }
        // Landing and the divider between the flights.
        box(0, y0 + rise - 0.15, L / 2 - landing / 2, [W, 0.3, landing], MAP_COLORS.stairs, { kind: 'floor' });
        box(0, y0 + rise / 2 + 0.6, -L / 2 + run / 2, [0.1, rise + 1.2, run], this.p.trimColor, { kind: 'solid', noCover: true });
        // Waypoints: up flight 1 to the landing, across it, then up flight 2 (never across the divider).
        const a = at(-W / 4, -L / 2 - 0.8);
        const b = at(W / 4, -L / 2 - 0.8);
        const landA = at(-W / 4, L / 2 - landing / 2);
        const landB = at(W / 4, L / 2 - landing / 2);
        this.f.link(this.f.point(a[0], y0, a[1]), this.f.point(b[0], this.fs(st + 1), b[1]), [
          this.f.point(landA[0], y0 + rise, landA[1]),
          this.f.point(landB[0], y0 + rise, landB[1]),
        ]);
      } else {
        // Top storey: rail across half A, where the hole drops to the flight below.
        box(-W / 4, y0 + 0.5, -L / 2 + 0.05, [W / 2, 1.0, 0.08], MAP_COLORS.railing, { kind: 'solid', noCover: true });
      }

      if (st === this.p.floors) {
        // Stair house on the roof: entry wall with a door on half B, and a cap.
        const zWall = -L / 2 - STAIR_HOUSE_DEPTH;
        // Door on half B spans sx = W/4 ± 0.6; the wall fills the rest out to the core walls.
        const left0 = -W / 2 - INNER_T;
        const left1 = W / 4 - 0.6;
        const right0 = W / 4 + 0.6;
        const right1 = W / 2 + INNER_T;
        box((left0 + left1) / 2, (y0 + bandTop) / 2, zWall, [left1 - left0, bandTop - y0, INNER_T], this.p.trimColor, { kind: 'solid' });
        box((right0 + right1) / 2, (y0 + bandTop) / 2, zWall, [right1 - right0, bandTop - y0, INNER_T], this.p.trimColor, { kind: 'solid' });
        box(W / 4, (y0 + 2.3 + bandTop) / 2, zWall, [1.2, bandTop - y0 - 2.3, INNER_T], this.p.trimColor, { kind: 'solid' });
        box(0, bandTop + 0.1, zStart / 2 + L / 4, [W + 0.4, 0.2, coreLen + 0.2], MAP_COLORS.roof, { kind: 'solid' });
      }
    }
  }

  // --- Interior walls, balconies, roof ---

  private interiorWalls(): void {
    const p = this.p;
    for (const wall of p.interiorWalls) {
      const [x0, z0] = wall.from;
      const [x1, z1] = wall.to;
      const alongX = Math.abs(z1 - z0) < 1e-6;
      const length = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
      for (let i = 0; i <= this.topStorey - (p.roof === 'none' ? 0 : 1); i++) {
        if (!onFloor(wall.floors, i, p.floors)) continue;
        const y0 = this.fs(i);
        const y1 = wall.height !== undefined ? y0 + wall.height : this.fs(i + 1) - SLAB;
        const doors = (wall.doors ?? []).map((u) => ({ u0: u - DOOR_W / 2, u1: u + DOOR_W / 2, v0: y0, v1: y0 + 2.2 }));
        for (const piece of wallPieces(length, y0, y1, doors)) {
          const a = Math.min(alongX ? x0 : z0, alongX ? x1 : z1);
          if (alongX) this.f.boxFromTo([a + piece.u0, piece.v0, z0 - INNER_T / 2], [a + piece.u1, piece.v1, z0 + INNER_T / 2], wall.height ? p.wallColor : MAP_COLORS.interiorWall, { kind: 'solid' });
          else this.f.boxFromTo([x0 - INNER_T / 2, piece.v0, a + piece.u0], [x0 + INNER_T / 2, piece.v1, a + piece.u1], wall.height ? p.wallColor : MAP_COLORS.interiorWall, { kind: 'solid' });
        }
      }
    }
  }

  private balconies(): void {
    const p = this.p;
    for (const b of p.balconies ?? []) {
      for (const fl of b.floors) {
        const y = this.fs(fl);
        for (const u of b.us) {
          const { w, d } = p;
          // Balcony rect outside the wall on side b.side.
          let r: Rect2;
          if (b.side === 's') r = { x0: u - b.width / 2, z0: d / 2, x1: u + b.width / 2, z1: d / 2 + b.depth };
          else if (b.side === 'n') r = { x0: u - b.width / 2, z0: -d / 2 - b.depth, x1: u + b.width / 2, z1: -d / 2 };
          else if (b.side === 'e') r = { x0: w / 2, z0: u - b.width / 2, x1: w / 2 + b.depth, z1: u + b.width / 2 };
          else r = { x0: -w / 2 - b.depth, z0: u - b.width / 2, x1: -w / 2, z1: u + b.width / 2 };
          this.f.boxFromTo([r.x0, y - 0.25, r.z0], [r.x1, y, r.z1], p.trimColor, { kind: 'floor' });
          const rail = (min: [number, number, number], max: [number, number, number]): void =>
            this.f.boxFromTo(min, max, MAP_COLORS.railing, { kind: 'solid', noCover: true });
          const h = MAP.railingHeight;
          if (b.side === 's' || b.side === 'n') {
            const zf = b.side === 's' ? r.z1 - 0.04 : r.z0 + 0.04;
            rail([r.x0, y, zf - 0.04], [r.x1, y + h, zf + 0.04]);
            rail([r.x0, y, r.z0], [r.x0 + 0.08, y + h, r.z1]);
            rail([r.x1 - 0.08, y, r.z0], [r.x1, y + h, r.z1]);
          } else {
            const xf = b.side === 'e' ? r.x1 - 0.04 : r.x0 + 0.04;
            rail([xf - 0.04, y, r.z0], [xf + 0.04, y + h, r.z1]);
            rail([r.x0, y, r.z0], [r.x1, y + h, r.z0 + 0.08]);
            rail([r.x0, y, r.z1 - 0.08], [r.x1, y + h, r.z1]);
          }
        }
      }
    }
  }

  private roof(): void {
    const p = this.p;
    if (p.roof === 'none' || p.frame) return;
    // AC units on the roof (cover when the roof is walkable).
    const y = this.fs(p.floors);
    const ac = Math.max(1, Math.floor(p.w / 12));
    for (let i = 0; i < ac; i++) {
      const x = -p.w / 2 + (p.w * (i + 0.5)) / ac;
      const hit = p.stairs.some((s) => {
        const r = this.stairRect(s);
        return x > r.x0 - 2.5 && x < r.x1 + 2.5 && p.d / 4 > r.z0 - 2.5 && p.d / 4 < r.z1 + 2.5;
      });
      if (!hit) this.f.boxFromTo([x - 0.8, y, p.d / 4 - 0.6], [x + 0.8, y + 1.1, p.d / 4 + 0.6], MAP_COLORS.acUnit, { kind: 'solid', surface: 'metal' });
    }
  }
}
