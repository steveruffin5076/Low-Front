import { debugFlag } from './debugFlags';
/** Keyboard and mouse state with Pointer Lock. Read state each frame, then call `endFrame()`. */
export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private released = new Set<string>();
  private buttons = new Set<number>();
  private buttonsPressed = new Set<number>();
  private dx = 0;
  private dy = 0;
  private wheel = 0;

  /** When true, clicking the canvas locks the mouse. Only the match enables this. */
  lockOnClick = false;
  /** Called when Pointer Lock ends (Esc, Alt+Tab): the match opens the Pause Menu. */
  onLockLost: (() => void) | null = null;
  private wasLocked = false;

  constructor(private readonly target: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    target.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('wheel', this.onWheel, { passive: true });
    target.addEventListener('click', this.requestLock);
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', this.onLockChange);
  }

  /**
   * Dev only (`?debug=freemouse`): treat the mouse as locked without Pointer Lock,
   * for automated browser checks where Pointer Lock is not available.
   */
  private readonly freeMouse = debugFlag('freemouse');

  get locked(): boolean {
    return document.pointerLockElement === this.target || (this.freeMouse && this.lockOnClick);
  }

  requestLock = (): void => {
    if (this.lockOnClick && !this.locked) void this.target.requestPointerLock()?.catch?.(() => undefined);
  };

  exitLock(): void {
    if (this.locked) document.exitPointerLock();
  }

  /** `code` is a KeyboardEvent.code, e.g. "KeyW", "Space", "F3". */
  isDown(code: string): boolean {
    return this.down.has(code);
  }

  wasPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  wasReleased(code: string): boolean {
    return this.released.has(code);
  }

  isMouseDown(button: number): boolean {
    return this.buttons.has(button);
  }

  wasMousePressed(button: number): boolean {
    return this.buttonsPressed.has(button);
  }

  get mouseDelta(): { x: number; y: number } {
    return { x: this.dx, y: this.dy };
  }

  get wheelDelta(): number {
    return this.wheel;
  }

  /** Clears per-frame state. Call at the end of each rendered frame. */
  endFrame(): void {
    this.pressed.clear();
    this.released.clear();
    this.buttonsPressed.clear();
    this.dx = 0;
    this.dy = 0;
    this.wheel = 0;
  }

  private onLockChange = (): void => {
    const locked = document.pointerLockElement === this.target;
    if (this.wasLocked && !locked) this.onLockLost?.();
    this.wasLocked = locked;
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'F3' || e.code === 'F4' || e.code === 'F5' || e.code === 'Tab') e.preventDefault();
    if (!this.down.has(e.code)) this.pressed.add(e.code);
    this.down.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.down.delete(e.code);
    this.released.add(e.code);
  };

  private onBlur = (): void => {
    this.down.clear();
    this.buttons.clear();
  };

  private onMouseDown = (e: MouseEvent): void => {
    this.buttons.add(e.button);
    this.buttonsPressed.add(e.button);
  };

  private onMouseUp = (e: MouseEvent): void => {
    this.buttons.delete(e.button);
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.locked) return;
    this.dx += e.movementX;
    this.dy += e.movementY;
  };

  private onWheel = (e: WheelEvent): void => {
    this.wheel += Math.sign(e.deltaY);
  };
}
