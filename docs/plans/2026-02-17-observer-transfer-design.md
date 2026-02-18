# Observer Listener Transfer & Copy


## Overview

Add static methods to `ObserverEngine` for transferring and copying event listeners between observer instances. This enables cloning scenarios (e.g., cloning a FetchEngine that extends ObserverEngine) where listeners for observability, logging, etc. should carry over to the new instance.


## API

```ts
// Move: source loses listeners, target gains them
ObserverEngine.transfer(source, target)
ObserverEngine.transfer(source, target, { filter: ['user:login', /^data:/] })
ObserverEngine.transfer(source, target, { exclude: [/^internal:/] })

// Copy: source keeps listeners, target also gets them
ObserverEngine.copy(source, target)
ObserverEngine.copy(source, target, { filter: [/^fetch:/] })
ObserverEngine.copy(source, target, { exclude: ['debug'] })
```


## Semantics

- **transfer**: Release listeners from source into target. Source no longer has them.
- **copy**: Duplicate listeners into target. Source keeps them.
- **Stacking**: Target's existing listeners are untouched. Transferred/copied listeners are added alongside them.
- Both handle string event listeners and regex event listeners.


## Options

```ts
ObserverEngine.TransferOptions<Shape> = {
    filter?: (Events<Shape> | RegExp)[]    // opt-in whitelist (applied first)
    exclude?: (Events<Shape> | RegExp)[]   // opt-out blacklist (applied second)
}
```

**Pipeline**: all events → narrow by `filter` (if provided) → remove by `exclude` (if provided) → transfer/copy remainder.

When both are provided, they compose: filter narrows first, exclude removes from that set.


## Implementation

- Static methods on `ObserverEngine` using Approach B: direct `#` private field access from within the class.
- For **transfer**: iterate source listener sets, add each callback to target's sets, delete from source's sets, clean up empty sets.
- For **copy**: same iteration, add to target, don't touch source.
- Filter matching: string filters match exact event keys, RegExp filters test against event name strings.
- No new instance methods or exposed internals needed.


## Non-Goals

- Not a clone — does not create new ObserverEngine instances.
- Does not transfer spy functions, emitValidators, or other config.
- Does not affect EventQueues or EventGenerators.
