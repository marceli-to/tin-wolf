import { AIM_ASSIST, PLAYER } from '../config';
import { angleDiff, clamp, yawTo } from '../core/math';
import type { PlayerIntent } from '../core/intent';
import { clearLine } from './los';
import { playerEyeHeight, zoomFactor } from './player';
import type { Player, World } from './world';

export interface AssistTarget {
  /** Yaw and pitch error from the crosshair to the target point (radians). */
  yaw: number;
  pitch: number;
  /** Angular distance, and the cone it has to be inside (wider for close targets). */
  angle: number;
  cone: number;
}

/**
 * The visible enemy closest to the crosshair, if one is inside the assist cone: living guards, and
 * other players in versus. The aim point is the middle of the figure.
 */
export function assistTarget(world: World, p: Player): AssistTarget | null {
  const ex = p.x;
  const ey = p.y + playerEyeHeight(p);
  const ez = p.z;
  const cands: { x: number; y: number; z: number }[] = [];
  for (const g of world.guards) if (g.state !== 'dead') cands.push({ x: g.x, y: g.y + g.height * AIM_ASSIST.aimHeight, z: g.z });
  for (const o of world.players) if (o !== p && o.alive) cands.push({ x: o.x, y: o.y + o.height * AIM_ASSIST.aimHeight, z: o.z });
  let best: AssistTarget | null = null;
  for (const c of cands) {
    const dx = c.x - ex;
    const dz = c.z - ez;
    const flat = Math.hypot(dx, dz);
    if (flat > AIM_ASSIST.range || flat < 0.3) continue;
    const yaw = angleDiff(p.yaw, yawTo(ex, ez, c.x, c.z));
    const pitch = Math.atan2(c.y - ey, flat) - p.pitch;
    const angle = Math.hypot(yaw * Math.cos(p.pitch), pitch);
    // The figure's own width counts: a close target fills more of the view.
    // Scoped in, the cone narrows with the view so it covers the same part of the screen.
    const cone = (AIM_ASSIST.coneDeg * (Math.PI / 180)) / zoomFactor(world, p) + Math.atan2(PLAYER.radius * 1.5, flat);
    if (angle > cone || (best && angle >= best.angle)) continue;
    if (!clearLine(world, ex, ey, ez, c.x, c.y, c.z)) continue;
    best = { yaw, pitch, angle, cone };
  }
  return best;
}

/**
 * Gamepad aim assist, applied to the look deltas of an intent with `aimAssist` set:
 * - slowdown: turning is damped while the crosshair is over or near a target, so it does not skate past;
 * - pull: while the player is turning or moving, the aim drifts toward the target. Standing still
 *   with the stick untouched never moves the aim, so the game does not aim by itself.
 */
export function applyAimAssist(world: World, p: Player, intent: PlayerIntent, dt: number): void {
  if (!intent.aimAssist || !p.alive) return;
  const t = assistTarget(world, p);
  if (!t) return;
  const near = 1 - t.angle / t.cone;
  const slow = 1 - (1 - AIM_ASSIST.slowdown) * near;
  intent.lookYaw *= slow;
  intent.lookPitch *= slow;
  const active = Math.abs(intent.lookYaw) + Math.abs(intent.lookPitch) > 1e-5 || Math.abs(intent.moveX) + Math.abs(intent.moveZ) > 0.1;
  if (!active) return;
  const pull = AIM_ASSIST.pullRate * dt * near;
  intent.lookYaw += clamp(t.yaw, -pull, pull);
  intent.lookPitch += clamp(t.pitch, -pull, pull);
}
