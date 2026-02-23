# @logosdx/state-machine

## 2.0.0

### Major Changes

- 879cea2: ## Breaking Changes

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
    initial: "idle",
    context: { count: 0 },
    transitions: {
      idle: {
        on: {
          INCREMENT: {
            target: "idle",
            action: (ctx) => ({ ...ctx, count: ctx.count + 1 }),
          },
        },
      },
      done: { final: true },
    },
  });

  sm.on("idle", ({ context }) => console.log(context));
  sm.send("INCREMENT");
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
  sm.getState(); // returns current state object
  sm.getStates(); // returns state history
  sm.timeTravelTo(id); // navigate history
  ```

  **After:**

  ```typescript
  sm.state; // current state name (string)
  sm.context; // current context (cloned)
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

  - `feat(state-machine):` Declarative `MachineConfig` with typed `transitions`, `guards`, `actions`, and `final` states
  - `feat(state-machine):` `invoke` — async side effects with `onDone` / `onError` transitions, auto-cancellation on state exit
  - `feat(state-machine):` `StateHub` class — manage multiple machines with `get()` and declarative `connect()` for inter-machine wiring
  - `feat(state-machine):` Transition validation at construction — invalid targets throw immediately
  - `feat(state-machine):` `$rejected` events with `no_transition` and `guard_failed` reasons
  - `feat(state-machine):` `$invoke.done`, `$invoke.error`, `$invoke.cancelled` system events
  - `feat(state-machine):` `MachineOptions.persistence` — async hydration via `StorageAdapter` with `ready()` promise
  - `feat(state-machine):` `debug` option — logs transitions via observer spy
  - `feat(state-machine):` Regex pattern matching on `on()` via `@logosdx/observer`
  - `feat(state-machine):` Full TypeScript generics — `StateMachine<Context, Events, States>` with typed `send()` signatures

### Patch Changes

- Updated dependencies [2f9c85c]
- Updated dependencies [879cea2]
  - @logosdx/observer@2.4.0
  - @logosdx/utils@6.1.0

## 2.0.0-beta.1

### Major Changes

- 879cea2: ## Breaking Changes

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
    initial: "idle",
    context: { count: 0 },
    transitions: {
      idle: {
        on: {
          INCREMENT: {
            target: "idle",
            action: (ctx) => ({ ...ctx, count: ctx.count + 1 }),
          },
        },
      },
      done: { final: true },
    },
  });

  sm.on("idle", ({ context }) => console.log(context));
  sm.send("INCREMENT");
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
  sm.getState(); // returns current state object
  sm.getStates(); // returns state history
  sm.timeTravelTo(id); // navigate history
  ```

  **After:**

  ```typescript
  sm.state; // current state name (string)
  sm.context; // current context (cloned)
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

  - `feat(state-machine):` Declarative `MachineConfig` with typed `transitions`, `guards`, `actions`, and `final` states
  - `feat(state-machine):` `invoke` — async side effects with `onDone` / `onError` transitions, auto-cancellation on state exit
  - `feat(state-machine):` `StateHub` class — manage multiple machines with `get()` and declarative `connect()` for inter-machine wiring
  - `feat(state-machine):` Transition validation at construction — invalid targets throw immediately
  - `feat(state-machine):` `$rejected` events with `no_transition` and `guard_failed` reasons
  - `feat(state-machine):` `$invoke.done`, `$invoke.error`, `$invoke.cancelled` system events
  - `feat(state-machine):` `MachineOptions.persistence` — async hydration via `StorageAdapter` with `ready()` promise
  - `feat(state-machine):` `debug` option — logs transitions via observer spy
  - `feat(state-machine):` Regex pattern matching on `on()` via `@logosdx/observer`
  - `feat(state-machine):` Full TypeScript generics — `StateMachine<Context, Events, States>` with typed `send()` signatures

### Patch Changes

- Updated dependencies [2f9c85c]
- Updated dependencies [879cea2]
  - @logosdx/observer@2.4.0-beta.2
  - @logosdx/utils@6.1.0-beta.1

## 1.0.22-beta.0

### Patch Changes

- Updated dependencies [11e8233]
  - @logosdx/utils@6.1.0-beta.0

## 1.0.21

### Patch Changes

- Updated dependencies [5380675]
  - @logosdx/utils@6.0.0

## 1.0.20

### Patch Changes

- Updated dependencies [ea81582]
  - @logosdx/utils@5.1.0

## 1.0.19

### Patch Changes

- Updated dependencies [582644e]
- Updated dependencies [e4e4f43]
  - @logosdx/utils@5.0.0

## 1.0.18

### Patch Changes

- Updated dependencies [567ed1f]
- Updated dependencies [204dd76]
  - @logosdx/utils@4.0.0

## 1.0.17

### Patch Changes

- Updated dependencies [e6b07d8]
  - @logosdx/utils@3.0.1

## 1.0.16

### Patch Changes

- Updated dependencies [96fe247]
  - @logosdx/utils@3.0.0

## 1.0.15

### Patch Changes

- Updated dependencies [6416ac4]
  - @logosdx/utils@2.5.0

## 1.0.14

### Patch Changes

- Updated dependencies [8fda604]
  - @logosdx/utils@2.4.0

## 1.0.13

### Patch Changes

- Updated dependencies [9edb1c4]
- Updated dependencies [6560f02]
  - @logosdx/utils@2.3.0

## 1.0.12

### Patch Changes

- Updated dependencies [0cf6edd]
- Updated dependencies [0cf6edd]
- Updated dependencies [0cf6edd]
  - @logosdx/utils@2.2.0

## 1.0.11

### Patch Changes

- Updated dependencies [9e6afcd]
  - @logosdx/utils@2.1.2

## 1.0.10

### Patch Changes

- Updated dependencies [2c6c8cc]
  - @logosdx/utils@2.1.1

## 1.0.9

### Patch Changes

- Updated dependencies [755e80d]
  - @logosdx/utils@2.1.0

## 1.0.8

### Patch Changes

- Updated dependencies [cbd0e23]
  - @logosdx/utils@2.0.3

## 1.0.7

### Patch Changes

- eecc5d4: Export type so they aren't compiled into ESM files
- Updated dependencies [eecc5d4]
  - @logosdx/utils@2.0.2

## 1.0.6

### Patch Changes

- 43b3457: ### Fixed

  - Export bug from utils.
  - Better naming for options

- Updated dependencies [43b3457]
  - @logosdx/utils@2.0.1

## 1.0.5

### Patch Changes

- Updated dependencies [68b2d8b]
  - @logosdx/utils@2.0.0

## 1.0.4

### Patch Changes

- 062ceab: Missed update

## 1.0.3

### Patch Changes

- a84138b: Force release due to bad build
- Updated dependencies [1dcc2d1]
- Updated dependencies [a84138b]
  - @logosdx/utils@1.1.0

## 1.0.2

### Patch Changes

- 0704421: publish .d.ts files
- Updated dependencies [0704421]
  - @logosdx/utils@1.0.2

## 1.0.0

### Major Changes

- b051504: Re-release as LogosDX

### Patch Changes

- Updated dependencies [b051504]
  - @logosdx/utils@1.0.0
