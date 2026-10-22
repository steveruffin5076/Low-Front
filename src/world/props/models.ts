import * as THREE from 'three';
import { PALETTE } from '../../data/palette';
import type { PropType } from '../../data/map/types';
import { PropParts, type PropModel } from './PropKit';

/**
 * Low-poly cover props built in code (plan section 10.3). Local frame: origin on the ground
 * at the footprint center, length along Z. White parts take the per-instance tint.
 */
const WHITE = 0xffffff;
const TIRE = 0x1d1e21;
const GLASS = 0x27333f;
const CONCRETE = 0xb8b4aa;
const METAL = 0x6f7780;
const RUST = 0x8a4a2a;
const SAND = 0xc8b27a;
const WOOD = 0xa0703f;
const LEAF = 0x5fae3d;

function wheels(p: PropParts, halfWidth: number, zs: readonly number[], r: number): void {
  for (const z of zs) for (const s of [-1, 1]) p.cyl([s * halfWidth, r, z], r, 0.26, TIRE, 'x', 8);
}

function car(body: number, burned: boolean): PropModel {
  const p = new PropParts();
  const glass = burned ? 0x1a1a1a : GLASS;
  p.box([0, 0.68, 0], [1.8, 0.62, 4.3], body);
  p.box([0, 1.2, -0.25], [1.6, 0.48, 2.3], burned ? 0x2a2522 : body);
  p.box([0, 1.2, -0.25], [1.64, 0.32, 2.0], glass);
  p.box([0, 0.62, 2.16], [1.7, 0.2, 0.06], burned ? RUST : 0xd8d8d8);
  wheels(p, 0.82, [-1.35, 1.35], 0.34);
  return { geometry: p.build(), colliders: [{ center: [0, 0.72, 0], size: [1.8, 1.44, 4.3] }], surface: 'metal' };
}

function bus(): PropModel {
  const p = new PropParts();
  p.box([0, 1.7, 0], [2.5, 2.6, 11], WHITE);
  p.box([0, 2.15, 0.2], [2.54, 0.8, 9.6], GLASS);
  p.box([0, 2.15, 5.52], [2.2, 1.1, 0.06], GLASS);
  p.box([0, 3.05, 0], [2.3, 0.12, 10.6], 0xdedede);
  wheels(p, 1.12, [-3.6, 3.6], 0.5);
  return { geometry: p.build(), colliders: [{ center: [0, 1.5, 0], size: [2.5, 3.0, 11] }], surface: 'metal' };
}

function barrier(): PropModel {
  const p = new PropParts();
  const shape = new THREE.Shape([new THREE.Vector2(-0.3, 0), new THREE.Vector2(0.3, 0), new THREE.Vector2(0.12, 0.35), new THREE.Vector2(0.1, 0.8), new THREE.Vector2(-0.1, 0.8), new THREE.Vector2(-0.12, 0.35)]);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false }).translate(0, 0, -1.5);
  p.add(g, CONCRETE);
  p.box([0, 0.55, 0], [0.22, 0.08, 3.01], 0xe5483b);
  return { geometry: p.build(), colliders: [{ center: [0, 0.4, 0], size: [0.6, 0.8, 3] }], surface: 'concrete' };
}

function sandbags(): PropModel {
  const p = new PropParts();
  const rows = 3;
  for (let r = 0; r < rows; r++) {
    const n = 4 - (r === 2 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const z = -0.9 + (1.8 * (i + 0.5)) / n + (r % 2 ? 0.15 : 0);
      p.box([0, 0.15 + r * 0.29, Math.min(0.95, z)], [0.65 - r * 0.08, 0.3, 1.8 / n - 0.04], r % 2 ? 0xbfa76f : SAND);
    }
  }
  return { geometry: p.build(), colliders: [{ center: [0, 0.45, 0], size: [0.7, 0.9, 2.2] }], surface: 'dirt' };
}

