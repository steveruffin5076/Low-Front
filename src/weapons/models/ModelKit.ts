import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AttachmentName, NodeName, WeaponLod, WeaponModel } from './WeaponModel';

/**
 * Helpers for building low-poly models from code.
 * All helpers take positions in model space and return a transformed geometry.
 */
export type V3 = readonly [number, number, number];
export type V2 = readonly [number, number];

export interface Xform {
  pos?: V3;
  /** Euler XYZ rotation in radians, applied before `pos`. */
  rot?: V3;
}

function applyXform(geo: THREE.BufferGeometry, x: Xform = {}): THREE.BufferGeometry {
  if (x.rot) geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...x.rot)));
  if (x.pos) geo.translate(...x.pos);
  return geo;
}

/** Box of `size` [x, y, z] centered on `pos`. */
export function box(size: V3, x?: Xform): THREE.BufferGeometry {
  return applyXform(new THREE.BoxGeometry(...size), x);
}

/** Box given by its min and max corners. */
export function boxFromTo(min: V3, max: V3): THREE.BufferGeometry {
  const size: V3 = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const center: V3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  return box(size, { pos: center });
}

export interface CylOptions extends Xform {
  segments?: number;
  /** Radius at the +axis end. Defaults to `radius`. */
  radiusEnd?: number;
  axis?: 'x' | 'y' | 'z';
}

/** Cylinder along an axis (default Z, the barrel axis), centered on `pos`. */
export function cyl(radius: number, length: number, opts: CylOptions = {}): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(opts.radiusEnd ?? radius, radius, length, opts.segments ?? 8);
  const axis = opts.axis ?? 'z';
  if (axis === 'z') geo.rotateX(Math.PI / 2);
  if (axis === 'x') geo.rotateZ(-Math.PI / 2);
  return applyXform(geo, opts);
}

/** Cylinder along Z between two Z values. */
export function cylZ(radius: number, zFrom: number, zTo: number, y: number, x = 0, segments = 8): THREE.BufferGeometry {
  return cyl(radius, Math.abs(zTo - zFrom), { pos: [x, y, (zFrom + zTo) / 2], segments });
}

function shapeOf(points: readonly V2[]): THREE.Shape {
  return new THREE.Shape(points.map(([a, b]) => new THREE.Vector2(a, b)));
}

/**
 * Side-profile extrusion. `points` are (z, y) pairs seen from the right side;
 * the shape is extruded along X by `thickness`, centered on x = `centerX`.
 */
export function profile(points: readonly V2[], thickness: number, centerX = 0, holes: readonly V2[][] = []): THREE.BufferGeometry {
  const shape = shapeOf(points);
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([a, b]) => new THREE.Vector2(a, b))));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 1 });
  geo.translate(0, 0, -thickness / 2);
  // Shape X becomes model Z; the extrusion axis becomes model X.
  geo.rotateY(-Math.PI / 2);
  geo.translate(centerX, 0, 0);
  return geo;
}

/** Cross-section extrusion. `points` are (x, y) pairs seen from the muzzle; extruded along Z from `zFrom` to `zTo`. */
export function section(points: readonly V2[], zFrom: number, zTo: number): THREE.BufferGeometry {
  const length = Math.abs(zTo - zFrom);
  const geo = new THREE.ExtrudeGeometry(shapeOf(points), { depth: length, bevelEnabled: false, curveSegments: 1 });
  geo.translate(0, 0, Math.min(zFrom, zTo));
  return geo;
}

/** Points along a circular arc in the (z, y) plane. Angle 0 points along +Z, angles grow toward −Y. */
export function arc(center: V2, radius: number, fromAngle: number, toAngle: number, segments: number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = fromAngle + ((toAngle - fromAngle) * i) / segments;
    out.push([center[0] + Math.cos(a) * radius, center[1] - Math.sin(a) * radius]);
  }
  return out;
}

type GeoBuckets = Map<THREE.Material, THREE.BufferGeometry[]>;

/** A moving part. Geometry is given in model space and stored relative to the pivot. */
export class PartNode {
  readonly object = new THREE.Group();

  constructor(
    name: string,
    readonly pivot: V3,
    private readonly buckets: GeoBuckets,
  ) {
    this.object.name = name;
    this.object.position.set(...pivot);
  }

  add(mat: THREE.Material, ...geos: THREE.BufferGeometry[]): this {
    for (const g of geos) {
      g.translate(-this.pivot[0], -this.pivot[1], -this.pivot[2]);
      pushGeo(this.buckets, mat, g);
    }
    return this;
  }
}

/**
 * Collects parts and merges static geometry by material to keep draw calls low.
 * Moving parts (`node`) are merged separately so they can move on their own.
 */
