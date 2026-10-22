import * as THREE from 'three';
import type { Input } from '../core/Input';
import { CONQUEST } from '../data/conquest';
import { VERDAN } from '../data/map';
import type { TeamId } from '../data/map/types';
import type { Loadout } from '../data/weapons';
import { Soldier } from '../entities/soldier/Soldier';
import { ConquestMatch, type Combatant, type KillFeedEntry } from '../game/ConquestMatch';
import { HQZone } from '../game/HQZone';
import type { MatchResult } from '../game/MatchClock';
import { SpawnSystem, type SpawnChoice } from '../game/SpawnSystem';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { Renderer } from '../render/Renderer';
import type { PlayerHud } from '../ui/PlayerHud';
import type { CityMap } from './CityMap';
import { PlaySession } from './PlaySession';

export const PLAYER_ID = 'player';
const PLAYER_TEAM: TeamId = 'blue';

export type ConquestState = 'alive' | 'dead' | 'ended';

export interface ConquestCallbacks {
  /** The player died; the Deploy Screen takes over. */
  onPlayerDied?(info: KillFeedEntry): void;
  onEnded?(result: MatchResult): void;
}

/**
 * The player's side of a Conquest match on the city map: runs the `PlaySession`, the
 * `ConquestMatch` (flags, tickets, scores), the enemy-HQ rule, spawning and flag visuals.
 * The HUD, Deploy Screen and Pause Menu read from it and call `deploy`.
 */
export class ConquestSession {
  readonly match: ConquestMatch;
  readonly session: PlaySession;
  readonly spawns = new SpawnSystem(VERDAN);
  readonly hq = new HQZone(VERDAN.hqs);
  state: ConquestState = 'alive';
  /** How the player last died, for the Deploy Screen. */
  lastDeath: KillFeedEntry | null = null;
  /** Seconds since the player died. */
  deadTime = 0;
  callbacks: ConquestCallbacks = {};
  private readonly playerCombatant: Combatant;
  private readonly targets = new Map<object, Combatant>();

  constructor(
    physics: PhysicsWorld,
    input: Input,
    readonly name: string,
    loadout: Loadout,
    readonly world: CityMap,
    hud?: PlayerHud,
  ) {
    this.session = new PlaySession(physics, input, loadout, world, { autoRespawn: false, hud });
    const feet = this.session.player.motor.feet;
    const self = this;
    this.playerCombatant = {
      id: PLAYER_ID,
      name,
      team: PLAYER_TEAM,
      isPlayer: true,
      position: feet,
      get alive() {
        return self.state === 'alive';
      },
    };
    this.match = new ConquestMatch(VERDAN, [this.playerCombatant]);
    // `?debug=crowd` targets: they can be shot and cost tickets, but never take flags.
    for (const s of world.crowd?.soldiers ?? []) {
      const c: Combatant = {
        id: s.label,
        name: s.label,
        team: s.team,
        isPlayer: false,
        capturer: false,
        position: s.position,
        get alive() {
          return !s.dead;
        },
      };
      this.targets.set(s, c);
      this.match.add(c);
    }

    this.session.events.on('died', ({ cause }) => {
      this.state = 'dead';
      this.deadTime = 0;
      this.match.reportDeath({ victimId: PLAYER_ID, cause: cause ?? undefined });
    });
    this.session.events.on('targetHit', (hit) => {
      const target = hit.target instanceof Soldier ? this.targets.get(hit.target) : undefined;
      if (hit.kill && target) {
        this.match.reportDeath({ victimId: target.id, killerId: PLAYER_ID, weapon: hit.weapon, headshot: hit.zone === 'head', distance: hit.distance });
      }
    });
    this.match.events.on('kill', (k) => {
      if (k.victim.id === PLAYER_ID) {
        this.lastDeath = k;
        this.callbacks.onPlayerDied?.(k);
      }
    });
    const audio = this.session.audio;
    this.match.events.on('captured', ({ team }) => audio.flagCue(team === PLAYER_TEAM ? 'captured' : 'lost'));
    this.match.events.on('neutralized', ({ team }) => audio.flagCue(team === PLAYER_TEAM ? 'lost' : 'neutralized'));
    this.match.events.on('ended', (r) => {
      this.state = 'ended';
      this.callbacks.onEnded?.(r);
    });

    this.deploy({ kind: 'hq' });
  }

  get paused(): boolean {
    return this.session.paused;
  }

  set paused(p: boolean) {
    this.session.paused = p;
  }

  /** Seconds until the Deploy button unlocks. */
  get respawnWait(): number {
    return Math.max(0, CONQUEST.respawnDelay - this.deadTime);
  }

  spawnOptions(): SpawnChoice[] {
    return this.spawns.options(PLAYER_TEAM, this.match.owners());
  }

  /** Spawns the player at `choice` (HQ or an owned flag) with `loadout` (default: the current one). */
  deploy(choice: SpawnChoice, loadout?: Loadout): void {
    if (this.state === 'ended') return;
    const valid = this.spawnOptions().some((o) => o.kind === choice.kind && (o.kind === 'hq' || (choice.kind === 'flag' && o.flag === choice.flag)));
    const pick = valid ? choice : { kind: 'hq' as const };
    const p = this.spawns.point(PLAYER_TEAM, pick, []);
    this.session.respawn(new THREE.Vector3(p.x, 0, p.z), p.yaw, loadout);
    this.hq.reset();
    this.state = 'alive';
  }

  mount(parent: HTMLElement): void {
    this.session.mount(parent);
  }

  fixedUpdate(dt: number): void {
    if (this.paused || this.state === 'ended') return;
    this.session.fixedUpdate(dt);
    if (this.state === 'alive') {
      const feet = this.session.player.motor.feet;
      if (this.hq.update(dt, PLAYER_TEAM, feet.x, feet.z) === 'expired') this.session.kill('hq');
    } else {
      this.deadTime += dt;
    }
    this.match.update(dt);
  }

  update(dt: number, alpha: number): void {
    this.session.update(dt, alpha);
    for (const [i, f] of this.world.flags.entries()) {
      const z = this.match.zones[i];
      f.setState(z.owner, z.control);
    }
  }

  render(renderer: Renderer): void {
    this.session.render(renderer);
  }

  dispose(): void {
    this.session.dispose();
  }
}
