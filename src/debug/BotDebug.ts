import * as THREE from 'three';
import type { BotOrders } from '../ai/BotBrain';
import type { Bot } from '../entities/Bot';

const TEAM_COLOR = { blue: new THREE.Color(0x4fa3ff), red: new THREE.Color(0xff5a4f) };
const FIRE_COLOR = new THREE.Color(0xffe14f);
const MAX_SEGMENTS = 4096;

/** A text label that redraws only when its text changes. */
class Label {
  readonly sprite: THREE.Sprite;
  private readonly canvas = document.createElement('canvas');
  private readonly texture: THREE.CanvasTexture;
  private text = '';

  constructor() {
    this.canvas.width = 256;
    this.canvas.height = 48;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texture, depthTest: false, transparent: true }));
    this.sprite.scale.set(2.4, 0.45, 1);
    this.sprite.renderOrder = 10;
  }

  set(text: string): void {
    if (text === this.text) return;
    this.text = text;
    const g = this.canvas.getContext('2d')!;
    g.clearRect(0, 0, 256, 48);
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(0, 0, 256, 48);
    g.fillStyle = '#fff';
    g.font = 'bold 26px monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 128, 25);
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
    this.sprite.material.dispose();
  }
}

function describe(o: BotOrders, b: Bot): string {
  const flag = o.objective ? ` ${o.objective}` : '';
  return `${b.name} ${o.state}${flag}`;
}

/**
 * F5 debug view (with `?debug`): over each living bot its name, state and objective; its
 * remaining path in the team color; a yellow line to whoever it is shooting at.
 */
export class BotDebug {
  readonly root = new THREE.Group();
  private readonly lines: THREE.LineSegments;
  private readonly positions = new Float32Array(MAX_SEGMENTS * 6);
  private readonly colors = new Float32Array(MAX_SEGMENTS * 6);
  private readonly labels = new Map<Bot, Label>();

  constructor(
    private readonly bots: readonly Bot[],
    private readonly target: (id: string) => { chest: THREE.Vector3 } | null,
  ) {
    this.root.name = 'bot-debug';
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true }));
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 9;
    this.root.add(this.lines);
    for (const b of bots) {
      const l = new Label();
      this.labels.set(b, l);
      this.root.add(l.sprite);
    }
    this.root.visible = false;
  }

  toggle(): void {
    this.root.visible = !this.root.visible;
  }

  update(): void {
    if (!this.root.visible) return;
    let n = 0;
    const seg = (a: THREE.Vector3, ay: number, b: THREE.Vector3, by: number, c: THREE.Color) => {
      if (n >= MAX_SEGMENTS) return;
      this.positions.set([a.x, a.y + ay, a.z, b.x, b.y + by, b.z], n * 6);
      this.colors.set([c.r, c.g, c.b, c.r, c.g, c.b], n * 6);
      n++;
    };
    for (const b of this.bots) {
      const label = this.labels.get(b)!;
      label.sprite.visible = b.alive;
      if (!b.alive) continue;
      label.set(describe(b.orders, b));
      label.sprite.position.copy(b.position).setY(b.position.y + 2.3);
      const route = b.route;
      let prev = b.position;
      for (const p of route) {
        seg(prev, 0.15, p, 0.15, TEAM_COLOR[b.team]);
        prev = p;
      }
      const t = b.orders.fireAt ? this.target(b.orders.fireAt) : null;
      if (t) seg(b.eye, 0, t.chest, 0, FIRE_COLOR);
    }
    const geo = this.lines.geometry;
    geo.setDrawRange(0, n * 2);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }

  dispose(): void {
    for (const l of this.labels.values()) l.dispose();
    this.lines.geometry.dispose();
    (this.lines.material as THREE.Material).dispose();
  }
}
