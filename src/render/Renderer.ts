import * as THREE from 'three';
import { ENGINE } from '../data/engine';

/** Owns the main WebGLRenderer and keeps it sized to the window. */
export class Renderer {
  readonly gl: THREE.WebGLRenderer;

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

  get aspect(): number {
    return window.innerWidth / window.innerHeight;
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    if (camera.aspect !== this.aspect) {
      camera.aspect = this.aspect;
      camera.updateProjectionMatrix();
    }
    this.gl.render(scene, camera);
  }

  /**
   * Draws `scene` on top of the current frame with a cleared depth buffer,
   * so the first-person weapon never clips into walls.
   */
  renderLayer(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    if (camera.aspect !== this.aspect) {
      camera.aspect = this.aspect;
      camera.updateProjectionMatrix();
    }
    this.gl.autoClear = false;
    this.gl.clearDepth();
    this.gl.render(scene, camera);
    this.gl.autoClear = true;
  }

  /**
   * Compiles every shader `scene` needs now, hidden objects included (effect pools, the other
   * weapon), so the first firefight does not stall while the GPU driver builds them.
   */
  warmUp(scene: THREE.Scene, camera: THREE.Camera): void {
    const hidden: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
    });
    this.gl.compile(scene, camera);
    for (const o of hidden) o.visible = false;
  }

  /** The graphics chip the browser renders with (laptops with two GPUs may pick the slower one). */
  get gpuName(): string {
    const gl = this.gl.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    // "ANGLE (NVIDIA, NVIDIA GeForce RTX 3050 Laptop GPU (0x...) Direct3D11 ...)" -> the chip name.
    return name.match(/ANGLE \([^,]*, (.*?)\s*(?:\(0x|Direct3D|, |\)$)/)?.[1] ?? name;
  }

  clear(): void {
    this.gl.clear();
  }

  /** Returns this frame's render stats and resets the counters. */
  takeStats(): { drawCalls: number; triangles: number } {
    const stats = { drawCalls: this.gl.info.render.calls, triangles: this.gl.info.render.triangles };
    this.gl.info.reset();
    return stats;
  }

  private resize = (): void => {
    this.gl.setSize(window.innerWidth, window.innerHeight, false);
  };
}
