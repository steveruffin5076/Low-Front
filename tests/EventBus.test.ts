import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/core/EventBus';

interface Events {
  hit: { damage: number };
  reset: undefined;
}

describe('EventBus', () => {
  it('delivers payloads to subscribers', () => {
    const bus = new EventBus<Events>();
    const fn = vi.fn();
    bus.on('hit', fn);
    bus.emit('hit', { damage: 30 });
    expect(fn).toHaveBeenCalledWith({ damage: 30 });
  });

  it('stops delivery after off or the returned unsubscribe', () => {
    const bus = new EventBus<Events>();
    const a = vi.fn();
    const b = vi.fn();
    const unsubscribe = bus.on('hit', a);
    bus.on('hit', b);
    unsubscribe();
    bus.off('hit', b);
    bus.emit('hit', { damage: 1 });
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it('only calls handlers for the emitted event', () => {
    const bus = new EventBus<Events>();
    const fn = vi.fn();
    bus.on('reset', fn);
    bus.emit('hit', { damage: 1 });
    expect(fn).not.toHaveBeenCalled();
  });

  it('allows a handler to unsubscribe during dispatch', () => {
    const bus = new EventBus<Events>();
    const second = vi.fn();
    const off = bus.on('reset', () => off());
    bus.on('reset', second);
    bus.emit('reset', undefined);
    bus.emit('reset', undefined);
    expect(second).toHaveBeenCalledTimes(2);
  });
});
