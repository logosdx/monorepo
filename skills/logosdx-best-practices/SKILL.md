---
name: logosdx-best-practices
description: "Use when writing code with LogosDX packages. Covers philosophy, package selection, error handling with attempt(), 4-block function structure, and when to use each @logosdx package."
license: MIT
metadata:
  author: logosdx
  version: "1.0"
---

## Quick Start

```typescript
import { attempt, attemptSync, assert, isObject } from '@logosdx/utils'

// I/O operations use error tuples — never try-catch
const [user, err] = await attempt(() => fetchUser(id))
if (err) throw err

// Sync parsing uses attemptSync
const [parsed, parseErr] = attemptSync(() => JSON.parse(raw))
if (parseErr) return defaultValue

// Business logic throws directly — no error tuple
function calculateTotal(items: CartItem[]): number {

    if (!items.length) throw new Error('Empty cart')
    return items.reduce((sum, i) => sum + i.price * i.qty, 0)
}
```

## Critical Rules

1. **Never use try-catch.** Use `attempt()` for async I/O, `attemptSync()` for sync I/O. Business logic that fails is a bug — let it throw naturally.
2. **Follow the 4-block function structure** in order: Declaration, Validation, Business Logic, Commit. See [function-structure.md](references/function-structure.md).
3. **Dogfood `@logosdx/utils`** for error handling, data operations, flow control, and validation throughout all packages.
4. **Always clean up listeners and engines.** Store cleanup functions and call them on teardown. Call `destroy()` on engines when done.
5. **Validate before executing.** Catch bad inputs in the Validation block so business logic never operates on invalid data.

## Package Selection Guide

| Need | Package | Key Exports |
|------|---------|-------------|
| Error handling, flow control, data ops | `@logosdx/utils` | `attempt`, `retry`, `circuitBreaker`, `clone`, `merge` |
| HTTP client with retry, cache, dedup | `@logosdx/fetch` | `FetchEngine`, `isFetchError` |
| Typed events, async iteration, queues | `@logosdx/observer` | `ObserverEngine`, `EventQueue` |
| DOM manipulation, behaviors, viewport | `@logosdx/dom` | `$`, `html.css`, `html.events`, `html.behaviors` |
| State management with history | `@logosdx/state-machine` | `StateMachine` |
| Typed localStorage/sessionStorage | `@logosdx/storage` | `StorageAdapter` |
| Internationalization | `@logosdx/localize` | `LocaleManager` |
| React context + hooks for engines | `@logosdx/react` | `createObserverContext`, `createFetchContext`, `composeProviders` |
| Unified orchestration | `@logosdx/kit` | `appKit` |

See [package-selection-guide.md](references/package-selection-guide.md) for detailed use cases.

## Anti-Patterns

```typescript
// WRONG: try-catch for I/O
try { const user = await fetchUser(id) }
catch (err) { handleError(err) }

// RIGHT: error tuple
const [user, err] = await attempt(() => fetchUser(id))
if (err) return handleError(err)

// WRONG: error tuple for pure business logic
const [total, err] = attemptSync(() => calculateTotal(items))

// RIGHT: business logic throws directly
const total = calculateTotal(items) // let it throw if buggy

// WRONG: forgetting cleanup
observer.on('event', handler) // listener leaks

// RIGHT: store and call cleanup
const cleanup = observer.on('event', handler)
onTeardown(() => cleanup())

// WRONG: missing validation before business logic
function process(data) { return transform(data) }

// RIGHT: validate inputs first
function process(data: Data): Result {
    assert(isObject(data), 'data must be an object')
    return transform(data)
}
```

See [anti-patterns.md](references/anti-patterns.md) for more examples.

## References

- [package-selection-guide.md](references/package-selection-guide.md) — Detailed guidance on which package to use for what
- [anti-patterns.md](references/anti-patterns.md) — Common mistakes and their corrections
- [function-structure.md](references/function-structure.md) — The 4-block function structure with examples
