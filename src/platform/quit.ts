/** The parts of `window` the quit flow uses. Electron (Phase 10) exposes `lowFront.quit`. */
export interface QuitTarget {
  close(): void;
  readonly closed: boolean;
  lowFront?: { quit(): void };
}

export interface QuitOptions {
  target: QuitTarget;
  /** Called when the browser does not allow the tab to close. */
  onBlocked(): void;
  delayMs: number;
  schedule?: (fn: () => void, ms: number) => void;
}

/** Electron: close the app. Web: try `window.close()`, then report if the tab is still open. */
export function quitGame({ target, onBlocked, delayMs, schedule = setTimeout }: QuitOptions): void {
  if (target.lowFront) {
    target.lowFront.quit();
    return;
  }
  target.close();
  schedule(() => {
    if (!target.closed) onBlocked();
  }, delayMs);
}
