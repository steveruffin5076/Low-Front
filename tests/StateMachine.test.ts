import { describe, expect, it } from 'vitest';
import { StateMachine, type State } from '../src/core/StateMachine';

function recorder(name: string, log: string[]): State {
  return {
    enter: () => log.push(`${name}:enter`),
    exit: () => log.push(`${name}:exit`),
    fixedUpdate: (dt) => log.push(`${name}:fixed:${dt}`),
    update: (dt, alpha) => log.push(`${name}:update:${dt}:${alpha}`),
    render: () => log.push(`${name}:render`),
  };
}

describe('StateMachine', () => {
  it('starts with no state and ignores updates', () => {
    const sm = new StateMachine();
    expect(sm.current).toBeNull();
    expect(() => sm.update(1, 0)).not.toThrow();
  });

  it('calls exit on the old state before enter on the new one', () => {
    const log: string[] = [];
    const sm = new StateMachine<'menu' | 'match'>();
    sm.add('menu', recorder('menu', log)).add('match', recorder('match', log));
    sm.change('menu');
    sm.change('match');
    expect(log).toEqual(['menu:enter', 'menu:exit', 'match:enter']);
    expect(sm.current).toBe('match');
  });

  it('forwards updates only to the active state', () => {
    const log: string[] = [];
    const sm = new StateMachine<'a' | 'b'>();
    sm.add('a', recorder('a', log)).add('b', recorder('b', log));
    sm.change('b');
    sm.fixedUpdate(0.5);
    sm.update(0.1, 0.25);
    sm.render();
    expect(log).toEqual(['b:enter', 'b:fixed:0.5', 'b:update:0.1:0.25', 'b:render']);
  });

  it('throws on an unknown state', () => {
    const sm = new StateMachine<string>();
    expect(() => sm.change('nope')).toThrow('Unknown state: nope');
  });
});
