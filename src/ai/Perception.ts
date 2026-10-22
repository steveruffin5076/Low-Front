import * as THREE from 'three';
import { BOTS } from '../data/bots';
import type { TeamId } from '../data/map/types';

const P = BOTS.perception;
/** A target counts as visible this long after the last successful sight check. */
const VISIBLE_HOLD = 0.35;
const COS_HALF_FOV = Math.cos(THREE.MathUtils.degToRad(P.fov / 2));

/** Someone who can be seen: feet position and the point a sight line aims at. */
export interface SightTarget {
  readonly id: string;
  readonly team: TeamId;
  readonly alive: boolean;
  readonly position: THREE.Vector3;
  /** Chest height point used for line of sight. */
  readonly chest: THREE.Vector3;
}

/** What a bot knows about one enemy. */
export interface KnownEnemy {
  id: string;
  /** Last seen or heard feet position. */
  position: THREE.Vector3;
  /** Time of the last successful sight check, or −∞ if only heard. */
  lastSeen: number;
  /** Start of the current unbroken sighting (for reaction time). */
  seenSince: number;
  lastHeard: number;
}

/** One bot's memory of enemies: what it sees now and where it last saw or heard them. */
export class BotMemory {
  readonly known = new Map<string, KnownEnemy>();

  constructor(readonly team: TeamId) {}

  isVisible(e: KnownEnemy, time: number): boolean {
    return time - e.lastSeen <= VISIBLE_HOLD;
  }

  saw(t: SightTarget, time: number): void {
    let e = this.known.get(t.id);
    if (!e) {
      e = { id: t.id, position: t.position.clone(), lastSeen: -Infinity, seenSince: time, lastHeard: -Infinity };
      this.known.set(t.id, e);
    }
    if (!this.isVisible(e, time)) e.seenSince = time;
    e.lastSeen = time;
    e.position.copy(t.position);
  }

  heard(id: string, at: THREE.Vector3, time: number): void {
    let e = this.known.get(id);
    if (!e) {
      e = { id, position: at.clone(), lastSeen: -Infinity, seenSince: Infinity, lastHeard: time };
      this.known.set(id, e);
      return;
    }
    e.lastHeard = time;
    // A shot from someone in sight changes nothing; otherwise it updates where they are.
    if (!this.isVisible(e, time)) e.position.copy(at);
  }

  /** Drops enemies not seen or heard for a while, and dead ones. */
  forget(time: number, alive: (id: string) => boolean): void {
    for (const [id, e] of this.known) {
      if (!alive(id) || time - Math.max(e.lastSeen, e.lastHeard) > P.memory) this.known.delete(id);
    }
  }

  /** The visible enemy nearest to `from`, or null. */
  nearestVisible(from: THREE.Vector3, time: number): KnownEnemy | null {
    let best: KnownEnemy | null = null;
    let bestD = Infinity;
    for (const e of this.known.values()) {
      if (!this.isVisible(e, time)) continue;
      const d = e.position.distanceToSquared(from);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  /** The most recently seen or heard enemy (for searching), or null. */
  latest(): KnownEnemy | null {
    let best: KnownEnemy | null = null;
    let bestT = -Infinity;
    for (const e of this.known.values()) {
      const t = Math.max(e.lastSeen, e.lastHeard);
      if (t > bestT) {
        bestT = t;
        best = e;
      }
    }
    return best;
  }
}

/** A bot as an observer. */
export interface Observer {
  readonly id: string;
  readonly team: TeamId;
  readonly alive: boolean;
  readonly eye: THREE.Vector3;
  /** View direction yaw (forward is −Z turned by yaw). */
  readonly yaw: number;
  readonly memory: BotMemory;
}

/**
 * Bot sight and hearing (plan section 12): 110° field of view, 90 m range, line of sight
 * against the world. Sight checks share a raycast budget per frame and continue round-robin
 * where the last frame stopped. Gunshots within 60 m tell enemies where the shooter is.
 */
export class Perception {
  /** Raycasts used in the last update (for tests and the debug view). */
  raycasts = 0;
  private cursor = 0;
  private readonly to = new THREE.Vector3();

  constructor(
    /** True when nothing blocks the line from `from` to `to`. */
    private readonly lineOfSight: (from: THREE.Vector3, to: THREE.Vector3) => boolean,
    private readonly budget: number = P.raycastBudget,
  ) {}

  /** Cheap checks before a raycast: alive, enemy, in range, inside the field of view. */
  canPossiblySee(o: Observer, t: SightTarget): boolean {
    if (!t.alive || t.team === o.team) return false;
    this.to.subVectors(t.chest, o.eye);
    const d = this.to.length();
    if (d > P.sightRange || d < 1e-3) return d < 1e-3;
    const fx = -Math.sin(o.yaw);
    const fz = -Math.cos(o.yaw);
    const flat = Math.hypot(this.to.x, this.to.z);
    if (flat < 1e-3) return true;
    return (this.to.x * fx + this.to.z * fz) / flat >= COS_HALF_FOV;
  }

  update(time: number, observers: readonly Observer[], targets: readonly SightTarget[]): void {
    this.raycasts = 0;
    const n = observers.length;
    if (n === 0) return;
    // Visit observers from the cursor; each gets its full list of candidates checked.
    for (let visited = 0; visited < n && this.raycasts < this.budget; visited++) {
      const o = observers[this.cursor % n];
      this.cursor = (this.cursor + 1) % n;
      if (!o.alive) continue;
      for (const t of targets) {
        if (!this.canPossiblySee(o, t)) continue;
        this.raycasts++;
        if (this.lineOfSight(o.eye, t.chest)) o.memory.saw(t, time);
      }
      o.memory.forget(time, (id) => targets.some((t) => t.id === id && t.alive));
    }
  }

  /** A gunshot: enemies of the shooter within hearing range learn where it came from. */
  gunshot(time: number, shooter: { id: string; team: TeamId; position: THREE.Vector3 }, listeners: readonly Observer[]): void {
    for (const l of listeners) {
      if (!l.alive || l.team === shooter.team) continue;
      if (l.eye.distanceTo(shooter.position) <= P.hearingRange) l.memory.heard(shooter.id, shooter.position, time);
    }
  }
}