function crate(): PropModel {
  const p = new PropParts();
  p.box([0, 0.6, 0], [1.2, 1.2, 1.2], WOOD);
  p.box([0, 0.6, 0], [1.24, 0.12, 1.24], 0x7a5530);
  p.box([0, 0.6, 0], [0.12, 1.24, 1.24], 0x7a5530);
  return { geometry: p.build(), colliders: [{ center: [0, 0.6, 0], size: [1.2, 1.2, 1.2] }], surface: 'wood' };
}

function dumpster(): PropModel {
  const p = new PropParts();
  p.box([0, 0.7, 0], [1.3, 1.1, 2.0], 0x2e6b4f);
  p.box([0, 1.3, 0], [1.4, 0.12, 2.1], 0x245740);
  wheels(p, 0.5, [-0.8, 0.8], 0.12);
  return { geometry: p.build(), colliders: [{ center: [0, 0.7, 0], size: [1.3, 1.4, 2.0] }], surface: 'metal' };
}

function container(): PropModel {
  const p = new PropParts();
  p.box([0, 1.3, 0], [2.44, 2.6, 6.06], WHITE);
  for (let i = -5; i <= 5; i++) {
    p.box([1.23, 1.3, i * 0.52], [0.04, 2.4, 0.12], 0xd0d0d0);
    p.box([-1.23, 1.3, i * 0.52], [0.04, 2.4, 0.12], 0xd0d0d0);
  }
  p.box([0, 1.3, 3.04], [2.3, 2.4, 0.04], 0xd8d8d8);
  return { geometry: p.build(), colliders: [{ center: [0, 1.3, 0], size: [2.44, 2.6, 6.06] }], surface: 'metal' };
}

function rubble(): PropModel {
  const p = new PropParts();
  const pieces: [number, number, number, number, number, number, number][] = [
    [0, 0.3, 0, 2.2, 0.6, 2.0, 0.2],
    [-0.6, 0.6, 0.4, 1.0, 0.5, 0.9, 0.7],
    [0.7, 0.55, -0.3, 0.9, 0.5, 1.0, -0.5],
    [0.1, 0.85, 0, 0.8, 0.35, 0.7, 1.1],
    [0.9, 0.25, 0.9, 0.7, 0.5, 0.6, 0.3],
  ];
  for (const [x, y, z, sx, sy, sz, r] of pieces) p.box([x, y, z], [sx, sy, sz], r > 0.5 ? 0x9f9a90 : CONCRETE, [0.1, r, 0.08]);
  p.box([-0.2, 0.9, -0.5], [0.06, 0.06, 1.4], RUST, [0.4, 0.3, 0]);
  return { geometry: p.build(), colliders: [{ center: [0, 0.45, 0], size: [2.4, 0.9, 2.4] }], surface: 'concrete' };
}

function busStop(): PropModel {
  const p = new PropParts();
  p.box([0, 1.25, -0.6], [0.08, 2.1, 3.4], GLASS, [0, Math.PI / 2, 0]);
  p.box([0, 2.4, 0], [3.6, 0.12, 1.6], 0x3d5a73);
  for (const x of [-1.7, 1.7]) p.box([x, 1.2, -0.6], [0.1, 2.4, 0.1], METAL);
  p.box([0, 0.45, -0.35], [2.6, 0.08, 0.4], WOOD);
  return { geometry: p.build(), colliders: [{ center: [0, 1.2, -0.6], size: [3.4, 2.4, 0.15] }], surface: 'metal' };
}

function streetLight(): PropModel {
  const p = new PropParts();
  p.cyl([0, 3, 0], 0.09, 6, 0x3d4349, 'y', 6);
  p.box([0, 6, 0.7], [0.12, 0.12, 1.5], 0x3d4349);
  p.box([0, 5.9, 1.4], [0.35, 0.15, 0.6], 0xfff2c4);
  return { geometry: p.build(), colliders: [{ center: [0, 3, 0], size: [0.25, 6, 0.25] }], surface: 'metal', noCover: true };
}

