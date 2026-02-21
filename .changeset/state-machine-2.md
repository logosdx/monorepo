---
"@logosdx/state-machine": major
---

## Breaking Changes

### Complete rewrite — XState-inspired declarative API

The entire `StateMachine` class has been rewritten from a stream-based reducer model to a declarative state machine with typed transitions, guards, actions, and async invocations.

**Before (reducer-based):**

```typescript
const sm = new StateMachine({ count: 0 }, { statesToKeep: 5 });
sm.addReducer((value, state) => ({ ...state, ...value }));
sm.addListener((newState, oldState) => console.log(newState));
sm.next({ count: 1 });
```

**After (declarative config):**

```typescript
const sm = new StateMachine({
    initial: 'idle',
    context: { count: 0 },
    transitions: {
        idle: { on: { INCREMENT: { target: 'idle', action: (ctx) => ({ ...ctx, count: ctx.count + 1 }) } } },
        done: { final: true },
    },
});

sm.on('idle', ({ context }) => console.log(context));
sm.send('INCREMENT');
```

### Constructor signature changed

**Before:**

```typescript
new StateMachine(initialState, options?)
```

**After:**

```typescript
new StateMachine(config: MachineConfig, options?: MachineOptions)
```

### State access changed

**Before:**

```typescript
sm.getState()        // returns current state object
sm.getStates()       // returns state history
sm.timeTravelTo(id)  // navigate history
```

**After:**

```typescript
sm.state    // current state name (string)
sm.context  // current context (cloned)
```

### Listener API changed

**Before:**

```typescript
sm.addListener((newState, oldState, flow) => { ... })
sm.removeListener(fn)
```

**After:**

```typescript
const cleanup = sm.on('stateName', (payload) => { ... })
sm.on('*', (payload) => { ... })          // all transitions
sm.on('$rejected', (payload) => { ... })  // rejected events
sm.on(/error|failed/, (payload) => { ... }) // regex patterns
sm.off('stateName', listener)
```

### Reducer API removed

`addReducer()`, `removeReducer()`, and `next()` have been removed. Use `send()` with typed events and transition actions instead.

### State history removed

`getStates()`, `timeTravelTo()`, `statesToKeep`, and `flushOnRead` options have been removed. The machine tracks only the current state and context.

### Parent/child relationships removed

`parent` and `bidirectional` options have been removed. Use `StateHub.connect()` for inter-machine communication instead.

## Added

* `feat(state-machine):` Declarative `MachineConfig` with typed `transitions`, `guards`, `actions`, and `final` states
* `feat(state-machine):` `invoke` — async side effects with `onDone` / `onError` transitions, auto-cancellation on state exit
* `feat(state-machine):` `StateHub` class — manage multiple machines with `get()` and declarative `connect()` for inter-machine wiring
* `feat(state-machine):` Transition validation at construction — invalid targets throw immediately
* `feat(state-machine):` `$rejected` events with `no_transition` and `guard_failed` reasons
* `feat(state-machine):` `$invoke.done`, `$invoke.error`, `$invoke.cancelled` system events
* `feat(state-machine):` `MachineOptions.persistence` — async hydration via `StorageAdapter` with `ready()` promise
* `feat(state-machine):` `debug` option — logs transitions via observer spy
* `feat(state-machine):` Regex pattern matching on `on()` via `@logosdx/observer`
* `feat(state-machine):` Full TypeScript generics — `StateMachine<Context, Events, States>` with typed `send()` signatures
