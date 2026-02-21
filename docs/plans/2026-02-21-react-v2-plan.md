# @logosdx/react v2 Implementation Plan


> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add state-machine React bindings with selector support, and add subpath exports so peer deps are only required when imported.

**Architecture:** Two new exports (`useStateMachine`, `createStateMachineContext`) following the existing context+hook tuple pattern. Subpath exports via package.json `exports` field mapping each binding to its own entry point.

**Tech Stack:** React (18/19), @logosdx/state-machine, @logosdx/utils (equals), TypeScript

---

### Task 1: Add UseStateMachineReturn type

**Files:**
- Modify: `packages/react/src/types.ts`

**Step 1: Add the type**

Add to the end of `packages/react/src/types.ts`, before the closing of the file:

```ts
import type { StateMachine } from '@logosdx/state-machine';
```

Add to the imports at top. Then add the type at the bottom:

```ts
export type UseStateMachineReturn<
    Context,
    Events extends Record<string, any>,
    States extends string,
    Selected = Context
> = {
    state: States;
    context: Selected;
    send: StateMachine<Context, Events, States>['send'];
    instance: StateMachine<Context, Events, States>;
};
```

**Step 2: Verify no type errors**

Run: `cd packages/react && pnpm lint`
Expected: PASS (no type errors)

**Step 3: Commit**

```
feat(react): add UseStateMachineReturn type
```

---

### Task 2: Write failing tests for useStateMachine standalone hook

**Files:**
- Create: `tests/src/react/state-machine.test.ts`

**Step 1: Write the test file**

```ts
import { describe, it, expect } from 'vitest';
import { act } from 'react';

import { StateMachine } from '../../../packages/state-machine/src/index.ts';
import { createStateMachineContext, useStateMachine } from '../../../packages/react/src/index.ts';
import { renderHook } from './_helpers.ts';


interface CounterContext {
    count: number;
    label: string;
}

interface CounterEvents {
    INCREMENT: void;
    DECREMENT: void;
    SET: number;
    RESET: void;
}

type CounterStates = 'idle' | 'active';

function createCounter() {

    return new StateMachine<CounterContext, CounterEvents, CounterStates>({
        initial: 'idle',
        context: { count: 0, label: 'counter' },
        transitions: {
            idle: {
                on: {
                    INCREMENT: {
                        target: 'active',
                        action: (ctx) => ({ ...ctx, count: ctx.count + 1 }),
                    },
                    SET: {
                        target: 'active',
                        action: (ctx, val) => ({ ...ctx, count: val }),
                    },
                },
            },
            active: {
                on: {
                    INCREMENT: {
                        target: 'active',
                        action: (ctx) => ({ ...ctx, count: ctx.count + 1 }),
                    },
                    DECREMENT: {
                        target: 'active',
                        action: (ctx) => ({ ...ctx, count: ctx.count - 1 }),
                    },
                    SET: {
                        target: 'active',
                        action: (ctx, val) => ({ ...ctx, count: val }),
                    },
                    RESET: {
                        target: 'idle',
                        action: (ctx) => ({ ...ctx, count: 0 }),
                    },
                },
            },
        },
    });
}


describe('@logosdx/react: state-machine', () => {

    describe('useStateMachine', () => {

        it('returns the expected API shape', () => {

            const machine = createCounter();
            const { result } = renderHook(() => useStateMachine(machine));

            expect(result.current.state).to.equal('idle');
            expect(result.current.context).to.deep.equal({ count: 0, label: 'counter' });
            expect(result.current.send).to.be.a('function');
            expect(result.current.instance).to.equal(machine);
        });

        it('re-renders on state transition', () => {

            const machine = createCounter();

            let renderCount = 0;
            const { result } = renderHook(() => {

                renderCount++;
                return useStateMachine(machine);
            });

            expect(result.current.state).to.equal('idle');
            const before = renderCount;

            act(() => { machine.send('INCREMENT'); });

            expect(result.current.state).to.equal('active');
            expect(result.current.context.count).to.equal(1);
            expect(renderCount).to.be.greaterThan(before);
        });

        it('send() triggers transitions', () => {

            const machine = createCounter();
            const { result } = renderHook(() => useStateMachine(machine));

            act(() => { result.current.send('INCREMENT'); });

            expect(result.current.state).to.equal('active');
            expect(result.current.context.count).to.equal(1);
        });

        it('selector narrows context and prevents unnecessary re-renders', () => {

            const machine = createCounter();

            let renderCount = 0;
            const { result } = renderHook(() => {

                renderCount++;
                return useStateMachine(machine, (ctx) => ctx.count);
            });

            expect(result.current.context).to.equal(0);

            const before = renderCount;

            // Transition that changes count — should re-render
            act(() => { machine.send('INCREMENT'); });
            expect(result.current.context).to.equal(1);
            expect(renderCount).to.be.greaterThan(before);

            const after = renderCount;

            // Transition that results in same count — should NOT re-render
            act(() => { machine.send('SET', 1); });
            expect(renderCount).to.equal(after);
        });

        it('cleans up listener on unmount', () => {

            const machine = createCounter();

            let renderCount = 0;
            const { unmount } = renderHook(() => {

                renderCount++;
                return useStateMachine(machine);
            });

            const before = renderCount;
            unmount();

            machine.send('INCREMENT');
            expect(renderCount).to.equal(before);
        });
    });

    describe('createStateMachineContext', () => {

        it('returns [Provider, useHook] tuple', () => {

            const machine = createCounter();
            const result = createStateMachineContext(machine);

            expect(result).to.be.an('array').with.lengthOf(2);
            expect(result[0]).to.be.a('function');
            expect(result[1]).to.be.a('function');
        });

        it('hook works via Provider', () => {

            const machine = createCounter();
            const [Provider, useMachine] = createStateMachineContext(machine);

            const { result } = renderHook(
                () => useMachine(),
                Provider,
            );

            expect(result.current.state).to.equal('idle');
            expect(result.current.instance).to.equal(machine);
        });

        it('hook accepts selector via context', () => {

            const machine = createCounter();
            const [Provider, useMachine] = createStateMachineContext(machine);

            const { result } = renderHook(
                () => useMachine((ctx) => ctx.count),
                Provider,
            );

            expect(result.current.context).to.equal(0);

            act(() => { machine.send('INCREMENT'); });
            expect(result.current.context).to.equal(1);
        });

        it('re-renders on transitions via context', () => {

            const machine = createCounter();
            const [Provider, useMachine] = createStateMachineContext(machine);

            let renderCount = 0;
            const { result } = renderHook(
                () => {

                    renderCount++;
                    return useMachine();
                },
                Provider,
            );

            const before = renderCount;

            act(() => { machine.send('INCREMENT'); });

            expect(result.current.state).to.equal('active');
            expect(renderCount).to.be.greaterThan(before);
        });
    });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test state-machine.test`
