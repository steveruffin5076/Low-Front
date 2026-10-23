import * as THREE from 'three';
import { FPAnimator } from '../anim/FPAnimator';
import { CameraFx } from '../anim/CameraFx';
import { AudioManager } from '../audio/AudioManager';
import { EventBus } from '../core/EventBus';
import type { Input } from '../core/Input';
import { CONTROLS, MOUSE } from '../data/controls';
import { MOVEMENT } from '../data/player';
import type { Loadout, WeaponSlot } from '../data/weapons';
import { PlayerController, type PlayerIntent } from '../entities/PlayerController';
import type { DeathCause } from '../game/ConquestMatch';
import { OutOfBounds } from '../game/OutOfBounds';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { Renderer } from '../render/Renderer';
import { ViewmodelLayer } from '../render/ViewmodelLayer';
import type { PlayerHud } from '../ui/PlayerHud';
import { RangeOverlay } from '../ui/RangeOverlay';
import { PlayerWeapons, type WeaponInput } from '../weapons/PlayerWeapons';
import { Combat } from '../game/Combat';
import { PlayerHitboxes } from '../entities/PlayerHitboxes';
import type { BulletShooter } from '../weapons/Ballistics';
import { RangeCombat, type KillerInfo, type TargetHit } from './RangeCombat';
import type { World } from './World';

/** Pressed keys latched each frame until a fixed step consumes them. */
interface Latched {
  crouch: boolean;
  jump: boolean;
  fire: boolean;
  reload: boolean;
  fireMode: boolean;
  inspect: boolean;
  switchTo: WeaponSlot | null;
}

const NONE: Latched = { crouch: false, jump: false, fire: false, reload: false, fireMode: false, inspect: false, switchTo: null };

export interface SessionEvents {
  /** The player died; `cause` is null when an enemy killed them (`killer` says who). */
  died: { cause: DeathCause | null; killer: KillerInfo | null };
  /** The player's bullet hit a target. */
  targetHit: TargetHit;
}

export interface SessionOptions {
  /** Respawn at the world spawn after the death camera (test range). The match deploys instead. */
  autoRespawn: boolean;
  hud?: PlayerHud;
  /** The player's match identity, for hitboxes and bullets (none on the test range). */
  identity?: { id: string; name: string; team: 'blue' | 'red' };
}

/** A play session in a world: player movement, weapons, animations, combat and bounds. */
export class PlaySession {
  readonly events = new EventBus<SessionEvents>();
  readonly player: PlayerController;
  readonly camera = new THREE.PerspectiveCamera(MOVEMENT.baseFov, 1, 0.05, 400);
  readonly audio = new AudioManager();
  readonly hud: PlayerHud;
  /** Bullets, impacts and tracers for everyone in this world (bots fire into it too). */
  readonly combatSystem: Combat;
  /** The player as a bullet target. */
  readonly hitboxes: PlayerHitboxes;
  /** Tags the player's bullets. */
  readonly shooter: BulletShooter;
  weapons!: PlayerWeapons;
  /** While paused the simulation and input stop; the frame still renders. */
  paused = false;
  /** Radians per pixel of mouse movement (the player's setting). */
  sensitivity: number = MOVEMENT.mouseSensitivity;
  private readonly layer = new ViewmodelLayer();
  private readonly fx = new CameraFx();
  private readonly bounds = new OutOfBounds();
  private animator!: FPAnimator;
  private combat!: RangeCombat;
  private loadout!: Loadout;
  private baseFov: number = MOVEMENT.baseFov;
  private latched: Latched = { ...NONE };

  constructor(
    private readonly physics: PhysicsWorld,
    private readonly input: Input,
    loadout: Loadout,
    readonly world: World,
    private readonly options: SessionOptions = { autoRespawn: true },
  ) {
    this.hud = options.hud ?? new RangeOverlay();
    this.combatSystem = new Combat(physics, world.scene, this.audio);
    const id = options.identity;
    this.hitboxes = new PlayerHitboxes(physics, id?.name ?? 'player', id?.team, id?.id, (hit) => {
      const killer: KillerInfo | null = hit.attackerId
        ? { id: hit.attackerId, weapon: hit.weapon ?? '', headshot: hit.zone === 'head', distance: hit.distance }
        : null;
      const wasDead = this.combat.health.dead;
      this.combat.damagePlayer(hit.damage, hit.from ?? null, null, killer);
      hit.killed = !wasDead && this.combat.health.dead;
      hit.remainingHp = this.combat.health.hp;
    });
    this.shooter = { id: id?.id ?? 'player', team: id?.team ?? null, owner: this.hitboxes };
    this.player = new PlayerController(physics, world.spawn.position.clone());
    this.player.yaw = world.spawn.yaw;
    this.player.events.on('jumped', () => this.animator.onJump());
    this.player.events.on('landed', ({ impactSpeed }) => this.animator.onLand(impactSpeed));
    this.arm(loadout);
    this.weapons.start();
  }

