# Observer Transfer & Copy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `ObserverEngine.transfer()` and `ObserverEngine.copy()` static methods for moving/duplicating event listeners between observer instances.

**Architecture:** Two static methods on `ObserverEngine` that access `#listenerMap` and `#rgxListenerMap` directly via same-class private field access. A shared internal helper handles the filtering pipeline and map iteration, with a `remove` flag distinguishing transfer (true) from copy (false).

**Tech Stack:** TypeScript, Vitest, Sinon

**Design doc:** `docs/plans/2026-02-17-observer-transfer-design.md`

---

### Task 1: Write failing tests for `ObserverEngine.transfer()`

**Files:**
- Modify: `tests/src/observable/engine.ts`

**Step 1: Add a new describe block for transfer tests**

Add at the end of the existing `describe('@logosdx/observer')` block:

```ts
describe('ObserverEngine.transfer(source, target)', function () {

    afterEach(() => {

        sandbox.resetHistory();
    });

    it('should move all string listeners from source to target', function () {

        const source = new ObserverEngine<AppEvents>();
        const target = new ObserverEngine<AppEvents>();
        const fake = sandbox.stub();

        source.on('test', fake);
        source.on('test1', fake);

        ObserverEngine.transfer(source, target);

        // Source should no longer have listeners
        source.emit('test', 'a');
        source.emit('test1', 'a');
        expect(fake.callCount).to.eq(0);

        // Target should have them
        target.emit('test', 'b');
        target.emit('test1', 'b');
        expect(fake.callCount).to.eq(2);
    });

    it('should move regex listeners from source to target', function () {

        const source = new ObserverEngine<AppEvents>();
        const target = new ObserverEngine<AppEvents>();
        const fake = sandbox.stub();

        source.on(/^test/, fake);

        ObserverEngine.transfer(source, target);

        source.emit('test', 'a');
        expect(fake.callCount).to.eq(0);

        target.emit('test', 'b');
        expect(fake.callCount).to.eq(1);
    });

    it('should stack with existing target listeners', function () {

        const source = new ObserverEngine<AppEvents>();
        const target = new ObserverEngine<AppEvents>();
        const sourceFake = sandbox.stub();
        const targetFake = sandbox.stub();

        target.on('test', targetFake);
        source.on('test', sourceFake);

        ObserverEngine.transfer(source, target);

        target.emit('test', 'a');
        expect(targetFake.callCount).to.eq(1);
        expect(sourceFake.callCount).to.eq(1);
    });

    it('should filter with opt-in filter (string)', function () {

        const source = new ObserverEngine<AppEvents>();
        const target = new ObserverEngine<AppEvents>();
        const fake1 = sandbox.stub();
        const fake2 = sandbox.stub();

        source.on('test', fake1);
        source.on('test1', fake2);

        ObserverEngine.transfer(source, target, { filter: ['test'] });

        // Only 'test' transferred
        target.emit('test', 'a');
        expect(fake1.callCount).to.eq(1);

        // 'test1' stayed on source
        target.emit('test1', 'a');
        expect(fake2.callCount).to.eq(0);

        source.emit('test1', 'a');
        expect(fake2.callCount).to.eq(1);
    });

    it('should filter with opt-in filter (regex)', function () {

        const source = new ObserverEngine<AppEvents>();
        const target = new ObserverEngine<AppEvents>();
        const fake1 = sandbox.stub();
        const fake2 = sandbox.stub();

        source.on('aa', fake1);
        source.on('ba', fake2);

        ObserverEngine.transfer(source, target, { filter: [/^a/] });

        target.emit('aa', 'x');
        expect(fake1.callCount).to.eq(1);

        // 'ba' not transferred
        source.emit('ba', 'x');
        expect(fake2.callCount).to.eq(1);
    });

    it('should exclude events with opt-out exclude', function () {

        const source = new ObserverEngine<AppEvents>();
        const target = new ObserverEngine<AppEvents>();
        const fake1 = sandbox.stub();
        const fake2 = sandbox.stub();

        source.on('test', fake1);
        source.on('test1', fake2);

        ObserverEngine.transfer(source, target, { exclude: ['test1'] });

        target.emit('test', 'a');
        expect(fake1.callCount).to.eq(1);

        // 'test1' stayed on source
        source.emit('test1', 'a');
        expect(fake2.callCount).to.eq(1);
    });

    it('should compose filter + exclude', function () {

        const source = new ObserverEngine<AppEvents>();
        const target = new ObserverEngine<AppEvents>();
        const fake1 = sandbox.stub();
        const fake2 = sandbox.stub();
        const fake3 = sandbox.stub();

        source.on('test', fake1);
        source.on('test1', fake2);
        source.on('aa', fake3);

        // filter keeps test + test1, exclude removes test1
        ObserverEngine.transfer(source, target, {
            filter: [/^test/],
            exclude: ['test1']
        });

        target.emit('test', 'a');
        expect(fake1.callCount).to.eq(1);

        // test1 was excluded, stays on source
        source.emit('test1', 'a');
        expect(fake2.callCount).to.eq(1);

        // aa was filtered out, stays on source
        source.emit('aa', 'a');
        expect(fake3.callCount).to.eq(1);
    });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test observable/engine`
