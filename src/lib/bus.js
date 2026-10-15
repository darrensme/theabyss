// Tiny event bus so far-apart pieces (terminal, easter eggs, galaxy, toasts)
// can talk without prop drilling.
const listeners = new Map();
const signals = new Map();

export const bus = {
  on(type, fn) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(fn);
    return () => listeners.get(type)?.delete(fn);
  },

  emit(type, payload) {
    listeners.get(type)?.forEach(fn => fn(payload));
  },

  // one-shot "this happened" flags that late subscribers can still await
  signal(name, value) {
    const entry = signals.get(name);
    if (entry) entry.resolve(value);
    else signals.set(name, { promise: Promise.resolve(value), resolve: () => {} });
  },

  waitFor(name) {
    if (!signals.has(name)) {
      let resolve;
      const promise = new Promise(r => (resolve = r));
      signals.set(name, { promise, resolve });
    }
    return signals.get(name).promise;
  }
};

export const toast = (message, opts) => bus.emit('toast', { message, ...opts });