Expected: FAIL — `useStateMachine` and `createStateMachineContext` not exported

---

### Task 3: Implement useStateMachine and createStateMachineContext

**Files:**
- Create: `packages/react/src/state-machine.ts`
- Modify: `packages/react/src/index.ts`

**Step 1: Create the state-machine binding**

Create `packages/react/src/state-machine.ts`:

```ts
import {
    createContext,
    createElement,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';

import { equals } from '@logosdx/utils';

import type { StateMachine } from '@logosdx/state-machine';
import type { ProviderProps, UseStateMachineReturn } from './types.ts';


/**
 * Subscribes to a StateMachine instance and re-renders on transitions.
 * Optionally accepts a selector to narrow the context and prevent
 * unnecessary re-renders when unrelated context values change.
 *
 * @example
 *     const machine = new StateMachine({ ... });
 *
 *     function Counter() {
 *
 *         const { state, context, send } = useStateMachine(machine);
 *         return <button onClick={() => send('INCREMENT')}>{context.count}</button>;
 *     }
 *
 * @example
 *     // With selector — only re-renders when `count` changes
 *     const { context: count } = useStateMachine(machine, (ctx) => ctx.count);
 */
export function useStateMachine<
    Context,
    Events extends Record<string, any>,
    States extends string,
    Selected = Context
>(
    machine: StateMachine<Context, Events, States>,
    selector?: (context: Context) => Selected
): UseStateMachineReturn<Context, Events, States, Selected> {

    const selectorRef = useRef(selector);
    selectorRef.current = selector;

    const select = (ctx: Context): Selected => {

        return selectorRef.current ? selectorRef.current(ctx) : ctx as unknown as Selected;
    };

    const [state, setState] = useState<States>(machine.state);
    const [selected, setSelected] = useState<Selected>(() => select(machine.context));

    useEffect(() => {

        return machine.on('*', (payload) => {

            setState(payload.to as States);

            const next = select(payload.context as Context);

            setSelected(prev => equals(prev, next) ? prev : next);
        });
    }, [machine]);

    return {
        state,
        context: selected,
        send: machine.send.bind(machine),
        instance: machine,
    };
}


/**
 * Creates a React context + hook pair bound to a StateMachine instance.
 * Returns a `[Provider, useHook]` tuple — rename to fit your domain.
 *
 * @example
 *     const machine = new StateMachine({ ... });
 *     export const [GameProvider, useGame] = createStateMachineContext(machine);
 *
 *     // In your app:
 *     <GameProvider><App /></GameProvider>
 *
 *     // In components:
 *     const { state, send } = useGame();
 *     const score = useGame((ctx) => ctx.score); // with selector
 */
export function createStateMachineContext<
    Context,
    Events extends Record<string, any>,
    States extends string
>(
    instance: StateMachine<Context, Events, States>
): [
    (props: ProviderProps) => ReturnType<typeof createElement>,
    <Selected = Context>(selector?: (context: Context) => Selected) => UseStateMachineReturn<Context, Events, States, Selected>
] {

    const MachineContext = createContext<StateMachine<Context, Events, States>>(instance);

    function Provider(props: ProviderProps) {

        return createElement(MachineContext.Provider, { value: instance }, props.children);
    }

    function useHook<Selected = Context>(
        selector?: (context: Context) => Selected
    ): UseStateMachineReturn<Context, Events, States, Selected> {

        const machine = useContext(MachineContext);
        return useStateMachine(machine, selector);
    }

    return [Provider, useHook];
}
```

