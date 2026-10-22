import { CONQUEST } from '../data/conquest';
import type { HQDef, TeamId } from '../data/map/types';

/**
 * Enemy HQ rule (plan section 10.5): a soldier inside the other team's HQ gets a 5 s warning,
 * then dies. Leaving cancels the warning. Pure logic, one per soldier.
 */
export class HQZone {
  /** Seconds left, or null while outside every enemy HQ. */
  remaining: number | null = null;

  constructor(
    private readonly hqs: readonly HQDef[],
    private readonly time: number = CONQUEST.hq.enemyWarning,
  ) {}

  /** True when (x, z) is inside an HQ that is not `team`'s. */
  inEnemyHQ(team: TeamId, x: number, z: number): boolean {
    return this.hqs.some((h) => h.team !== team && x >= h.rect.x0 && x <= h.rect.x1 && z >= h.rect.z0 && z <= h.rect.z1);
  }

  update(dt: number, team: TeamId, x: number, z: number): 'safe' | 'warning' | 'expired' {
    if (!this.inEnemyHQ(team, x, z)) {
      this.remaining = null;
      return 'safe';
    }
    this.remaining = Math.max(0, (this.remaining ?? this.time) - dt);
    return this.remaining === 0 ? 'expired' : 'warning';
  }

  reset(): void {
    this.remaining = null;
  }
}
