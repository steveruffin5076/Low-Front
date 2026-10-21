import * as THREE from 'three';
import { FPAnimator } from '../anim/FPAnimator';
import { CameraFx } from '../anim/CameraFx';
import { AudioManager } from '../audio/AudioManager';
import type { Input } from '../core/Input';
import { CONTROLS, MOUSE } from '../data/controls';
import { MOVEMENT } from '../data/player';
import type { Loadout, WeaponSlot } from '../data/weapons';
import { PlayerController, type PlayerIntent } from '../entities/PlayerController';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { Renderer } from '../render/Renderer';
import { ViewmodelLayer } from '../render/ViewmodelLayer';
import { RangeOverlay } from '../ui/RangeOverlay';
import { PlayerWeapons, type WeaponInput } from '../weapons/PlayerWeapons';
import { RangeCombat } from './RangeCombat';
import { OutOfBounds } from '../game/OutOfBounds';
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

/** A play session in a world: player movement, weapons, animations, combat and bounds. */
export class PlaySession {
  readonly player: PlayerController;
  readonly weapons: PlayerWeapons;
  readonly camera = new THREE.PerspectiveCamera(MOVEMENT.baseFov, 1, 0.05, 400);
  private readonly layer = new ViewmodelLayer();
  private readonly animator: FPAnimator;
  private readonly audio = new AudioManager();
  private readonly fx = new CameraFx();
  private readonly overlay = new RangeOverlay();
  private readonly bounds = new OutOfBounds();
  private latched: Latched = { ...NONE };
  private readonly combat: RangeCombat;

  constructor(
    physics: PhysicsWorld,
    private readonly input: Input,
    loadout: Loadout,
    readonly world: World,
  ) {
    this.player = new PlayerController(physics, world.spawn.position.clone());
    this.player.yaw = world.spawn.yaw;
    this.weapons = new PlayerWeapons(loadout);
    this.animator = new FPAnimator(this.layer, this.weapons, this.audio);
    this.player.events.on('jumped', () => this.animator.onJump());
    this.player.events.on('landed', ({ impactSpeed }) => this.animator.onLand(impactSpeed));
    this.combat = new RangeCombat(
      physics,
      world.scene,
      this.player,
      this.weapons,
      this.audio,
      this.camera,
      (out) => this.animator.muzzleWorld(this.camera, out),
      {
        onHitTarget: (kill) => this.overlay.showHitMarker(kill),
        onPlayerDamaged: (angle) => {
          this.fx.hit();
          this.overlay.hitFlash();
          this.overlay.showDamageFrom(angle);
        },
        onPlayerDied: () => this.fx.die(),
      },
    );
    this.weapons.start();
  }

  mount(parent: HTMLElement): void {
    parent.append(this.overlay.element);
  }

  fixedUpdate(dt: number): void {
    if (this.fx.dead) return;
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
    this.combat.fixedUpdate(dt);
    if (this.world.limit !== null) {
      const feet = this.player.motor.feet;
      if (this.bounds.update(dt, feet.x, feet.z) === 'expired') this.combat.damagePlayer(this.combat.health.max, null);
    }
    this.latched = { ...NONE };
  }

  update(dt: number, alpha: number): void {
    const i = this.input;
    if (!this.fx.dead) this.readInput();
    else if (this.fx.deathFinished) this.respawn();

    this.player.updateCamera(this.camera, alpha);
    const eye = this.camera.position.y - this.player.motor.feet.y;
    this.fx.apply(this.camera, dt, eye);
    this.camera.updateMatrixWorld();
    this.audio.setListener(this.camera);
    this.world.follow(this.player.motor.feet);
    this.world.update(dt, this.camera);
    this.combat.update(dt, alpha);

    this.combat.shooting.ads = this.animator.adsBlend;
    const fov = this.animator.update({
      dt,
      ads: !this.fx.dead && this.adsAllowed && i.locked && i.isMouseDown(MOUSE.ads),
      sprinting: this.player.sprinting,
      crouchBlend: this.player.crouchBlend,
      speed: this.player.horizontalSpeed,
      grounded: this.player.grounded,
      mouseDx: i.locked ? i.mouseDelta.x : 0,
      mouseDy: i.locked ? i.mouseDelta.y : 0,
    });
    if (this.camera.fov !== fov) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    this.layer.setFov(fov);

    const w = this.weapons.active;
    this.overlay.update(
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
      i.locked,
    );
    this.overlay.setBoundsWarning(this.fx.dead ? null : this.bounds.remaining);
  }

  render(renderer: Renderer): void {
    renderer.render(this.world.scene, this.camera);
    if (!this.fx.dead) renderer.renderLayer(this.layer.scene, this.layer.camera);
  }

  dispose(): void {
    this.world.dispose();
    this.animator.dispose();
    this.combat.dispose();
    this.audio.dispose();
  }

  /** ADS is blocked while sprinting, switching weapons and reloading. */
  private get adsAllowed(): boolean {
    const a = this.weapons.actionKind;
    return !this.player.sprinting && a !== 'holster' && a !== 'draw' && a !== 'reload';
  }

  private readInput(): void {
    const i = this.input;
    if (i.locked) this.combat.shooting.onLook(this.player.look(i.mouseDelta.x, i.mouseDelta.y));
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
    if (i.wasPressed(CONTROLS.debugDeath)) this.combat.damagePlayer(this.combat.health.max, null);
  }

  private respawn(): void {
    this.fx.reset();
    this.player.respawn(this.world.spawn.position.clone(), this.world.spawn.yaw);
    this.bounds.reset();
    this.animator.reset();
    this.combat.reset();
    this.weapons.start();
  }

  private axis(pos: string, neg: string): number {
    return (this.input.isDown(pos) ? 1 : 0) - (this.input.isDown(neg) ? 1 : 0);
  }
}
