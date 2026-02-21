# @logosdx/react v2 Design


## Summary

Two changes to the React package:

1. **Subpath exports** — each binding importable independently, peer deps only required when used
2. **State machine bindings** — `createStateMachineContext` + `useStateMachine` with selector support


## Subpath Exports

Add per-binding subpath exports to `package.json`:

```json
"exports": {
    ".": { "types": "...", "require": "...", "import": "..." },
    "./observer": { ... },
    "./fetch": { ... },
    "./storage": { ... },
    "./localize": { ... },
    "./state-machine": { ... },
    "./compose": { ... }
}
```

Users import what they need:

```ts
import { createStorageContext } from '@logosdx/react/storage';
```

The barrel export (`.`) remains for convenience.


## State Machine Bindings


### useStateMachine (standalone hook)

```ts
function useStateMachine<Context, Events, States, Selected = Context>(
    machine: StateMachine<Context, Events, States>,
    selector?: (context: Context) => Selected
): UseStateMachineReturn<Context, Events, States, Selected>
```

**Returns:** `{ state, context, send, instance }`

- `state` — current state name (reactive)
- `context` — full context or selector result (reactive, compared via `equals`)
- `send` — bound `machine.send`
- `instance` — raw StateMachine reference

**Reactivity:** Subscribes to `'*'` event. Uses `equals` from `@logosdx/utils` for selector comparison. Stores selector in a ref to avoid useEffect re-subscription.


### createStateMachineContext (context + hook tuple)

```ts
function createStateMachineContext<Context, Events, States>(
    machine: StateMachine<Context, Events, States>
): [Provider, (selector?) => UseStateMachineReturn]
```

Same pattern as `createObserverContext`, `createStorageContext`, etc. Internally wraps `useStateMachine`.


### Types

```ts
export type UseStateMachineReturn<Context, Events, States, Selected = Context> = {
    state: States;
    context: Selected;
    send: StateMachine<Context, Events, States>['send'];
    instance: StateMachine<Context, Events, States>;
};
```


## Decisions

- **No DOM bindings** — DOM package is for vanilla JS / non-React use cases
- **Selector support included** — lightweight with `@logosdx/utils` equals (~10 lines)
- **Minimal reactive return** — state, context, send, instance. Advanced features via `instance`
- **Both barrel and subpath exports** — non-breaking, users choose import style


## Files to Create/Modify

- `packages/react/src/state-machine.ts` — new binding
- `packages/react/src/types.ts` — add UseStateMachineReturn
- `packages/react/src/index.ts` — add state-machine exports
- `packages/react/package.json` — subpath exports + state-machine peer dep
- `tests/src/react/state-machine.test.ts` — tests for both hook styles