Expected: FAIL — `ObserverEngine.transfer is not a function`

**Step 3: Commit**

```
test: add failing tests for ObserverEngine.transfer()
```

---

### Task 2: Write failing tests for `ObserverEngine.copy()`

**Files:**
- Modify: `tests/src/observable/engine.ts`

**Step 1: Add copy tests after the transfer describe block**

```ts
describe('ObserverEngine.copy(source, target)', function () {

    afterEach(() => {

        sandbox.resetHistory();
    });

    it('should copy all listeners — source keeps them', function () {

        const source = new ObserverEngine<AppEvents>();
        const target = new ObserverEngine<AppEvents>();
        const fake = sandbox.stub();

        source.on('test', fake);

        ObserverEngine.copy(source, target);

        // Source still has listeners
        source.emit('test', 'a');
        expect(fake.callCount).to.eq(1);

        // Target also has them
        target.emit('test', 'b');
        expect(fake.callCount).to.eq(2);
    });

    it('should copy regex listeners — source keeps them', function () {

        const source = new ObserverEngine<AppEvents>();
        const target = new ObserverEngine<AppEvents>();
        const fake = sandbox.stub();

        source.on(/^test/, fake);

        ObserverEngine.copy(source, target);

        source.emit('test', 'a');
        expect(fake.callCount).to.eq(1);

        target.emit('test', 'b');
        expect(fake.callCount).to.eq(2);
    });

    it('should stack with existing target listeners', function () {

        const source = new ObserverEngine<AppEvents>();
        const target = new ObserverEngine<AppEvents>();
        const sourceFake = sandbox.stub();
        const targetFake = sandbox.stub();

        target.on('test', targetFake);
        source.on('test', sourceFake);

        ObserverEngine.copy(source, target);

        target.emit('test', 'a');
        expect(targetFake.callCount).to.eq(1);
        expect(sourceFake.callCount).to.eq(1);
    });

    it('should respect filter option', function () {

        const source = new ObserverEngine<AppEvents>();
        const target = new ObserverEngine<AppEvents>();
        const fake1 = sandbox.stub();
        const fake2 = sandbox.stub();

        source.on('test', fake1);
        source.on('test1', fake2);

        ObserverEngine.copy(source, target, { filter: ['test'] });

        target.emit('test', 'a');
        expect(fake1.callCount).to.eq(1);

        target.emit('test1', 'a');
        expect(fake2.callCount).to.eq(0);
    });

    it('should respect exclude option', function () {

        const source = new ObserverEngine<AppEvents>();
        const target = new ObserverEngine<AppEvents>();
        const fake1 = sandbox.stub();
        const fake2 = sandbox.stub();

        source.on('test', fake1);
        source.on('test1', fake2);

        ObserverEngine.copy(source, target, { exclude: ['test1'] });

        target.emit('test', 'a');
        expect(fake1.callCount).to.eq(1);

        target.emit('test1', 'a');
        expect(fake2.callCount).to.eq(0);
    });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test observable/engine`
Expected: FAIL — `ObserverEngine.copy is not a function`

**Step 3: Commit**

```
test: add failing tests for ObserverEngine.copy()
```

---

### Task 3: Implement `transfer()` and `copy()` on ObserverEngine

**Files:**
- Modify: `packages/observer/src/engine.ts`
- Modify: `packages/observer/src/types.ts`

**Step 1: Add TransferOptions type to `types.ts`**

Add to the `declare module './engine.ts'` block in `types.ts`:

```ts
export type TransferOptions<Ev extends Record<string, any>> = {
    filter?: (Events<Ev> | RegExp)[]
    exclude?: (Events<Ev> | RegExp)[]
}
```

**Step 2: Add the shared filtering helper as a private static method on `ObserverEngine`**

Add to `engine.ts` inside the class body (before `clear()`):

