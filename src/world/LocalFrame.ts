import * as THREE from 'three';
import type { Surface } from '../physics/collision';
import type { StaticSink } from './StaticSink';
import { transformVolume, volume, type Volume, type VolumeKind } from './Volume';

export interface NavLink {
  /** Bottom and top of a stair flight pair (or ramp), and points along the way. */
  a: THREE.Vector3;
  b: THREE.Vector3;
  via: THREE.Vector3[];
}

export interface BoxOpts {
  kind?: VolumeKind | null;
  surface?: Surface;
  yaw?: number;
  tilt?: number;
  noCover?: boolean;
}

/**
 * Draws boxes and emits volumes in a local frame (yaw around the origin, then an offset),
 * so buildings and prop layouts can be authored in their own coordinates.
 */
export class LocalFrame {
  readonly volumes: Volume[] = [];
  readonly links: NavLink[] = [];
  private readonly offset: THREE.Vector3;

  constructor(
    private readonly sink: StaticSink,
    private readonly yaw: number,
    x: number,
    z: number,
    y = 0,
  ) {
    this.offset = new THREE.Vector3(x, y, z);
  }

  /** Local point → world. */
  point(x: number, y: number, z: number): THREE.Vector3 {
    const c = Math.cos(this.yaw);
    const s = Math.sin(this.yaw);
    return new THREE.Vector3(x * c + z * s + this.offset.x, y + this.offset.y, -x * s + z * c + this.offset.z);
  }

  /** Box drawn with `color`; with `kind` set it also blocks as a volume. `color` < 0 skips drawing. */
  box(center: readonly [number, number, number], size: readonly [number, number, number], color: number, o: BoxOpts = {}): void {
    const yaw = o.yaw ?? 0;
    const tilt = o.tilt ?? 0;
    const w = this.point(center[0], center[1], center[2]);
    if (color >= 0) this.sink.box([w.x, w.y, w.z], size, color, this.yaw + yaw, tilt);
    if (o.kind) {
      const v = transformVolume(volume(center, size, o.kind, o.surface ?? 'concrete', yaw, tilt), this.yaw, this.offset);
      if (o.noCover) v.noCover = true;
      this.volumes.push(v);
    }
  }

  /** Box from min/max corners (axis-aligned in the local frame). */
  boxFromTo(min: readonly [number, number, number], max: readonly [number, number, number], color: number, o: BoxOpts = {}): void {
    this.box(
      [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
      [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
      color,
      o,
    );
  }

  link(a: THREE.Vector3, b: THREE.Vector3, via: THREE.Vector3[]): void {
    this.links.push({ a, b, via });
  }
}
