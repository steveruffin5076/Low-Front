import * as THREE from 'three';
import { EventBus } from '../core/EventBus';
import { MOVEMENT } from '../data/player';
import { CharacterMotor } from '../physics/CharacterMotor';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { Stamina, accelerate, approach, jumpVelocity, maxSpeed, shouldSprint } from './PlayerMovement';

/** What the player wants this step. Pressed flags are latched per frame and consumed once. */
export interface PlayerIntent {
  /** −1 (left) to 1 (right). */
  strafe: number;
  /** −1 (back) to 1 (forward). */
  forward: number;
  sprint: boolean;
  /** ADS is held and allowed by the weapon. */
  ads: boolean;
  /** Fire was pressed or held; stops sprint. */
  firing: boolean;
  leanLeft: boolean;
  leanRight: boolean;
  crouchPressed: boolean;
  jumpPressed: boolean;
}

export interface PlayerEvents {
  jumped: Record<string, never>;
  footstep: { crouched: boolean; sprinting: boolean };
  landed: { fallHeight: number; impactSpeed: number };
}

const DEG = Math.PI / 180;
const tmpDelta = new THREE.Vector3();
const tmpRight = new THREE.Vector3();
const tmpHead = new THREE.Vector3();

/** First-person player movement and camera (plan section 9). */
export class PlayerController {
  readonly events = new EventBus<PlayerEvents>();
  readonly stamina = new Stamina();
  readonly motor: CharacterMotor;
  yaw = 0;
  pitch = 0;
  readonly velocity = new THREE.Vector3();
  crouched = false;
  sprinting = false;
  /** 0 standing → 1 crouched, eased over `crouchTransition`. */
  crouchBlend = 0;
  /** −1 full left → 1 full right. */
  lean = 0;
  /** How far the lean may go before a wall (0–1) for each side. */
  private leanRoom = { left: 1, right: 1 };
  private prevFeet = new THREE.Vector3();
  private stepDistance = 0;
  private airPeakY = 0;
  private wasGrounded = true;

  constructor(physics: PhysicsWorld, spawn: THREE.Vector3, groups?: number) {
    this.motor = new CharacterMotor(physics, spawn, groups);
    this.prevFeet.copy(spawn);
  }

  get grounded(): boolean {
    return this.motor.grounded;
  }

