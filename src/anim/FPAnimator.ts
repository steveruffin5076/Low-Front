import * as THREE from 'three';
import type { AudioManager } from '../audio/AudioManager';
import { MOVEMENT } from '../data/player';
import type { Team } from '../data/soldier';
import { VIEWMODEL_MOTION as M } from '../data/viewmodel';
import { approach } from '../entities/PlayerMovement';
import type { ViewmodelLayer } from '../render/ViewmodelLayer';
import { FPEffects } from '../weapons/Effects';
import type { PlayerWeapons } from '../weapons/PlayerWeapons';
import type { WeaponState } from '../weapons/WeaponState';
import { EASE } from './Easing';
import { FPArms } from './FPArms';
import * as clips from './fpClips';
import { Spring } from './Spring';
import { ClipPlayer, type Clip } from './Timeline';
import { WeaponVisual } from './WeaponVisual';

/** Per-frame input from the player for the procedural motion. */
export interface FPFrame {
  dt: number;
  ads: boolean;
  sprinting: boolean;
  crouchBlend: number;
  speed: number;
  grounded: boolean;
  mouseDx: number;
  mouseDy: number;
}

const FADE_TIME = 0.15;
/** Peak of a critically damped spring after an impulse v is v / (w·e). */
const peakToImpulse = (peak: number, w: number): number => peak * w * Math.E;
const tmpPos = new THREE.Vector3();
const tmpRot = new THREE.Vector3();
const tmpMat = new THREE.Matrix4();
const rightFrame = new THREE.Matrix4();
const leftFrame = new THREE.Matrix4();
const ONE = new THREE.Vector3(1, 1, 1);

/**
 * Drives the first-person weapon and arms (plan section 8.1): stance blends (hip, ADS, sprint),
 * procedural motion (breathing, sway, bob, kick, jump), keyframed clips, hand IK and effects.
 */
export class FPAnimator {
  readonly arms: FPArms;
  readonly effects = new FPEffects();
  private readonly weaponRoot = new THREE.Group();
  private readonly visuals = new Map<WeaponState, WeaponVisual>();
  private current: WeaponVisual;
  private action: ClipPlayer | null = null;
  private fire: ClipPlayer | null = null;
  private fading: ClipPlayer[] = [];
  private readonly channels = new Map<string, number[]>();
  private readonly sample = new Map<string, number[]>();

  adsBlend = 0;
  /** Hip-fire field of view (the player's setting). */
  baseFov: number = MOVEMENT.baseFov;
  private sprintBlend = 0;
  private time = 0;
  private bobPhase = 0;
  private readonly kickBack = new Spring(M.kickFrequency);
  private readonly kickUp = new Spring(M.kickFrequency);
  private readonly kickRoll = new Spring(M.kickFrequency);
  private readonly swayX = new Spring(M.sway.frequency);
  private readonly swayY = new Spring(M.sway.frequency);
  private readonly jump = new Spring(M.jump.frequency);
  private pendingShots: { visual: WeaponVisual }[] = [];
  /** Shell-loading clips hold their last pose until the next shell (game logic may run behind the frame). */
  private holdAction = false;
  /** Re-lock the bolt/slide if an empty reload is cancelled before it closes. */
  private relockOnCancel = false;

  constructor(
    layer: ViewmodelLayer,
    weapons: PlayerWeapons,
    private readonly audio: AudioManager,
    team: Team = 'blue',
  ) {
    this.arms = new FPArms(team);
    for (const w of Object.values(weapons.weapons)) {
      const v = new WeaponVisual(w);
      v.model.root.visible = false;
      this.weaponRoot.add(v.model.root);
      this.visuals.set(w, v);
    }
    this.current = this.visuals.get(weapons.active)!;
    layer.scene.add(this.weaponRoot, this.arms.root, this.effects.root);
    this.listen(weapons);
  }

  /** Fully aimed through a scope: the session shows the scope view and hides the weapon. */
  get scoped(): boolean {
    return !!this.current.vm.scope && this.adsBlend > 0.97;
  }

  /** 0–1; firing waits until the weapon is fully out of the sprint pose. */
  get sprintAmount(): number {
    return this.sprintBlend;
  }

