/** What a player wants to do this tick. Produced by input devices or the debug hook, consumed by the sim. */
export interface PlayerIntent {
  /** Strafe, -1 (left) .. 1 (right). */
  moveX: number;
  /** Forward, -1 (back) .. 1 (forward). */
  moveZ: number;
  /** Look deltas for this tick, radians. Positive yaw turns right, positive pitch looks up. */
  lookYaw: number;
  lookPitch: number;
  fire: boolean;
  reload: boolean;
  interact: boolean;
  crouch: boolean;
  /** Cycle to the next / previous owned weapon (edge-triggered by the sim). */
  weaponNext: boolean;
  weaponPrev: boolean;
  /** Select owned weapon by number, 1-based; 0 = no request. */
  weaponSlot: number;
  /** Gamepad aim assist for this player's look (stick input). */
  aimAssist?: boolean;
}

export function emptyIntent(): PlayerIntent {
  return { moveX: 0, moveZ: 0, lookYaw: 0, lookPitch: 0, fire: false, reload: false, interact: false, crouch: false, weaponNext: false, weaponPrev: false, weaponSlot: 0 };
}
