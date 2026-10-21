/** A screen or mode the game can be in (menu, loadout, match, ...). */
export interface State {
  enter?(): void;
  exit?(): void;
  /** Called at the fixed simulation rate. */
  fixedUpdate?(dt: number): void;
  /** Called once per rendered frame. `alpha` is the interpolation factor between fixed steps. */
  update?(dt: number, alpha: number): void;
}

/** Holds named states and switches between them, calling exit/enter in order. */
export class StateMachine<Name extends string = string> {
  private states = new Map<Name, State>();
  private currentName: Name | null = null;

  add(name: Name, state: State): this {
    this.states.set(name, state);
    return this;
  }

  get current(): Name | null {
    return this.currentName;
  }

  change(name: Name): void {
    const next = this.states.get(name);
    if (!next) throw new Error(`Unknown state: ${name}`);
    if (this.currentName !== null) this.states.get(this.currentName)?.exit?.();
    this.currentName = name;
    next.enter?.();
  }

  fixedUpdate(dt: number): void {
    this.active()?.fixedUpdate?.(dt);
  }

  update(dt: number, alpha: number): void {
    this.active()?.update?.(dt, alpha);
  }

  private active(): State | undefined {
    return this.currentName === null ? undefined : this.states.get(this.currentName);
  }
}
