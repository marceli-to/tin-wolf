import * as THREE from 'three';
import type { ModelInstance } from './models';
import { measureHeight, tintModel } from './models';
import { flatMaterial, shadedBox } from './shapes';

export type CharacterAnim = 'idle' | 'walk' | 'sprint' | 'crouch' | 'holding-right' | 'holding-right-shoot' | 'die';

const FADE = 0.18;

/** Animated glTF character (Kenney mini characters) driven by sim state. Faces -z like the box humanoid. */
export class ModelCharacter {
  readonly root = new THREE.Group();
  readonly gun: THREE.Mesh;
  readonly flash: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current: CharacterAnim | null = null;

  constructor(
    private model: ModelInstance,
    height: number,
    flashMaterial: THREE.Material,
  ) {
    const inner = model.object;
    const h = measureHeight(inner) || 1;
    inner.scale.setScalar(height / h);
    // glTF characters face +z; the game's figures face -z.
    inner.rotation.y = Math.PI;
    this.root.add(inner);
    this.mixer = new THREE.AnimationMixer(inner);
    for (const clip of model.animations) this.actions.set(clip.name, this.mixer.clipAction(clip));
    const die = this.actions.get('die');
    if (die) {
      die.setLoop(THREE.LoopOnce, 1);
      die.clampWhenFinished = true;
    }
    // A plain dark pistol in the right hand (the pack's blasters are toys).
    this.gun = new THREE.Mesh(shadedBox(0.07, 0.12, 0.28), flatMaterial('#232428'));
    const hand = inner.getObjectByName('arm-right');
    const s = 1 / inner.scale.x;
    this.gun.scale.setScalar(s);
    this.gun.position.set(-0.05 * s, -0.42 * s, 0.12 * s);
    (hand ?? inner).add(this.gun);
    const flash = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), flashMaterial);
    flash.position.set(0, 0, 0.2);
    flash.visible = false;
    this.gun.add(flash);
    this.flash = flash;
    this.play('idle');
  }

  play(name: CharacterAnim): void {
    if (name === this.current) return;
    const next = this.actions.get(name);
    if (!next) return;
    const prev = this.current ? this.actions.get(this.current) : null;
    next.reset().setEffectiveWeight(1).fadeIn(FADE).play();
    prev?.fadeOut(FADE);
    this.current = name;
  }

  update(dt: number, speedScale: number): void {
    if (this.current === 'walk' || this.current === 'sprint') this.mixer.timeScale = speedScale;
    else this.mixer.timeScale = 1;
    this.mixer.update(dt);
  }

  light(l: number): void {
    tintModel(this.model.materials, l);
  }
}
