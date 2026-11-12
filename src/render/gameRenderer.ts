import * as THREE from 'three';
import { RENDER } from '../config';
import { lerp } from '../core/math';
import { playerEyeHeight } from '../sim/player';
import { doorBox, type World } from '../sim/world';
import { buildHumanoid, poseHumanoid, type Humanoid } from './humanoid';
import { configureCameraLayers, LAYER, setLayerDeep } from './layers';
import { buildLevelMesh } from './levelMesh';
import { materialColor, PLAYER_COLORS } from './palette';
import { flatMaterial, shadedBox } from './shapes';
import { computeViewRects, type SplitMode, type ViewRect } from './views';

export interface ViewLook {
  yaw: number;
  pitch: number;
}

interface ActorVisual {
  h: Humanoid;
  phase: number;
}

/** Owns the Three.js scene. Reads world state each frame; never writes to it. */
export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  cameras: THREE.PerspectiveCamera[] = [];
  split: SplitMode = 'vertical';
  private levelGroup: THREE.Group | null = null;
  private dynamic = new THREE.Group();
  private propMeshes: THREE.Mesh[] = [];
  private doorMeshes: THREE.Mesh[] = [];
  private players: ActorVisual[] = [];
  private rects: ViewRect[] = [];
  private debugGroup = new THREE.Group();

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.scene.add(this.dynamic);
    this.scene.add(this.debugGroup);
    this.resize();
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  load(world: World, debug: boolean): void {
    this.clear();
    const fog = world.level.fog;
    this.scene.fog = new THREE.Fog(fog.color, fog.near, fog.far);
    this.scene.background = new THREE.Color(fog.color);
    this.levelGroup = buildLevelMesh(world.grid);
    this.scene.add(this.levelGroup);

    for (const p of world.props) {
      const b = p.box;
      const m = new THREE.Mesh(shadedBox(b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ), flatMaterial(materialColor(p.mat)));
      m.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2);
      this.dynamic.add(m);
      this.propMeshes.push(m);
    }
    for (const d of world.doors) {
      const b = doorBox(world, d);
      const m = new THREE.Mesh(shadedBox(b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ), flatMaterial(materialColor(d.mat)));
      this.dynamic.add(m);
      this.doorMeshes.push(m);
    }
    this.cameras = world.players.map((p) => {
      const cam = new THREE.PerspectiveCamera(RENDER.fov, 1, 0.05, 200);
      cam.rotation.order = 'YXZ';
      configureCameraLayers(cam, p.slot);
      return cam;
    });
    this.players = world.players.map((p) => {
      const color = PLAYER_COLORS[p.slot] ?? '#888';
      const h = buildHumanoid({ body: color, legs: '#2a2a2e', skin: '#c99a7a' });
      setLayerDeep(h.root, LAYER.BODY + p.slot);
      this.dynamic.add(h.root);
      return { h, phase: 0 };
    });
    if (debug) this.buildDebug(world);
    this.resize();
  }

  private buildDebug(world: World): void {
    const mat = new THREE.LineBasicMaterial({ color: '#00ff88' });
    for (const b of world.terrain.boxes) {
      const g = new THREE.EdgesGeometry(new THREE.BoxGeometry(b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ));
      const l = new THREE.LineSegments(g, mat);
      l.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2);
      this.debugGroup.add(l);
    }
  }

  clear(): void {
    if (this.levelGroup) {
      this.scene.remove(this.levelGroup);
      disposeDeep(this.levelGroup);
      this.levelGroup = null;
    }
    disposeDeep(this.dynamic);
    this.dynamic.clear();
    disposeDeep(this.debugGroup);
    this.debugGroup.clear();
    this.propMeshes = [];
    this.doorMeshes = [];
    this.players = [];
    this.cameras = [];
  }

  resize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    this.rects = computeViewRects(Math.max(1, this.cameras.length), w, h, this.split);
  }

  viewRects(): ViewRect[] {
    return this.rects;
  }

  render(world: World, alpha: number, looks: ViewLook[], frameTime: number): void {
    world.props.forEach((p, i) => {
      const m = this.propMeshes[i];
      if (m) m.visible = p.alive;
    });
    world.doors.forEach((d, i) => {
      const m = this.doorMeshes[i];
      if (!m) return;
      const b = doorBox(world, d);
      m.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2);
    });

    world.players.forEach((p, i) => {
      const v = this.players[i];
      if (!v) return;
      const x = lerp(p.prev.x, p.x, alpha);
      const y = lerp(p.prev.y, p.y, alpha);
      const z = lerp(p.prev.z, p.z, alpha);
      const crouch = lerp(p.prev.crouch, p.crouch, alpha);
      const speed = Math.hypot(p.vx, p.vz);
      v.phase += speed * frameTime * 3.2;
      v.h.root.visible = p.alive;
      v.h.root.position.set(x, y, z);
      v.h.root.rotation.y = -p.yaw;
      poseHumanoid(v.h, { phase: v.phase, stride: Math.min(1, speed / 4), crouch, aim: 1, pitch: p.pitch });

      const cam = this.cameras[i];
      if (!cam) return;
      const look = looks[i] ?? { yaw: 0, pitch: 0 };
      const eye = playerEyeHeight({ ...p, crouch } as typeof p);
      cam.position.set(x, y + eye, z);
      cam.rotation.y = -(p.yaw + look.yaw);
      cam.rotation.x = Math.max(-1.5, Math.min(1.5, p.pitch + look.pitch));
    });

    const r = this.renderer;
    const fullH = r.domElement.height;
    r.setScissorTest(true);
    this.cameras.forEach((cam, i) => {
      const rect = this.rects[i];
      if (!rect) return;
      cam.aspect = rect.w / rect.h;
      cam.updateProjectionMatrix();
      const y = fullH - rect.y - rect.h;
      r.setViewport(rect.x, y, rect.w, rect.h);
      r.setScissor(rect.x, y, rect.w, rect.h);
      r.render(this.scene, cam);
    });
    r.setScissorTest(false);
  }
}

function disposeDeep(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}
