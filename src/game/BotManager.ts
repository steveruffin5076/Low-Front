import * as THREE from 'three';
import type { BotQueries, BotSenses, FlagView } from '../ai/BotBrain';
import { CoverIndex } from '../ai/CoverIndex';
import type { CoverPoint } from '../ai/CoverPoints';
import { PathService } from '../ai/PathService';
import { Perception, type SightTarget } from '../ai/Perception';
import type { AudioManager } from '../audio/AudioManager';
import { BOTS } from '../data/bots';
import { CONQUEST } from '../data/conquest';
import type { FlagId, MapData, TeamId } from '../data/map/types';
import { DEFAULT_LOADOUT, WEAPON_IDS, WEAPONS, type WeaponId } from '../data/weapons';
import { RESUPPLY } from '../data/resupply';
import { Bot } from '../entities/Bot';
import { COLLISION, raycastSegment } from '../physics/collision';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { NavGrid } from '../world/NavGrid';
import type { Combat } from './Combat';
import type { ConquestMatch } from './ConquestMatch';
import { ResupplySystem, resupplyKit, kitNeedsResupply, type Crate, type Resupplier } from './Resupply';
import type { SpawnChoice, SpawnSystem } from './SpawnSystem';
import { enemyOf } from './Tickets';

export interface BotManagerOptions {
  physics: PhysicsWorld;
  scene: THREE.Scene;
  combat: Combat;
  audio: AudioManager;
  nav: NavGrid;
  cover: readonly CoverPoint[];
  match: ConquestMatch;
  map: MapData;
  spawns: SpawnSystem;
  /** The player as something bots can see (null: no player). */
  player: SightTarget | null;
  /** Resupply crates at the flags. */
  crates: readonly Crate[];
  /** Bots per team (defaults from `BOTS`). */
  counts?: Record<TeamId, number>;
  rand?: () => number;
}

const PRIMARIES = WEAPON_IDS.filter((id) => WEAPONS[id].slot === 'primary');

/** A primary picked by `BOTS.primaryWeights` (`r` in 0–1). */
export function pickPrimary(r: number): WeaponId {
  const weight = (id: WeaponId): number => BOTS.primaryWeights[id] ?? 1;
  let left = r * PRIMARIES.reduce((sum, id) => sum + weight(id), 0);
  for (const id of PRIMARIES) {
    left -= weight(id);
    if (left < 0) return id;
  }
  return PRIMARIES[PRIMARIES.length - 1];
}

/**
 * Runs the bots (plan section 12): creates 15 Blue and 16 Red bots with weighted random primaries,
 * spawns and respawns them, shares perception (with its raycast budget) and the path queue,
 * staggers their 10 Hz decisions, and answers the brain's world questions.
 */
export class BotManager {
  readonly bots: Bot[] = [];
  readonly paths: PathService;
  readonly perception: Perception;
  readonly coverIndex: CoverIndex;
  /** Crate rules, shared with the player's side (ConquestSession). */
  readonly resupply: ResupplySystem;
  private readonly resuppliers: Resupplier[] = [];
  time = 0;
  private readonly byId = new Map<string, Bot>();
  private readonly targets: SightTarget[] = [];
  /** Flag positions never change; the brain only reads them. */
  private readonly flagPositions: THREE.Vector3[];
  private readonly rand: () => number;
  private readonly queries: BotQueries;
  /** The bot deciding right now (its own cover claim does not count against it). */
  private deciding: Bot | null = null;

