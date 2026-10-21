import { describe, expect, it } from 'vitest';
import { OutOfBounds } from '../src/game/OutOfBounds';

describe('OutOfBounds', () => {
  it('counts down 10 s outside and expires', () => {
    const ob = new OutOfBounds(180, 10);
    expect(ob.update(1, 0, 0)).toBe('inside');
    expect(ob.update(1, 185, 0)).toBe('warning');
    expect(ob.remaining).toBe(9);
    for (let i = 0; i < 8; i++) ob.update(1, 0, -185);
    expect(ob.remaining).toBe(1);
    expect(ob.update(1, 0, -185)).toBe('expired');
  });
  it('cancels the warning when the player returns', () => {
    const ob = new OutOfBounds(180, 10);
    ob.update(5, 190, 190);
    expect(ob.update(0.1, 170, 170)).toBe('inside');
    expect(ob.remaining).toBeNull();
    ob.update(1, 181, 0);
    expect(ob.remaining).toBe(9);
  });
});
