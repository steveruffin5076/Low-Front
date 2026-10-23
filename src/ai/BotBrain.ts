import * as THREE from 'three';
import { BOTS } from '../data/bots';
import type { FlagId, TeamId } from '../data/map/types';
import type { WeaponSlot } from '../data/weapons';

const T = BOTS.thresholds;
const O = BOTS.objective;

export type BotState = 'objective' | 'hold' | 'combat' | 'reload' | 'retreat' | 'search';
export type Pace = 'sprint' | 'run' | 'walk';

/** A flag as one bot sees it. */
export interface FlagView {
  id: FlagId;
  position: THREE.Vector3;
  owner: TeamId | null;
  /** −1 Red … +1 Blue. */
  control: number;
  /** The enemy is taking it (control moving away from us while they are inside). */
  enemyCapturing: boolean;
}

/** Everything the brain looks at in one decision. */
export interface BotSenses {
  time: number;
  team: TeamId;
  position: THREE.Vector3;
  hp: number;
  /** Rounds in the magazine as a fraction of a full one. */
  magFraction: number;
  /** The active weapon and whether the primary has no rounds at all. */
  activeSlot: WeaponSlot;
  primaryEmpty: boolean;
  reloading: boolean;
  flags: readonly FlagView[];
  /** Teammates already heading to each flag (this bot excluded). */
  teammatesGoing: Partial<Record<FlagId, number>>;
  /** The nearest enemy in sight, or null. */
  enemy: { id: string; position: THREE.Vector3; distance: number } | null;
  /** The most recent enemy position seen or heard, with its age in seconds. */
  lastKnown: { position: THREE.Vector3; age: number } | null;
  /** The bot made no progress for the stuck time. */
  stuck: boolean;
}

/** World questions the brain may ask (faked in tests). */
export interface BotQueries {
  /** Cover within `radius` of `from`, preferring cover that faces `threat` (null: any). */
  cover(from: THREE.Vector3, radius: number, threat: THREE.Vector3 | null): { pos: THREE.Vector3; high: boolean } | null;
  /** A cover point (or spot) inside a flag zone, picked at random. */
  zoneSpot(flag: FlagId): THREE.Vector3;
}

/** What the bot should do until the next decision. */
export interface BotOrders {
  state: BotState;
  objective: FlagId | null;
  /** Where to go (the body follows a path there), or null to stay. */
  moveTo: THREE.Vector3 | null;
  pace: Pace;
  crouch: boolean;
  /** Sideways step while fighting without cover: −1 left, 0, 1 right. */
  strafe: number;
  lookAt: THREE.Vector3 | null;
  /** Enemy to shoot at. */
  fireAt: string | null;
  reload: boolean;
  switchTo: WeaponSlot | null;
}

/**
 * The bot's decisions (plan section 12): choose an objective, move, capture or defend, fight,
 * reload, retreat and search, plus recovery when stuck. Pure logic: it reads `BotSenses`,
 * asks `BotQueries`, and writes `BotOrders` for the body to carry out.
 */
export class BotBrain {
  readonly orders: BotOrders = {
    state: 'objective',
    objective: null,
    moveTo: null,
    pace: 'sprint',
    crouch: false,
    strafe: 0,
    lookAt: null,
    fireAt: null,
    reload: false,
    switchTo: null,
  };
  private searchUntil = -Infinity;
  private holdSpot: THREE.Vector3 | null = null;
  private holdUntil = 0;
  private strafeUntil = 0;
  private strafeDir = 1;
  private stuckCount = 0;
  private avoid: FlagId | null = null;
  private coverSpot: THREE.Vector3 | null = null;

  constructor(private readonly rand: () => number = Math.random) {}

  /** Back to a fresh start (after respawn). */
  reset(): void {
    this.orders.state = 'objective';
    this.orders.objective = null;
    this.searchUntil = -Infinity;
    this.holdSpot = null;
    this.coverSpot = null;
    this.stuckCount = 0;
    this.avoid = null;
  }

  decide(s: BotSenses, q: BotQueries): BotOrders {
    const o = this.orders;
    o.reload = false;
    o.switchTo = null;
    o.fireAt = null;
    o.crouch = false;
    o.strafe = 0;
    if (s.stuck) this.onStuck();
    else this.stuckCount = 0;

    if (s.enemy) {
      this.searchUntil = s.time + T.searchTime;
      if (s.hp < T.retreatHp) return this.retreat(s, q);
      return this.combat(s, q);
    }
    this.coverSpot = null;
    if (!s.reloading && s.magFraction < T.reloadFraction) return this.reload(s, q);
    if (s.lastKnown && s.time < this.searchUntil && s.lastKnown.age < T.searchTime) return this.search(s);
    return this.objective(s, q);
  }

  // --- States ---

