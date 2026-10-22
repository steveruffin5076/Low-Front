import { EventBus } from '../core/EventBus';
import { HEALTH } from '../data/player';

export interface HealthEvents {
  damaged: { amount: number; hp: number };
  died: Record<string, never>;
}

/** Hit points with delayed regeneration (plan section 9). */
export class Health {
  readonly events = new EventBus<HealthEvents>();
  hp: number;
  private sinceDamage = Infinity;

  constructor(
    readonly max: number = HEALTH.max,
    private readonly regenDelay: number = HEALTH.regenDelay,
    private readonly regenRate: number = HEALTH.regenRate,
  ) {
    this.hp = max;
  }

  get dead(): boolean {
    return this.hp <= 0;
  }

  /** Returns true if this damage killed. */
  damage(amount: number): boolean {
    if (this.dead || amount <= 0) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.sinceDamage = 0;
    this.events.emit('damaged', { amount, hp: this.hp });
    if (this.hp === 0) {
      this.events.emit('died', {});
      return true;
    }
    return false;
  }

  update(dt: number): void {
    if (this.dead) return;
    this.sinceDamage += dt;
    // Only the part of this step that is past the delay counts.
    const regenTime = Math.min(dt, this.sinceDamage - this.regenDelay);
    if (regenTime > 0) this.hp = Math.min(this.max, this.hp + this.regenRate * regenTime);
  }

  reset(): void {
    this.hp = this.max;
    this.sinceDamage = Infinity;
  }
}

/** Fall damage for a fall of `height` meters. */
export function fallDamage(height: number): number {
  return Math.max(0, height - HEALTH.fallThreshold) * HEALTH.fallDamagePerMeter;
}
