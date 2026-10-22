import * as THREE from 'three';
import { DIFFICULTIES, DIFFICULTY, type DifficultyPreset } from '../data/bots';
import { spreadDirection } from '../weapons/Spread';

/**
 * How a bot aims and fires (plan section 12): an error cone that shrinks while it keeps
 * tracking the same target, the torso with a small chance of the head, a reaction delay
 * before the first shot, and bursts with pauses. `rand` is injectable for tests.
 */
export class BotAim {
  /** Seconds the current target has been tracked. */
  trackTime = 0;
  targetId: string | null = null;
  /** Aiming at the head for this burst. */
  head = false;
  /** Rounds left in the current burst, and the pause before the next one. */
  burstLeft = 0;
  pause = 0;
  /** Reaction delay for the current target. */
  reaction = 0;
  private readonly offset = new THREE.Vector3();

  constructor(
    private readonly preset: DifficultyPreset = DIFFICULTIES[DIFFICULTY],
    private readonly rand: () => number = Math.random,
  ) {}

  /** Error cone half-angle in degrees right now. */
  get error(): number {
    const p = this.preset;
    const k = Math.min(1, this.trackTime / p.aimSettle);
    return THREE.MathUtils.lerp(p.aimError.start, p.aimError.min, k);
  }

  /** Call every frame with the target being engaged (null when none). */
  track(dt: number, targetId: string | null): void {
    if (targetId !== this.targetId) {
      this.targetId = targetId;
      this.trackTime = 0;
      this.burstLeft = 0;
      this.pause = 0;
      const r = this.preset.reaction;
      this.reaction = r.min + (r.max - r.min) * this.rand();
      return;
    }
    if (targetId) this.trackTime += dt;
    this.pause = Math.max(0, this.pause - dt);
  }

  /** The bot may shoot: target held past the reaction time and not between bursts. */
  get ready(): boolean {
    return this.targetId !== null && this.trackTime >= this.reaction && this.pause === 0;
  }

  /**
   * The point to aim at: chest (or head for this burst), offset by the error cone as seen from
   * `eye`. Writes the unit aim direction into `out`.
   */
  aim(eye: THREE.Vector3, chest: THREE.Vector3, headPos: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    this.offset.subVectors(this.head ? headPos : chest, eye).normalize();
    return spreadDirection(this.offset, this.error, out, this.rand);
  }

  /** A round was fired; returns true when the burst ends (the caller releases the trigger). */
  shot(): boolean {
    if (this.burstLeft <= 0) this.startBurst();
    this.burstLeft--;
    if (this.burstLeft > 0) return false;
    const p = this.preset.burstPause;
    this.pause = p.min + (p.max - p.min) * this.rand();
    return true;
  }

  /** Fraction of each shot's recoil the bot pulls back down. */
  get recoilControl(): number {
    return this.preset.recoilControl;
  }

  private startBurst(): void {
    const b = this.preset.burst;
    this.burstLeft = Math.round(b.min + (b.max - b.min) * this.rand());
    this.head = this.rand() < this.preset.headChance;
  }
}