  /** Muzzle of the shown weapon in world space (`camera` is the world camera this layer follows). */
  muzzleWorld(camera: THREE.PerspectiveCamera, layerFov: number, out: THREE.Vector3): THREE.Vector3 {
    this.current.model.points.muzzle.getWorldPosition(out);
    // The weapon draws with its own FOV: keep the muzzle at the same spot on screen (same depth)
    // when moving it into the world camera's view.
    const k = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / Math.tan(THREE.MathUtils.degToRad(layerFov) / 2);
    out.x *= k;
    out.y *= k;
    return out.applyMatrix4(camera.matrixWorld);
  }

  /** New life: bolts and slides forward, dust cover closed, no clips. */
  reset(): void {
    for (const v of this.visuals.values()) {
      v.locked = false;
      v.dustCoverOpen = false;
    }
    this.action = null;
    this.holdAction = false;
    this.fire = null;
    this.fading = [];
    this.adsBlend = 0;
    this.sprintBlend = 0;
  }

  onJump(): void {
    this.jump.impulse(peakToImpulse(M.jump.impulse, M.jump.frequency));
  }

  onLand(impactSpeed: number): void {
    const dip = Math.min(M.jump.maxLand, impactSpeed * M.jump.landPerSpeed);
    this.jump.impulse(-peakToImpulse(dip, M.jump.frequency));
  }

  /** Updates everything and returns the camera FOV for this frame. */
  update(f: FPFrame): number {
    const dt = f.dt;
    this.time += dt;
    const v = this.current;
    this.adsBlend = approach(this.adsBlend, f.ads ? 1 : 0, dt / v.weapon.def.adsTime);
    this.sprintBlend = approach(this.sprintBlend, f.sprinting ? 1 : 0, dt / M.sprintBlendTime);
    this.advanceClips(dt);

    // Stance: hip → ADS (sight anchor on the camera) → sprint.
    const e = EASE.inOut(this.adsBlend);
    const s = EASE.inOut(this.sprintBlend);
    const hip = v.vm.hip;
    tmpPos.set(...hip.pos).lerp(new THREE.Vector3(-v.anchor.x, -v.anchor.y, -v.anchor.z), e).lerp(new THREE.Vector3(...v.vm.sprint.pos), s);
    tmpRot.set(...hip.rot).multiplyScalar(1 - e).lerp(new THREE.Vector3(...v.vm.sprint.rot), s);

    this.addProcedural(f, e, s);
    const wp = this.channels.get('weapon.pos');
    const wr = this.channels.get('weapon.rot');
    if (wp) tmpPos.add(new THREE.Vector3(wp[0], wp[1], wp[2]));
    if (wr) tmpRot.add(new THREE.Vector3(wr[0], wr[1], wr[2]));
    this.weaponRoot.position.copy(tmpPos);
    this.weaponRoot.rotation.set(tmpRot.x, tmpRot.y, tmpRot.z);
    v.applyNodes(dt, this.channels);
    this.weaponRoot.updateMatrixWorld(true);

    this.updateHands(v);
    for (const shot of this.pendingShots) this.spawnShotEffects(shot.visual);
    this.pendingShots = [];
    this.effects.update(dt);
    // ADS keeps its zoom ratio when the player changes the base FOV in the settings.
    return THREE.MathUtils.lerp(this.baseFov, (v.vm.adsFov * this.baseFov) / MOVEMENT.baseFov, e);
  }

  /** Frees the rig and takes it out of the weapon layer (a loadout change builds a new one). */
  dispose(): void {
    for (const v of this.visuals.values()) v.dispose();
    this.arms.dispose();
    this.effects.dispose();
    this.weaponRoot.removeFromParent();
    this.arms.root.removeFromParent();
    this.effects.root.removeFromParent();
  }

