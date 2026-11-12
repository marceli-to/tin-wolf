import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';

interface Ev {
  ping: { n: number };
  pong: string;
}

describe('EventBus', () => {
  it('delivers typed payloads and unsubscribes', () => {
    const bus = new EventBus<Ev>();
    const got: number[] = [];
    const off = bus.on('ping', (p) => got.push(p.n));
    bus.emit('ping', { n: 1 });
    off();
    bus.emit('ping', { n: 2 });
    expect(got).toEqual([1]);
  });
  it('allows a listener to remove itself during emit', () => {
    const bus = new EventBus<Ev>();
    const got: string[] = [];
    const off = bus.on('pong', (s) => {
      got.push(s);
      off();
    });
    bus.on('pong', (s) => got.push(s + '!'));
    bus.emit('pong', 'a');
    bus.emit('pong', 'b');
    expect(got).toEqual(['a', 'a!', 'b!']);
  });
});
