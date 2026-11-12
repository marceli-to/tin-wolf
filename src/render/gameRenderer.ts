import * as THREE from 'three';
import { PLAYER, RENDER } from '../config';
import { lerp } from '../core/math';
import { SWITCH_TIME } from '../sim/weapons';
import { playerEyeHeight } from '../sim/player';
import { doorBox, type Pickup, type World } from '../sim/world';
import { buildHumanoid, lightHumanoid, poseHumanoid, type Humanoid } from './humanoid';
import { buildLightField, lampsFromLevel, type LightField } from './lighting';
import { setTextureSmoothing, texturedMaterial } from './textures';
import { Snow } from './snow';
import { tintModel, type ModelLibrary } from './models';
import { ModelCharacter, PROFILES, type HeldGun } from './modelCharacter';
import { StaticBatch } from './staticBatch';
import { rayGrid } from '../sim/raycast';
import type { Grid } from '../sim/grid';
import { configureCameraLayers, LAYER, setLayerDeep } from './layers';
import { buildLevelMesh } from './levelMesh';
import { materialColor, PLAYER_COLORS } from './palette';
import { shadeByNormal, worldUvBox } from './shapes';
import { computeViewRects, type SplitMode, type ViewRect } from './views';
import { Effects } from './effects';
import { buildModelArmsViewModel, buildPistolViewModel, poseViewModel, type ViewModel } from './viewModel';
import { buildPickupMesh } from './pickups';
import { flatMaterial } from './shapes';
import type { SimEvent } from '../sim/events';

export interface ViewLook {
  yaw: number;
  pitch: number;
}

interface ActorVisual {
  h: Humanoid;
  phase: number;
  flash: THREE.Object3D;
  /** Animated glTF figure, when model art is enabled; replaces the box humanoid. */
  model?: ModelCharacter;
}


const STATE_COLORS: Record<string, string> = {
  patrol: '#40d070',
  suspicious: '#e8d040',
  attack: '#ff4030',
  search: '#ff9a30',
  dead: '#555555',
};

