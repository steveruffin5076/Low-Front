import * as THREE from 'three';
import { PLANS } from '../data/map/plans';
import type { MapData } from '../data/map/types';
import { BuildingBuilder } from './BuildingBuilder';
import { buildSolid } from './FacadeBuilder';
import type { NavLink } from './LocalFrame';
import { buildProps, propVolumes } from './PropBuilder';
import { StaticSink } from './StaticSink';
import { buildStreets } from './StreetBuilder';
import { buildFootbridge } from './structures';
import { volume, type Volume } from './Volume';
import { MAP } from '../data/map/config';

export interface BuiltMap {
  data: MapData;
  /** Static geometry (one mesh per chunk) and instanced props. Shared: clone it, never dispose it. */
  group: THREE.Group;
  volumes: Volume[];
  links: NavLink[];
  stats: { staticTriangles: number; volumes: number; buildMs: number };
}

/** Builds the map's meshes, collision volumes and nav links from the map data. */
export function buildMap(data: MapData): BuiltMap {
  const t0 = performance.now();
  const sink = new StaticSink();
  const volumes: Volume[] = buildStreets(data, sink);
  const links: NavLink[] = [];

  data.solids.forEach((b, i) => volumes.push(buildSolid(b, sink, i)));
  data.boundary.solids.forEach((b, i) => volumes.push(buildSolid(b, sink, i + 1)));

  for (const e of data.enterables) {
    const frame = new BuildingBuilder(PLANS[e.plan], sink, e.x, e.z, e.rotY, e.color).build();
    volumes.push(...frame.volumes);
    links.push(...frame.links);
  }
  for (const prop of [...data.props, ...data.boundary.props]) {
    if (prop.type === 'footbridge') {
      const f = buildFootbridge(prop, sink);
      volumes.push(...f.volumes);
      links.push(...f.links);
    } else {
      volumes.push(...propVolumes(prop));
    }
  }

  // Invisible walls at the hard limit (plan section 10.1).
  const L = MAP.hardLimit;
  const wallH = 40;
  for (const [x, z, w, d] of [
    [0, -L - 1, 2 * L + 4, 2],
    [0, L + 1, 2 * L + 4, 2],
    [-L - 1, 0, 2, 2 * L + 4],
    [L + 1, 0, 2, 2 * L + 4],
  ] as const) {
    const v = volume([x, wallH / 2, z], [w, wallH, d], 'solid', 'concrete');
    v.noCover = true;
    v.invisible = true;
    volumes.push(v);
  }

  const staticTriangles = sink.triangles;
  const group = new THREE.Group();
  group.name = 'map';
  group.add(sink.build('map-static'), buildProps([...data.props, ...data.boundary.props]));
  return { data, group, volumes, links, stats: { staticTriangles, volumes: volumes.length, buildMs: performance.now() - t0 } };
}

let cached: BuiltMap | null = null;

/** The map is built once per session and shared (menu fly-over and match). */
export function getBuiltMap(data: MapData): BuiltMap {
  if (!cached || cached.data !== data) cached = buildMap(data);
  return cached;
}
