/** Minimal typed event bus. `M` maps event names to payload types. */
export type Listener<T> = (payload: T) => void;

export class EventBus<M extends object> {
  private listeners = new Map<keyof M, Set<Listener<never>>>();

  on<K extends keyof M>(name: K, fn: Listener<M[K]>): () => void {
    let set = this.listeners.get(name);
    if (!set) {
      set = new Set();
      this.listeners.set(name, set);
    }
    set.add(fn as Listener<never>);
    return () => this.off(name, fn);
  }

  off<K extends keyof M>(name: K, fn: Listener<M[K]>): void {
    this.listeners.get(name)?.delete(fn as Listener<never>);
  }

  emit<K extends keyof M>(name: K, payload: M[K]): void {
    const set = this.listeners.get(name);
    if (!set) return;
    for (const fn of [...set]) (fn as Listener<M[K]>)(payload);
  }

  clear(): void {
    this.listeners.clear();
  }
}