function tree(): PropModel {
  const p = new PropParts();
  p.cyl([0, 1.2, 0], 0.18, 2.4, 0x6b4a2b, 'y', 6);
  p.blob([0, 3.4, 0], 1.7, LEAF, 0.9);
  p.blob([0.5, 4.3, 0.3], 1.1, 0x6dbe45, 0.9);
  return { geometry: p.build(), colliders: [{ center: [0, 1.2, 0], size: [0.4, 2.4, 0.4] }], surface: 'wood', noCover: true };
}

function planter(): PropModel {
  const p = new PropParts();
  p.box([0, 0.35, 0], [1.1, 0.7, 2.4], CONCRETE);
  p.blob([0, 0.95, -0.5], 0.55, LEAF, 0.7);
  p.blob([0, 0.95, 0.5], 0.5, 0x6dbe45, 0.7);
  return { geometry: p.build(), colliders: [{ center: [0, 0.45, 0], size: [1.1, 0.9, 2.4] }], surface: 'concrete' };
}

function scaffolding(): PropModel {
  const p = new PropParts();
  const H = 9;
  for (const z of [-3, 0, 3]) for (const x of [-0.75, 0.75]) p.box([x, H / 2, z], [0.08, H, 0.08], 0x9aa3ab);
  for (const y of [3, 6, 9]) {
    p.box([0, y, 0], [1.6, 0.08, 6.1], 0xb38b55);
    p.box([0.75, y + 1, 0], [0.06, 0.06, 6], 0x9aa3ab);
  }
  for (const z of [-1.5, 1.5]) p.box([0.75, H / 2, z], [0.05, 0.05, 9.6], 0x9aa3ab, [Math.atan2(3, H) * 2, 0, 0]);
  return { geometry: p.build(), colliders: [{ center: [0, H / 2, 0], size: [1.6, H, 6] }], surface: 'metal' };
}

function trainCar(): PropModel {
  const p = new PropParts();
  p.box([0, 2.55, 0], [3.0, 3.1, 14], WHITE);
  p.box([1.52, 2.4, 0], [0.04, 2.2, 3], 0x4b4f55);
  p.box([-1.52, 2.4, 0], [0.04, 2.2, 3], 0x4b4f55);
  p.box([0, 4.15, 0], [2.8, 0.12, 13.8], 0x9a9a9a);
  for (const z of [-5, 5]) {
    p.box([0, 0.65, z], [2.2, 0.6, 2.6], 0x2b2e33);
    wheels(p, 0.75, [z - 0.8, z + 0.8], 0.45);
  }
  return { geometry: p.build(), colliders: [{ center: [0, 2.1, 0], size: [3.0, 4.2, 14] }], surface: 'metal' };
}

function crane(): PropModel {
  const p = new PropParts();
  const H = 32;
  const Y = 0xe9c46a;
  for (const x of [-0.9, 0.9]) for (const z of [-0.9, 0.9]) p.box([x, H / 2, z], [0.18, H, 0.18], Y);
  for (let y = 2; y < H; y += 4) {
    p.box([0, y, 0.9], [1.8, 0.12, 0.12], Y);
    p.box([0, y, -0.9], [1.8, 0.12, 0.12], Y);
    p.box([0.9, y, 0], [0.12, 0.12, 1.8], Y);
    p.box([-0.9, y, 0], [0.12, 0.12, 1.8], Y);
  }
  p.box([0, H + 0.8, 10], [1.2, 1.2, 30], Y);
  p.box([0, H + 0.4, -7], [1.6, 2.0, 4], 0x8d8d8d);
  p.box([0, H - 1.2, 1.6], [1.6, 1.6, 1.6], 0x3d5a73);
  p.box([0, H + 3.0, 0], [0.3, 4.6, 0.3], Y);
  p.box([0, 1.2, 24], [0.05, 0.05, 0.05], Y);
  p.cyl([0, H - 6, 22], 0.04, 12, 0x333333, 'y', 4);
  p.box([0, 0.5, 0], [3.4, 1, 3.4], 0x9c9a94);
  return { geometry: p.build(), colliders: [{ center: [0, H / 2, 0], size: [2.2, H, 2.2] }, { center: [0, 0.5, 0], size: [3.4, 1, 3.4] }], surface: 'metal' };
}