  private addProcedural(f: FPFrame, e: number, s: number): void {
    const dt = f.dt;
    // Breathing.
    const b = M.breathing;
    const calm = 1 - 0.8 * e;
    tmpPos.y += Math.sin(this.time * b.rate) * b.pos * calm;
    tmpRot.x += Math.sin(this.time * b.rate * 0.5) * b.rot * calm;

    // Mouse sway: the weapon lags behind the look direction.
    const sw = M.sway;
    const sx = this.swayX.update(dt, THREE.MathUtils.clamp(-f.mouseDx * sw.perPixel, -sw.max, sw.max));
    const sy = this.swayY.update(dt, THREE.MathUtils.clamp(-f.mouseDy * sw.perPixel, -sw.max, sw.max));
    const swayScale = 1 - 0.7 * e;
    tmpRot.y += sx * swayScale;
    tmpRot.x += sy * swayScale;
    tmpPos.x += sx * sw.posScale * swayScale;
    tmpPos.y += sy * sw.posScale * swayScale;

    // Walk bob: figure-8 synced to distance travelled.
    const bob = M.bob;
    if (f.grounded) this.bobPhase += ((f.speed * dt) / bob.stride) * Math.PI * 2;
    const k =
      Math.min(f.speed / MOVEMENT.walkSpeed, 1.5) *
      THREE.MathUtils.lerp(1, bob.sprintScale, s) *
      THREE.MathUtils.lerp(1, bob.adsScale, e) *
      THREE.MathUtils.lerp(1, bob.crouchScale, f.crouchBlend) *
      (f.grounded ? 1 : 0);
    tmpPos.x += Math.sin(this.bobPhase) * bob.x * k;
    tmpPos.y += Math.sin(this.bobPhase * 2) * bob.y * k;
    tmpRot.z += Math.sin(this.bobPhase) * bob.roll * k;

    // Kick and jump springs.
    tmpPos.z += this.kickBack.update(dt);
    tmpRot.x += this.kickUp.update(dt);
    tmpRot.z += this.kickRoll.update(dt);
    const j = this.jump.update(dt);
    tmpPos.y += j * M.jump.posScale;
    tmpRot.x += j * M.jump.rotScale;
  }

  private updateHands(v: WeaponVisual): void {
    const world = this.weaponRoot.matrixWorld;
    this.handFrame(world, v.rightGrip, v.handRotation.right, 'rightHand', rightFrame);
    this.handFrame(world, v.leftGrip, v.handRotation.left, 'leftHand', leftFrame);
    this.arms.update(rightFrame, leftFrame);
  }

  /** Grip frame, blended toward the clip's keyed hand position when a clip moves the hand. */
  private handFrame(world: THREE.Matrix4, grip: THREE.Matrix4, rot: THREE.Quaternion, channel: string, out: THREE.Matrix4): void {
    const blend = this.channels.get(`${channel}.blend`)?.[0] ?? 0;
    const target = this.channels.get(`${channel}.pos`);
    if (blend <= 0 || !target) {
      out.multiplyMatrices(world, grip);
      return;
    }
    const gripPos = new THREE.Vector3().setFromMatrixPosition(grip);
    const keyed = new THREE.Vector3(target[0], target[1], target[2]);
    tmpMat.compose(gripPos.lerp(keyed, EASE.inOut(Math.min(1, blend))), rot, ONE);
    out.multiplyMatrices(world, tmpMat);
  }

  private spawnShotEffects(v: WeaponVisual): void {
    if (v !== this.current) return;
    this.effects.muzzleFlash(v.model.points.muzzle, v.weapon.def.slot === 'secondary' ? 0.7 : 1);
    // A manual action throws the case out when it is worked, not on the shot.
    if (!v.weapon.def.action.manual) this.effects.ejectShell(v.weapon.def.id, v.model.points.ejectionPort);
  }

  // --- Clips ---

  private play(slot: 'action' | 'fire', clip: Clip): void {
    const old = this[slot];
    if (slot === 'action') this.holdAction = false;
    if (old && !old.done) this.fade(old);
    this[slot] = new ClipPlayer(clip);
  }

  /** Replaces a clip with no blend: for clips that start where the previous one ends. */
  private swap(slot: 'action' | 'fire', clip: Clip, hold = false): void {
    if (slot === 'action') this.holdAction = hold;
    this[slot] = new ClipPlayer(clip);
  }

  private stop(slot: 'action' | 'fire'): void {
    const p = this[slot];
    if (slot === 'action') this.holdAction = false;
    if (p) this.fade(p);
    this[slot] = null;
  }

  private fade(p: ClipPlayer): void {
    this.fading.push(p);
  }