  private combat(s: BotSenses, q: BotQueries): BotOrders {
    const o = this.orders;
    const e = s.enemy!;
    o.state = 'combat';
    o.lookAt = e.position;
    o.fireAt = e.id;
    o.pace = 'walk';
    if (s.activeSlot === 'primary' && s.primaryEmpty && e.distance < T.pistolRange) o.switchTo = 'secondary';
    else if (s.activeSlot === 'secondary' && !s.primaryEmpty && e.distance >= T.pistolRange) o.switchTo = 'primary';
    // Into cover close by, then fight from it; otherwise strafe in the open.
    if (!this.coverSpot) this.coverSpot = q.cover(s.position, T.coverRange, e.position)?.pos ?? null;
    if (this.coverSpot && this.coverSpot.distanceTo(s.position) > 1) {
      o.moveTo = this.coverSpot;
      return o;
    }
    o.moveTo = null;
    if (this.coverSpot) {
      o.crouch = true;
    } else {
      if (s.time >= this.strafeUntil) {
        this.strafeUntil = s.time + 0.8 + this.rand() * 1.2;
        this.strafeDir = this.rand() < 0.5 ? -1 : 1;
      }
      o.strafe = this.strafeDir;
    }
    return o;
  }


  private retreat(s: BotSenses, q: BotQueries): BotOrders {
    const o = this.orders;
    const e = s.enemy!;
    o.state = 'retreat';
    o.lookAt = e.position;
    o.pace = 'run';
    // Cover away from the enemy: farther from them than we are now.
    const away = q.cover(s.position, T.coverRange * 2, e.position);
    const safe = away && away.pos.distanceTo(e.position) > s.position.distanceTo(e.position) - 1 ? away.pos : null;
    o.moveTo = safe;
    o.crouch = safe !== null && safe.distanceTo(s.position) < 1;
    // Still shoots back when it has nowhere to go.
    if (!safe) o.fireAt = e.id;
    return o;
  }

  private reload(s: BotSenses, q: BotQueries): BotOrders {
    const o = this.orders;
    o.state = 'reload';
    o.reload = true;
    o.pace = 'walk';
    const c = q.cover(s.position, T.coverRange, s.lastKnown?.position ?? null);
    o.moveTo = c && c.pos.distanceTo(s.position) > 1 ? c.pos : null;
    o.crouch = o.moveTo === null;
    return o;
  }

  private search(s: BotSenses): BotOrders {
    const o = this.orders;
    o.state = 'search';
    o.moveTo = s.lastKnown!.position;
    o.lookAt = s.lastKnown!.position;
    o.pace = 'walk';
    if (s.position.distanceTo(s.lastKnown!.position) < 2) this.searchUntil = s.time;
    return o;
  }

  private objective(s: BotSenses, q: BotQueries): BotOrders {
    const o = this.orders;
    o.lookAt = null;
    const target = this.chooseObjective(s);
    if (target !== o.objective) {
      o.objective = target;
      this.holdSpot = null;
    }
    const flag = s.flags.find((f) => f.id === target);
    if (!flag) {
      o.state = 'objective';
      o.moveTo = null;
      return o;
    }
    const inZone = flag.position.distanceTo(s.position) < 10;
    const ours = flag.owner === s.team && flag.control * (s.team === 'blue' ? 1 : -1) >= 1;
    if (inZone) {
      // Capture or defend: stay in the zone, moving between spots from time to time.
      o.state = 'hold';
      this.avoid = null;
      if (!this.holdSpot || s.time >= this.holdUntil) {
        this.holdSpot = q.zoneSpot(flag.id);
        const h = T.holdShuffle;
        this.holdUntil = s.time + h.min + (h.max - h.min) * this.rand();
      }
      o.moveTo = this.holdSpot;
      o.pace = 'walk';
      o.crouch = ours && this.holdSpot.distanceTo(s.position) < 1;
      return o;
    }
    o.state = 'objective';
    o.moveTo = flag.position;
    const near = flag.position.distanceTo(s.position) < T.walkNear;
    o.pace = near || s.lastKnown ? 'run' : 'sprint';
    return o;
  }

  /** Scores every flag (plan section 12) and keeps the current one unless another is clearly better. */
  chooseObjective(s: BotSenses): FlagId | null {
    const enemy: TeamId = s.team === 'blue' ? 'red' : 'blue';
    let best: FlagId | null = null;
    let bestScore = -Infinity;
    for (const f of s.flags) {
      if (f.id === this.avoid) continue;
      let score = 0;
      if (f.owner !== s.team) score += O.notOwned;
      if (f.owner === enemy) score += O.enemyOwned;
      if (f.owner === s.team && f.enemyCapturing) score += O.underAttack;
      score += O.distance * f.position.distanceTo(s.position);
      score += O.crowd * (s.teammatesGoing[f.id] ?? 0);
      score += O.noise * this.rand();
      if (f.id === this.orders.objective) score += O.stickiness;
      if (score > bestScore) {
        bestScore = score;
        best = f.id;
      }
    }
    return best;
  }

  private onStuck(): void {
    this.stuckCount++;
    this.holdSpot = null;
    this.coverSpot = null;
    // A second stuck in a row: give up this objective for another.
    if (this.stuckCount >= 2) {
      this.avoid = this.orders.objective;
      this.orders.objective = null;
      this.stuckCount = 0;
    }
  }
}
