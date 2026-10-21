/** Minimal key/value interface so saves can be tested without a browser. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export class MemoryStore implements KeyValueStore {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

/** localStorage when it is available and writable, otherwise an in-memory store. */
export function browserStore(): KeyValueStore {
  try {
    const probe = '__lowfront_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return {
      getItem: (k) => {
        try {
          return window.localStorage.getItem(k);
        } catch {
          return null;
        }
      },
      setItem: (k, v) => {
        try {
          window.localStorage.setItem(k, v);
        } catch {
          // Storage full or blocked: the game keeps running without saving.
        }
      },
    };
  } catch {
    return new MemoryStore();
  }
}
