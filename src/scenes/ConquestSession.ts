import * as THREE from 'three';
import type { Input } from '../core/Input';
import { CONQUEST } from '../data/conquest';
import { VERDAN } from '../data/map';
import type { TeamId } from '../data/map/types';
import type { Loadout } from '../data/weapons';
import type { SightTarget } from '../ai/Perception';
import { BODY_POINTS } from '../data/bots';
import { GRAPHICS } from '../data/graphics';
import { RESUPPLY } from '../data/resupply';
import { kitNeedsResupply, placeCrates, resupplyKit, type Kit, type Resupplier } from '../game/Resupply';
import { ResupplyCrate } from '../world/ResupplyCrate';
import { BotManager } from '../game/BotManager';
import { debugMode } from '../core/debugFlags';
import { BotDebug } from '../debug/BotDebug';
import { ConquestMatch, type Combatant, type KillFeedEntry } from '../game/ConquestMatch';
import { HQZone } from '../game/HQZone';
import type { MatchResult } from '../game/MatchClock';
import { SpawnSystem, type SpawnChoice } from '../game/SpawnSystem';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { Renderer } from '../render/Renderer';
import { CONTROLS } from '../data/controls';
import { MOVEMENT } from '../data/player';
import type { Settings } from '../save/SettingsStore';
import { HUD } from '../data/hud';
import { COLLISION, raycastSegment } from '../physics/collision';
import { MapImage } from '../ui/hud/MapImage';
import type { MapMarker } from '../ui/hud/mapMarkers';
import { MatchHud } from '../ui/hud/MatchHud';
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
  readonly hud: MatchHud;
  /** Top-down map image, shared with the Deploy Screen. */
  readonly mapImage = new MapImage(VERDAN);
  readonly bots: BotManager;
  private readonly playerCombatant: Combatant;
  private botDebug: BotDebug | null = null;
  private readonly crates: ResupplyCrate[];
  private readonly playerKit: Resupplier;
  private markers: MapMarker[] = [];
  private markerClock = 0;

  constructor(
    private readonly physics: PhysicsWorld,
    private readonly input: Input,
    readonly name: string,
    loadout: Loadout,
    readonly world: CityMap,
  ) {
    this.match = new ConquestMatch(VERDAN);
    this.hud = new MatchHud(this.match, this.mapImage);
    this.session = new PlaySession(physics, input, loadout, world, {
      autoRespawn: false,
      hud: this.hud,
      identity: { id: PLAYER_ID, name, team: PLAYER_TEAM },
    });
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
    this.match.add(this.playerCombatant);
    const crates = placeCrates(VERDAN, world.nav);
    this.crates = crates.map((c) => new ResupplyCrate(c));
    for (const c of this.crates) world.scene.add(c.root);
    this.playerKit = {
      id: PLAYER_ID,
      team: PLAYER_TEAM,
      get alive() {
        return self.state === 'alive';
      },
      position: feet,
      needsResupply: () => kitNeedsResupply(this.kit()),
    };
    this.bots = new BotManager({
      crates,
      physics,
      scene: world.scene,
      combat: this.session.combatSystem,
      audio: this.session.audio,
      nav: world.nav,
      cover: world.cover,
      match: this.match,
      map: VERDAN,
      spawns: this.spawns,
      player: this.playerTarget(),
    });

    // Deaths by bullet are reported from the combat hit (with the killer); the rest here.
    this.session.events.on('died', ({ cause }) => {
      this.state = 'dead';
      this.deadTime = 0;
      if (cause !== null) this.match.reportDeath({ victimId: PLAYER_ID, cause });
    });
    this.session.combatSystem.events.on('hit', (h) => {
      if (!h.kill) return;
      const victimId = h.target.combatantId;
      if (!victimId) return;
      this.match.reportDeath({ victimId, killerId: h.shooter?.id, weapon: h.weapon, headshot: h.zone === 'head', distance: h.distance });
    });
    this.match.events.on('kill', (k) => {
      this.hud.addKill(k);
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

  /** Applies the player's settings (sensitivity multiplier, FOV, volume, graphics preset). */
  applySettings(s: Settings, renderer: Renderer): void {
    this.session.sensitivity = MOVEMENT.mouseSensitivity * s.sensitivity;
    this.session.setBaseFov(s.fov);
    this.session.audio.setVolume(s.volume);
    const g = GRAPHICS[s.graphics];
    renderer.setRenderScale(g.renderScale);
    this.world.setShadows(g.shadows, g.shadowMapSize);
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
    this.bots.resupply.reset(PLAYER_ID);
    this.state = 'alive';
  }

  mount(parent: HTMLElement): void {
    this.session.mount(parent);
  }

  fixedUpdate(dt: number): void {
    if (this.paused || this.state === 'ended') return;
    this.bots.fixedUpdate(dt);
    this.session.fixedUpdate(dt);
    if (this.bots.resupply.update(this.bots.time, this.match.owners(), [this.playerKit]).length) {
      resupplyKit(this.kit());
      this.hud.showNotice('Resupplied', RESUPPLY.noticeTime);
      this.session.audio.resupplyCue();
    }
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
    for (const [i, c] of this.crates.entries()) c.setOwner(this.match.zones[i].owner);
    if (!this.paused) this.bots.update(dt, this.session.camera.position);
    if (debugMode() && this.input.wasPressed(CONTROLS.botDebug)) {
      if (!this.botDebug) {
        this.botDebug = new BotDebug(this.bots.bots, (id) => this.bots.target(id));
        this.world.scene.add(this.botDebug.root);
      }
      this.botDebug.toggle();
    }
    this.botDebug?.update();
    for (const [i, f] of this.world.flags.entries()) {
      const z = this.match.zones[i];
      f.setState(z.owner, z.control);
    }
    if ((this.markerClock -= dt) <= 0) {
      this.markerClock = HUD.minimap.enemyCheck;
      this.markers = this.mapMarkers();
    }
    const feet = this.session.player.motor.feet;
    const alive = this.state === 'alive';
    this.hud.updateMatch(dt, {
      match: this.match,
      team: PLAYER_TEAM,
      zone: alive ? this.match.zoneOf(feet) : null,
      player: { x: feet.x, z: feet.z, yaw: this.session.player.yaw },
      markers: this.markers,
      hqWarning: alive ? this.hq.remaining : null,
      showScoreboard: this.input.isDown(CONTROLS.scoreboard) || this.state === 'ended',
      showLargeMap: alive && this.input.isDown(CONTROLS.largeMap),
    });
  }

  /** Teammates always; enemies only when the player can see them (in front, in range, line of sight). */
  private mapMarkers(): MapMarker[] {
    const out: MapMarker[] = [];
    for (const c of this.bots.resupply.crates) {
      if (this.match.owners()[c.flag] === PLAYER_TEAM) out.push({ x: c.position.x, z: c.position.z, kind: 'crate' });
    }
    const cam = this.session.camera;
    const forward = cam.getWorldDirection(new THREE.Vector3());
    const to = new THREE.Vector3();
    const halfFov = THREE.MathUtils.degToRad(cam.fov * Math.max(1, cam.aspect)) / 2;
    for (const c of this.bots.bots) {
      if (!c.alive) continue;
      if (c.team === PLAYER_TEAM) {
        out.push({ x: c.position.x, z: c.position.z, kind: 'ally' });
        continue;
      }
      if (this.state !== 'alive') continue;
      to.set(c.position.x, c.position.y + 1.4, c.position.z).sub(cam.position);
      const dist = to.length();
      if (dist > HUD.minimap.enemyRange || to.angleTo(forward) > halfFov) continue;
      const end = cam.position.clone().addScaledVector(to, (dist - 0.6) / dist);
      if (raycastSegment(this.physics, cam.position, end, COLLISION.view)) continue;
      out.push({ x: c.position.x, z: c.position.z, kind: 'enemy' });
    }
    return out;
  }

  render(renderer: Renderer): void {
    this.session.render(renderer);
  }

  /** The player as the bots see them: feet, chest and head following the crouch. */
  private playerTarget(): SightTarget {
    const self = this;
    const p = this.session.player;
    const chest = new THREE.Vector3();
    const head = new THREE.Vector3();
    const at = (out: THREE.Vector3, h: { stand: number; crouch: number }) => out.copy(p.motor.feet).setY(p.motor.feet.y + THREE.MathUtils.lerp(h.stand, h.crouch, p.crouchBlend));
    return {
      id: PLAYER_ID,
      team: PLAYER_TEAM,
      position: p.motor.feet,
      get alive() {
        return self.state === 'alive';
      },
      get chest() {
        return at(chest, BODY_POINTS.chest);
      },
      get head() {
        return at(head, BODY_POINTS.head);
      },
    };
  }

  /** The player's weapons and health, for resupply. */
  private kit(): Kit {
    return { weapons: this.session.weapons, health: this.session.health };
  }

  dispose(): void {
    this.botDebug?.dispose();
    this.bots.dispose();
    this.session.dispose();
  }
}
