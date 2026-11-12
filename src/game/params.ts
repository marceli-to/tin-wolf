export interface GameParams {
  level: string | null;
  players: number;
  debug: boolean;
  /** Skip the lobby (debug/testing): slot 0 gets keyboard+mouse, others the first free gamepads. */
  autostart: boolean;
  seed: number;
  /** 'kenney' turns on the glTF model art trial. */
  art: string;
}

export function readParams(search: string): GameParams {
  const q = new URLSearchParams(search);
  const players = Number(q.get('players') ?? '');
  return {
    level: q.get('level'),
    players: players >= 1 && players <= 2 ? players : 0,
    debug: q.get('debug') === '1',
    autostart: q.get('autostart') === '1',
    seed: Number(q.get('seed') ?? '') || Math.floor(Math.random() * 2 ** 31),
    art: q.get('art') ?? '',
  };
}
