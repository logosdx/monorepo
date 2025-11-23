---
"@logosdx/observer": minor
---

feat(observer): add AbortSignal support for automatic listener cleanup

Adds `signal` option to `ObserverEngine`, `on()`, `once()`, and `observe()` for automatic cleanup when signals abort.

```ts
const controller = new AbortController();

// Instance-level: clears all listeners when aborted
const observer = new ObserverEngine({ signal: controller.signal });

// Per-listener: removes specific listener when aborted
observer.on('event', handler, { signal: controller.signal });

// Promise-based: rejects with AbortError when aborted
const data = await observer.once('event', { signal: controller.signal });

// Observed components: cleanup when aborted
observer.observe(component, { signal: controller.signal });
```

Also fixes missing `clear` method in `ObserverEngine.Child` type definition.
