import type * as THREE from 'three';

/** A playable place: the test range or the city map. */
export interface World {
  readonly scene: THREE.Scene;
  /** Where the player starts (feet) and which way they face. */
  readonly spawn: { position: THREE.Vector3; yaw: number };
  /** Half size of the playable square; leaving it starts the out-of-bounds countdown. Null: no limit. */
  readonly limit: number | null;
  /** Keeps the sun's shadow camera around the player. */
  follow(pos: THREE.Vector3): void;
  update(dt: number, camera: THREE.Camera): void;
  /** Fixed step for things in the world that have physics (soldiers' hitboxes). */
  fixedUpdate?(dt: number): void;
  /** F4: show or hide the navigation and cover debug view, if the world has one. */
  toggleNavDebug?(): void;
  dispose(): void;
}
