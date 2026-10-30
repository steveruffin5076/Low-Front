import * as THREE from 'three';
import { BotAim } from '../ai/BotAim';
import { BotBrain, type BotOrders } from '../ai/BotBrain';
import type { PathRequest, PathService } from '../ai/PathService';
import { BotMemory, type SightTarget } from '../ai/Perception';
import type { AudioManager } from '../audio/AudioManager';
import { BALLISTICS } from '../data/ballistics';
import { BODY_POINTS, BOTS } from '../data/bots';
import type { TeamId } from '../data/map/types';
import type { Loadout } from '../data/weapons';
import type { Combat } from '../game/Combat';
import type { Combatant } from '../game/ConquestMatch';
import { COLLISION } from '../physics/collision';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { BulletShooter } from '../weapons/Ballistics';
import { PlayerWeapons, type WeaponInput } from '../weapons/PlayerWeapons';
import { Recoil } from '../weapons/Recoil';
import { Spread, spreadDirection } from '../weapons/Spread';
import { PlayerController, type PlayerIntent } from './PlayerController';
import { Soldier } from './soldier/Soldier';

const T = BOTS.thresholds;
const DEG = Math.PI / 180;
const { eye: EYE, chest: CHEST, head: HEAD } = BODY_POINTS;
/** Radians per second a bot turns its view. */
const TURN_RATE = 7;
const SIDESTEP_TIME = 0.7;
/** Final waypoint radius, and how close a blocked waypoint must be to count as passed. */
const ARRIVE_RADIUS = 1;
const BLOCKED_PASS = 1.6;
const BLOCKED_TIME = 0.6;
/** A goal that moved this far gets a new path right away. */
const REPATH_FAR = 8;
const UP = new THREE.Vector3(0, 1, 0);

const dir = new THREE.Vector3();
const aimDir = new THREE.Vector3();
const shotDir = new THREE.Vector3();
const pelletDir = new THREE.Vector3();
const muzzleOffset = new THREE.Vector3();

/** What the bot needs from the world around it. */
export interface BotWorld {
  physics: PhysicsWorld;
  combat: Combat;
  paths: PathService;
  audio: AudioManager;
  /** Live sight target for an id (to aim at where the enemy is now). */
  target(id: string): SightTarget | null;
}

/**
 * A bot soldier (plan section 12): the player's movement (`PlayerController`), weapons
 * (`PlayerWeapons`) and bullets, a third-person `Soldier` for looks and hitboxes, and a
 * `BotBrain` whose orders it carries out every fixed step: path following, stuck recovery,
 * turning, crouching, aiming and firing in bursts.
 */
export class Bot implements Combatant, SightTarget {
  readonly isPlayer = false;
  readonly controller: PlayerController;
  readonly weapons: PlayerWeapons;
  readonly soldier: Soldier;
  readonly brain = new BotBrain();
  readonly aim = new BotAim();
  readonly memory: BotMemory;
  readonly eye = new THREE.Vector3();
  readonly chest = new THREE.Vector3();
  readonly head = new THREE.Vector3();
  readonly shooter: BulletShooter;
  /** Seconds dead (for respawn). */
  deadTime = 0;
  /** Seconds until the next decision (staggered across bots). */
  decisionClock: number;
  /** Set when the bot made no progress; read and cleared by the next decision. */
  stuck = false;
  /** Longest time without progress so far this life (for tests). */
  maxStall = 0;
  /** Seconds wanting to move without getting 1 m from where that started, and its maximum this life. */
  stuckFor = 0;
  maxStuck = 0;
  /** Times this bot was moved out of a spot it could not leave (for tests). */
  unsticks = 0;
  private readonly stuckAnchor = new THREE.Vector3();
  /** Match time, for visibility checks (set by the manager each step). */
  now = 0;
  private path: THREE.Vector3[] = [];
  private pathIndex = 0;
  private destination: THREE.Vector3 | null = null;
  private request: PathRequest | null = null;
  private repathAt = 0;
  private bestDistance = Infinity;
  private stallTime = 0;
  private sidestep = 0;
  private sidestepDir = 1;
  private triggerHeld = false;
  private pressNext = false;
  private reloadAsked = false;
  private readonly recoil = new Recoil();
  private readonly spreads = new Map<string, Spread>();