**Step 2: Add exports to index.ts**

Add to `packages/react/src/index.ts`:

```ts
export { createStateMachineContext, useStateMachine } from './state-machine.ts';
```

And add to the type exports:

```ts
export type {
    // ... existing types
    UseStateMachineReturn,
} from './types.ts';
```

**Step 3: Run tests to verify they pass**

Run: `pnpm test state-machine.test`
Expected: ALL PASS

**Step 4: Commit**

```
feat(react): add state-machine bindings with selector support
```

---

### Task 4: Add subpath exports to package.json

**Files:**
- Modify: `packages/react/package.json`

**Step 1: Update exports field**

Replace the `exports` field with subpath entries:

```json
"exports": {
    ".": {
        "types": "./dist/types/index.d.ts",
        "require": "./dist/cjs/index.js",
        "import": "./dist/esm/index.mjs"
    },
    "./observer": {
        "types": "./dist/types/observer.d.ts",
        "require": "./dist/cjs/observer.js",
        "import": "./dist/esm/observer.mjs"
    },
    "./fetch": {
        "types": "./dist/types/fetch.d.ts",
        "require": "./dist/cjs/fetch.js",
        "import": "./dist/esm/fetch.mjs"
    },
    "./storage": {
        "types": "./dist/types/storage.d.ts",
        "require": "./dist/cjs/storage.js",
        "import": "./dist/esm/storage.mjs"
    },
    "./localize": {
        "types": "./dist/types/localize.d.ts",
        "require": "./dist/cjs/localize.js",
        "import": "./dist/esm/localize.mjs"
    },
    "./state-machine": {
        "types": "./dist/types/state-machine.d.ts",
        "require": "./dist/cjs/state-machine.js",
        "import": "./dist/esm/state-machine.mjs"
    },
    "./compose": {
        "types": "./dist/types/utils/compose.d.ts",
        "require": "./dist/cjs/utils/compose.js",
        "import": "./dist/esm/utils/compose.mjs"
    }
}
```

**Step 2: Add state-machine peer dependency**

Add to `peerDependencies`:

```json
"@logosdx/state-machine": "workspace:^"
```

Add to `peerDependenciesMeta`:

```json
"@logosdx/state-machine": {
    "optional": true
}
```

**Step 3: Verify build works**

Run: `cd packages/react && pnpm build`
Expected: Build succeeds, `dist/` contains subpath entry points

**Step 4: Commit**

```
feat(react): add subpath exports and state-machine peer dep
```

---

### Task 5: Run full test suite and verify

**Files:** None (verification only)

**Step 1: Run all tests**

Run: `pnpm test`
Expected: ALL PASS

**Step 2: Verify build**

Run: `pnpm build` (or `cd packages/react && pnpm build`)
Expected: Build succeeds

**Step 3: Verify subpath files exist in dist**

Check that these files exist after build:
- `packages/react/dist/esm/state-machine.mjs`
- `packages/react/dist/cjs/state-machine.js`
- `packages/react/dist/types/state-machine.d.ts`
- `packages/react/dist/esm/observer.mjs` (existing, verify subpath works)

---

### Task 6: Update react test imports to use relative paths

The existing observer and localize react tests use `@logosdx/observer` and `@logosdx/react` package imports instead of relative paths. Fix them for consistency.

**Files:**
- Modify: `tests/src/react/observer.test.ts`
- Modify: `tests/src/react/localize.test.ts`
- Modify: `tests/src/react/fetch.test.ts`
- Modify: `tests/src/react/compose.test.ts`

**Step 1: Update imports in each file**

Replace package imports with relative paths:

```ts
// FROM:
import { ObserverEngine } from '@logosdx/observer';
import { createObserverContext } from '@logosdx/react';

// TO:
import { ObserverEngine } from '../../../packages/observer/src/index.ts';
import { createObserverContext } from '../../../packages/react/src/index.ts';
```

Apply the same pattern to all react test files.

**Step 2: Run react tests**

Run: `pnpm test react/`
Expected: ALL PASS

**Step 3: Commit**

```
refactor(tests): use relative imports in react tests
```
