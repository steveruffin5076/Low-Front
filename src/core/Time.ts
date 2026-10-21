import { ENGINE } from '../data/engine';

/** Fixed-step accumulator. Pure logic, so it can be unit tested without a browser. */
export class FixedStepClock {
  readonly step: number;
  private accumulator = 0;

  constructor(
    hz: number = ENGINE.fixedHz,
    private readonly maxSteps: number = ENGINE.maxStepsPerFrame,
    private readonly maxFrameDelta: number = ENGINE.maxFrameDelta,
  ) {
    this.step = 1 / hz;
  }

  /**
   * Adds a frame delta and returns how many fixed steps to run.
   * Extra time beyond `maxSteps` is dropped so the game slows down instead of freezing.
   */
  advance(frameDelta: number): number {
    this.accumulator += Math.min(Math.max(frameDelta, 0), this.maxFrameDelta);
    let steps = Math.floor(this.accumulator / this.step);
    if (steps > this.maxSteps) {
      steps = this.maxSteps;
      this.accumulator = 0;
    } else {
      this.accumulator -= steps * this.step;
    }
    return steps;
  }

  /** Fraction (0–1) of the next fixed step already elapsed, for render interpolation. */
  get alpha(): number {
    return this.accumulator / this.step;
  }

  reset(): void {
    this.accumulator = 0;
  }
}
