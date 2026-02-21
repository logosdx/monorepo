---
title: Events
description: Reactive storage events via @logosdx/observer.
---

# Events


StorageAdapter uses `@logosdx/observer` for reactive events.

[[toc]]

## Event Names


| Event | Fired |
|-------|-------|
| `before-set` | Before a value is written |
| `after-set` | After a value is written |
| `before-remove` | Before a key is removed |
| `after-remove` | After a key is removed |
| `clear` | When `clear()` is called |

## Event Payload


```typescript
interface StorageEventPayload<V, K extends keyof V> {
    key: K
    value?: V[K] | null
}
```

Which fields are present depends on the event:

| Event | `key` | `value` |
|-------|-------|---------|
| `before-set` | the key being written | the new value (or `null` if `undefined`) |
| `after-set` | the key that was written | the new value (or `null` if `undefined`) |
| `before-remove` | the key being removed | `null` |
| `after-remove` | the key that was removed | `null` |
| `clear` | *no payload* | *no payload* |

::: tip `undefined` becomes `null`
If the value passed to `set()` is `undefined`, the event payload normalizes it to `null`.
:::

## Subscribing


`on()` returns a cleanup function. Use `off()` for manual removal.

```typescript
// Subscribe -- returns cleanup function
const cleanup = storage.on('after-set', (event) => {
    console.log('Set:', event.key, event.value)
})

// Remove later
cleanup()

// Or use off() directly
function handleRemove(event) {
    console.log('Removed:', event.key)
}

storage.on('before-remove', handleRemove)
storage.off('before-remove', handleRemove)
```

## Event Ordering


- `before-*` fires before the driver operation.
- `after-*` fires after the driver operation.
- Bulk `set({ ... })` emits one event pair per key.