function pipes(): PropModel {
  const p = new PropParts();
  const r = 0.4;
  const rows = [[-1.2, -0.4, 0.4, 1.2], [-0.8, 0, 0.8], [-0.4, 0.4]];
  rows.forEach((row, i) => {
    for (const x of row) p.cyl([x, r + i * r * 1.7, 0], r, 6, i % 2 ? 0x7f8790 : 0x6c747c, 'z', 8);
  });
  for (const z of [-2.2, 2.2]) p.box([0, 0.08, z], [3.0, 0.16, 0.2], WOOD);
  return { geometry: p.build(), colliders: [{ center: [0, 0.75, 0], size: [3.2, 1.5, 6] }], surface: 'metal' };
}

function dirtMound(): PropModel {
  const p = new PropParts();
  const g = new THREE.ConeGeometry(2.4, 1.3, 6).translate(0, 0.65, 0);
  p.add(g, 0x9b7653);
  p.add(new THREE.ConeGeometry(1.4, 1.1, 5).translate(1.2, 0.55, 0.8), 0x8a6848);
  return { geometry: p.build(), colliders: [{ center: [0.2, 0.55, 0.2], size: [3.2, 1.1, 3.2] }], surface: 'dirt' };
}

function fountain(): PropModel {
  const p = new PropParts();
  const R = 5;
  const sides = 8;
  const colliders: PropModel['colliders'][number][] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const x = Math.sin(a) * R * Math.cos(Math.PI / sides);
    const z = Math.cos(a) * R * Math.cos(Math.PI / sides);
    const len = 2 * R * Math.sin(Math.PI / sides) + 0.1;
    p.box([x, 0.4, z], [len, 0.8, 0.5], 0xd7cdb6, [0, a, 0]);
    colliders.push({ center: [x, 0.4, z], size: [len, 0.8, 0.5], yaw: a });
  }
  p.add(new THREE.CylinderGeometry(R - 0.3, R - 0.3, 0.1, sides).rotateY(Math.PI / sides).translate(0, 0.5, 0), 0x5fa8d3);
  p.cyl([0, 1.2, 0], 0.55, 2.4, 0xd7cdb6, 'y', 8);
  p.cyl([0, 2.45, 0], 1.4, 0.25, 0xd7cdb6, 'y', 8);
  p.cyl([0, 2.9, 0], 0.25, 0.8, 0xd7cdb6, 'y', 6);
  colliders.push({ center: [0, 1.3, 0], size: [1.2, 2.6, 1.2] });
  return { geometry: p.build(), colliders, surface: 'concrete' };
}

function statue(): PropModel {
  const p = new PropParts();
  p.box([0, 0.8, 0], [2.6, 1.6, 2.6], 0xcfc6b0);
  p.box([0, 1.7, 0], [2.0, 0.2, 2.0], 0xbdb39b);
  const bronze = 0x5d7b6a;
  p.box([0, 2.6, 0], [0.7, 1.4, 0.45], bronze);
  p.box([0, 3.5, 0], [0.35, 0.4, 0.35], bronze);
  p.box([0.45, 3.1, 0], [0.2, 1.0, 0.2], bronze, [0, 0, -0.6]);
  p.box([-0.4, 2.7, 0], [0.2, 0.9, 0.2], bronze);
  return { geometry: p.build(), colliders: [{ center: [0, 0.9, 0], size: [2.6, 1.8, 2.6] }, { center: [0, 2.7, 0], size: [0.9, 1.8, 0.6] }], surface: 'concrete' };
}

