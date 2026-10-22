import { AIM_SPLIT, AIR, CROUCH, DEATH, FIRE_KICK, GAIT, HOLDS, SOLDIER_DIMENSIONS, type HoldPose } from '../data/soldier';
import { WEAPON_TIMING } from '../data/weaponTiming';
import type { WeaponSlot } from '../data/weapons';
import { EASE } from './Easing';
import { SOLDIER_RELOAD } from './soldierClips';
import { ClipPlayer } from './Timeline';

export type Euler3 = [number, number, number];

/** Body bones the animator rotates (XYZ Euler, radians, in the parent bone's frame). */
export const POSE_BONES = ['root', 'hips', 'spine', 'chest', 'neck', 'head', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'] as const;
export type PoseBone = (typeof POSE_BONES)[number];

/** What the soldier is doing this frame. */
export interface SoldierInput {
  /** Velocity in the soldier's frame (m/s): +right, +forward. */
  moveRight: number;
  moveForward: number;
  crouched: boolean;
  sprinting: boolean;
  grounded: boolean;
  /** m/s, positive up. */
  verticalSpeed: number;
  /** Aim pitch in radians, positive up. */
  pitch: number;
}

export const IDLE_INPUT: SoldierInput = { moveRight: 0, moveForward: 0, crouched: false, sprinting: false, grounded: true, verticalSpeed: 0, pitch: 0 };

/** Output of the animator; `SoldierRig` applies it to the skeleton. */
export interface SoldierPose {
  rot: Record<PoseBone, Euler3>;
  /** Hips height above the feet. */
  hipsY: number;
  /** Extra root lift (a body lying on the ground). */
  rootY: number;
  /** Weapon hold in the chest frame. */
  hold: HoldPose;
  /** The weapon in the hands. */
  active: WeaponSlot;
  /** 0 = in the hands, 1 = stowed (sling or holster), during a weapon switch. */
  stow: number;
  /** 0–1 fire kick. */
  kick: number;
  /** Left hand: 0 = support grip, 1 = magazine; then 0–1 toward the vest pouch. */
  toMag: number;
  toPouch: number;
  /** The magazine travels with the left hand. */
  magInHand: boolean;
  /** 0 = alive and up, 1 = lying on the ground. */
  death: number;
  opacity: number;
}

/** Hips height for leg angles (thigh from vertical, shin relative to the thigh), feet on the ground. */
export function legHeight(thigh: number, shin: number): number {
  const L = SOLDIER_DIMENSIONS.leg;
  return L.thigh * Math.cos(thigh) + L.shin * Math.cos(thigh + shin) + L.ankle + 0.03;
}

interface Tier {
  stride: number;
  swing: number;
  knee: number;
  bob: number;
  lean: number;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const approach = (v: number, target: number, rate: number): number => (v < target ? Math.min(target, v + rate) : Math.max(target, v - rate));

function tierAt(speed: number): Tier {
  const pick = (k: 'walk' | 'run' | 'sprint'): Tier => ({ stride: GAIT.stride[k], swing: GAIT.swing[k], knee: GAIT.knee[k], bob: GAIT.bob[k], lean: GAIT.lean[k] });
  const mix = (a: Tier, b: Tier, t: number): Tier => ({
    stride: lerp(a.stride, b.stride, t),
    swing: lerp(a.swing, b.swing, t),
    knee: lerp(a.knee, b.knee, t),
    bob: lerp(a.bob, b.bob, t),
    lean: lerp(a.lean, b.lean, t),
  });
  if (speed <= GAIT.walkSpeed) {
    const t = pick('walk');
    const s = Math.min(1, speed / GAIT.walkSpeed);
    return { ...t, swing: t.swing * s, knee: t.knee * s, bob: t.bob * s, lean: t.lean * s };
  }
  if (speed <= GAIT.runSpeed) return mix(pick('walk'), pick('run'), (speed - GAIT.walkSpeed) / (GAIT.runSpeed - GAIT.walkSpeed));
  return mix(pick('run'), pick('sprint'), Math.min(1, (speed - GAIT.runSpeed) / (GAIT.sprintSpeed - GAIT.runSpeed)));
}

function mixHold(a: HoldPose, b: HoldPose, t: number): HoldPose {
  return {
    pos: [lerp(a.pos[0], b.pos[0], t), lerp(a.pos[1], b.pos[1], t), lerp(a.pos[2], b.pos[2], t)],
    rot: [lerp(a.rot[0], b.rot[0], t), lerp(a.rot[1], b.rot[1], t), lerp(a.rot[2], b.rot[2], t)],
    chestYaw: lerp(a.chestYaw, b.chestYaw, t),
  };
}

/**
 * Procedural third-person animation (plan section 8.2): locomotion from the velocity (walk, run,
 * sprint, crouch, strafe, backpedal), aim pitch, jump and fall, fire kick, reload, weapon switch
 * and death. Pure logic: no Three.js objects, so it is unit tested.
 */
export class SoldierAnimator {
  /** Gait cycle phase in radians; advances with distance so the feet do not slide. */
  phase = 0;
  crouchBlend = 0;
  sprintBlend = 0;
  airBlend = 0;
  moveBlend = 0;
  active: WeaponSlot = 'primary';
  private time = 0;
  private kick = 0;
  private reloadClip: ClipPlayer | null = null;
  private readonly channels = new Map<string, number[]>();
  private magInHand = false;
  private switchTime = -1;
  private switchHolster = 0;
  private switchTotal = 0;
  private deathTime = -1;
  private deathHeading = 0;
  readonly pose: SoldierPose = {
    rot: Object.fromEntries(POSE_BONES.map((b) => [b, [0, 0, 0]])) as unknown as Record<PoseBone, Euler3>,
    hipsY: SOLDIER_DIMENSIONS.hipHeight,
    rootY: 0,
    hold: HOLDS.rifle,
    active: 'primary',
    stow: 0,
    kick: 0,
    toMag: 0,
    toPouch: 0,
    magInHand: false,
    death: 0,
    opacity: 1,
  };

  get dead(): boolean {
    return this.deathTime >= 0;
  }

  get reloading(): boolean {
    return this.reloadClip !== null;
  }

  get switching(): boolean {
    return this.switchTime >= 0;
  }

  /** True once the body has faded out after death. */
  get gone(): boolean {
    return this.dead && this.deathTime >= DEATH.fallTime + DEATH.stayTime + DEATH.fadeTime;
  }

  fire(): void {
    if (!this.dead && !this.switching) this.kick = 1;
  }

  /** Starts a reload that lasts `duration` seconds (the weapon's reload time). */
  reload(duration: number): void {
    if (this.dead || this.switching || this.reloading) return;
    this.reloadClip = new ClipPlayer(SOLDIER_RELOAD, 1 / duration);
  }

  /** Holsters the weapon in the hands and draws the other one. */
  switchWeapon(): void {
    if (this.dead || this.switching) return;
    this.reloadClip = null;
    this.magInHand = false;
    const next: WeaponSlot = this.active === 'primary' ? 'secondary' : 'primary';
    this.switchTime = 0;
    this.switchHolster = WEAPON_TIMING.holster[this.active];
    this.switchTotal = this.switchHolster + WEAPON_TIMING.draw[next];
  }

  /** Dies and falls toward `heading` (soldier frame: 0 = forward, π/2 = right, π = backward). */
  die(heading: number): void {
    if (this.dead) return;
    this.deathTime = 0;
    this.deathHeading = heading;
    this.reloadClip = null;
    this.magInHand = false;
    this.switchTime = -1;
  }

  /** Back to a standing, idle, living soldier with the primary drawn. */
  reset(): void {
    this.deathTime = -1;
    this.reloadClip = null;
    this.magInHand = false;
    this.switchTime = -1;
    this.active = 'primary';
    this.kick = 0;
    this.crouchBlend = this.sprintBlend = this.airBlend = this.moveBlend = 0;
  }

  /** Seconds since death, or −1. */
  get deathClock(): number {
    return this.deathTime;
  }

  /** The heading the body falls toward. */
  get fallHeading(): number {
    return this.deathHeading;
  }

  update(dt: number, input: SoldierInput): SoldierPose {
    this.time += dt;
    if (this.deathTime >= 0) this.deathTime += dt;
    const p = this.pose;
    const rate = dt / GAIT.blendTime;
    const speed = Math.hypot(input.moveRight, input.moveForward);
    const alive = !this.dead;
    this.crouchBlend = approach(this.crouchBlend, alive && input.crouched ? 1 : 0, rate);
    this.sprintBlend = approach(this.sprintBlend, alive && input.sprinting && speed > GAIT.runSpeed * 0.8 && !this.reloading ? 1 : 0, rate);
    this.airBlend = approach(this.airBlend, alive && !input.grounded ? 1 : 0, rate);
    this.moveBlend = approach(this.moveBlend, alive && speed > GAIT.idleSpeed && input.grounded ? 1 : 0, rate);

    // Gait: one cycle per stride; the tier sets amplitude, crouch scales it down.
    const standing = tierAt(speed);
    const crouch: Tier = { stride: GAIT.stride.crouch, swing: GAIT.swing.crouch, knee: GAIT.knee.crouch, bob: GAIT.bob.crouch, lean: GAIT.lean.crouch };
    const c = this.crouchBlend;
    const tier: Tier = {
      stride: lerp(standing.stride, crouch.stride, c),
      swing: lerp(standing.swing, crouch.swing * Math.min(1, speed / GAIT.walkSpeed), c),
      knee: lerp(standing.knee, crouch.knee * Math.min(1, speed / GAIT.walkSpeed), c),
      bob: lerp(standing.bob, crouch.bob, c),
      lean: lerp(standing.lean, crouch.lean, c),
    };
    if (alive && input.grounded) this.phase = (this.phase + (speed * dt * Math.PI * 2) / tier.stride) % (Math.PI * 2);
    const move = this.moveBlend;
    const heading = speed > GAIT.idleSpeed ? Math.atan2(input.moveRight, input.moveForward) : 0;
    const fwd = Math.cos(heading);
    const side = Math.sin(heading);

    const r = p.rot;
    for (const b of POSE_BONES) r[b][0] = r[b][1] = r[b][2] = 0;
    // Base leg angles: standing straight, or the crouch pose.
    const base = { thighL: CROUCH.thighL * c, shinL: CROUCH.shinL * c, thighR: CROUCH.thighR * c, shinR: CROUCH.shinR * c };
    for (const [thigh, shin, foot, offset] of [['thighL', 'shinL', 'footL', 0], ['thighR', 'shinR', 'footR', Math.PI]] as const) {
      const ph = this.phase + offset;
      const swing = Math.sin(ph) * tier.swing * move;
      const knee = Math.max(0, Math.cos(ph)) * tier.knee * move;
      r[thigh][0] = base[thigh] + swing * fwd;
      r[thigh][2] = swing * side * 0.7;
      r[shin][0] = base[shin] - knee;
      r[foot][0] = -(r[thigh][0] + r[shin][0]) * 0.7;
    }
    // Air: legs tuck while rising, reach down while falling.
    const air = input.verticalSpeed > AIR.risingSpeed ? AIR.rising : AIR.falling;
    for (const [thigh, shin] of [['thighL', 'shinL'], ['thighR', 'shinR']] as const) {
      r[thigh][0] = lerp(r[thigh][0], air.thigh, this.airBlend);
      r[shin][0] = lerp(r[shin][0], air.shin, this.airBlend);
    }
    const crouchHips = legHeight(CROUCH.thighL, CROUCH.shinL);
    const bob = tier.bob * move * (0.5 - 0.5 * Math.cos(this.phase * 2));
    p.hipsY = lerp(SOLDIER_DIMENSIONS.hipHeight, crouchHips, c) - bob;
    r.hips[1] = Math.sin(this.phase) * 0.1 * tier.swing * move * fwd;

    // Upper body: lean, breathing, aim pitch shared over spine, chest and neck; the rifle stance turns the chest.
    const kind = this.active === 'primary' ? 'rifle' : 'pistol';
    p.hold = mixHold(HOLDS[kind], HOLDS[kind === 'rifle' ? 'rifleSprint' : 'pistolSprint'], this.sprintBlend);
    const pitch = input.pitch * (1 - this.sprintBlend * 0.7);
    const breath = Math.sin(this.time * GAIT.breathRate) * GAIT.breathAngle * (1 - move);
    r.spine[0] = -tier.lean * move - CROUCH.spineLean * c + pitch * AIM_SPLIT.spine;
    r.spine[1] = p.hold.chestYaw * 0.4 - r.hips[1];
    r.chest[0] = pitch * AIM_SPLIT.chest + breath;
    r.chest[1] = p.hold.chestYaw * 0.6;
    r.neck[0] = pitch * AIM_SPLIT.neck + tier.lean * move + CROUCH.spineLean * c * 0.8;
    r.neck[1] = -p.hold.chestYaw;

    this.updateActions(dt);
    this.updateDeath();
    return p;
  }

  private updateActions(dt: number): void {
    const p = this.pose;
    this.kick *= Math.exp(-FIRE_KICK.recover * dt);
    p.kick = this.kick;
    p.toMag = p.toPouch = 0;
    if (this.reloadClip) {
      this.reloadClip.update(dt, (e) => {
        if (e === 'magOut') this.magInHand = true;
        if (e === 'magIn') this.magInHand = false;
      });
      this.reloadClip.sample(this.channels);
      p.toMag = this.channels.get('toMag')?.[0] ?? 0;
      p.toPouch = this.channels.get('toPouch')?.[0] ?? 0;
      if (this.reloadClip.done) this.reloadClip = null;
    }
    p.magInHand = this.magInHand;
    p.stow = 0;
    if (this.switchTime >= 0) {
      const before = this.switchTime;
      this.switchTime += dt;
      if (before < this.switchHolster && this.switchTime >= this.switchHolster) this.active = this.active === 'primary' ? 'secondary' : 'primary';
      const t = this.switchTime;
      p.stow = t < this.switchHolster ? EASE.inOut(t / this.switchHolster) : 1 - EASE.inOut(Math.min(1, (t - this.switchHolster) / (this.switchTotal - this.switchHolster)));
      if (t >= this.switchTotal) this.switchTime = -1;
    }
    p.active = this.active;
  }

  private updateDeath(): void {
    const p = this.pose;
    p.death = 0;
    p.rootY = 0;
    p.opacity = 1;
    if (this.deathTime < 0) return;
    const t = this.deathTime;
    const fall = EASE.in(Math.min(1, t / DEATH.fallTime));
    p.death = fall;
    p.rootY = DEATH.lieLift * fall;
    // Knees buckle during the fall, then the legs lie straight.
    const buckle = Math.sin(Math.PI * Math.min(1, t / DEATH.fallTime));
    const r = p.rot;
    r.thighL[0] = r.thighR[0] = 0.6 * buckle;
    r.shinL[0] = r.shinR[0] = -1.1 * buckle;
    r.thighL[2] = r.thighR[2] = 0;
    r.spine[0] = r.chest[0] = r.neck[0] = 0;
    // Tip the root over toward the fall heading, with a twist from its sideways part.
    const h = this.deathHeading;
    const tip = (Math.PI / 2) * fall;
    r.root[0] = -Math.cos(h) * tip;
    r.root[2] = -Math.sin(h) * tip;
    r.root[1] = Math.sin(h) * DEATH.twist * fall;
    p.hipsY = lerp(p.hipsY, SOLDIER_DIMENSIONS.hipHeight, fall);
    p.hold = mixHold(p.hold, HOLDS.dead, Math.min(1, t / DEATH.fallTime));
    r.neck[1] = r.chest[1] = r.spine[1] = 0;
    const fadeStart = DEATH.fallTime + DEATH.stayTime;
    p.opacity = t <= fadeStart ? 1 : Math.max(0, 1 - (t - fadeStart) / DEATH.fadeTime);
  }
}
