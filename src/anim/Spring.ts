/** Critically damped spring, used for kick, landing dip and sway. Exact at any time step. */
export class Spring {
  value = 0;
  velocity = 0;

  constructor(
    /** Higher is stiffer (returns faster). */
    private readonly frequency: number,
  ) {}

  impulse(v: number): void {
    this.velocity += v;
  }

  update(dt: number, target = 0): number {
    const w = this.frequency;
    // Closed form of x'' = w²(target − x) − 2w·x' over dt.
    const x0 = this.value - target;
    const v0 = this.velocity;
    const c = v0 + w * x0;
    const e = Math.exp(-w * dt);
    this.value = target + (x0 + c * dt) * e;
    this.velocity = (v0 - w * c * dt) * e;
    return this.value;
  }
}