  constructor(private readonly o: BotManagerOptions) {
    this.rand = o.rand ?? Math.random;
    this.resupply = new ResupplySystem(o.crates);
    this.flagPositions = o.match.zones.map((z) => new THREE.Vector3(z.flag.x, z.flag.y, z.flag.z));
    this.paths = new PathService(o.nav);
    this.coverIndex = new CoverIndex(o.cover);
    this.perception = new Perception((from, to) => !raycastSegment(o.physics, from, to, COLLISION.view));
    this.queries = {
      cover: (from, radius, threat) => this.cover(from, radius, threat),
      zoneSpot: (flag) => this.zoneSpot(flag),
    };
    let lastShot: { shooter: unknown; time: number } = { shooter: null, time: -1 };
    o.combat.ballistics.events.on('fired', ({ shooter, origin }) => {
      if (!shooter?.team) return;
      // A shotgun fires several pellets at once: one shot to hear.
      if (lastShot.shooter === shooter && lastShot.time === this.time) return;
      lastShot = { shooter, time: this.time };
      this.perception.gunshot(this.time, { id: shooter.id, team: shooter.team, position: origin }, this.bots);
    });
    const counts = o.counts ?? { blue: BOTS.blue, red: BOTS.red };
    let n = 0;
    for (const team of ['blue', 'red'] as const) {
      for (let i = 0; i < counts[team]; i++, n++) {
        const primary = pickPrimary(this.rand());
        const name = BOTS.names[n % BOTS.names.length];
        const bot = new Bot(`bot-${n}`, name, team, { primary, secondary: DEFAULT_LOADOUT.secondary }, this.botWorld(), new THREE.Vector3(0, -50, 0), (n % BOTS.decisionRate) / BOTS.decisionRate / BOTS.decisionRate);
        o.scene.add(bot.soldier.model.root);
        this.bots.push(bot);
        this.resuppliers.push({
          id: bot.id,
          team,
          get alive() {
            return bot.alive;
          },
          position: bot.position,
          needsResupply: () => kitNeedsResupply({ weapons: bot.weapons, health: bot.soldier.health }),
        });
        this.byId.set(bot.id, bot);
        o.match.add(bot);
        this.spawn(bot, { kind: 'hq' });
      }
    }
  }

  fixedUpdate(dt: number): void {
    this.time += dt;
    this.paths.update();
    this.targets.length = 0;
    if (this.o.player) this.targets.push(this.o.player);
    this.targets.push(...this.bots);
    this.perception.update(this.time, this.bots, this.targets);
    const going = this.teamObjectives();
    for (const bot of this.bots) {
      bot.now = this.time;
      if (!bot.alive) {
        bot.fixedUpdate(dt);
        if (bot.deadTime >= CONQUEST.respawnDelay && !this.o.match.result) this.respawn(bot);
        continue;
      }
      bot.decisionClock -= dt;
      if (bot.decisionClock <= 0) {
        bot.decisionClock += 1 / BOTS.decisionRate;
        this.deciding = bot;
        bot.brain.decide(this.senses(bot, going[bot.team]), this.queries);
        this.deciding = null;
        bot.stuck = false;
      }
      bot.fixedUpdate(dt);
    }
    for (const r of this.resupply.update(this.time, this.o.match.owners(), this.resuppliers)) {
      const bot = this.byId.get(r.id)!;
      resupplyKit({ weapons: bot.weapons, health: bot.soldier.health });
    }
  }

  update(dt: number, cameraPos: THREE.Vector3): void {
    for (const bot of this.bots) bot.update(dt, cameraPos);
  }

  /** The bot or the player with this id. */
  target(id: string): SightTarget | null {
    return id === this.o.player?.id ? this.o.player : (this.byId.get(id) ?? null);
  }

  dispose(): void {
    for (const bot of this.bots) bot.dispose();
  }

  // --- Spawning ---

  private spawn(bot: Bot, choice: SpawnChoice): void {
    const taken = this.bots.filter((b) => b !== bot && b.alive).map((b) => b.position);
    const p = this.o.spawns.point(bot.team, choice, taken, this.rand());
    bot.spawn(new THREE.Vector3(p.x, 0, p.z), p.yaw);
    this.resupply.reset(bot.id);
  }

  /** Respawn at the HQ or the owned flag nearest the bot's objective. */
  private respawn(bot: Bot): void {
    const options = this.o.spawns.options(bot.team, this.o.match.owners());
    const goal = this.o.match.zones.find((z) => z.flag.id === bot.orders.objective)?.flag;
    let choice: SpawnChoice = { kind: 'hq' };
    if (goal) {
      let best = Infinity;
      for (const c of options) {
        const at = c.kind === 'hq' ? this.hqCenter(bot.team) : this.o.match.zones.find((z) => z.flag.id === c.flag)!.flag;
        const d = Math.hypot(at.x - goal.x, at.z - goal.z);
        if (d < best) {
          best = d;
          choice = c;
        }
      }
    }
    this.spawn(bot, choice);
  }

  private hqCenter(team: TeamId): { x: number; z: number } {
    const r = this.o.map.hqs.find((h) => h.team === team)!.rect;
    return { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 };
  }

  // --- What the brain sees ---

  private botWorld() {
    return {
      physics: this.o.physics,
      combat: this.o.combat,
      paths: this.paths,
      audio: this.o.audio,
      target: (id: string) => this.target(id),
    };
  }

