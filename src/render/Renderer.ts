import * as THREE from 'three';
import { ENGINE } from '../data/engine';

/** Owns the WebGLRenderer and keeps it sized to the window. */
export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio, ENGINE.maxPixelRatio));
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFShadowMap;
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    // Draw calls/triangles are summed per frame, not per render() call.
    this.gl.info.autoReset = false;
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  setCamera(camera: THREE.PerspectiveCamera): void {
    this.camera = camera;
    this.resize();
  }

  render(scene: THREE.Scene): void {
    if (this.camera) this.gl.render(scene, this.camera);
  }

  /** Returns this frame's render stats and resets the counters. */
  takeStats(): { drawCalls: number; triangles: number } {
    const stats = { drawCalls: this.gl.info.render.calls, triangles: this.gl.info.render.triangles };
    this.gl.info.reset();
    return stats;
  }

  private resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.gl.setSize(w, h, false);
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  };
}
