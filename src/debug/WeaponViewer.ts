import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { GameLoop } from '../core/GameLoop';
import { WEAPONS, WEAPON_IDS, type WeaponId } from '../data/weapons';
import { allPaletteMaterials } from '../render/Materials';
import { Renderer } from '../render/Renderer';
import { disposeObject } from '../render/dispose';
import { countTriangles } from '../weapons/models/ModelKit';
import { PART_TESTS, type PartTest } from '../weapons/models/partTests';
import type { NodeName, WeaponLod, WeaponModel } from '../weapons/models/WeaponModel';
import { OVERALL_LENGTH, buildWeaponModel } from '../weapons/models/weaponModels';
import { button, el } from '../ui/dom';
import './viewer.css';

const VIEWER = {
  background: 0x8fa3b5,
  stageColor: 0x5c6b7a,
  autoRotateSpeed: 0.5,
  fov: 35,
  fitMargin: 1.25,
  axesSize: 0.025,
  /** Stage radius relative to the weapon length, and gap below the weapon (m). */
  stageScale: 0.65,
  stageGap: 0.02,
  hemiIntensity: 2.2,
  keyIntensity: 3.0,
  rimIntensity: 1.2,
} as const;

type ViewName = 'Free' | 'Left' | 'Right' | 'Top' | 'Front' | 'Back';
const VIEW_DIRS: Record<Exclude<ViewName, 'Free'>, THREE.Vector3> = {
  Left: new THREE.Vector3(-1, 0, 0),
  Right: new THREE.Vector3(1, 0, 0),
  Top: new THREE.Vector3(0, 1, 0.0001),
  Front: new THREE.Vector3(0, 0, -1),
  Back: new THREE.Vector3(0, 0, 1),
};

interface RestPose {
  pos: THREE.Vector3;
  rot: THREE.Euler;
}

/** `/?debug=weapons`: turntable viewer to review weapon models and test their moving parts. */
export class WeaponViewer {
  private readonly renderer: Renderer;
  private readonly labels = new CSS2DRenderer();
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(VIEWER.fov, 1, 0.01, 20);
  private readonly controls: OrbitControls;
  private readonly turntable = new THREE.Group();
  private readonly loop: GameLoop;
  private readonly panel: HTMLElement;

  private weapon: WeaponId = 'm4a1';
  private lod: WeaponLod = 'fp';
  private model: WeaponModel | null = null;
  /** Model bounds measured before helpers are added. */
  private bounds = new THREE.Box3();
  private readonly stage: THREE.Mesh;
  private rest = new Map<THREE.Object3D, RestPose>();
  private autoRotate = true;
  private wireframe = false;
  private showPoints = false;
  private running: { test: PartTest; time: number } | null = null;

