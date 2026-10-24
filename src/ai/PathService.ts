import type * as THREE from 'three';
import { BOTS } from '../data/bots';
import type { NavGrid } from '../world/NavGrid';
import { clearLine, smoothPath } from '../world/NavPaths';

/** A queued path search. Set `cancelled` to drop it (e.g. the bot changed its mind). */
export interface PathRequest {
  from: THREE.Vector3;
  to: THREE.Vector3;
  done: (points: THREE.Vector3[] | null) => void;
  cancelled: boolean;
  /** Cell centers instead of a smoothed path (keeps away from corners after getting stuck). */
  raw: boolean;
}

/**
 * Path searches for the bots (plan section 12, performance): requests wait in a queue and a few
 * A* searches run per frame, so many bots changing objective at once cost no frame spikes.
 * Results are smoothed paths in world points.
 */
export class PathService {
  private readonly queue: PathRequest[] = [];
  /** Searches run so far (for tests and the debug overlay). */
  searches = 0;

  constructor(
    readonly nav: NavGrid,
    private readonly perFrame: number = BOTS.pathsPerFrame,
  ) {}

  get pending(): number {
    return this.queue.length;
  }

  /** A straight walkable line on one floor: no search needed. Returns the two points, or null. */
  direct(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] | null {
    const a = this.nav.nearestWalkable(from, 1);
    const b = this.nav.nearestWalkable(to, 1);
    if (a === null || b === null || !clearLine(this.nav, a, b)) return null;
    // A spot off the walkable floor (on a car, a crate) becomes its cell on the floor.
    const end = this.nav.position(b);
    return [from.clone(), Math.abs(end.y - to.y) > 0.5 ? end : to.clone()];
  }

  request(from: THREE.Vector3, to: THREE.Vector3, done: PathRequest['done'], raw = false): PathRequest {
    const r: PathRequest = { from: from.clone(), to: to.clone(), done, cancelled: false, raw };
    this.queue.push(r);
    return r;
  }

  /** Runs up to `perFrame` searches. */
  update(): void {
    let budget = this.perFrame;
    while (budget > 0 && this.queue.length) {
      const r = this.queue.shift()!;
      if (r.cancelled) continue;
      budget--;
      this.searches++;
      const path = this.nav.findPath(r.from, r.to, undefined, BOTS.pathWeight, BOTS.pathMaxExpand);
      r.done(path && path.length ? (r.raw ? this.nav.pathPoints(path) : smoothPath(this.nav, path)) : null);
    }
  }
}