  constructor(
    readonly id: string,
    readonly name: string,
    readonly team: TeamId,
    loadout: Loadout,
    private readonly world: BotWorld,
    spawn: THREE.Vector3,
    decisionOffset: number,
  ) {
    this.controller = new PlayerController(world.physics, spawn, COLLISION.bot);
    this.weapons = new PlayerWeapons(loadout);
    this.soldier = new Soldier(world.physics, team, loadout, name, false);
    this.soldier.combatantId = id;
    this.memory = new BotMemory(team);
    this.shooter = { id, team, owner: this.soldier };
    this.decisionClock = decisionOffset;
    for (const w of Object.values(this.weapons.weapons)) this.spreads.set(w.def.id, new Spread(w.def));
    this.weapons.events.on('fired', ({ weapon }) => this.onFired(weapon.def));
    this.weapons.events.on('reloadStart', ({ duration }) => this.soldier.anim.reload(duration));
    this.weapons.events.on('holsterStart', () => this.soldier.switchWeapon());
    this.controller.events.on('footstep', ({ crouched, sprinting }) => {
      if (this.world.audio.listenerDistance(this.position) < 30) {
        this.world.audio.footstep('concrete', crouched ? 0.4 : sprinting ? 1.2 : 0.8, this.position);
      }
    });
  }

  get position(): THREE.Vector3 {
    return this.controller.motor.feet;
  }

  get alive(): boolean {
    return !this.soldier.dead;
  }

  get yaw(): number {
    return this.controller.yaw;
  }

  /** The waypoints still ahead (for the debug view). */
  get route(): readonly THREE.Vector3[] {
    return this.path.slice(this.pathIndex);
  }

  get orders(): BotOrders {
    return this.brain.orders;
  }

  spawn(at: THREE.Vector3, yaw: number): void {
    this.controller.respawn(at, yaw);
    this.controller.motor.setEnabled(true);
    this.soldier.spawn(at, yaw);
    this.weapons.start();
    this.brain.reset();
    this.memory.known.clear();
    this.aim.track(0, null);
    this.recoil.reset();
    this.deadTime = 0;
    this.path = [];
    this.destination = null;
    if (this.request) this.request.cancelled = true;
    this.request = null;
    this.stallTime = 0;
    this.maxStall = 0;
    this.stuckFor = 0;
    this.maxStuck = 0;
    this.stuckAnchor.copy(at);
    this.bestDistance = Infinity;
    this.triggerHeld = false;
    this.updatePoints();
  }

  fixedUpdate(dt: number): void {
    if (!this.alive) {
      if (this.deadTime === 0) this.controller.motor.setEnabled(false);
      this.deadTime += dt;
      return;
    }
    const o = this.orders;
    const intent = this.steer(dt, o);
    this.controller.fixedUpdate(dt, intent, this.weapons.active.def.moveSpeedModifier);
    this.controller.clampPitch();
    this.weapons.update(dt, this.weaponInput(dt, o));
    for (const s of this.spreads.values()) s.update(dt);
    this.recoil.update(dt, this.weapons.active.def);
    this.updatePoints();
    // The visible soldier follows the body.
    const s = this.soldier;
    s.position.copy(this.position);
    s.yaw = this.controller.yaw;
    s.fixedUpdate(dt);
  }

  /** Frame update: animation input and the soldier's look. */
  update(dt: number, cameraPos: THREE.Vector3): void {
    const s = this.soldier;
    if (this.alive) {
      const c = this.controller;
      const sin = Math.sin(c.yaw);
      const cos = Math.cos(c.yaw);
      s.input.moveForward = -c.velocity.x * sin - c.velocity.z * cos;
      s.input.moveRight = c.velocity.x * cos - c.velocity.z * sin;
      s.input.crouched = c.crouched;
      s.input.sprinting = c.sprinting;
      s.input.grounded = c.grounded;
      s.input.verticalSpeed = c.velocity.y;
      s.input.pitch = c.pitch;
      s.position.copy(this.position);
      s.yaw = c.yaw;
    }
    s.update(dt, cameraPos);
  }

  dispose(): void {
    this.soldier.dispose();
  }

  // --- Movement ---

