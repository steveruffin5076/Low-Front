import { MAP } from '../data/map/config';

export type BoundsState = 'inside' | 'warning' | 'expired';

/**
 * Out-of-bounds countdown (plan section 10.1): leaving the playable square starts a warning;
 * coming back cancels it; when it runs out the player dies.
 */
export class OutOfBounds {
  /** Seconds left, or null while inside. */
  remaining: number | null = null;

  constructor(
    private readonly half: number = MAP.half,
    private readonly time: number = MAP.outOfBoundsTime,
  ) {}

  update(dt: number, x: number, z: number): BoundsState {
    if (Math.abs(x) <= this.half && Math.abs(z) <= this.half) {
      this.remaining = null;
      return 'inside';
    }
    this.remaining = Math.max(0, (this.remaining ?? this.time) - dt);
    return this.remaining === 0 ? 'expired' : 'warning';
  }

  reset(): void {
    this.remaining = null;
  }
}
