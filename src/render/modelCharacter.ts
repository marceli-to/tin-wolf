import * as THREE from 'three';
import type { ModelInstance } from './models';
import { measureHeight, tintModel } from './models';
import { flatMaterial, shadedBox } from './shapes';

/** Game-side animation names; each art set maps them to its own clip names. */
export type CharacterAnim = 'idle' | 'alert' | 'walk' | 'run' | 'aim' | 'shoot' | 'die';

export interface CharacterProfile {
  model: string;
  clips: Record<CharacterAnim, string>;
  /** Bone the gun is parented to. */
  hand: string;
  /** Optional gun model and its placement in hand-bone space (metres, radians). */
  gun?: { model: string; scale: number; position: [number, number, number]; rotation: [number, number, number] };
  /** Placement of the fallback box gun when no gun model is given. */
  boxGun?: { position: [number, number, number] };
}

export interface ArtSet {
  guard: CharacterProfile;
  officer: CharacterProfile;
  /** Player bodies (seen by the other player in split-screen); the named material takes the player colour. */
  player?: CharacterProfile & { tintMaterial: string };
  /** First-person gun model and its placement in view-model space. */
  viewGun?: { model: string; scale: number; position: [number, number, number]; rotation: [number, number, number] };
}

const Q_PISTOL = { model: 'quaternius/Pistol.glb', scale: 0.3, position: [0, 0.1, 0.02] as [number, number, number], rotation: [0, Math.PI / 2, -Math.PI / 2] as [number, number, number] };

export const PROFILES: Record<string, ArtSet> = {
  quaternius: {
    guard: {
      model: 'quaternius/Swat.glb',
      clips: { idle: 'Idle_Gun', alert: 'Idle_Gun_Pointing', walk: 'Walk', run: 'Run', aim: 'Idle_Gun_Pointing', shoot: 'Idle_Gun_Shoot', die: 'Death' },
      hand: 'Wrist.R',
      gun: Q_PISTOL,
    },
    officer: {
      model: 'quaternius/Suit.glb',
      clips: { idle: 'Idle', alert: 'Idle_Gun_Pointing', walk: 'Walk', run: 'Run', aim: 'Idle_Gun_Pointing', shoot: 'Idle_Gun_Shoot', die: 'Death' },
      hand: 'Wrist.R',
      gun: Q_PISTOL,
    },
    player: {
      model: 'quaternius/Swat.glb',
      clips: { idle: 'Idle_Gun', alert: 'Idle_Gun', walk: 'Walk', run: 'Run', aim: 'Idle_Gun_Pointing', shoot: 'Idle_Gun_Shoot', die: 'Death' },
      hand: 'Wrist.R',
      gun: Q_PISTOL,
      tintMaterial: 'Swat',
    },
    viewGun: { model: 'quaternius/Pistol.glb', scale: 0.25, position: [0.01, -0.03, 0.0], rotation: [0.06, -Math.PI / 2, 0] },
  },
};

export function profileModels(art: string): string[] {
  const set = PROFILES[art];
  if (!set) return [];
  const profiles = [set.guard, set.officer, ...(set.player ? [set.player] : [])];
  return [...profiles.flatMap((p) => [p.model, ...(p.gun ? [p.gun.model] : [])]), ...(set.viewGun ? [set.viewGun.model] : [])];
}

const FADE = 0.18;

/** Animated glTF character driven by sim state. Faces -z like the box humanoid. */
export class ModelCharacter {
  readonly root = new THREE.Group();
  readonly flash: THREE.Object3D;
  /** The hand-held gun, exposed for placement tuning. */
  readonly gun: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current: CharacterAnim | null = null;
  private materials: THREE.MeshStandardMaterial[];

  constructor(
    model: ModelInstance,
    private profile: CharacterProfile,
    height: number,
    flashMaterial: THREE.Material,
    gunModel: ModelInstance | null,
  ) {
    const inner = model.object;
    const h = measureHeight(inner) || 1;
    inner.scale.setScalar(height / h);
    // glTF characters face +z; the game's figures face -z.
    inner.rotation.y = Math.PI;
    this.root.add(inner);
    this.materials = [...model.materials, ...(gunModel?.materials ?? [])];
    this.mixer = new THREE.AnimationMixer(inner);
    for (const clip of model.animations) this.actions.set(clip.name, this.mixer.clipAction(clip));
    const die = this.actions.get(profile.clips.die);
    if (die) {
      die.setLoop(THREE.LoopOnce, 1);
      die.clampWhenFinished = true;
    }
    const hand = inner.getObjectByName(profile.hand) ?? inner;
    // Undo the character's scale so gun offsets are in metres.
    const holder = new THREE.Group();
    holder.scale.setScalar(1 / inner.scale.x);
    hand.add(holder);
    if (gunModel && profile.gun) {
      const g = gunModel.object;
      g.scale.setScalar(profile.gun.scale);
      g.position.set(...profile.gun.position);
      g.rotation.set(...profile.gun.rotation);
      holder.add(g);
      this.gun = g;
    } else {
      const box = new THREE.Mesh(shadedBox(0.07, 0.12, 0.28), flatMaterial('#232428'));
      box.position.set(...(profile.boxGun?.position ?? [0, 0, 0]));
      holder.add(box);
      this.gun = box;
    }
    const flash = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), flashMaterial);
    flash.position.set(0, 0, 0.25);
    flash.visible = false;
    holder.add(flash);
    this.flash = flash;
    this.play('idle');
  }

  play(name: CharacterAnim): void {
    if (name === this.current) return;
    const next = this.actions.get(this.profile.clips[name]);
    if (!next) return;
    const prev = this.current ? this.actions.get(this.profile.clips[this.current]) : null;
    if (prev === next) {
      this.current = name;
      return;
    }
    next.reset().setEffectiveWeight(1).fadeIn(FADE).play();
    prev?.fadeOut(FADE);
    this.current = name;
  }

  update(dt: number, speedScale: number): void {
    this.mixer.timeScale = this.current === 'walk' || this.current === 'run' ? speedScale : 1;
    this.mixer.update(dt);
  }

  light(l: number): void {
    tintModel(this.materials, l);
  }
}