  private steer(dt: number, o: BotOrders): PlayerIntent {
    const c = this.controller;
    const feet = this.position;
    const intent: PlayerIntent = {
      strafe: 0,
      forward: 0,
      sprint: false,
      ads: o.pace === 'walk',
      firing: this.triggerHeld,
      leanLeft: false,
      leanRight: false,
      crouchPressed: o.crouch !== c.crouched,
      jumpPressed: false,
    };
    let moving = false;
    if (o.moveTo) {
      // A moving goal (an enemy) repaths at most once a second unless it jumped far.
      const moved = this.destination ? this.destination.distanceTo(o.moveTo) : Infinity;
      if (moved > REPATH_FAR || (moved > 1.5 && this.now >= this.repathAt)) this.setDestination(o.moveTo);
      while (this.pathIndex < this.path.length) {
        const p = this.path[this.pathIndex];
        // The end counts as reached within the brain's 1 m (cover spots sit against walls).
        const radius = this.pathIndex === this.path.length - 1 ? ARRIVE_RADIUS : T.waypointRadius;
        if (Math.hypot(p.x - feet.x, p.z - feet.z) > radius || Math.abs(p.y - feet.y) > 1.2) break;
        this.pathIndex++;
        this.bestDistance = Infinity;
      }
      const wp = this.path[this.pathIndex];
      if (wp) {
        dir.set(wp.x - feet.x, 0, wp.z - feet.z);
        moving = dir.lengthSq() > 1e-4;
      }
    } else {
      this.destination = null;
    }
    // Look at the enemy (or where we go) with a limited turn rate.
    const look = o.lookAt;
    let wantYaw = c.yaw;
    if (look) wantYaw = Math.atan2(-(look.x - feet.x), -(look.z - feet.z));
    else if (moving) wantYaw = Math.atan2(-dir.x, -dir.z);
    const diff = THREE.MathUtils.euclideanModulo(wantYaw - c.yaw + Math.PI, Math.PI * 2) - Math.PI;
    c.yaw += THREE.MathUtils.clamp(diff, -TURN_RATE * dt, TURN_RATE * dt);
    if (look) {
      const dy = (look.y + CHEST.stand) - this.eye.y;
      const want = Math.atan2(dy, Math.hypot(look.x - feet.x, look.z - feet.z));
      c.pitch += THREE.MathUtils.clamp(want - c.pitch, -TURN_RATE * dt, TURN_RATE * dt);
    } else {
      c.pitch *= 0.9;
    }
    if (moving) {
      dir.normalize();
      const sin = Math.sin(c.yaw);
      const cos = Math.cos(c.yaw);
      intent.forward = -dir.x * sin - dir.z * cos;
      intent.strafe = dir.x * cos - dir.z * sin;
      intent.sprint = o.pace === 'sprint' && !look && intent.forward > 0.7;
      this.trackProgress(dt);
      if (feet.distanceTo(this.stuckAnchor) > 1) {
        this.stuckAnchor.copy(feet);
        this.stuckFor = 0;
      } else {
        this.stuckFor += dt;
        this.maxStuck = Math.max(this.maxStuck, this.stuckFor);
        // Sliding along a wall can look like progress; not getting 1 m away cannot.
        const every = T.stuckTime * 0.75;
        if (this.stuckFor >= T.stuckTime && Math.floor(this.stuckFor / every) !== Math.floor((this.stuckFor - dt) / every)) this.recover();
        if (this.stuckFor >= T.unstickTime) this.unstick();
      }
    } else {
      this.stuckAnchor.copy(feet);
      this.stuckFor = 0;
      intent.strafe = o.strafe;
      this.stallTime = 0;
    }
    if (this.sidestep > 0) {
      this.sidestep -= dt;
      intent.strafe = this.sidestepDir;
      intent.forward = -0.3;
      intent.jumpPressed = this.sidestep < 0.2 && this.sidestep + dt >= 0.2;
    }
    return intent;
  }

  /** `raw`: follow cell centers (after getting stuck) instead of a smoothed path. */
  private setDestination(to: THREE.Vector3, raw = false): void {
    const near = this.destination !== null && this.destination.distanceTo(to) < REPATH_FAR;
    this.destination = to.clone();
    this.repathAt = this.now + 1;
    this.bestDistance = Infinity;
    if (this.request) this.request.cancelled = true;
    this.request = null;
    // Searches and straight lines start from walkable ground: get back onto it first.
    const exit = this.world.paths.exit(this.position);
    // A clear straight line needs no search.
    const direct = raw ? null : this.world.paths.direct(this.position, to);
    if (direct) {
      this.path = exit ? [exit, direct[1]] : [direct[1]];
      this.pathIndex = 0;
      return;
    }
    // Keep to the old path (to about the same place) until the new one arrives, or head straight there.
    if (!near || raw || exit || this.pathIndex >= this.path.length) {
      this.path = exit ? [exit, this.destination] : [this.destination];
      this.pathIndex = 0;
    }
    this.request = this.world.paths.request(
      this.position,
      to,
      (points) => {
        this.request = null;
        if (!points || points.length < 2) return;
        this.path = points;
        // The first point is the start cell: skip it unless we still have to step onto it.
        this.pathIndex = this.world.paths.exit(this.position) ? 0 : 1;
        this.bestDistance = Infinity;
      },
      raw,
    );
  }

  /** No getting closer to the current waypoint for a while counts as stuck: step aside and repath. */
  private trackProgress(dt: number): void {
    const wp = this.path[this.pathIndex];
    const d = Math.hypot(wp.x - this.position.x, wp.z - this.position.z);
    if (d < this.bestDistance - 0.25) {
      this.bestDistance = d;
      this.stallTime = 0;
      return;
    }
    this.stallTime += dt;
    this.maxStall = Math.max(this.maxStall, this.stallTime);
    // Blocked right next to a waypoint (a prop corner, another soldier): take it as passed.
    if (this.stallTime >= BLOCKED_TIME && d < BLOCKED_PASS) {
      this.pathIndex++;
      this.stallTime = 0;
      this.bestDistance = Infinity;
      return;
    }
    if (this.stallTime >= T.stuckTime) this.recover();
  }