  get horizontalSpeed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  /** Mouse look in pixels. Returns the pitch change in radians. */
  look(dx: number, dy: number, sensitivity: number = MOVEMENT.mouseSensitivity): number {
    const maxPitch = MOVEMENT.maxPitchDeg * DEG;
    const before = this.pitch;
    this.yaw -= dx * sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * sensitivity, -maxPitch, maxPitch);
    return this.pitch - before;
  }

  respawn(at: THREE.Vector3, yaw = 0): void {
    this.motor.setHeight(MOVEMENT.standHeight);
    this.motor.teleport(at);
    this.prevFeet.copy(at);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.crouched = false;
    this.crouchBlend = 0;
    this.lean = 0;
    this.sprinting = false;
  }

  fixedUpdate(dt: number, intent: PlayerIntent, weaponSpeedModifier: number): void {
    this.prevFeet.copy(this.motor.feet);
    const grounded = this.motor.grounded;

    // Crouch toggle; sprinting stands the player up.
    if (intent.crouchPressed) this.setCrouched(!this.crouched);
    if (intent.sprint && this.crouched && intent.forward > 0) this.setCrouched(false);
    this.crouchBlend = approach(this.crouchBlend, this.crouched ? 1 : 0, dt / MOVEMENT.crouchTransition);

    // Sprint and stamina.
    const len = Math.hypot(intent.strafe, intent.forward);
    const fwd = len > 0 ? intent.forward / len : 0;
    this.sprinting =
      !this.crouched &&
      shouldSprint({ wantsSprint: intent.sprint, forward: fwd, grounded, ads: intent.ads, firing: intent.firing, canSprint: this.stamina.canSprint });
    this.stamina.update(dt, this.sprinting && this.horizontalSpeed > MOVEMENT.idleSpeed);

    // Horizontal velocity toward the input direction (yaw only).
    const speed = maxSpeed({ sprinting: this.sprinting, crouched: this.crouched, ads: intent.ads }, weaponSpeedModifier);
    const sx = len > 1 ? intent.strafe / len : intent.strafe;
    const sz = len > 1 ? intent.forward / len : intent.forward;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    // Forward is −Z rotated by yaw; right is +X rotated by yaw.
    const tx = (sx * cos - sz * sin) * speed;
    const tz = (-sx * sin - sz * cos) * speed;
    const accel = grounded ? MOVEMENT.groundAccel : MOVEMENT.airAccel;
    [this.velocity.x, this.velocity.z] = accelerate(this.velocity.x, this.velocity.z, tx, tz, accel, dt);

    // Jump and gravity.
    if (intent.jumpPressed && grounded) {
      if (this.crouched) this.setCrouched(false);
      else {
        this.velocity.y = jumpVelocity();
        this.events.emit('jumped', {});
      }
    }
    this.velocity.y -= MOVEMENT.gravity * dt;

    // Standing still on the ground: nothing can move us (the map is static), so skip the
    // collision query. Most bots spend much of the match holding a spot.
    const still = grounded && this.velocity.y <= 0 && Math.hypot(this.velocity.x, this.velocity.z) < MOVEMENT.idleSpeed * 0.1;
    if (still) {
      this.velocity.set(0, 0, 0);
      this.trackFall();
      this.updateLean(dt, intent);
      return;
    }
    tmpDelta.copy(this.velocity).multiplyScalar(dt);
    const moved = this.motor.move(tmpDelta);
    if (this.motor.grounded && this.velocity.y < 0) this.velocity.y = 0;
    // Head hit a ceiling.
    if (this.velocity.y > 0 && moved.y < tmpDelta.y * 0.5) this.velocity.y = 0;

    this.trackSteps(moved);
    this.trackFall();
    this.updateLean(dt, intent);
  }

  /** Places the camera at the eyes, interpolated between fixed steps, with lean roll and shift. */
  updateCamera(camera: THREE.Camera, alpha: number): void {
    const feet = tmpDelta.lerpVectors(this.prevFeet, this.motor.feet, alpha);
    const eye = THREE.MathUtils.lerp(MOVEMENT.standEyeHeight, MOVEMENT.crouchEyeHeight, smooth(this.crouchBlend));
    tmpRight.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const leanEase = Math.sign(this.lean) * smooth(Math.abs(this.lean));
    camera.position.set(feet.x, feet.y + eye, feet.z).addScaledVector(tmpRight, leanEase * MOVEMENT.leanOffset);
    camera.rotation.set(this.pitch, this.yaw, -leanEase * MOVEMENT.leanAngleDeg * DEG, 'YXZ');
  }

  private setCrouched(crouched: boolean): void {
    if (crouched === this.crouched) return;
    if (this.motor.setHeight(crouched ? MOVEMENT.crouchHeight : MOVEMENT.standHeight)) this.crouched = crouched;
  }

  /** Clamps pitch after recoil pushed it past the limit. */
  clampPitch(): void {
    const maxPitch = MOVEMENT.maxPitchDeg * DEG;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -maxPitch, maxPitch);
  }

  private trackSteps(moved: THREE.Vector3): void {
    if (!this.motor.grounded) return;
    this.stepDistance += Math.hypot(moved.x, moved.z);
    if (this.stepDistance >= MOVEMENT.stepDistance) {
      this.stepDistance -= MOVEMENT.stepDistance;
      this.events.emit('footstep', { crouched: this.crouched, sprinting: this.sprinting });
    }
  }

  private trackFall(): void {
    const g = this.motor.grounded;
    const y = this.motor.feet.y;
    if (!g) this.airPeakY = this.wasGrounded ? y : Math.max(this.airPeakY, y);
    if (g && !this.wasGrounded) {
      this.events.emit('landed', { fallHeight: Math.max(0, this.airPeakY - y), impactSpeed: Math.abs(this.velocity.y) });
    }
    this.wasGrounded = g;
  }

  private updateLean(dt: number, intent: PlayerIntent): void {
    let target = (intent.leanRight ? 1 : 0) - (intent.leanLeft ? 1 : 0);
    if (this.sprinting) target = 0;
    // Not leaning and not asked to: no need to look for walls (bots never lean).
    if (target === 0 && this.lean === 0) return;
    // Do not lean the head into a wall.
    const eye = THREE.MathUtils.lerp(MOVEMENT.standEyeHeight, MOVEMENT.crouchEyeHeight, this.crouchBlend);
    tmpHead.set(this.motor.feet.x, this.motor.feet.y + eye, this.motor.feet.z);
    tmpRight.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.leanRoom.right = this.room(tmpHead, tmpRight);
    this.leanRoom.left = this.room(tmpHead, tmpRight.negate());
    target = target > 0 ? Math.min(target, this.leanRoom.right) : Math.max(target, -this.leanRoom.left);
    this.lean = approach(this.lean, target, dt / MOVEMENT.leanTime);
  }

  private room(head: THREE.Vector3, dir: THREE.Vector3): number {
    const reach = MOVEMENT.leanOffset + MOVEMENT.leanWallMargin;
    const hit = this.motor.raycast(head, dir, reach);
    if (hit === null) return 1;
    return THREE.MathUtils.clamp((hit - MOVEMENT.leanWallMargin) / MOVEMENT.leanOffset, 0, 1);
  }
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}