function fuelIsland(): PropModel {
  const p = new PropParts();
  p.box([0, 0.15, 0], [1.6, 0.3, 7], CONCRETE);
  for (const z of [-2.2, 0, 2.2]) {
    p.box([0, 1.0, z], [0.7, 1.4, 0.9], 0xe5483b);
    p.box([0, 1.4, z], [0.72, 0.3, 0.6], 0xf1e3c8);
  }
  for (const x of [-3.2, 3.2]) for (const z of [-3.6, 3.6]) p.cyl([x, 2.4, z], 0.16, 4.8, 0xd9d9d9, 'y', 6);
  p.box([0, 4.95, 0], [8, 0.35, 9], 0xf1f1f1);
  p.box([0, 4.75, 0], [8.05, 0.12, 9.05], 0xe5483b);
  const colliders = [
    { center: [0, 0.75, 0] as const, size: [1.0, 1.5, 6.8] as const },
    { center: [0, 4.95, 0] as const, size: [8, 0.35, 9] as const },
  ];
  const posts = [-3.2, 3.2].flatMap((x) => [-3.6, 3.6].map((z) => ({ center: [x, 2.4, z] as const, size: [0.32, 4.8, 0.32] as const })));
  return { geometry: p.build(), colliders: [...colliders, ...posts], surface: 'metal' };
}

function lowWall(): PropModel {
  const p = new PropParts();
  p.box([0, 0.55, 0], [0.3, 1.1, 4], CONCRETE);
  p.box([0, 1.12, 0], [0.38, 0.06, 4.04], 0xa09c93);
  return { geometry: p.build(), colliders: [{ center: [0, 0.55, 0], size: [0.3, 1.1, 4] }], surface: 'concrete' };
}

function fence(): PropModel {
  const p = new PropParts();
  for (const z of [-2, 0, 2]) p.cyl([0, 1.1, z], 0.05, 2.2, 0x7d858d, 'y', 5);
  p.box([0, 2.15, 0], [0.05, 0.05, 4], 0x7d858d);
  p.box([0, 1.1, 0], [0.03, 2.0, 4], 0xa7aeb5);
  return { geometry: p.build(), colliders: [{ center: [0, 1.1, 0], size: [0.12, 2.2, 4] }], surface: 'metal', noCover: true };
}

function rails(): PropModel {
  const p = new PropParts();
  for (let z = -4.5; z <= 4.5; z += 1) p.box([0, 0.06, z], [2.4, 0.12, 0.25], 0x5b4a3a);
  for (const x of [-0.72, 0.72]) p.box([x, 0.17, 0], [0.08, 0.12, 10], 0x8d9399);
  return { geometry: p.build(), colliders: [], surface: 'metal', castShadow: false };
}

/** Props built once and shared by every placement. */
export function buildPropModel(type: Exclude<PropType, 'footbridge'>): PropModel {
  switch (type) {
    case 'car':
      return car(WHITE, false);
    case 'burnedCar':
      return car(0x3a332e, true);
    case 'bus':
      return bus();
    case 'barrier':
      return barrier();
    case 'sandbags':
      return sandbags();
    case 'crate':
      return crate();
    case 'dumpster':
      return dumpster();
    case 'container':
      return container();
    case 'rubble':
      return rubble();
    case 'busStop':
      return busStop();
    case 'streetLight':
      return streetLight();
    case 'tree':
      return tree();
    case 'planter':
      return planter();
    case 'scaffolding':
      return scaffolding();
    case 'trainCar':
      return trainCar();
    case 'crane':
      return crane();
    case 'pipes':
      return pipes();
    case 'dirtMound':
      return dirtMound();
    case 'fountain':
      return fountain();
    case 'statue':
      return statue();
    case 'fuelIsland':
      return fuelIsland();
    case 'lowWall':
      return lowWall();
    case 'fence':
      return fence();
    case 'rails':
      return rails();
  }
}

/** Default tints for props that take a color. */
export const PROP_TINTS = {
  car: [PALETTE.blueTeam, PALETTE.redTeam, PALETTE.mustard, PALETTE.teal, PALETTE.cream, PALETTE.coral, 0x6b7f8f],
  container: [PALETTE.terracotta, PALETTE.teal, PALETTE.mustard, 0x3f6fb0, 0x6f8f4f],
  bus: [PALETTE.mustard, PALETTE.teal],
  trainCar: [RUST, 0x3f6fb0, 0x5f6b4f],
} as const;