  /**
   * Last resort, still stuck after stepping aside and repathing (wedged in a small corner the
   * nav grid marks unwalkable): move onto the nearest walkable cell, at most 2 m away.
   */
  private unstick(): void {
    const feet = this.position;
    const to = this.world.paths.exit(feet) ?? this.world.paths.nearbyWalkable(feet, Math.random() * Math.PI * 2);
    this.stuckFor = 0;
    this.stuckAnchor.copy(feet);
    if (!to) return;
    this.unsticks++;
    this.controller.motor.teleport(to);
    if (this.destination) this.setDestination(this.destination, true);
  }

  /** Stuck: tell the brain, step aside and repath along cell centers. */
  private recover(): void {
    this.stuck = true;
    this.stallTime = 0;
    this.bestDistance = Infinity;
    this.sidestep = SIDESTEP_TIME;
    this.sidestepDir = Math.random() < 0.5 ? -1 : 1;
    if (this.destination) this.setDestination(this.destination, true);
  }

  // --- Weapons ---

  private weaponInput(dt: number, o: BotOrders): WeaponInput {
    const w = this.weapons.active;
    const target = o.fireAt ? this.world.target(o.fireAt) : null;
    const visible = target !== null && target.alive && this.memory.known.has(target.id) && this.memory.isVisible(this.memory.known.get(target.id)!, this.now);
    this.aim.style = BOTS.styles[w.def.class];
    this.aim.track(dt, visible ? target!.id : null);
    let fire = false;
    let press = false;
    if (visible && this.aim.ready && w.mag > 0) {
      fire = true;
      if (w.fireMode === 'semi') {
        press = this.pressNext;
        this.pressNext = !this.pressNext;
      } else {
        press = !this.triggerHeld;
      }
    }
    this.triggerHeld = fire;
    const reload = o.reload && !this.reloadAsked;
    this.reloadAsked = o.reload;
    const autoReload = w.mag === 0 && w.reserve > 0 && !visible;
    return {
      firePressed: press,
      fireHeld: fire && w.fireMode === 'auto',
      reloadPressed: reload || autoReload,
      switchTo: o.switchTo,
      fireModePressed: false,
      inspectPressed: false,
      canFire: !this.controller.sprinting,
      sprinting: this.controller.sprinting,
      ads: o.pace === 'walk',
    };
  }

  private onFired(def: PlayerWeapons['active']['def']): void {
    this.soldier.fire();
    const id = this.aim.targetId;
    const target = id ? this.world.target(id) : null;
    if (target) this.aim.aim(this.eye, target.chest, target.head ?? target.chest, aimDir);
    else aimDir.set(-Math.sin(this.controller.yaw), 0, -Math.cos(this.controller.yaw));
    // Recoil climbs the shots; the bot pulls part of it back down.
    this.recoil.kick(def, 1 - this.aim.recoilControl);
    shotDir.copy(aimDir).applyAxisAngle(dir.crossVectors(aimDir, UP).normalize(), this.recoil.pitch * DEG);
    const spread = this.spreads.get(def.id)!;
    spreadDirection(shotDir, spread.cone({ ads: this.orders.pace === 'walk' ? 1 : 0, speed: this.controller.horizontalSpeed, grounded: this.controller.grounded }), shotDir);
    spread.onShot();
    if (this.aim.shot()) this.triggerHeld = false;
    muzzleOffset.copy(aimDir).multiplyScalar(BOTS.muzzle.forward);
    muzzleOffset.y -= BOTS.muzzle.down;
    const tracer = Math.random() < 1 / BALLISTICS.tracerEvery;
    // Ballistics copies what it needs, and the sound only reads its position.
    for (let i = 0; i < def.pellets; i++) {
      const d = def.pellets > 1 ? spreadDirection(shotDir, def.pelletSpreadDeg, pelletDir) : shotDir;
      this.world.combat.ballistics.fire(this.eye, d, def, tracer && i === 0, muzzleOffset, this.shooter);
    }
    this.world.audio.gunshot(def.id, this.eye);
  }

  private updatePoints(): void {
    const k = this.controller.crouchBlend;
    const f = this.position;
    this.eye.set(f.x, f.y + THREE.MathUtils.lerp(EYE.stand, EYE.crouch, k), f.z);
    this.chest.set(f.x, f.y + THREE.MathUtils.lerp(CHEST.stand, CHEST.crouch, k), f.z);
    this.head.set(f.x, f.y + THREE.MathUtils.lerp(HEAD.stand, HEAD.crouch, k), f.z);
  }
}