  constructor(canvas: HTMLCanvasElement, ui: HTMLElement) {
    this.renderer = new Renderer(canvas);
    this.scene.background = new THREE.Color(VIEWER.background);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x667788, VIEWER.hemiIntensity));
    const key = new THREE.DirectionalLight(0xffffff, VIEWER.keyIntensity);
    key.position.set(2, 3, 2);
    const rim = new THREE.DirectionalLight(0xffffff, VIEWER.rimIntensity);
    rim.position.set(-2, 1, -2);
    this.scene.add(key, rim, this.turntable);
    this.stage = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 0.02, 32),
      new THREE.MeshStandardMaterial({ color: VIEWER.stageColor, flatShading: true }),
    );
    this.scene.add(this.stage);

    this.labels.domElement.style.position = 'absolute';
    this.labels.domElement.style.inset = '0';
    this.labels.domElement.style.pointerEvents = 'none';
    ui.append(this.labels.domElement);
    window.addEventListener('resize', this.resizeLabels);
    this.resizeLabels();

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.panel = el('div', { class: 'viewer-panel' });
    ui.append(this.panel);

    this.loop = new GameLoop({
      fixedUpdate: () => {},
      update: (dt) => this.update(dt),
      render: () => {
        this.renderer.render(this.scene, this.camera);
        this.labels.render(this.scene, this.camera);
      },
    });
  }

  start(): void {
    this.loadModel();
    this.loop.start();
  }

  private loadModel(): void {
    if (this.model) {
      this.turntable.remove(this.model.root);
      this.model.root.traverse((o) => o instanceof CSS2DObject && o.element.remove());
      disposeObject(this.model.root);
    }
    this.running = null;
    this.model = buildWeaponModel(this.weapon, this.lod);
    this.turntable.add(this.model.root);
    this.bounds.setFromObject(this.model.root);
    const size = this.bounds.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.z) * VIEWER.stageScale;
    this.stage.scale.set(radius, 1, radius);
    this.stage.position.set(0, this.bounds.min.y - VIEWER.stageGap, 0);
    this.rest.clear();
    for (const node of Object.values(this.model.nodes)) {
      this.rest.set(node, { pos: node.position.clone(), rot: node.rotation.clone() });
    }
    for (const [name, p] of Object.entries(this.model.points)) {
      const axes = new THREE.AxesHelper(VIEWER.axesSize);
      const label = new CSS2DObject(el('div', { class: 'point-label', text: name }));
      label.position.set(0, VIEWER.axesSize, 0);
      p.add(axes, label);
    }
    this.applyToggles();
    this.setView('Free');
    this.renderPanel();
  }

  private setView(view: ViewName): void {
    if (!this.model) return;
    const sphere = this.bounds.getBoundingSphere(new THREE.Sphere());
    const distance = (sphere.radius * VIEWER.fitMargin) / Math.sin(THREE.MathUtils.degToRad(VIEWER.fov) / 2);
    let dir = new THREE.Vector3(1, 0.45, 0.9).normalize();
    if (view !== 'Free') {
      dir = VIEW_DIRS[view].clone().normalize();
      this.autoRotate = false;
      this.turntable.rotation.y = 0;
    }
    this.controls.target.copy(sphere.center);
    this.camera.position.copy(sphere.center).addScaledVector(dir, distance);
    this.camera.lookAt(sphere.center);
    this.controls.update();
    this.renderPanel();
  }

  private applyToggles(): void {
    for (const m of allPaletteMaterials()) m.wireframe = this.wireframe;
    this.model?.root.traverse((o) => {
      if (o instanceof THREE.AxesHelper || o instanceof CSS2DObject) o.visible = this.showPoints;
    });
  }

  private update(dt: number): void {
    if (this.autoRotate) this.turntable.rotation.y += VIEWER.autoRotateSpeed * dt;
    this.controls.update();
    if (!this.running || !this.model) return;
    this.running.time += dt;
    const { test } = this.running;
    const t = Math.min(1, this.running.time / test.duration);
    this.resetNodes();
    if (t < 1) test.apply(this.model.nodes, t);
    else this.running = null;
  }

  private resetNodes(): void {
    for (const [node, pose] of this.rest) {
      node.position.copy(pose.pos);
      node.rotation.copy(pose.rot);
    }
  }

  private renderPanel(): void {
    if (!this.model) return;
    const tris = countTriangles(this.model.root);
    let meshes = 0;
    this.model.root.traverse((o) => o instanceof THREE.Mesh && meshes++);
    const size = this.bounds.getSize(new THREE.Vector3());
    const nodes = Object.keys(this.model.nodes) as NodeName[];
    const tests = PART_TESTS[this.weapon].filter((t) => t.nodes.every((n) => nodes.includes(n)));

    const toggle = (label: string, on: boolean, fn: () => void): HTMLButtonElement => {
      const b = button(label, () => {
        fn();
        this.applyToggles();
        this.renderPanel();
      });
      if (on) b.classList.add('active');
      return b;
    };
    const choice = <T>(label: string, value: T, current: T, set: (v: T) => void): HTMLButtonElement => {
      const b = button(label, () => set(value));
      if (value === current) b.classList.add('active');
      return b;
    };

    this.panel.replaceChildren(
      el('h1', { text: 'Weapon Viewer' }),
      el('h2', { text: 'Weapon' }),
      el('div', { class: 'viewer-row' }, WEAPON_IDS.map((id) => choice(WEAPONS[id].name, id, this.weapon, (v) => {
        this.weapon = v;
        this.loadModel();
      }))),
      el('h2', { text: 'Model' }),
      el('div', { class: 'viewer-row' }, [
        choice('First person', 'fp' as WeaponLod, this.lod, (v) => {
          this.lod = v;
          this.loadModel();
        }),
        choice('Third person', 'tp' as WeaponLod, this.lod, (v) => {
          this.lod = v;
          this.loadModel();
        }),
      ]),
      el('h2', { text: 'Display' }),
      el('div', { class: 'viewer-row' }, [
        toggle('Auto-rotate', this.autoRotate, () => (this.autoRotate = !this.autoRotate)),
        toggle('Wireframe', this.wireframe, () => (this.wireframe = !this.wireframe)),
        toggle('Points', this.showPoints, () => (this.showPoints = !this.showPoints)),
      ]),
      el('h2', { text: 'Camera' }),
      el('div', { class: 'viewer-row' }, (['Free', 'Left', 'Right', 'Top', 'Front', 'Back'] as ViewName[]).map((v) =>
        button(v, () => this.setView(v)),
      )),
      el('h2', { text: 'Moving parts' }),
      el('div', { class: 'viewer-row' }, tests.length
        ? tests.map((t) => button(t.label, () => (this.running = { test: t, time: 0 })))
        : [el('span', { text: 'None in this model.' })]),
      el('h2', { text: 'Info' }),
      el('p', {
        class: 'viewer-info',
        text: [
          `Triangles  ${tris}`,
          `Meshes     ${meshes}`,
          `Length     ${size.z.toFixed(3)} m (real ${OVERALL_LENGTH[this.weapon]} m)`,
          `Parts      ${nodes.join(', ')}`,
        ].join('\n'),
      }),
    );
    // Long part lists wrap instead of stretching the panel.
    (this.panel.lastElementChild as HTMLElement).style.whiteSpace = 'pre-wrap';
  }

  private resizeLabels = (): void => {
    this.labels.setSize(window.innerWidth, window.innerHeight);
  };
}
