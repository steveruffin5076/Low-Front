import { describe, expect, it, vi } from 'vitest';
import { quitGame, type QuitTarget } from '../src/platform/quit';

function runNow(fn: () => void): void {
  fn();
}

describe('quitGame', () => {
  it('uses the Electron bridge when present', () => {
    const quit = vi.fn();
    const target: QuitTarget = { close: vi.fn(), closed: false, lowFront: { quit } };
    const onBlocked = vi.fn();
    quitGame({ target, onBlocked, delayMs: 0, schedule: runNow });
    expect(quit).toHaveBeenCalled();
    expect(target.close).not.toHaveBeenCalled();
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it('reports a blocked close when the tab stays open', () => {
    const target: QuitTarget = { close: vi.fn(), closed: false };
    const onBlocked = vi.fn();
    quitGame({ target, onBlocked, delayMs: 0, schedule: runNow });
    expect(target.close).toHaveBeenCalled();
    expect(onBlocked).toHaveBeenCalled();
  });

  it('does nothing more when the tab closes', () => {
    const target = { closed: false, close() { this.closed = true; } };
    const onBlocked = vi.fn();
    quitGame({ target, onBlocked, delayMs: 0, schedule: runNow });
    expect(onBlocked).not.toHaveBeenCalled();
  });
});
