/** One-shot things the sim reports each tick. Game forwards them to the event bus. */
export type SimEvent =
  | { type: 'shotFired'; shooter: ActorRef; x: number; y: number; z: number; weapon: string; noise: number }
  | { type: 'impact'; x: number; y: number; z: number; nx: number; ny: number; nz: number; surface: 'world' | 'flesh' | 'prop'; onPlayer?: boolean }
  | { type: 'hit'; target: ActorRef; shooter: ActorRef | null; zone: HitZone; damage: number; x: number; y: number; z: number }
  | { type: 'died'; target: ActorRef; killer: ActorRef | null; x?: number; z?: number }
  | { type: 'spawned'; slot: number }
  | { type: 'reloadStart'; slot: number }
  | { type: 'weaponSwitched'; slot: number; weapon: string }
  | { type: 'thrown'; shooter: ActorRef; x: number; y: number; z: number; weapon: string }
  | { type: 'bounce'; x: number; y: number; z: number }
  | { type: 'explosion'; owner: ActorRef; x: number; y: number; z: number; radius: number; noise: number }
  | { type: 'dryFire'; slot: number }
  | { type: 'pickup'; slot: number; item: string; x: number; y: number; z: number }
  | { type: 'doorOpened'; id: string; x: number; y: number; z: number }
  | { type: 'doorLocked'; id: string; slot: number; requires: string }
  | { type: 'propDestroyed'; id: string; x: number; y: number; z: number }
  | { type: 'guardAlerted'; id: string; x: number; y: number; z: number }
  | { type: 'alarmRaised'; id: string; x: number; y: number; z: number }
  | { type: 'alarmRunner'; id: string; x: number; z: number }
  | { type: 'objectiveCompleted'; id: string; text: string }
  | { type: 'missionEnded'; success: boolean; reason: string }
  | { type: 'matchEnded'; winner: number | null }
  | { type: 'used'; id: string; slot: number }
  | { type: 'footstep'; x: number; y: number; z: number; slot: number }
  | { type: 'guardStep'; x: number; z: number; running: boolean };

export type HitZone = 'head' | 'torso' | 'limb';

export type ActorRef = { kind: 'player'; slot: number } | { kind: 'guard'; index: number };

export type SimEventType = SimEvent['type'];
export type SimEventMap = { [K in SimEventType]: Extract<SimEvent, { type: K }> };
