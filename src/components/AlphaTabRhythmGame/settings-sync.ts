// Simple event emitter for settings synchronization
type Listener = (source: string) => void;

class SettingsSyncEmitter {
  private listeners: Set<Listener> = new Set();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify(source: string = "unknown"): void {
    this.listeners.forEach((listener) => listener(source));
  }
}

export const settingsSyncEmitter = new SettingsSyncEmitter();
