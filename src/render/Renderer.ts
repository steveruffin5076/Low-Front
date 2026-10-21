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
