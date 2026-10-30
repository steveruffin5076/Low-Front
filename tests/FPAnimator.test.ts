import { describe, expect, it } from 'vitest';
import { FPAnimator } from '../src/anim/FPAnimator';
import { AudioManager } from '../src/audio/AudioManager';
import { ViewmodelLayer } from '../src/render/ViewmodelLayer';
import { PlayerWeapons } from '../src/weapons/PlayerWeapons';

describe('first-person rig', () => {
  it('leaves the weapon layer when disposed, so a new loadout shows only its own weapons', () => {
    const layer = new ViewmodelLayer();
    const before = layer.scene.children.length;
    const audio = new AudioManager();
    const first = new FPAnimator(layer, new PlayerWeapons({ primary: 'm4a1', secondary: 'm1911' }), audio);
    expect(layer.scene.children.length).toBeGreaterThan(before);
    first.dispose();
    expect(layer.scene.children.length).toBe(before);
    const second = new FPAnimator(layer, new PlayerWeapons({ primary: 'ak47', secondary: 'm1911' }), audio);
    second.dispose();
    expect(layer.scene.children.length).toBe(before);
  });
});