  private teamObjectives(): Record<TeamId, Partial<Record<FlagId, number>>> {
    const out: Record<TeamId, Partial<Record<FlagId, number>>> = { blue: {}, red: {} };
    for (const b of this.bots) {
      const f = b.orders.objective;
      if (b.alive && f) out[b.team][f] = (out[b.team][f] ?? 0) + 1;
    }
    return out;
  }

  private senses(bot: Bot, going: Partial<Record<FlagId, number>>): BotSenses {
    const enemyTeam = enemyOf(bot.team);
    const flags: FlagView[] = this.o.match.zones.map((z, i) => ({
      id: z.flag.id,
      position: this.flagPositions[i],
      owner: z.owner,
      control: z.control,
      enemyCapturing: z.inside[enemyTeam].length > z.inside[bot.team].length,
    }));
    const mine = { ...going };
    if (bot.orders.objective) mine[bot.orders.objective] = Math.max(0, (mine[bot.orders.objective] ?? 1) - 1);
    const seen = bot.memory.nearestVisible(bot.position, this.time);
    const latest = bot.memory.latest();
    const w = bot.weapons;
    const active = w.active;
    const primary = w.weapons.primary;
    return {
      time: this.time,
      team: bot.team,
      position: bot.position,
      hp: bot.soldier.health.hp,
      magFraction: active.mag / (active.def.magazine + active.def.chamber),
      activeSlot: w.activeSlot,
      weaponClass: active.def.class,
      primaryClass: primary.def.class,
      primaryEmpty: primary.mag === 0,
      primaryOut: primary.mag === 0 && primary.reserve === 0,
      canReload: active.reserve > 0,
      reloading: w.actionKind === 'reload' || w.actionKind === 'shells',
      flags,
      teammatesGoing: mine,
      enemy: seen ? { id: seen.id, position: seen.position, distance: seen.position.distanceTo(bot.position) } : null,
      lastKnown: latest ? { position: latest.position, age: this.time - Math.max(latest.lastSeen, latest.lastHeard) } : null,
      stuck: bot.stuck,
      resupplyAt: this.resupplyTarget(bot),
    };
  }

  /** An owned crate nearby when the primary is out of ammo or down to its last magazine. */
  private resupplyTarget(bot: Bot): THREE.Vector3 | null {
    const p = bot.weapons.weapons.primary;
    if (p.reserve >= p.def.magazine && p.mag > 0) return null;
    if (this.resupply.cooldownLeft(bot.id, this.time) > 0) return null;
    return this.resupply.nearestOwned(bot.position, bot.team, this.o.match.owners(), RESUPPLY.botRange)?.position ?? null;
  }

  /** Cover within `radius`, nearest first; with a threat, only cover that stands between us and it. */
  private cover(from: THREE.Vector3, radius: number, threat: THREE.Vector3 | null): { pos: THREE.Vector3; high: boolean } | null {
    const toThreat = new THREE.Vector3();
    const p = this.coverIndex.best(from, radius, (c, d) => {
      if (this.claimed(c.pos)) return null;
      if (!threat) return d;
      toThreat.subVectors(threat, c.pos).setY(0).normalize();
      return c.toward.dot(toThreat) > 0.3 ? d : null;
    });
    return p ? { pos: p.pos, high: p.high } : null;
  }

  /** Another living bot stands on or is heading to this spot. */
  private claimed(pos: THREE.Vector3): boolean {
    for (const b of this.bots) {
      if (b === this.deciding || !b.alive) continue;
      if (b.position.distanceToSquared(pos) < 1.2 * 1.2) return true;
      const goal = b.orders.moveTo;
      if (goal && goal.distanceToSquared(pos) < 1) return true;
    }
    return false;
  }

  /** A random cover point inside a flag zone, or a walkable spot near the flag. */
  private zoneSpot(flag: FlagId): THREE.Vector3 {
    const f = this.o.match.zones.find((z) => z.flag.id === flag)!.flag;
    const center = new THREE.Vector3(f.x, f.y, f.z);
    const inZone = this.coverIndex.near(center, CONQUEST.capture.radius - 2).filter((c) => !this.claimed(c.pos));
    if (inZone.length) return inZone[Math.floor(this.rand() * inZone.length)].pos.clone();
    const a = this.rand() * Math.PI * 2;
    const r = this.rand() * 6;
    const p = center.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    const n = this.o.nav.nearestWalkable(p, 4);
    return n === null ? center : this.o.nav.position(n);
  }
}