/** Owns the Three.js scene. Reads world state each frame; never writes to it. */
export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  cameras: THREE.PerspectiveCamera[] = [];
  split: SplitMode = 'vertical';
  private levelGroup: THREE.Group | null = null;
  private dynamic = new THREE.Group();
  private propMeshes: THREE.Object3D[] = [];
  /** Set to use glTF models for props and guards (art trial). */
  models: ModelLibrary | null = null;
  /** Which character set to use with models (a key of PROFILES, e.g. 'quaternius'). */
  art = '';
  private modelLights = new THREE.Group();
  private doorMeshes: THREE.Mesh[] = [];
  private pickupMeshes: THREE.Group[] = [];
  private projectileMeshes = new Map<number, THREE.Object3D>();
  private time = 0;
  private light: LightField = () => 1;
  /** Internal render height in pixels (0 = native resolution). */
  internalHeight: number = RENDER.internalHeight;
  private glScale = 1;
  private snow: Snow | null = null;
  private players: ActorVisual[] = [];
  private guards: ActorVisual[] = [];
  private debugLines: THREE.LineSegments | null = null;
  private rects: ViewRect[] = [];
  private debugGroup = new THREE.Group();
  /** View models render in a second pass over a cleared depth buffer so they never clip into walls. */
  private vmScene = new THREE.Scene();
  private viewModels: ViewModel[] = [];
  private bob: number[] = [];
  readonly effects = new Effects();
  private flashMat = new THREE.MeshBasicMaterial({ color: '#ffd27a', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false });

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.scene.add(this.dynamic);
    this.scene.add(this.debugGroup);
    this.scene.add(this.effects.group);
    this.resize();
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  load(world: World, debug: boolean): void {
    this.clear();
    const fog = world.level.fog;
    const mood = PROFILES[this.art]?.mood;
    const fogColor = new THREE.Color(fog.color);
    if (mood) fogColor.lerp(new THREE.Color(mood.fogTint), mood.fogMix);
    const fogScale = mood?.fogFarScale ?? 1;
    this.scene.fog = new THREE.Fog(fogColor, fog.near * fogScale, fog.far * fogScale);
    this.scene.background = fogColor.clone();
    const baked = buildLightField(world.grid, lampsFromLevel(world.level));
    this.light = mood ? (x, z) => mood.lightFloor + (1 - mood.lightFloor) * baked(x, z) : baked;
    if (Snow.wanted(world.grid)) {
      this.snow = new Snow(world.grid);
      this.dynamic.add(this.snow.points);
    }
    this.levelGroup = buildLevelMesh(world.grid, this.light);
    this.scene.add(this.levelGroup);

    const litBox = (w: number, h: number, d: number, x: number, z: number, worldUv: boolean): THREE.BufferGeometry => {
      const g = new THREE.BoxGeometry(w, h, d);
      if (worldUv) worldUvBox(g, w, h, d);
      return shadeByNormal(g, this.light(x, z));
    };
    this.scene.remove(this.modelLights);
    this.modelLights.clear();
    if (this.models) {
      // Models use standard materials, so they need real lights; the level stays unlit and baked.
      this.modelLights.add(new THREE.HemisphereLight('#dfe8f0', '#4a443c', 1.5));
      const sun = new THREE.DirectionalLight('#fff4e0', 1.0);
      sun.position.set(0.4, 1, 0.3);
      this.modelLights.add(sun);
      this.scene.add(this.modelLights);
    }
    this.grid = world.grid;
    const batch = new StaticBatch();
    for (const p of world.props) {
      const b = p.box;
      const kind = world.data.props[p.kind];
      const model = kind?.model && this.models ? this.models.instance(kind.model) : null;
      if (model) {
        const o = model.object;
        o.scale.setScalar(kind!.modelScale);
        // Kenney models face +z; prop yaw follows the level convention (0 = north / -z).
        o.rotation.y = Math.PI - p.yaw;
        // Origins differ between kits (corner vs. centre), so centre each model on its collision
        // box and stand it on the box's floor.
        o.position.set(0, 0, 0);
        o.updateMatrixWorld(true);
        let mb = new THREE.Box3().setFromObject(o);
        if (kind!.modelFit !== 'scale') {
          fitToBox(o, mb, b, kind!.modelFit);
          o.updateMatrixWorld(true);
          mb = new THREE.Box3().setFromObject(o);
        }
        o.position.set((b.minX + b.maxX) / 2 - (mb.min.x + mb.max.x) / 2, b.minY - mb.min.y, (b.minZ + b.maxZ) / 2 - (mb.min.z + mb.max.z) / 2);
        // glTF defaults metalness to 1 and the kits rely on that plus a metal map; with no
        // environment map, metal renders near-black, so props are lit as (mostly) dielectric.
        for (const m of model.materials) {
          m.metalness = Math.min(m.metalness, 0.15);
          m.roughness = Math.max(m.roughness, 0.55);
        }
        tintModel(model.materials, Math.min(1.25, this.light(o.position.x, o.position.z) + 0.3));
        if (!p.destructible) {
          // Static: merged with every other static prop below; nothing to update per frame.
          batch.add(o);
          this.propMeshes.push(new THREE.Object3D());
          continue;
        }
        this.dynamic.add(o);
        this.propMeshes.push(o);
        continue;
      }
      if (!p.solid) {
        // Decoration without a model is simply not drawn.
        const empty = new THREE.Object3D();
        this.propMeshes.push(empty);
        continue;
      }
      const w = b.maxX - b.minX;
      const h = b.maxY - b.minY;
      const d = b.maxZ - b.minZ;
      const cx = (b.minX + b.maxX) / 2;
      const cz = (b.minZ + b.maxZ) / 2;
      // Crates and consoles show their whole texture per face; panels tile in world units.
      const perFace = p.mat === 'crate' || p.mat === 'console' || p.mat === 'barrel' || p.mat === 'alarm';
      const m = new THREE.Mesh(litBox(w, h, d, cx, cz, !perFace), texturedMaterial(p.mat, materialColor(p.mat)));
      m.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2);
      this.dynamic.add(m);
      this.propMeshes.push(m);
    }
    this.dynamic.add(batch.build());
    for (const d of world.doors) {
      const b = doorBox(world, d);
      const m = new THREE.Mesh(
        litBox(b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ, (b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2, false),
        texturedMaterial(d.mat, materialColor(d.mat)),
      );
      this.dynamic.add(m);
      this.doorMeshes.push(m);
    }
    for (const pk of world.pickups) this.addPickup(world, pk);
    this.cameras = world.players.map((p) => {
      const cam = new THREE.PerspectiveCamera(RENDER.fov, 1, 0.05, 200);
      cam.rotation.order = 'YXZ';
      configureCameraLayers(cam, p.slot);
      return cam;
    });
    const set = PROFILES[this.art];
    this.players = world.players.map((p) => {
      const color = PLAYER_COLORS[p.slot] ?? '#888';
      const prof = set?.player;
      const file = set?.playerModels?.[p.slot % set.playerModels.length] ?? prof?.model;
      const inst = prof && file && this.models ? this.models.instance(file) : null;
      if (prof && inst) {
        const gun = prof.gun ? this.models!.instance(prof.gun.model) : null;
        if (prof.tintMaterial) for (const m of inst.materials) if (m.name === prof.tintMaterial) (m.userData.base as THREE.Color).multiply(new THREE.Color(color)).multiplyScalar(2.2);
        const model = new ModelCharacter(inst, prof, p.height, this.flashMat, gun, this.heldGuns(world, Object.keys(world.data.weapons)), this.gunRef());
        setLayerDeep(model.root, LAYER.BODY + p.slot);
        this.dynamic.add(model.root);
        return { h: buildHumanoid({ body: '#000', legs: '#000', skin: '#000' }), phase: 0, flash: model.flash, model };
      }
      const h = buildHumanoid({ body: color, legs: '#2a2a2e', skin: '#c99a7a' });
      const flash = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), this.flashMat);
      flash.position.set(0, 0, -0.2);
      flash.visible = false;
      h.gun.add(flash);
      setLayerDeep(h.root, LAYER.BODY + p.slot);
      this.dynamic.add(h.root);
      return { h, phase: 0, flash };
    });
    this.guards = [];
    for (const g of world.guards) this.guards.push(this.guardVisual(world, g));
    this.vmScene.add(new THREE.HemisphereLight('#e8eef4', '#4a443c', 1.6));
    const vmSun = new THREE.DirectionalLight('#fff4e0', 1.2);
    vmSun.position.set(0.5, 1, 0.8);
    this.vmScene.add(vmSun);
    this.viewModels = world.players.map((p) => {
      const va = set?.viewArms;
      const armsInst = va && this.models ? this.models.instance(va.model) : null;
      let vm: ViewModel;
      if (va && armsInst) {
        if (va.tintMaterial) for (const m of armsInst.materials) if (m.name === va.tintMaterial) m.color.multiply(new THREE.Color(PLAYER_COLORS[p.slot] ?? '#888')).multiplyScalar(2.2);
        vm = buildModelArmsViewModel(armsInst, this.heldGuns(world, Object.keys(world.data.weapons)), this.gunRef(), {
          clip: va.clip,
          collapse: va.collapse,
          headOffset: va.headOffset,
          hand: va.hand,
          muzzle: va.muzzle,
          height: p.height,
          headBone: va.headBone,
          grip: va.grip,
          gunOnly: va.gunOnly,
        });
      } else {
        const vg = set?.viewGun;
        const vgModel = vg && this.models ? this.models.instance(vg.model) : null;
        vm = buildPistolViewModel(PLAYER_COLORS[p.slot] ?? '#555', vgModel, vg);
      }
      setLayerDeep(vm.root, LAYER.VIEWMODEL + p.slot);
      const holder = new THREE.Group();
      holder.add(vm.root);
      setLayerDeep(holder, LAYER.VIEWMODEL + p.slot);
      this.vmScene.add(holder);
      return vm;
    });
    this.bob = world.players.map(() => 0);
    if (debug) this.buildDebug(world);
    this.resize();
  }

  /** Figure for one guard; also called for reinforcements that arrive after the level loaded. */
  private guardVisual(world: World, g: World['guards'][number]): ActorVisual {
    const def = world.data.enemies[g.archetype];
    const set = PROFILES[this.art];
    const profile = set ? ((g.look && set.looks?.[g.look]) || (g.archetype === 'guard_officer' ? set.officer : set.guard)) : null;
    const inst = profile && this.models ? this.models.instance(profile.model) : null;
    if (profile && inst) {
      const gun = profile.gun ? this.models!.instance(profile.gun.model) : null;
      if (g.uniform && profile.tintMaterial) {
        for (const m of inst.materials) if (m.name === profile.tintMaterial) (m.userData.base as THREE.Color).set(g.uniform);
      }
      const model = new ModelCharacter(inst, profile, g.height, this.flashMat, gun, this.heldGuns(world, def ? [def.weapon] : []), this.gunRef());
      this.dynamic.add(model.root);
      return { h: buildHumanoid({ body: '#000', legs: '#000', skin: '#000' }), phase: 0, flash: model.flash, model };
    }
    const h = buildHumanoid({ body: def?.color ?? '#556', legs: def?.legs ?? '#333', skin: '#c99a7a' });
    const flash = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), this.flashMat);
    flash.position.set(0, 0, -0.2);
    flash.visible = false;
    h.gun.add(flash);
    this.dynamic.add(h.root);
    return { h, phase: Math.random() * 6, flash };
  }

  /** Fresh model instances for the weapons that have one (falls back to the model's own gun). */
  private heldGuns(world: World, ids: string[]): HeldGun[] {
    if (!this.models) return [];
    const out: HeldGun[] = [];
    for (const id of ids) {
      const def = world.data.weapons[id];
      const inst = def?.model ? this.models.instance(def.model) : null;
      if (def && inst) out.push({ id, model: inst, fit: def.fit, hold: def.hold });
    }
    return out;
  }

  private gunRef(): THREE.Object3D | null {
    const ref = PROFILES[this.art]?.gunRef;
    return ref ? (this.models?.instance(ref)?.object ?? null) : null;
  }

  /** Spinning pickup: the item's model if it has one, else the code-built shape. */
  private addPickup(world: World, pk: Pickup): void {
    const item = world.data.items[pk.item];
    const holder = new THREE.Group();
    const inst = item?.model && this.models ? this.models.instance(item.model) : null;
    if (item && inst) {
      const o = inst.object;
      o.scale.setScalar(item.modelScale);
      // Centre the model on the pickup point so it spins in place.
      o.updateMatrixWorld(true);
      const mb = new THREE.Box3().setFromObject(o);
      o.position.set(-(mb.min.x + mb.max.x) / 2, -(mb.min.y + mb.max.y) / 2, -(mb.min.z + mb.max.z) / 2);
      for (const m of inst.materials) m.metalness = Math.min(m.metalness, 0.15);
      if (item.kind === 'key') for (const m of inst.materials) (m.userData.base as THREE.Color).set(item.color), m.color.set(item.color);
      holder.add(o);
    } else if (item) holder.add(buildPickupMesh(item));
    holder.position.set(pk.x, pk.y + 0.45, pk.z);
    this.dynamic.add(holder);
    this.pickupMeshes.push(holder);
  }

  /** Grenade in flight: the weapon's model, or a small dark ball. */
  private projectileMesh(world: World, weapon: string): THREE.Object3D {
    const def = world.data.weapons[weapon];
    const inst = def?.model && this.models ? this.models.instance(def.model) : null;
    if (inst) {
      for (const m of inst.materials) m.metalness = Math.min(m.metalness, 0.15);
      const g = new THREE.Group();
      inst.object.updateMatrixWorld(true);
      const mb = new THREE.Box3().setFromObject(inst.object);
      const size = mb.getSize(new THREE.Vector3());
      inst.object.scale.setScalar(0.14 / Math.max(size.x, size.y, size.z, 1e-3));
      inst.object.updateMatrixWorld(true);
      const c = new THREE.Box3().setFromObject(inst.object).getCenter(new THREE.Vector3());
      inst.object.position.sub(c);
      g.add(inst.object);
      return g;
    }
    return new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), flatMaterial('#3a4030'));
  }

  private buildDebug(world: World): void {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(4096 * 3), 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(4096 * 3), 3));
    this.debugLines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, fog: false, depthTest: false }));
    this.debugLines.frustumCulled = false;
    this.debugLines.renderOrder = 10;
    this.debugGroup.add(this.debugLines);
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
    disposeDeep(this.vmScene);
    this.vmScene.clear();
    this.viewModels = [];
    this.effects.clear();
    this.debugLines = null;
    this.snow = null;
    this.guards = [];
    this.propMeshes = [];
    this.doorMeshes = [];
    this.pickupMeshes = [];
    this.projectileMeshes.clear();
    this.players = [];
    this.cameras = [];
  }

  /**
   * Two modes. Smooth (internalHeight 0): native resolution at the device pixel ratio, filtered textures.
   * Retro: the canvas renders at a low internal height and CSS upscales it with nearest-neighbour.
   * Rects stay in CSS pixels (for the HUD); GL viewports are in the renderer's logical units (rect × glScale).
   */
  resize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const views = Math.max(1, this.cameras.length);
    const retro = this.internalHeight > 0;
    // Stacked views each get the full internal height.
    const target = retro ? this.internalHeight * (views === 2 && this.split === 'horizontal' ? 2 : 1) : h;
    this.glScale = Math.min(1, target / h);
    this.renderer.setPixelRatio(retro ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.logicalH = Math.max(1, Math.round(h * this.glScale));
    this.renderer.setSize(Math.max(1, Math.round(w * this.glScale)), this.logicalH, false);
    const style = this.renderer.domElement.style;
    style.width = `${w}px`;
    style.height = `${h}px`;
    style.imageRendering = retro ? 'pixelated' : 'auto';
    setTextureSmoothing(!retro);
    this.rects = computeViewRects(views, w, h, this.split);
  }

  private logicalH = 1;

  drawCalls = 0;

  viewRects(): ViewRect[] {
    return this.rects;
  }

  /** Vision cones, paths and last-known positions per guard. */
  private drawDebug(world: World): void {
    const lines = this.debugLines!;
    const pos = lines.geometry.getAttribute('position') as THREE.BufferAttribute;
    const col = lines.geometry.getAttribute('color') as THREE.BufferAttribute;
    let n = 0;
    const seg = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, color: string): void => {
      if (n + 2 > pos.count) return;
      _c.set(color);
      pos.setXYZ(n, ax, ay, az);
      col.setXYZ(n++, _c.r, _c.g, _c.b);
      pos.setXYZ(n, bx, by, bz);
      col.setXYZ(n++, _c.r, _c.g, _c.b);
    };
    for (const g of world.guards) {
      const def = world.data.enemies[g.archetype];
      if (!def || g.state === 'dead') continue;
      const color = STATE_COLORS[g.state] ?? '#fff';
      const y = g.y + 0.1;
      const half = (def.visionFovDeg * Math.PI) / 360;
      const r = def.visionRange;
      const steps = 10;
      let px = g.x + Math.sin(g.yaw - half) * r;
      let pz = g.z - Math.cos(g.yaw - half) * r;
      seg(g.x, y, g.z, px, y, pz, color);
      for (let i = 1; i <= steps; i++) {
        const a = g.yaw - half + (2 * half * i) / steps;
        const qx = g.x + Math.sin(a) * r;
        const qz = g.z - Math.cos(a) * r;
        seg(px, y, pz, qx, y, qz, color);
        px = qx;
        pz = qz;
      }
      seg(g.x, y, g.z, px, y, pz, color);
      let lx = g.x;
      let lz = g.z;
      for (let i = g.pathIndex; i < g.path.length; i++) {
        const w = g.path[i]!;
        seg(lx, y + 0.05, lz, w.x, y + 0.05, w.z, '#40a0ff');
        lx = w.x;
        lz = w.z;
      }
      if (g.lastKnown) {
        const k = g.lastKnown;
        seg(k.x - 0.4, y + 0.1, k.z, k.x + 0.4, y + 0.1, k.z, '#ff40ff');
        seg(k.x, y + 0.1, k.z - 0.4, k.x, y + 0.1, k.z + 0.4, '#ff40ff');
      }
      // Awareness bar above the head.
      const top = g.y + g.height + 0.3;
      seg(g.x - 0.4, top, g.z, g.x - 0.4 + 0.8 * g.awareness, top, g.z, color);
    }
    lines.geometry.setDrawRange(0, n);
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }

  private grid: Grid | null = null;
  private frustum = new THREE.Frustum();
  private projView = new THREE.Matrix4();
  private sphere = new THREE.Sphere();

  /**
   * Skinned characters cannot use three's per-mesh culling (their bounds are in bind pose), so cull
   * each figure as a whole with a sphere around it, separately for every view.
   */
  private cullActors(cam: THREE.PerspectiveCamera): void {
    cam.updateMatrixWorld();
    this.projView.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projView);
    const test = (o: THREE.Object3D, wanted: boolean): void => {
      if (!wanted) {
        o.visible = false;
        return;
      }
      this.sphere.center.set(o.position.x, o.position.y + 0.9, o.position.z);
      this.sphere.radius = 1.3;
      o.visible = this.frustum.intersectsSphere(this.sphere) && !this.hiddenByWalls(cam.position, o.position);
    };
    for (const v of this.guards) if (v.model) test(v.model.root, true);
    for (const v of this.players) if (v.model) test(v.model.root, true);
  }

  /** True when level walls block the view of both a figure's head and its feet. */
  private hiddenByWalls(from: THREE.Vector3, at: THREE.Vector3): boolean {
    const grid = this.grid;
    if (!grid) return false;
    const blocked = (y: number): boolean => {
      const dx = at.x - from.x;
      const dy = y - from.y;
      const dz = at.z - from.z;
      const d = Math.hypot(dx, dy, dz);
      if (d < 0.5) return false;
      return rayGrid(grid, { ox: from.x, oy: from.y, oz: from.z, dx: dx / d, dy: dy / d, dz: dz / d }, d - 0.4) !== null;
    };
    return blocked(at.y + 1.6) && blocked(at.y + 0.3) && blocked(at.y + 1.0);
  }

  private updateProjectiles(world: World, alpha: number): void {
    const alive = new Set<number>();
    for (const pr of world.projectiles) {
      alive.add(pr.id);
      let m = this.projectileMeshes.get(pr.id);
      if (!m) {
        m = this.projectileMesh(world, pr.weapon);
        this.projectileMeshes.set(pr.id, m);
        this.dynamic.add(m);
      }
      m.position.set(lerp(pr.prev.x, pr.x, alpha), lerp(pr.prev.y, pr.y, alpha), lerp(pr.prev.z, pr.z, alpha));
      const spin = Math.hypot(pr.vx, pr.vz);
      m.rotation.x += spin * 0.02;
      m.rotation.y += spin * 0.01;
    }
    for (const [id, m] of this.projectileMeshes) {
      if (alive.has(id)) continue;
      this.dynamic.remove(m);
      this.projectileMeshes.delete(id);
    }
  }

  onSimEvent(e: SimEvent): void {
    // Blood on a player would burst right in front of their own camera; the hurt overlay covers it.
    if (e.type === 'impact' && !(e.onPlayer && this.cameras.length === 1)) this.effects.impact(e.x, e.y, e.z, e.nx, e.ny, e.nz, e.surface);
    else if (e.type === 'propDestroyed') this.effects.burst(e.x, e.y, e.z, '#6a6a6a', 24, 5);
    else if (e.type === 'explosion') this.effects.explosion(e.x, e.y + 0.2, e.z, e.radius);
  }

  render(world: World, alpha: number, looks: ViewLook[], frameTime: number): void {
    this.effects.update(Math.min(frameTime, 0.05));
    this.time += frameTime;
    const p0 = world.players[0];
    if (this.snow && p0) this.snow.update(Math.min(frameTime, 0.05), p0.x, p0.z, this.time);
    // Guards drop loot mid-level; build meshes for pickups that appeared since the last frame.
    for (let i = this.pickupMeshes.length; i < world.pickups.length; i++) this.addPickup(world, world.pickups[i]!);
    this.updateProjectiles(world, alpha);
    world.pickups.forEach((pk, i) => {
      const m = this.pickupMeshes[i];
      if (!m) return;
      m.visible = pk.active;
      m.rotation.y = this.time * 1.6 + i;
      m.position.y = pk.y + 0.45 + Math.sin(this.time * 2.4 + i) * 0.06;
    });
    world.props.forEach((p, i) => {
      const m = this.propMeshes[i];
      if (m) m.visible = p.alive;
      // Alarm panels flash once the alarm is raised.
      if (m && world.alarm.raised && world.data.props[p.kind]?.alarm) {
        const mat = (m as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
        if (mat?.color) mat.color.setScalar(Math.sin(this.time * 12) > 0 ? 2.2 : 1);
      }
    });
    world.doors.forEach((d, i) => {
      const m = this.doorMeshes[i];
      if (!m) return;
      const b = doorBox(world, d);
      m.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2);
    });

    // Reinforcements arrive with the alarm.
    while (this.guards.length < world.guards.length) this.guards.push(this.guardVisual(world, world.guards[this.guards.length]!));
    world.guards.forEach((g, i) => {
      const v = this.guards[i];
      if (!v) return;
      const x = lerp(g.prev.x, g.x, alpha);
      const y = lerp(g.prev.y, g.y, alpha);
      const z = lerp(g.prev.z, g.z, alpha);
      const speed = Math.hypot(g.vx, g.vz);
      if (v.model) {
        const m = v.model;
        m.root.position.set(x, y, z);
        m.root.rotation.y = -g.yaw;
        if (g.state === 'dead') m.play('die');
        else if (g.crouching) m.play('crouch');
        else if (g.state === 'attack' && g.sees && speed < 0.1) m.play(g.sinceShot < 0.35 ? 'shoot' : 'aim');
        else if (speed > 2.5) m.play('run');
        else if (speed > 0.1) m.play('walk');
        else m.play(g.state === 'attack' || g.state === 'suspicious' ? 'alert' : 'idle');
        m.update(Math.min(frameTime, 0.05), speed > 2.5 ? speed / 5 : speed / 1.6);
        m.light(Math.min(1.1, this.light(x, z) + 0.15));
        v.flash.visible = g.state !== 'dead' && g.sinceShot < 0.06;
        return;
      }
      v.phase += speed * frameTime * 3.4;
      v.h.root.position.set(x, y, z);
      v.h.root.rotation.y = -g.yaw;
      lightHumanoid(v.h, Math.min(1.15, this.light(x, z) + 0.1));
      const dead = g.state === 'dead';
      const fall = dead ? Math.min(1, g.deadTime / 0.55) : 0;
      // Death: topple backwards around the feet and settle on the floor.
      v.h.root.rotation.x = (Math.PI / 2) * fall * fall;
      v.h.root.position.y = y + 0.13 * fall;
      poseHumanoid(v.h, {
        phase: dead ? 0 : v.phase,
        stride: dead ? 0 : Math.min(1, speed / 3),
        crouch: g.crouching && !dead ? 1 : 0,
        aim: g.state === 'attack' && !dead ? 1 : 0,
        pitch: g.aimPitch,
      });
      v.h.body.rotation.x = -g.flinch * 1.2;
      v.flash.visible = !dead && g.sinceShot < 0.06;
    });
    if (this.debugLines) this.drawDebug(world);

    world.players.forEach((p, i) => {
      const v = this.players[i];
      if (!v) return;
      const x = lerp(p.prev.x, p.x, alpha);
      const y = lerp(p.prev.y, p.y, alpha);
      const z = lerp(p.prev.z, p.z, alpha);
      const crouch = lerp(p.prev.crouch, p.crouch, alpha);
      const speed = Math.hypot(p.vx, p.vz);
      v.phase += speed * frameTime * 3.2;
      if (v.model) {
        const m = v.model;
        m.root.position.set(x, y - crouch * 0.45, z);
        m.root.rotation.y = -p.yaw;
        if (!p.alive) m.play('die');
        else if (p.sinceShot < 0.3 && speed < 0.5) m.play('shoot');
        else if (speed > 3) m.play('run');
        else if (speed > 0.2) m.play('walk');
        else m.play('idle');
        m.update(Math.min(frameTime, 0.05), speed > 3 ? speed / 5 : speed / 1.6);
        m.light(Math.min(1.1, this.light(x, z) + 0.15));
        m.setWeapon(p.weapon.id);
      }
      v.h.root.visible = p.alive && !v.model;
      v.h.root.position.set(x, y, z);
      lightHumanoid(v.h, Math.min(1.15, this.light(x, z) + 0.1));
      v.h.root.rotation.y = -p.yaw;
      poseHumanoid(v.h, { phase: v.phase, stride: Math.min(1, speed / 4), crouch, aim: 1, pitch: p.pitch });
      v.flash.visible = p.alive && p.sinceShot < 0.06 && (v.model?.hasMuzzle ?? true);

      const vm = this.viewModels[i];
      if (vm) {
        this.bob[i] = (this.bob[i] ?? 0) + speed * frameTime * 2.2;
        const def = world.data.weapons[p.weapon.id];
        vm.mixer?.update(Math.min(frameTime, 0.05));
        // Swap models at the bottom of the switch, while the hand is out of view.
        const switching = p.switchTimer > 0 ? 1 - p.switchTimer / SWITCH_TIME : -1;
        if (switching < 0 || switching >= 0.5) vm.setWeapon?.(p.weapon.id);
        poseViewModel(vm, {
          switching,
          sinceShot: p.sinceShot,
          reload: p.weapon.reloadTimer > 0 && def ? 1 - p.weapon.reloadTimer / def.reloadTime : -1,
          bobPhase: this.bob[i]!,
          bobAmount: p.grounded ? Math.min(1, speed / 4) : 0,
          alive: p.alive,
        });
      }

      const cam = this.cameras[i];
      if (!cam) return;
      const look = looks[i] ?? { yaw: 0, pitch: 0 };
      const eye = playerEyeHeight({ ...p, crouch } as typeof p);
      cam.position.set(x, y + eye, z);
      cam.rotation.y = -(p.yaw + look.yaw);
      cam.rotation.x = Math.max(-1.5, Math.min(1.5, p.pitch + look.pitch));
      if (!p.alive) {
        // Death camera: slump to the floor.
        const t = Math.min(1, (PLAYER.respawnDelay - p.deadTimer) * 2);
        cam.position.y = y + eye - t * (eye - 0.35);
        cam.rotation.z = t * 0.6;
      } else {
        cam.rotation.z = 0;
      }
      const holder = vm?.root.parent;
      if (holder) {
        cam.updateMatrixWorld();
        holder.position.copy(cam.position);
        holder.quaternion.copy(cam.quaternion);
      }
    });

    const r = this.renderer;
    const fullH = this.logicalH;
    const k = this.glScale;
    r.setScissorTest(true);
    r.info.autoReset = false;
    r.info.reset();
    this.cameras.forEach((cam, i) => {
      const rect = this.rects[i];
      if (!rect) return;
      cam.aspect = rect.w / rect.h;
      cam.updateProjectionMatrix();
      const x0 = Math.round(rect.x * k);
      const w0 = Math.round((rect.x + rect.w) * k) - x0;
      const h0 = Math.round(rect.h * k);
      const y = fullH - Math.round(rect.y * k) - h0;
      r.setViewport(x0, y, w0, h0);
      r.setScissor(x0, y, w0, h0);
      this.cullActors(cam);
      r.render(this.scene, cam);
      r.autoClear = false;
      r.clearDepth();
      r.render(this.vmScene, cam);
      r.autoClear = true;
    });
    r.setScissorTest(false);
    this.drawCalls = r.info.render.calls / Math.max(1, this.cameras.length);
  }
}

const _c = new THREE.Color();

function disposeDeep(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}

/**
 * Sizes a prop model to its collision box: 'footprint' scales uniformly to fill the floor area,
 * 'stretch' fills the box exactly. `mb` is the model's current world box; yaw is a multiple of 90°
 * for boxed props, so local x maps to world x or z.
 */
function fitToBox(o: THREE.Object3D, mb: THREE.Box3, b: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }, mode: 'footprint' | 'stretch'): void {
  const ms = mb.getSize(new THREE.Vector3());
  const rx = (b.maxX - b.minX) / Math.max(ms.x, 1e-3);
  const ry = (b.maxY - b.minY) / Math.max(ms.y, 1e-3);
  const rz = (b.maxZ - b.minZ) / Math.max(ms.z, 1e-3);
  if (mode === 'footprint') {
    o.scale.multiplyScalar(Math.min(rx, rz));
    return;
  }
  const swap = Math.abs(Math.cos(o.rotation.y)) < 0.7;
  o.scale.multiply(new THREE.Vector3(swap ? rz : rx, ry, swap ? rx : rz));
}
