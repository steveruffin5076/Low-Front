import * as THREE from 'three';
import type { CoverPoint } from '../ai/CoverPoints';
import type { NavGrid } from '../world/NavGrid';

const LEVEL_COLORS = [0x37d67a, 0x4fc3f7, 0xffd54f, 0xba68c8, 0xff8a65, 0x90a4ae];

/** F4 debug view: walkable nav cells (one color per level), stair links, cover points. */
export class NavDebug {
  readonly root = new THREE.Group();

  constructor(nav: NavGrid, cover: readonly CoverPoint[]) {
    this.root.name = 'nav-debug';
    const positions: number[] = [];
    const colors: number[] = [];
    const c = new THREE.Color();
    nav.levels.forEach((level, li) => {
      c.set(LEVEL_COLORS[li % LEVEL_COLORS.length]);
      for (let j = 0; j < level.h; j++) {
        for (let i = 0; i < level.w; i++) {
          const k = j * level.w + i;
          if (!level.walk[k]) continue;
          positions.push(level.x0 + i + 0.5, level.floorY[k] + 0.08, level.z0 + j + 0.5);
          colors.push(c.r, c.g, c.b);
        }
      }
    });
    const cells = new THREE.BufferGeometry();
    cells.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    cells.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.root.add(new THREE.Points(cells, new THREE.PointsMaterial({ size: 0.25, vertexColors: true, depthWrite: false, transparent: true, opacity: 0.8 })));

    const coverPos: number[] = [];
    const coverCol: number[] = [];
    for (const p of cover) {
      coverPos.push(p.pos.x, p.pos.y + 0.6, p.pos.z);
      c.set(p.high ? 0xe5483b : 0xff9f1c);
      coverCol.push(c.r, c.g, c.b);
    }
    const coverGeo = new THREE.BufferGeometry();
    coverGeo.setAttribute('position', new THREE.Float32BufferAttribute(coverPos, 3));
    coverGeo.setAttribute('color', new THREE.Float32BufferAttribute(coverCol, 3));
    this.root.add(new THREE.Points(coverGeo, new THREE.PointsMaterial({ size: 0.5, vertexColors: true, depthWrite: false })));

    const linkPts: THREE.Vector3[] = [];
    for (const [from, edges] of nav.linkEdges) for (const e of edges) linkPts.push(nav.position(from).add(new THREE.Vector3(0, 0.3, 0)), nav.position(e.to).add(new THREE.Vector3(0, 0.3, 0)));
    this.root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(linkPts), new THREE.LineBasicMaterial({ color: 0xff00ff })));
    this.root.visible = false;
  }

  toggle(): void {
    this.root.visible = !this.root.visible;
  }
}