```ts
/**
 * Determines if an event key passes the filter/exclude pipeline.
 */
static #matchesFilter<Shape extends Record<string, any>>(
    eventKey: string,
    options?: ObserverEngine.TransferOptions<Shape>
): boolean {

    if (!options) return true;

    const { filter, exclude } = options;

    if (filter) {

        const included = filter.some(f =>
            f instanceof RegExp ? f.test(eventKey) : f === eventKey
        );

        if (!included) return false;
    }

    if (exclude) {

        const excluded = exclude.some(f =>
            f instanceof RegExp ? f.test(eventKey) : f === eventKey
        );

        if (excluded) return false;
    }

    return true;
}

/**
 * Internal method that powers both transfer and copy.
 * Iterates source listener maps, applies filter/exclude,
 * adds matching listeners to target, and optionally removes
 * them from source.
 */
static #moveListeners<Shape extends Record<string, any>>(
    source: ObserverEngine<Shape>,
    target: ObserverEngine<Shape>,
    options?: ObserverEngine.TransferOptions<Shape>,
    remove: boolean = true
) {

    // Process string listener map
    for (const [event, fns] of source.#listenerMap) {

        if (!ObserverEngine.#matchesFilter(event as string, options)) continue;

        const targetSet = target.#listenerMap.get(event) || new Set();

        for (const fn of fns) {

            targetSet.add(fn);
        }

        target.#listenerMap.set(event, targetSet);

        if (remove) {

            source.#listenerMap.delete(event);
        }
    }

    // Process regex listener map
    for (const [rgxStr, fns] of source.#rgxListenerMap) {

        if (!ObserverEngine.#matchesFilter(rgxStr, options)) continue;

        const targetSet = target.#rgxListenerMap.get(rgxStr) || new Set();

        for (const fn of fns) {

            targetSet.add(fn);
        }

        target.#rgxListenerMap.set(rgxStr, targetSet);

        if (remove) {

            source.#rgxListenerMap.delete(rgxStr);
        }
    }
}
```

**Step 3: Add the public static methods**

```ts
/**
 * Transfers all matching listeners from source to target.
 * Source loses the listeners; target gains them.
 * Target's existing listeners are not affected.
 *
 * @example
 *
 *     const source = new ObserverEngine();
 *     const target = new ObserverEngine();
 *
 *     source.on('analytics', trackEvent);
 *     ObserverEngine.transfer(source, target);
 *     // source no longer has 'analytics' listener
 *     // target now has 'analytics' listener
 */
static transfer<Shape extends Record<string, any>>(
    source: ObserverEngine<Shape>,
    target: ObserverEngine<Shape>,
    options?: ObserverEngine.TransferOptions<Shape>
) {

    ObserverEngine.#moveListeners(source, target, options, true);
}

/**
 * Copies all matching listeners from source to target.
 * Source keeps the listeners; target also gets them.
 * Target's existing listeners are not affected.
 *
 * @example
 *
 *     const source = new ObserverEngine();
 *     const target = new ObserverEngine();
 *
 *     source.on('analytics', trackEvent);
 *     ObserverEngine.copy(source, target);
 *     // both source and target have 'analytics' listener
 */
static copy<Shape extends Record<string, any>>(
    source: ObserverEngine<Shape>,
    target: ObserverEngine<Shape>,
    options?: ObserverEngine.TransferOptions<Shape>
) {

    ObserverEngine.#moveListeners(source, target, options, false);
}
```

**Step 4: Run tests**

Run: `pnpm test observable/engine`
Expected: ALL PASS

**Step 5: Commit**

```
feat(observer): add ObserverEngine.transfer() and ObserverEngine.copy()
```

---

### Task 4: Update llm-helpers and docs

**Files:**
- Modify: `llm-helpers/observer.md`
- Modify: `docs/packages/observer.md`

**Step 1: Add transfer/copy section to `llm-helpers/observer.md`**

Add a new section after "Component Observation":

```md
## Listener Transfer & Copy

```ts
// Transfer: move listeners from source to target (source loses them)
ObserverEngine.transfer(source, target)

// Copy: duplicate listeners to target (source keeps them)
ObserverEngine.copy(source, target)

// Opt-in filter: only transfer specific events
ObserverEngine.transfer(source, target, { filter: ['analytics', /^user:/] })

// Opt-out exclude: transfer everything except these
ObserverEngine.copy(source, target, { exclude: [/^internal:/] })

// Compose: filter first, then exclude from that set
ObserverEngine.transfer(source, target, {
    filter: [/^fetch:/],
    exclude: ['fetch:debug']
})

// Stacking: target's existing listeners are untouched
target.on('analytics', existingHandler)
ObserverEngine.transfer(source, target) // existingHandler still works
```
```

**Step 2: Add equivalent section to `docs/packages/observer.md`**

Add a section with the same examples plus brief prose explanation.

**Step 3: Commit**

```
docs(observer): document transfer() and copy() static methods
```
