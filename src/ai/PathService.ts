import type * as THREE from 'three';
import { BOTS } from '../data/bots';
import type { NavGrid } from '../world/NavGrid';
import { smoothPath } from '../world/NavPaths';

/** A queued path search. Set `cancelled` to drop it (e.g. the bot changed its mind). */
export interface PathRequest {
  from: THREE.Vector3;
  to: THREE.Vector3;
  done: (points: THREE.Vector3[] | null) => void;
  cancelled: boolean;
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

  request(from: THREE.Vector3, to: THREE.Vector3, done: PathRequest['done']): PathRequest {
    const r: PathRequest = { from: from.clone(), to: to.clone(), done, cancelled: false };
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
      const path = this.nav.findPath(r.from, r.to);
      r.done(path && path.length ? smoothPath(this.nav, path) : null);
    }
  }
}
