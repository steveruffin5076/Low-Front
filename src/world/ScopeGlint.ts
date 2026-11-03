import * as THREE from 'three';
import { GLINT } from '../data/hud';
import type { Bot } from '../entities/Bot';

/**
 * Scope glint (fairness for the player): an enemy aiming a scoped rifle at you shows a bright
 * flicker on its scope, so a sniper can be spotted before it fires. Walls hide it (depth test).
 */
export class ScopeGlints {
  readonly root = new THREE.Group();
  private readonly sprites: THREE.Sprite[] = [];
  private material: THREE.SpriteMaterial | null = null;
  private time = 0;
  private readonly at = new THREE.Vector3();
  private readonly toCamera = new THREE.Vector3();

  constructor() {
    this.root.name = 'scope-glints';
  }

  /** `playerId`: bots aiming at this id with a scope show a glint, seen from `camera`. */
  update(dt: number, bots: readonly Bot[], playerId: string, camera: THREE.Camera): void {
    this.time += dt;
    let n = 0;
    for (const b of bots) {
      if (!b.alive || b.aim.targetId !== playerId || !scoped(b)) continue;
      const d = b.position.distanceTo(camera.position);
      if (d < GLINT.minDistance || d > GLINT.maxDistance) continue;
      // At the scope's front lens: a little ahead of the eye, toward the target.
      this.toCamera.subVectors(camera.position, b.eye).normalize();
      this.at.copy(b.eye).addScaledVector(this.toCamera, 0.45);
      const s = this.sprite(n++);
      s.position.copy(this.at);
      // Constant size on screen, with a slow flicker.
      const flicker = 0.7 + 0.3 * Math.sin(this.time * GLINT.flickerSpeed + b.position.x);
      const size = d * GLINT.screenSize * flicker;
      s.scale.set(size, size, 1);
      s.visible = true;
    }
    for (let i = n; i < this.sprites.length; i++) this.sprites[i].visible = false;
  }

  dispose(): void {
    this.material?.map?.dispose();
    this.material?.dispose();
    this.root.removeFromParent();
  }

  private sprite(i: number): THREE.Sprite {
    while (this.sprites.length <= i) {
      const s = new THREE.Sprite(this.glintMaterial());
      s.renderOrder = 3;
      this.sprites.push(s);
      this.root.add(s);
    }
    return this.sprites[i];
  }

  /** A bright four-point star (canvas texture in the browser; a plain sprite in tests). */
  private glintMaterial(): THREE.SpriteMaterial {
    if (this.material) return this.material;
    let map: THREE.Texture | null = null;
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      if (g) {
        const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255,255,240,1)');
        grad.addColorStop(0.15, 'rgba(255,250,210,0.9)');
        grad.addColorStop(0.5, 'rgba(255,230,150,0.35)');
        grad.addColorStop(1, 'rgba(255,220,140,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 64, 64);
        g.fillStyle = 'rgba(255,255,235,0.85)';
        g.fillRect(30, 2, 4, 60);
        g.fillRect(2, 30, 60, 4);
        map = new THREE.CanvasTexture(c);
      }
    }
    this.material = new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, fog: false, toneMapped: false });
    return this.material;
  }
}

/** A sniper rifle, or a gun with a magnified scope fitted, in the bot's hands. */
export function scoped(b: Bot): boolean {
  const def = b.weapons.active.def;
  return def.class === 'sniper' || def.build?.optic === 'scope3x';
}
