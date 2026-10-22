import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GameLoop } from '../core/GameLoop';
import { PLANS } from '../data/map/plans';
import type { PlanId } from '../data/map/types';
import { Renderer } from '../render/Renderer';
import { VERDAN } from '../data/map';
import { BuildingBuilder } from '../world/BuildingBuilder';
import { getBuiltMap } from '../world/MapBuilder';
import { countTriangles } from '../weapons/models/ModelKit';
import { StaticSink, mapMaterial } from '../world/StaticSink';
import { button, el } from '../ui/dom';
import './viewer.css';

/**
 * `/?debug=map&plan=<id>`: orbit view of one enterable building, with an x-ray toggle to see
 * inside. Used to review floor plans; the full map view comes with the map builder.
 */
export class MapViewer {
  private readonly renderer: Renderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
  private readonly controls: OrbitControls;
  private readonly loop: GameLoop;
  private content: THREE.Object3D | null = null;
  private plan: PlanId | null;

  constructor(canvas: HTMLCanvasElement, private readonly ui: HTMLElement) {
    this.renderer = new Renderer(canvas);
    this.scene.background = new THREE.Color(0x9cc8e8);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x667788, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(40, 80, 30);
    this.scene.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8f8a7c }));
    this.scene.add(ground);
    this.controls = new OrbitControls(this.camera, canvas);
    const params = new URLSearchParams(window.location.search);
    this.plan = params.get('plan') as PlanId | null;
    this.loop = new GameLoop({
      fixedUpdate: () => {},
      update: () => this.controls.update(),
      render: () => this.renderer.render(this.scene, this.camera),
    });
  }

  start(): void {
    if (this.plan) this.show(this.plan);
    else this.showMap();
    const panel = el('div', { class: 'viewer-panel' }, [
      el('h1', { text: 'Map Viewer' }),
      el('h2', { text: 'Building' }),
      el('div', { class: 'viewer-row' }, [
        button('Whole map', () => this.showMap()),
        ...(Object.keys(PLANS) as PlanId[]).map((id) => button(id, () => this.show(id))),
      ]),
      el('h2', { text: 'View' }),
      el('div', { class: 'viewer-row' }, [
        button('X-ray', () => {
          const m = mapMaterial();
          m.transparent = !m.transparent;
          m.opacity = m.transparent ? 0.45 : 1;
          m.depthWrite = !m.transparent;
          m.needsUpdate = true;
        }),
      ]),
    ]);
    this.ui.append(panel);
    this.loop.start();
  }

  private showMap(): void {
    if (this.content) this.scene.remove(this.content);
    const built = getBuiltMap(VERDAN);
    this.content = built.group.clone();
    // Flag markers.
    for (const f of built.data.flags) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 20, 6), new THREE.MeshBasicMaterial({ color: 0xff00ff }));
      pole.position.set(f.x, 10, f.z);
      this.content.add(pole);
    }
    this.scene.add(this.content);
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(0, 330, 190);
    this.controls.update();
    (window as unknown as { __viewer: unknown }).__viewer = {
      id: 'map',
      stats: { ...built.stats, triangles: countTriangles(this.content), meshes: this.content.children.length, links: built.links.length },
      setView: (x: number, y: number, z: number, tx: number, ty: number, tz: number) => {
        this.camera.position.set(x, y, z);
        this.controls.target.set(tx, ty, tz);
        this.controls.update();
      },
    };
  }

  private show(id: PlanId): void {
    if (this.content) this.scene.remove(this.content);
    const sink = new StaticSink();
    const frame = new BuildingBuilder(PLANS[id], sink, 0, 0, 0).build();
    this.content = sink.build(id);
    // Stair links as lines.
    const pts: THREE.Vector3[] = [];
    for (const l of frame.links) pts.push(l.a, ...l.via, ...l.via, l.b);
    if (pts.length) this.content.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xff00ff })));
    this.scene.add(this.content);
    const p = PLANS[id];
    const size = Math.max(p.w, p.d, p.floors * p.floorHeight);
    this.controls.target.set(0, (p.floors * p.floorHeight) / 3, 0);
    this.camera.position.set(size * 1.1, size * 0.9, size * 1.3);
    this.controls.update();
    (window as unknown as { __viewer: unknown }).__viewer = { frame, sink, id };
  }
}
