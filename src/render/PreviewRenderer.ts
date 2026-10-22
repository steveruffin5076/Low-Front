import * as THREE from 'three';
import { PREVIEW } from '../data/menu';

/**
 * One offscreen WebGL renderer shared by all small UI previews (soldier, weapon cards).
 * Each preview draws into its own 2D canvas, so only one extra WebGL context is used.
 */
export class PreviewRenderer {
  private readonly gl: THREE.WebGLRenderer;
  private width = 0;
  private height = 0;

  constructor() {
    this.gl = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.gl.setPixelRatio(1);
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.setClearColor(0x000000, 0);
    this.gl.setScissorTest(true);
  }

  draw(scene: THREE.Scene, camera: THREE.PerspectiveCamera, target: HTMLCanvasElement): void {
    if (!target.isConnected) return;
    const dpr = Math.min(window.devicePixelRatio, PREVIEW.maxPixelRatio);
    const w = Math.round(target.clientWidth * dpr);
    const h = Math.round(target.clientHeight * dpr);
    if (w === 0 || h === 0) return;
    if (target.width !== w || target.height !== h) {
      target.width = w;
      target.height = h;
    }
    // Grow the shared buffer only; smaller previews use its bottom-left corner.
    if (w > this.width || h > this.height) {
      this.width = Math.max(this.width, w);
      this.height = Math.max(this.height, h);
      this.gl.setSize(this.width, this.height, false);
    }
    if (camera.aspect !== w / h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    this.gl.setViewport(0, 0, w, h);
    this.gl.setScissor(0, 0, w, h);
    this.gl.render(scene, camera);

    const ctx = target.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    // WebGL's origin is bottom-left, the 2D canvas origin is top-left.
    ctx.drawImage(this.gl.domElement, 0, this.height - h, w, h, 0, 0, w, h);
  }
}

/** Standard light rig for preview scenes. */
export function addPreviewLights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(PREVIEW.hemi.sky, PREVIEW.hemi.ground, PREVIEW.hemi.intensity));
  const key = new THREE.DirectionalLight(PREVIEW.key.color, PREVIEW.key.intensity);
  key.position.set(...PREVIEW.key.position);
  scene.add(key);
}