  get dead(): boolean {
    return this.fx.dead;
  }

  /** The death camera has finished. */
  get deathFinished(): boolean {
    return this.fx.deathFinished;
  }

  get health(): RangeCombat['health'] {
    return this.combat.health;
  }

  get currentLoadout(): Loadout {
    return { ...this.loadout };
  }

  get adsBlend(): number {
    return this.animator.adsBlend;
  }

  /** Seconds left of the out-of-bounds countdown, or null. */
  get boundsRemaining(): number | null {
    return this.bounds.remaining;
  }

  setBaseFov(fov: number): void {
    this.baseFov = fov;
    this.animator.baseFov = fov;
  }

  mount(parent: HTMLElement): void {
    parent.append(this.hud.element);
  }

  /** Kills the player at once (out of bounds, enemy HQ, test key). */
  kill(cause: DeathCause): void {
    this.combat.damagePlayer(this.combat.health.max, null, cause);
  }

  /** Back to life at `at` facing `yaw`; a different loadout rebuilds the weapons. */
  respawn(at: THREE.Vector3, yaw: number, loadout?: Loadout): void {
    if (loadout && (loadout.primary !== this.loadout.primary || loadout.secondary !== this.loadout.secondary)) {
      this.disarm();
      this.arm(loadout);
    }
    this.fx.reset();
    this.player.respawn(at, yaw);
    this.hitboxes.setEnabled(true);
    this.hitboxes.follow(this.player.motor.feet, yaw, 0);
    this.bounds.reset();
    this.animator.reset();
    this.combat.reset();
    this.weapons.start();
    this.latched = { ...NONE };
  }

  fixedUpdate(dt: number): void {
    if (this.paused) return;
    // The world (and everyone's bullets) keeps going while the player is dead.
    if (this.fx.dead) {
      this.world.fixedUpdate?.(dt);
      this.combatSystem.fixedUpdate(dt);
      return;
    }
    const i = this.input;
    const fireHeld = i.locked && i.isMouseDown(MOUSE.fire);
    const ads = this.adsAllowed && i.locked && i.isMouseDown(MOUSE.ads);
    const intent: PlayerIntent = {
      strafe: this.axis(CONTROLS.right, CONTROLS.left),
      forward: this.axis(CONTROLS.forward, CONTROLS.back),
      sprint: i.isDown(CONTROLS.sprint),
      ads,
      firing: fireHeld,
      leanLeft: i.isDown(CONTROLS.leanLeft),
      leanRight: i.isDown(CONTROLS.leanRight),
      crouchPressed: this.latched.crouch,
      jumpPressed: this.latched.jump,
    };
    this.player.fixedUpdate(dt, intent, this.weapons.active.def.moveSpeedModifier);

    const weaponInput: WeaponInput = {
      firePressed: this.latched.fire,
      fireHeld,
      reloadPressed: this.latched.reload,
      switchTo: this.latched.switchTo,
      fireModePressed: this.latched.fireMode,
      inspectPressed: this.latched.inspect,
      canFire: !this.player.sprinting && this.animator.sprintAmount === 0,
      sprinting: this.player.sprinting,
      ads,
    };
    this.weapons.update(dt, weaponInput);
    this.hitboxes.follow(this.player.motor.feet, this.player.yaw, this.player.crouchBlend);
    this.world.fixedUpdate?.(dt);
    this.combat.fixedUpdate(dt);
    this.combatSystem.fixedUpdate(dt);
    if (this.world.limit !== null) {
      const feet = this.player.motor.feet;
      if (this.bounds.update(dt, feet.x, feet.z) === 'expired') this.kill('bounds');
    }
    this.latched = { ...NONE };
  }

