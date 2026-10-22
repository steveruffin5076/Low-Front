import { MAP, MAP_COLORS } from '../data/map/config';
import type { SolidBuildingDef } from '../data/map/types';
import type { StaticSink } from './StaticSink';
import { volume, type Volume } from './Volume';

/**
 * Solid (not enterable) building: one collision box with a low-poly facade — window panels,
 * floor ledges, a parapet and AC units on the roof (plan section 10.4).
 */
export function buildSolid(b: SolidBuildingDef, sink: StaticSink, variant: number): Volume {
  const h = b.floors * MAP.floorHeight + MAP.curbHeight;
  sink.box([b.x, h / 2, b.z], [b.w, h, b.d], b.color);
  const trim = variant % 2 ? MAP_COLORS.ledge : MAP_COLORS.windowFrame;

  // Windows on every side and floor; the ground floor gets wider shop windows on even variants.
  const sides: { cx: number; cz: number; len: number; yaw: number; nx: number; nz: number }[] = [
    { cx: b.x, cz: b.z + b.d / 2, len: b.w, yaw: 0, nx: 0, nz: 1 },
    { cx: b.x, cz: b.z - b.d / 2, len: b.w, yaw: Math.PI, nx: 0, nz: -1 },
    { cx: b.x + b.w / 2, cz: b.z, len: b.d, yaw: Math.PI / 2, nx: 1, nz: 0 },
    { cx: b.x - b.w / 2, cz: b.z, len: b.d, yaw: -Math.PI / 2, nx: -1, nz: 0 },
  ];
  for (const s of sides) {
    const count = Math.max(1, Math.floor(s.len / MAP.windowSpacing));
    const spacing = s.len / count;
    for (let f = 0; f < b.floors; f++) {
      const shop = f === 0 && variant % 2 === 0;
      const wy = f * MAP.floorHeight + MAP.curbHeight + (shop ? 0.5 : MAP.windowSill);
      const height = shop ? 2.0 : MAP.windowHeight;
      for (let i = 0; i < count; i++) {
        const u = -s.len / 2 + spacing * (i + 0.5);
        const width = shop ? spacing * 0.75 : MAP.windowWidth;
        const x = s.cx + (s.nz !== 0 ? u : 0) + s.nx * 0.03;
        const z = s.cz + (s.nx !== 0 ? u : 0) + s.nz * 0.03;
        sink.panel([x + s.nx * 0.01, wy + height / 2, z + s.nz * 0.01], width + 0.24, height + 0.24, s.yaw, trim);
        sink.panel([x + s.nx * 0.03, wy + height / 2, z + s.nz * 0.03], width, height, s.yaw, MAP_COLORS.window);
      }
      if (f > 0) {
        const y = f * MAP.floorHeight + MAP.curbHeight;
        const along = s.nz !== 0;
        sink.box([s.cx + s.nx * 0.06, y, s.cz + s.nz * 0.06], along ? [s.len + 0.12, 0.18, 0.14] : [0.14, 0.18, s.len + 0.12], trim);
      }
    }
  }
  // Parapet and roof.
  const t = 0.3;
  sink.box([b.x, h + 0.25, b.z - b.d / 2 + t / 2], [b.w, 0.5, t], trim);
  sink.box([b.x, h + 0.25, b.z + b.d / 2 - t / 2], [b.w, 0.5, t], trim);
  sink.box([b.x - b.w / 2 + t / 2, h + 0.25, b.z], [t, 0.5, b.d - 2 * t], trim);
  sink.box([b.x + b.w / 2 - t / 2, h + 0.25, b.z], [t, 0.5, b.d - 2 * t], trim);
  sink.flat(b.x - b.w / 2 + t, b.z - b.d / 2 + t, b.x + b.w / 2 - t, b.z + b.d / 2 - t, h + 0.01, MAP_COLORS.roof);
  if (b.w * b.d > 120) sink.box([b.x + b.w * 0.15, h + 0.5, b.z - b.d * 0.15], [1.6, 1.0, 1.2], MAP_COLORS.acUnit);
  if (b.w * b.d > 260) sink.box([b.x - b.w * 0.2, h + 0.5, b.z + b.d * 0.2], [1.6, 1.0, 1.2], MAP_COLORS.acUnit);
  return volume([b.x, h / 2, b.z], [b.w, h, b.d], 'solid', 'concrete');
}
