import { forwardFromAngles } from '../core/math';
import type { WeaponDef } from '../data/schema';
import { actorShapes, applyDamage, damageProp } from './combat';
import type { ActorRef } from './events';
import { clearLine } from './los';
import { rayBox, rayGrid, type Ray, type RayHit } from './raycast';
import { hitTarget } from './targets';
import { doorBox, emit, type World } from './world';

const RADIUS = 0.08;
/** Lighter than body gravity so throws carry across a room. */
const GRAVITY = 12;
/** Fraction of speed kept along the surface normal / along the surface after a bounce. */
const RESTITUTION = 0.3;
const FRICTION = 0.7;
/** Rolling drag on the floor, per second. */
const ROLL_DRAG = 3.5;

/** Launch a thrown weapon from an eye position along a view direction, lofted slightly upward. */
export function throwProjectile(world: World, owner: ActorRef, x: number, y: number, z: number, yaw: number, pitch: number, def: WeaponDef, weaponId: string): void {
  const dir = forwardFromAngles(yaw, pitch + 0.18);
  // Start just in front of the eye so it never begins inside the thrower's own wall.
  const start = 0.35;
  const sx = x + dir.x * start;
  const sy = y + dir.y * start - 0.1;
  const sz = z + dir.z * start;
  world.projectiles.push({
    id: world.nextProjectile++,
    weapon: weaponId,
    owner,
    x: sx,
    y: sy,
    z: sz,
    vx: dir.x * def.throwSpeed,
    vy: dir.y * def.throwSpeed,
    vz: dir.z * def.throwSpeed,
    fuse: def.fuse,
    prev: { x: sx, y: sy, z: sz },
  });
  emit(world, { type: 'thrown', shooter: owner, x, y, z, weapon: weaponId });
}

/** Nearest solid surface along a segment: level, solid props or closed doors. */
function sweep(world: World, ray: Ray, len: number): RayHit | null {
  let best = rayGrid(world.grid, ray, len);
  const limit = (): number => (best ? best.t : len);
  for (const p of world.props) {
    if (!p.alive || !p.solid) continue;
    const h = rayBox(ray, p.box, limit());
    if (h) best = h;
  }
  for (const d of world.doors) {
    if (d.open >= 0.95) continue;
    const h = rayBox(ray, doorBox(world, d), limit());
    if (h) best = h;
  }
  return best;
}

export function updateProjectiles(world: World, dt: number): void {
  for (const pr of world.projectiles) {
    pr.prev = { x: pr.x, y: pr.y, z: pr.z };
    pr.vy -= GRAVITY * dt;
    let remaining = dt;
    // Up to three bounces per tick; anything left over is dropped.
    for (let i = 0; i < 3 && remaining > 1e-5; i++) {
      const speed = Math.hypot(pr.vx, pr.vy, pr.vz);
      const len = speed * remaining;
      if (len < 1e-5) break;
      const ray: Ray = { ox: pr.x, oy: pr.y, oz: pr.z, dx: pr.vx / speed, dy: pr.vy / speed, dz: pr.vz / speed };
      const hit = sweep(world, ray, len + RADIUS);
      if (!hit || hit.t > len + RADIUS) {
        pr.x += pr.vx * remaining;
        pr.y += pr.vy * remaining;
        pr.z += pr.vz * remaining;
        break;
      }
      const t = Math.max(0, hit.t - RADIUS);
      pr.x += ray.dx * t;
      pr.y += ray.dy * t;
      pr.z += ray.dz * t;
      remaining *= 1 - t / len;
      // Reflect: normal component reversed and damped, tangential component slowed.
      const vn = pr.vx * hit.nx + pr.vy * hit.ny + pr.vz * hit.nz;
      const tx = pr.vx - vn * hit.nx;
      const ty = pr.vy - vn * hit.ny;
      const tz = pr.vz - vn * hit.nz;
      pr.vx = tx * FRICTION - vn * hit.nx * RESTITUTION;
      pr.vy = ty * FRICTION - vn * hit.ny * RESTITUTION;
      pr.vz = tz * FRICTION - vn * hit.nz * RESTITUTION;
      if (Math.abs(vn) > 2) emit(world, { type: 'bounce', x: pr.x, y: pr.y, z: pr.z });
      // Resting on a floor: stop jittering.
      if (hit.ny > 0.5 && Math.abs(pr.vy) < 0.8) {
        pr.vy = 0;
        if (Math.hypot(pr.vx, pr.vz) < 0.3) pr.vx = pr.vz = 0;
      }
    }
    // Rolling on a floor loses speed quickly (contact checked just below the grenade).
    const below = rayGrid(world.grid, { ox: pr.x, oy: pr.y, oz: pr.z, dx: 0, dy: -1, dz: 0 }, RADIUS + 0.05);
    if (below) {
      const k = Math.exp(-ROLL_DRAG * dt);
      pr.vx *= k;
      pr.vz *= k;
    }
    pr.fuse -= dt;
  }
  const exploding = world.projectiles.filter((p) => p.fuse <= 0);
  if (!exploding.length) return;
  world.projectiles = world.projectiles.filter((p) => p.fuse > 0);
  for (const pr of exploding) {
    const def = world.data.weapons[pr.weapon];
    if (def) explode(world, pr.owner, pr.x, pr.y, pr.z, def);
  }
}

/** Blast damage falls off linearly with distance and is blocked by walls, doors and props. */
export function explode(world: World, owner: ActorRef, x: number, y: number, z: number, def: WeaponDef): void {
  const r = def.blastRadius;
  // Measure from slightly above the grenade so a floor-level blast is not blocked by the floor.
  const ey = y + 0.25;
  emit(world, { type: 'explosion', owner, x, y, z, radius: r, noise: def.noiseRadius });
  for (const a of actorShapes(world)) {
    const ay = a.y + a.height * 0.5;
    const d = Math.hypot(a.x - x, ay - ey, a.z - z);
    if (d > r + a.height * 0.5) continue;
    if (!clearLine(world, x, ey, z, a.x, ay, a.z) && !clearLine(world, x, ey, z, a.x, a.y + 0.3, a.z)) continue;
    const k = Math.max(0, 1 - Math.max(0, d - 0.5) / r);
    if (k <= 0) continue;
    applyDamage(world, a.ref, def.blastDamage * k, 'torso', owner, { x: a.x, y: ay, z: a.z });
  }
  world.props.forEach((p, i) => {
    if (!p.alive || !p.destructible) return;
    const b = p.box;
    const cx = Math.max(b.minX, Math.min(x, b.maxX));
    const cy = Math.max(b.minY, Math.min(ey, b.maxY));
    const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
    const d = Math.hypot(cx - x, cy - ey, cz - z);
    if (d <= r) damageProp(world, i, def.blastDamage * (1 - d / r));
  });
  // Training targets in the blast (and in sight of it) go down.
  const thrower = owner.kind === 'player' ? (world.players[owner.slot] ?? null) : null;
  world.targets.forEach((t, i) => {
    if (Math.hypot(t.x - x, t.y - ey, t.z - z) > r + t.radius) return;
    if (!clearLine(world, x, ey, z, t.x, t.y, t.z)) return;
    hitTarget(world, i, thrower, null);
  });
}