  private advanceClips(dt: number): void {
    const onEvent = (name: string): void => this.onClipEvent(name);
    this.action?.update(dt, onEvent);
    this.fire?.update(dt, onEvent);
    if (this.action?.done && !this.holdAction) this.action = null;
    if (this.fire?.done) this.fire = null;
    for (const p of this.fading) p.weight -= dt / FADE_TIME;
    this.fading = this.fading.filter((p) => p.weight > 0);

    // Sum channels from all clips, weighted. Hand targets come from the strongest clip.
    this.channels.clear();
    for (const p of [this.action, this.fire, ...this.fading]) {
      if (!p) continue;
      this.sample.clear();
      p.sample(this.sample);
      for (const [ch, val] of this.sample) {
        const out = this.channels.get(ch);
        if (ch === 'mag.visible') {
          // Hidden if any clip that is still mostly playing hides it.
          if (val[0] < 0.5 && p.weight > 0.5) this.channels.set(ch, [0]);
          else if (!out) this.channels.set(ch, [1]);
        } else if (ch.endsWith('Hand.pos')) {
          if (!out) this.channels.set(ch, [...val]);
        } else if (out) {
          for (let i = 0; i < val.length; i++) out[i] += val[i] * p.weight;
        } else {
          this.channels.set(ch, val.map((x) => x * p.weight));
        }
      }
    }
  }

  private onClipEvent(name: string): void {
    const v = this.current;
    if (name === 'lock') v.locked = true;
    if (name === 'slideClose') {
      this.relockOnCancel = false;
      this.audio.play('boltClose');
    }
    if (name === 'click') this.audio.play(this.action?.clip.name === 'fireMode' ? 'selector' : 'dryFire');
    if (name === 'magOut') this.audio.play('magOut');
    if (name === 'magIn') this.audio.play('magIn');
    if (name === 'boltOpen') this.audio.play('cycleBack');
    if (name === 'cycleBack') {
      this.audio.play('cycleBack');
      this.effects.ejectShell(v.weapon.def.id, v.model.points.ejectionPort);
    }
  }

  private listen(weapons: PlayerWeapons): void {
    const ev = weapons.events;
    ev.on('drawStart', ({ weapon, duration }) => {
      for (const v of this.visuals.values()) v.model.root.visible = v.weapon === weapon;
      this.current = this.visuals.get(weapon)!;
      this.arms.setLeftStyle(this.current.vm.leftHand);
      this.fading = [];
      this.fire = null;
      this.holdAction = false;
      this.action = new ClipPlayer(clips.drawClip(duration));
    });
    ev.on('holsterStart', ({ duration }) => this.play('action', clips.holsterClip(duration)));
    ev.on('fired', ({ weapon, lastRound }) => {
      const v = this.visuals.get(weapon)!;
      this.play('fire', clips.fireClip(v.ctx, lastRound));
      if (weapon.def.action.dustCover) v.dustCoverOpen = true;
      const k = v.vm.kick;
      const scale = 1 - 0.5 * this.adsBlend;
      this.kickBack.impulse(peakToImpulse(k.back * scale, M.kickFrequency));
      this.kickUp.impulse(peakToImpulse(k.up * scale, M.kickFrequency));
      this.kickRoll.impulse(peakToImpulse(k.roll * (Math.random() - 0.5) * 2, M.kickFrequency));
      this.pendingShots.push({ visual: v });
    });
    ev.on('dryFire', ({ weapon }) => this.play('fire', clips.dryFireClip(this.visuals.get(weapon)!.ctx)));
    ev.on('reloadStart', ({ weapon, kind }) => {
      const v = this.visuals.get(weapon)!;
      if (weapon.def.reloadMode === 'shell') {
        this.play('action', clips.shellStartClip(v.ctx));
        this.holdAction = true;
        return;
      }
      const locked = v.locked;
      this.relockOnCancel = locked;
      v.locked = false;
      this.play('action', clips.reloadClip(v.ctx, kind, locked));
    });
    ev.on('shellIn', ({ weapon, more }) => {
      const v = this.visuals.get(weapon)!;
      this.swap('action', more ? clips.shellInsertClip(v.ctx) : clips.shellEndClip(v.ctx), more);
    });
    ev.on('reloadEnd', () => {
      // Firing stopped a shell reload part way: blend back to the hip.
      const name = this.action?.clip.name;
      if (name === 'shellStart' || name === 'shellInsert') this.stop('action');
    });
    ev.on('reloadCancel', ({ weapon }) => {
      this.stop('action');
      if (this.relockOnCancel) this.visuals.get(weapon)!.locked = true;
      this.relockOnCancel = false;
    });
    ev.on('fireModeChanged', ({ duration }) => this.play('action', clips.fireModeClip(duration)));
    ev.on('inspectStart', ({ duration }) => this.play('action', clips.inspectClip(duration)));
    ev.on('inspectEnd', () => {
      if (this.action?.clip.name === 'inspect') this.stop('action');
    });
  }
}
