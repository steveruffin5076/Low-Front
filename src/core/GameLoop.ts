import { FixedStepClock } from './Time';

export interface LoopCallbacks {
  fixedUpdate(dt: number): void;
  update(dt: number, alpha: number): void;
  render(): void;
}

/** requestAnimationFrame loop: fixed-step simulation, variable-rate render. */
export class GameLoop {
  readonly clock = new FixedStepClock();
  private rafId = 0;
  private lastTime = 0;
  private running = false;

  constructor(private readonly callbacks: LoopCallbacks) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.clock.reset();
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    const steps = this.clock.advance(dt);
    for (let i = 0; i < steps; i++) this.callbacks.fixedUpdate(this.clock.step);
    this.callbacks.update(dt, this.clock.alpha);
    this.callbacks.render();

    this.rafId = requestAnimationFrame(this.frame);
  };
}