  update(dt: number, alpha: number): void {
    const i = this.input;
    const live = !this.paused && !this.fx.dead;
    if (live) this.readInput();
    else if (!this.paused && this.options.autoRespawn && this.fx.deathFinished) this.respawn(this.world.spawn.position.clone(), this.world.spawn.yaw);
    if (this.paused) dt = 0;

    this.player.updateCamera(this.camera, alpha);
    const eye = this.camera.position.y - this.player.motor.feet.y;
    this.fx.apply(this.camera, dt, eye);
    this.camera.updateMatrixWorld();
    this.audio.setListener(this.camera);
    this.world.follow(this.player.motor.feet);
    this.world.update(dt, this.camera);
    this.combatSystem.update(dt, alpha);

    this.combat.shooting.ads = this.animator.adsBlend;
    const aiming = live && this.adsAllowed && i.locked && i.isMouseDown(MOUSE.ads);
    const fov = this.animator.update({
      dt,
      ads: aiming,
      sprinting: this.player.sprinting,
      crouchBlend: this.player.crouchBlend,
      speed: this.player.horizontalSpeed,
      grounded: this.player.grounded,
      mouseDx: live && i.locked ? i.mouseDelta.x : 0,
      mouseDy: live && i.locked ? i.mouseDelta.y : 0,
    });
    if (this.camera.fov !== fov) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    this.layer.setFov(fov);

    const w = this.weapons.active;
    this.hud.update(
      dt,
      {
        weapon: w.def.name,
        mag: w.mag,
        reserve: w.reserve,
        fireMode: w.fireMode,
        action: this.weapons.actionKind,
        stance: this.player.sprinting ? 'sprint' : this.player.crouched ? 'crouch' : 'stand',
        speed: this.player.horizontalSpeed,
        stamina: this.player.stamina.value,
        ads: this.animator.adsBlend,
        hp: this.combat.health.hp,
        maxHp: this.combat.health.max,
        spreadDeg: this.combat.shooting.cone,
        fov: this.camera.fov,
        lastHit: this.combat.lastHit,
      },
      this.fx.dead,
      i.locked || this.paused,
    );
    this.hud.setBoundsWarning(this.fx.dead ? null : this.bounds.remaining);
  }

  render(renderer: Renderer): void {
    renderer.render(this.world.scene, this.camera);
    if (!this.fx.dead) renderer.renderLayer(this.layer.scene, this.layer.camera);
  }

  dispose(): void {
    this.world.dispose();
    this.disarm();
    this.combatSystem.dispose();
    this.hitboxes.dispose();
    this.audio.dispose();
  }

  /** Builds the weapons, their first-person visuals and the combat systems for a loadout. */
  private arm(loadout: Loadout): void {
    this.loadout = { ...loadout };
    this.weapons = new PlayerWeapons(loadout);
    this.animator = new FPAnimator(this.layer, this.weapons, this.audio);
    this.animator.baseFov = this.baseFov;
    this.combat = new RangeCombat(
      this.physics,
      this.combatSystem,
      this.player,
      this.weapons,
      this.audio,
      this.camera,
      (out) => this.animator.muzzleWorld(this.camera, out),
      {
        onHitTarget: (hit) => {
          this.hud.showHitMarker(hit.kill);
          this.events.emit('targetHit', hit);
        },
        onPlayerDamaged: (angle) => {
          this.fx.hit();
          this.hud.hitFlash();
          this.hud.showDamageFrom(angle);
        },
        onPlayerDied: (cause, killer) => {
          this.fx.die();
          this.hitboxes.setEnabled(false);
          this.events.emit('died', { cause, killer });
        },
      },
      this.shooter,
    );
  }

  private disarm(): void {
    this.animator.dispose();
    this.combat.dispose();
  }

  /** ADS is blocked while sprinting, switching weapons and reloading. */
  private get adsAllowed(): boolean {
    const a = this.weapons.actionKind;
    return !this.player.sprinting && a !== 'holster' && a !== 'draw' && a !== 'reload';
  }

  private readInput(): void {
    const i = this.input;
    if (i.locked) this.combat.shooting.onLook(this.player.look(i.mouseDelta.x, i.mouseDelta.y, this.sensitivity));
    const l = this.latched;
    if (i.wasPressed(CONTROLS.crouch)) l.crouch = true;
    if (i.wasPressed(CONTROLS.jump)) l.jump = true;
    if (i.locked && i.wasMousePressed(MOUSE.fire)) l.fire = true;
    if (i.wasPressed(CONTROLS.reload)) l.reload = true;
    if (i.wasPressed(CONTROLS.fireMode)) l.fireMode = true;
    if (i.wasPressed(CONTROLS.inspect)) l.inspect = true;
    if (i.wasPressed(CONTROLS.primary)) l.switchTo = 'primary';
    if (i.wasPressed(CONTROLS.secondary)) l.switchTo = 'secondary';
    if (i.wheelDelta !== 0) l.switchTo = this.weapons.activeSlot === 'primary' ? 'secondary' : 'primary';
    if (i.wasPressed(CONTROLS.debugHit)) this.combat.debugHit();
    if (i.wasPressed(CONTROLS.navDebug)) this.world.toggleNavDebug?.();
    if (i.wasPressed(CONTROLS.debugDeath)) this.kill('suicide');
  }

  private axis(pos: string, neg: string): number {
    return (this.input.isDown(pos) ? 1 : 0) - (this.input.isDown(neg) ? 1 : 0);
  }
}
