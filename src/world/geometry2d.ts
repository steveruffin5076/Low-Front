/** Small 2D helpers for walls with openings and slabs with holes. */

export interface Span {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

/**
 * Splits a wall band (length × [v0, v1]) into solid rectangles around openings.
 * Openings must not overlap each other along u.
 */
export function wallPieces(length: number, v0: number, v1: number, openings: readonly Span[]): Span[] {
  const holes = openings
    .map((o) => ({ ...o, u0: Math.max(0, o.u0), u1: Math.min(length, o.u1), v0: Math.max(v0, o.v0), v1: Math.min(v1, o.v1) }))
    .filter((o) => o.u1 > o.u0 && o.v1 > o.v0)
    .sort((a, b) => a.u0 - b.u0);
  const out: Span[] = [];
  let u = 0;
  for (const h of holes) {
    if (h.u0 > u) out.push({ u0: u, u1: h.u0, v0, v1 });
    if (h.v0 > v0) out.push({ u0: h.u0, u1: h.u1, v0, v1: h.v0 });
    if (h.v1 < v1) out.push({ u0: h.u0, u1: h.u1, v0: h.v1, v1 });
    u = Math.max(u, h.u1);
  }
  if (u < length) out.push({ u0: u, u1: length, v0, v1 });
  return out.filter((s) => s.u1 - s.u0 > 1e-3 && s.v1 - s.v0 > 1e-3);
}

export interface Rect2 {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/** `outer` minus `holes`, as a list of rectangles (grid decomposition, rows merged). */
export function subtractRects(outer: Rect2, holes: readonly Rect2[]): Rect2[] {
  const clipped = holes
    .map((h) => ({ x0: Math.max(outer.x0, h.x0), z0: Math.max(outer.z0, h.z0), x1: Math.min(outer.x1, h.x1), z1: Math.min(outer.z1, h.z1) }))
    .filter((h) => h.x1 > h.x0 && h.z1 > h.z0);
  if (clipped.length === 0) return [outer];
  const xs = [...new Set([outer.x0, outer.x1, ...clipped.flatMap((h) => [h.x0, h.x1])])].sort((a, b) => a - b);
  const zs = [...new Set([outer.z0, outer.z1, ...clipped.flatMap((h) => [h.z0, h.z1])])].sort((a, b) => a - b);
  const out: Rect2[] = [];
  for (let j = 0; j < zs.length - 1; j++) {
    let run: Rect2 | null = null;
    for (let i = 0; i < xs.length - 1; i++) {
      const cx = (xs[i] + xs[i + 1]) / 2;
      const cz = (zs[j] + zs[j + 1]) / 2;
      const inHole = clipped.some((h) => cx > h.x0 && cx < h.x1 && cz > h.z0 && cz < h.z1);
      if (inHole) {
        if (run) out.push(run);
        run = null;
      } else if (run) {
        run.x1 = xs[i + 1];
      } else {
        run = { x0: xs[i], z0: zs[j], x1: xs[i + 1], z1: zs[j + 1] };
      }
    }
    if (run) out.push(run);
  }
  return out;
}
