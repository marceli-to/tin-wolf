import { emit, type World } from './world';

export interface MatchState {
  killLimit: number;
  timeLimit: number;
  timeLeft: number;
  over: boolean;
  /** Winning slot, or null for a draw. */
  winner: number | null;
}

export function createMatch(killLimit: number, timeLimit: number): MatchState {
  return { killLimit, timeLimit, timeLeft: timeLimit, over: false, winner: null };
}

/** Score is kills; leaders are all slots with the top score. */
export function leaders(world: World): number[] {
  const top = Math.max(...world.players.map((p) => p.kills));
  return world.players.filter((p) => p.kills === top).map((p) => p.slot);
}

export function updateMatch(world: World, dt: number): void {
  const m = world.match;
  if (!m || m.over) return;
  m.timeLeft = Math.max(0, m.timeLeft - dt);
  const winner = world.players.find((p) => p.kills >= m.killLimit);
  if (winner) return end(world, winner.slot);
  if (m.timeLeft <= 0) {
    const l = leaders(world);
    end(world, l.length === 1 ? l[0]! : null);
  }
}

function end(world: World, winner: number | null): void {
  const m = world.match!;
  m.over = true;
  m.winner = winner;
  emit(world, { type: 'matchEnded', winner });
}
