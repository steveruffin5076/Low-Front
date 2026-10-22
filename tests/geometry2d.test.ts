import { describe, expect, it } from 'vitest';
import { subtractRects, wallPieces } from '../src/world/geometry2d';

const area = (rs: { x0: number; z0: number; x1: number; z1: number }[]): number =>
  rs.reduce((a, r) => a + (r.x1 - r.x0) * (r.z1 - r.z0), 0);

describe('wallPieces', () => {
  it('leaves a door and a window open', () => {
    const pieces = wallPieces(10, 0, 3, [
      { u0: 2, u1: 3.5, v0: 0, v1: 2.2 },
      { u0: 6, u1: 7.5, v0: 1, v1: 2.5 },
    ]);
    const solid = pieces.reduce((a, p) => a + (p.u1 - p.u0) * (p.v1 - p.v0), 0);
    expect(solid).toBeCloseTo(30 - 1.5 * 2.2 - 1.5 * 1.5);
    // Nothing covers the door center or the window center.
    const covers = (u: number, v: number): boolean => pieces.some((p) => u > p.u0 && u < p.u1 && v > p.v0 && v < p.v1);
    expect(covers(2.75, 1)).toBe(false);
    expect(covers(6.75, 1.7)).toBe(false);
    expect(covers(5, 1)).toBe(true);
  });
});

describe('subtractRects', () => {
  it('cuts a hole out of a slab', () => {
    const rs = subtractRects({ x0: 0, z0: 0, x1: 10, z1: 10 }, [{ x0: 2, z0: 3, x1: 5, z1: 9 }]);
    expect(area(rs)).toBeCloseTo(100 - 18);
    expect(rs.some((r) => 3 > r.x0 && 3 < r.x1 && 5 > r.z0 && 5 < r.z1)).toBe(false);
  });
  it('returns the outer rect with no holes', () => {
    expect(subtractRects({ x0: 0, z0: 0, x1: 4, z1: 4 }, [])).toEqual([{ x0: 0, z0: 0, x1: 4, z1: 4 }]);
  });
});