export class Assembly {
  private readonly root = new THREE.Group();
  private readonly staticParts: GeoBuckets = new Map();
  private readonly nodeParts: { node: PartNode; buckets: GeoBuckets }[] = [];
  private readonly nodes: Partial<Record<NodeName, THREE.Object3D>> = {};
  private readonly points: Partial<Record<AttachmentName, THREE.Object3D>> = {};

  constructor(name: string) {
    this.root.name = name;
  }

  add(mat: THREE.Material, ...geos: THREE.BufferGeometry[]): this {
    for (const g of geos) pushGeo(this.staticParts, mat, g);
    return this;
  }

  node(name: NodeName, pivot: V3): PartNode {
    const buckets: GeoBuckets = new Map();
    const node = new PartNode(name, pivot, buckets);
    this.nodeParts.push({ node, buckets });
    this.nodes[name] = node.object;
    this.root.add(node.object);
    return node;
  }

  point(name: AttachmentName, pos: V3): this {
    const p = new THREE.Object3D();
    p.name = name;
    p.position.set(...pos);
    this.points[name] = p;
    this.root.add(p);
    return this;
  }

  addPoints(points: Record<AttachmentName, V3>): this {
    for (const name of Object.keys(points) as AttachmentName[]) this.point(name, points[name]);
    return this;
  }

  /** Merges geometry for a model without attachment points (hands, props). */
  finishStatic(): THREE.Group {
    addMerged(this.root, this.staticParts);
    for (const { node, buckets } of this.nodeParts) addMerged(node.object, buckets);
    return this.root;
  }

  /** Merges geometry and moves everything so the `rightHandGrip` point is the origin. */
  finish(lod: WeaponLod): WeaponModel {
    addMerged(this.root, this.staticParts);
    for (const { node, buckets } of this.nodeParts) addMerged(node.object, buckets);

    const grip = this.points.rightHandGrip;
    if (!grip) throw new Error(`${this.root.name}: missing rightHandGrip point`);
    const offset = grip.position.clone().negate();
    const content = new THREE.Group();
    content.position.copy(offset);
    content.add(...this.root.children);
    this.root.add(content);
    this.root.updateMatrixWorld(true);

    for (const name of ['muzzle', 'ejectionPort', 'sightAnchor', 'rightHandGrip', 'leftHandGrip', 'magWell'] as const) {
      if (!this.points[name]) throw new Error(`${this.root.name}: missing ${name} point`);
    }
    return {
      root: this.root,
      nodes: this.nodes,
      points: this.points as Record<AttachmentName, THREE.Object3D>,
      lod,
    };
  }
}

function pushGeo(buckets: GeoBuckets, mat: THREE.Material, geo: THREE.BufferGeometry): void {
  let list = buckets.get(mat);
  if (!list) {
    list = [];
    buckets.set(mat, list);
  }
  list.push(geo);
}

function addMerged(target: THREE.Object3D, buckets: GeoBuckets): void {
  for (const [mat, geos] of buckets) {
    const prepared = geos.map((g) => {
      const flat = g.index ? g.toNonIndexed() : g;
      if (flat !== g) g.dispose();
      if (flat.hasAttribute('uv')) flat.deleteAttribute('uv');
      flat.clearGroups();
      return flat;
    });
    const merged = mergeGeometries(prepared);
    if (!merged) throw new Error('Could not merge weapon geometry');
    for (const g of prepared) g.dispose();
    merged.computeBoundingSphere();
    target.add(new THREE.Mesh(merged, mat));
  }
}

/**
 * Bakes a flat vertex color into a geometry (non-indexed, no UVs) so many parts can share
 * one material and be merged into a single mesh.
 */
export function paint(geo: THREE.BufferGeometry, color: number): THREE.BufferGeometry {
  const flat = geo.index ? geo.toNonIndexed() : geo;
  if (flat !== geo) geo.dispose();
  if (flat.hasAttribute('uv')) flat.deleteAttribute('uv');
  if (flat.hasAttribute('uv1')) flat.deleteAttribute('uv1');
  flat.clearGroups();
  const c = new THREE.Color(color);
  const n = flat.getAttribute('position').count;
  const data = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    data[i * 3] = c.r;
    data[i * 3 + 1] = c.g;
    data[i * 3 + 2] = c.b;
  }
  flat.setAttribute('color', new THREE.BufferAttribute(data, 3));
  return flat;
}

/** Merges painted geometries (see `paint`) into one. */
export function mergePainted(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(geos);
  if (!merged) throw new Error('Could not merge painted geometry');
  for (const g of geos) g.dispose();
  merged.computeBoundingSphere();
  return merged;
}

/** Number of triangles under `root`. */
export function countTriangles(root: THREE.Object3D): number {
  let tris = 0;
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const g = o.geometry as THREE.BufferGeometry;
    tris += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  });
  return tris;
}
