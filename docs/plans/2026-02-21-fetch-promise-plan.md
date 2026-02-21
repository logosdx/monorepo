# FetchPromise Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add chainable `.json()`, `.text()`, `.raw()`, `.stream()` directives to fetch engine responses via a new `FetchPromise` class.

**Architecture:** `FetchPromise<T, H, P, RH>` extends `AbortablePromise` with directive methods that set a parsing override before the promise resolves. The executor reads the directive at parse time. A `FetchStreamPromise` interface gates async iteration at the type level.

**Tech Stack:** TypeScript, vitest, @logosdx/fetch, @logosdx/utils

**Design doc:** `docs/plans/2026-02-21-fetch-promise-design.md`

---

### Task 1: Create FetchPromise class with override guard

**Files:**
- Create: `packages/fetch/src/engine/fetch-promise.ts`
- Test: `tests/src/fetch/engine/fetch-promise.test.ts`

**Context:** The current `AbortablePromise` is defined as an interface in `packages/fetch/src/engine/index.ts:58-63` and the executor wraps plain promises via `#wrapAsAbortable` at `packages/fetch/src/engine/executor.ts:415-439`. `FetchPromise` needs to be a real class that extends `Promise` so we can add methods and private state.

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { FetchPromise } from '../../../../packages/fetch/src/engine/fetch-promise.ts';

describe('FetchPromise: override guard', () => {

    it('should throw when setting directive twice', () => {

        const p = new FetchPromise((resolve) => resolve({} as any));

        p.json();
        expect(() => p.text()).toThrowError('Response type already set');
    });

    it('should throw when chaining stream after json', () => {

        const p = new FetchPromise((resolve) => resolve({} as any));

        p.json();
        expect(() => p.stream()).toThrowError('Response type already set');
    });

    it('should throw when chaining raw after stream', () => {

        const p = new FetchPromise((resolve) => resolve({} as any));

        p.stream();
        expect(() => p.raw()).toThrowError('Response type already set');
    });

    it('should allow a single directive without throwing', () => {

        const p = new FetchPromise((resolve) => resolve({} as any));

        expect(() => p.json()).not.toThrow();
    });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test fetch-promise`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `packages/fetch/src/engine/fetch-promise.ts`:

```ts
import type { FetchResponse } from '../types.ts';

type ResponseDirective = 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData' | 'raw' | 'stream';

/**
 * Promise returned by FetchEngine HTTP methods.
 *
 * Supports chainable parsing directives: `.json()`, `.text()`, `.blob()`,
 * `.arrayBuffer()`, `.formData()`, `.raw()`, `.stream()`.
 *
 * @example
 *     const response = await api.get('/users').json();
 *     const html = await api.get('/page').text();
 *     for await (const chunk of api.get('/events').stream()) { ... }
 */
export class FetchPromise<T, H = unknown, P = unknown, RH = unknown> extends Promise<FetchResponse<T, H, P, RH>> {

    #overrideSet = false;
    #directive: ResponseDirective | undefined;
    #stream = false;

    get directive(): ResponseDirective | undefined {

        return this.#directive;
    }

    get isStream(): boolean {

        return this.#stream;
    }

    #setDirective(directive: ResponseDirective): this {

        if (this.#overrideSet) {

            throw new Error('Response type already set');
        }

        this.#overrideSet = true;
        this.#directive = directive;
        return this;
    }

    json(): FetchPromise<T, H, P, RH> {

        return this.#setDirective('json');
    }

    text(): FetchPromise<string, H, P, RH> {

        return this.#setDirective('text') as unknown as FetchPromise<string, H, P, RH>;
    }

    blob(): FetchPromise<Blob, H, P, RH> {

        return this.#setDirective('blob') as unknown as FetchPromise<Blob, H, P, RH>;
    }

    arrayBuffer(): FetchPromise<ArrayBuffer, H, P, RH> {

        return this.#setDirective('arrayBuffer') as unknown as FetchPromise<ArrayBuffer, H, P, RH>;
    }

    formData(): FetchPromise<FormData, H, P, RH> {

        return this.#setDirective('formData') as unknown as FetchPromise<FormData, H, P, RH>;
    }

    raw(): FetchPromise<Response, H, P, RH> {

        return this.#setDirective('raw') as unknown as FetchPromise<Response, H, P, RH>;
    }

    stream(): FetchStreamPromise<H, P, RH> {

        this.#setDirective('stream');
        this.#stream = true;
        return this as unknown as FetchStreamPromise<H, P, RH>;
    }
}

/**
 * Type-level gating — exposes async iteration only after `.stream()`.
 */
export interface FetchStreamPromise<H = unknown, P = unknown, RH = unknown>
    extends FetchPromise<Response, H, P, RH>, AsyncIterable<Uint8Array> {}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test fetch-promise`
Expected: PASS

**Step 5: Commit**

```
feat(fetch): add FetchPromise class with override guard and directive methods
```

---

### Task 2: Add abort support to FetchPromise

**Files:**
- Modify: `packages/fetch/src/engine/fetch-promise.ts`
- Test: `tests/src/fetch/engine/fetch-promise.test.ts`

**Context:** Currently `#wrapAsAbortable` in `executor.ts:415-439` patches `isFinished`, `isAborted`, and `abort()` onto a plain promise. FetchPromise needs these as first-class properties so the executor can construct a proper `FetchPromise` instance instead of patching.

**Step 1: Write the failing test**

```ts
describe('FetchPromise: abort support', () => {

    it('should start with isFinished false and isAborted false', () => {

        const controller = new AbortController();
        const p = FetchPromise.create(() => new Promise(() => {}), controller);

        expect(p.isFinished).toBe(false);
        expect(p.isAborted).toBe(false);
    });

    it('should set isAborted when abort is called', () => {

        const controller = new AbortController();
        const p = FetchPromise.create(() => new Promise(() => {}), controller);

        p.abort('cancelled');
        expect(p.isAborted).toBe(true);
    });

    it('should set isFinished when promise resolves', async () => {

        const controller = new AbortController();
        const p = FetchPromise.create(
            () => Promise.resolve({ data: 'ok' } as any),
            controller
        );

        await p;
        expect(p.isFinished).toBe(true);
    });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test fetch-promise`
Expected: FAIL — `FetchPromise.create` not found

**Step 3: Implement static factory**

Add to `FetchPromise` class in `fetch-promise.ts`:

```ts
isFinished = false;
isAborted = false;
#controller: AbortController | undefined;

abort(reason?: string): void {

    this.isAborted = true;
    this.#controller?.abort(reason);
}

/**
 * Create a FetchPromise from an async executor function.
 *
 * The factory wires abort/finish tracking to the AbortController.
 */
static create<T, H = unknown, P = unknown, RH = unknown>(
    executor: () => Promise<FetchResponse<T, H, P, RH>>,
    controller: AbortController
): FetchPromise<T, H, P, RH> {

    let resolveOuter: (value: FetchResponse<T, H, P, RH>) => void;
    let rejectOuter: (reason: unknown) => void;

    const promise = new FetchPromise<T, H, P, RH>((resolve, reject) => {

        resolveOuter = resolve;
        rejectOuter = reject;
    });

    promise.#controller = controller;

    controller.signal.addEventListener('abort', () => {

        promise.isAborted = true;
    }, { once: true });

    executor().then(
        (value) => {

            promise.isFinished = true;
            resolveOuter(value);
        },
        (err) => {

            if (!promise.isAborted) {

                promise.isFinished = true;
            }

            rejectOuter(err);
        }
    );

    return promise;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test fetch-promise`
Expected: PASS

**Step 5: Commit**

```
feat(fetch): add abort and finish tracking to FetchPromise
```

---

### Task 3: Add async iteration for stream mode

**Files:**
- Modify: `packages/fetch/src/engine/fetch-promise.ts`
- Test: `tests/src/fetch/engine/fetch-promise.test.ts`

**Context:** When `.stream()` is called, the FetchPromise needs to support `for await`. At runtime, `Symbol.asyncIterator` is always present but only works when the stream directive is active. The readable stream reference is stored after the promise resolves.

**Step 1: Write the failing test**

```ts
describe('FetchPromise: async iteration', () => {

    it('should iterate chunks when stream directive is set', async () => {

        const chunks = [
            new Uint8Array([1, 2]),
            new Uint8Array([3, 4]),
        ];

        const readable = new ReadableStream({
            start(controller) {

                for (const chunk of chunks) controller.enqueue(chunk);
                controller.close();
            }
        });

        const mockResponse = new Response(readable);

        const controller = new AbortController();
        const p = FetchPromise.create(
            () => Promise.resolve({
                data: mockResponse,
                headers: {},
                status: 200,
                request: new Request('http://test'),
                config: {}
            } as any),
            controller
        );

        p.stream();

        const collected: Uint8Array[] = [];

        for await (const chunk of p) {

            collected.push(chunk);
        }

        expect(collected).toHaveLength(2);
        expect(collected[0]).toEqual(new Uint8Array([1, 2]));
    });

    it('should throw when iterating without stream directive', async () => {

        const controller = new AbortController();
        const p = FetchPromise.create(
            () => Promise.resolve({ data: {} } as any),
            controller
        );

        await p;

        const iterator = (p as any)[Symbol.asyncIterator]();
        await expect(iterator.next()).rejects.toThrowError('not a stream');
    });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test fetch-promise`
Expected: FAIL — asyncIterator not implemented

**Step 3: Implement async iteration**

Add to `FetchPromise` class:

```ts
#readableStream: ReadableStream<Uint8Array> | undefined;

/**
 * Store the readable stream reference after resolution.
 * Called by the executor when stream mode is active.
 */
setReadableStream(stream: ReadableStream<Uint8Array>): void {

    this.#readableStream = stream;
}

async *[Symbol.asyncIterator](): AsyncIterator<Uint8Array> {

    if (!this.#stream) {

        throw new Error('Cannot iterate: not a stream. Call .stream() before iterating.');
    }

    const response = await this;
    const body = this.#readableStream ?? (response.data as unknown as Response)?.body;

    if (!body) {

        throw new Error('Response body is not readable');
    }

    const reader = body.getReader();

    try {

        while (true) {

            const { done, value } = await reader.read();

            if (done) break;
            if (value) yield value;
        }
    }
    finally {

        reader.releaseLock();
    }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test fetch-promise`
Expected: PASS

**Step 5: Commit**

```
feat(fetch): add async iteration support for stream mode
```

---

### Task 4: Wire FetchPromise into the executor

**Files:**
- Modify: `packages/fetch/src/engine/executor.ts` (lines 107-189, 415-439, 657-739)
- Modify: `packages/fetch/src/engine/fetch-promise.ts`
- Test: `tests/src/fetch/engine/fetch-promise.test.ts`

**Context:** The executor's `execute` method at line 107 currently creates a plain promise via `#executeWithOptions` and wraps it with `#wrapAsAbortable`. We need to:
1. Replace `#wrapAsAbortable` usage with `FetchPromise.create()`
2. Pass the `FetchPromise` instance to `#executeWithOptions` so it can read the directive
3. Modify the parsing logic at lines 693-739 to check the directive

**Step 1: Write the failing test**

```ts
// In a new section of fetch-promise.test.ts, or in response.test.ts
describe('FetchPromise: executor integration', () => {

    it('should auto-parse json when no directive is set', async () => {

        // Use actual FetchEngine against test server or mock
        // This test ensures backwards compatibility
    });

    it('should parse as text when .text() directive is set', async () => {

        // api.get('/json-endpoint').text() should return string
    });

    it('should return raw Response when .raw() directive is set', async () => {

        // api.get('/endpoint').raw() should have data as Response
    });
});
```

Note: These integration tests need the full FetchEngine. Use the existing test patterns from `tests/src/fetch/engine/core.test.ts` and the test server setup.

**Step 2: Run test to verify it fails**

Run: `pnpm test fetch-promise`
Expected: FAIL

**Step 3: Modify the executor**

In `executor.ts`, update the `execute` method (lines 107-190):

1. Import `FetchPromise`:
```ts
import { FetchPromise } from './fetch-promise.ts';
```

2. Replace `#wrapAsAbortable` with `FetchPromise.create` at lines 175-189:
```ts
const fetchPromise = FetchPromise.create<Res, DictAndT<H>, DictAndT<P>, ResHdr>(
    () => this.#executeWithOptions<Res, ResHdr>(
        method, path, payload, opts, controller,
        totalTimeout, attemptTimeoutMs, () => totalTimeoutFired,
        fetchPromise  // pass reference so executor can read directive
    ),
    controller
);

return fetchPromise;
```

Note: There's a circular reference issue — `fetchPromise` is referenced before assignment. Solve by passing a getter `() => fetchPromise.directive` instead, or by storing the directive on the options object that flows through the executor.

**Alternative approach:** Add `directive` to `InternalReqOptions` and have `FetchPromise.create` accept a callback that writes the directive onto the options before execution begins. Since directive is set synchronously and execution is async, we can use a deferred pattern:

```ts
const fetchPromise = FetchPromise.create<Res, DictAndT<H>, DictAndT<P>, ResHdr>(
    (getDirective) => this.#executeWithOptions<Res, ResHdr>(
        method, path, payload, opts, controller,
        totalTimeout, attemptTimeoutMs, () => totalTimeoutFired,
        getDirective
    ),
    controller
);
```

3. In the parsing section (lines 693-739), check the directive:

```ts
// Before auto-parse logic
const directive = getDirective();

if (directive === 'raw') {
    // Return raw Response as data, skip all parsing
    return { data: response as unknown as Res, headers: responseHeaders, status, request, config };
}

if (directive === 'stream') {
    // Same as current stream handling (lines 657-691)
    return { data: response as unknown as Res, headers: responseHeaders, status, request, config };
}

if (directive) {
    // Explicit parse directive — use it directly
    const data = await response[directive]() as Res;
    return { data, headers: responseHeaders, status, request, config };
}

// No directive — auto-parse as today (existing lines 693-739)
```

**Step 4: Run test to verify it passes**

Run: `pnpm test fetch-promise`
Expected: PASS

**Step 5: Commit**

```
feat(fetch): wire FetchPromise into executor with directive-based parsing
```

---

### Task 5: Remove `{ stream: true }` option

**Files:**
- Modify: `packages/fetch/src/engine/index.ts` (lines 285-288, 303-307, etc. — all stream overloads)
- Modify: `packages/fetch/src/engine/executor.ts` (lines 129, 657-691 — stream option check)
- Modify: `packages/fetch/src/engine/types.ts` (line 239 — `stream` property)
- Modify: `packages/fetch/src/options/types.ts` (line 143 — `stream` property in CallConfig)
- Test: `tests/src/fetch/engine/streaming.test.ts`

**Context:** All HTTP method overloads have a `{ stream: true }` variant (e.g., `index.ts:285-288`). The `CallConfig` type has `stream?: boolean` at `options/types.ts:143`. The executor checks `options.stream` at `executor.ts:657`. All of this is replaced by `.stream()` on `FetchPromise`.

**Step 1: Update streaming tests to use new API**

Replace all `{ stream: true }` usage in `tests/src/fetch/engine/streaming.test.ts`:

```ts
// Before:
const result = await api.get('/events', { stream: true });
const reader = result.data.body.getReader();

// After:
const result = api.get('/events').stream();
for await (const chunk of result) { ... }
// Or for metadata access:
const response = await api.get('/events').raw();
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test streaming`
Expected: FAIL — stream overloads removed

**Step 3: Remove stream option from types and overloads**

1. Remove `stream?: boolean` from `CallConfig` in `options/types.ts:143`
2. Remove `stream?: boolean` from `InternalReqOptions` in `engine/types.ts:239`
3. Remove all `{ stream: true }` overloads from `engine/index.ts` (lines 285-288, 303-307, 323-327, 343-347, 363-367, 383-386, 401-404, 419-423)
4. Remove the `'stream' in payloadOrOptions` check from `executor.ts:129`
5. Remove the `if (options.stream) { ... }` block from `executor.ts:657-691` (this logic now lives in the directive check from Task 4)

**Step 4: Run tests to verify they pass**

Run: `pnpm test streaming`
Expected: PASS

**Step 5: Commit**

```
feat(fetch)!: remove { stream: true } option in favor of .stream() chain
```

---

### Task 6: Update FetchEngine return types

**Files:**
- Modify: `packages/fetch/src/engine/index.ts` (all HTTP method signatures)
- Modify: `packages/fetch/src/engine/executor.ts` (execute return type)
- Test: existing tests should still pass

**Context:** All HTTP methods currently return `AbortablePromise<FetchResponse<...>>`. They need to return `FetchPromise<...>` instead. The `AbortablePromise` interface in `index.ts:58-63` can be kept for backwards compatibility or removed — since we're in beta, remove it.

**Step 1: Update return types**

In `engine/index.ts`, change all method signatures:

```ts
// Before:
get<Res = unknown, ResHdr = RH>(
    path: string,
    options?: CallConfig<H, P>
): AbortablePromise<FetchResponse<Res, DictAndT<H>, DictAndT<P>, ResHdr>>;

// After:
get<Res = unknown, ResHdr = RH>(
    path: string,
    options?: CallConfig<H, P>
): FetchPromise<Res, DictAndT<H>, DictAndT<P>, ResHdr>;
```

Apply to: `get`, `post`, `put`, `patch`, `delete`, `options`, `head`, `request`.

**Step 2: Remove the `AbortablePromise` interface from `engine/index.ts:58-63`**

Also remove the duplicate in `executor.ts:29-33`. Import from `fetch-promise.ts` instead.

**Step 3: Update the `FetchEngine.AbortPromise` type alias at `index.ts:644`**

```ts
// Point to FetchPromise instead
export type AbortPromise<T> = FetchPromise<T>;
```

Or remove if not needed.

**Step 4: Export FetchPromise and FetchStreamPromise from package barrel**

In `packages/fetch/src/index.ts`, add:

```ts
export { FetchPromise } from './engine/fetch-promise.js';
export type { FetchStreamPromise } from './engine/fetch-promise.js';
```

**Step 5: Run full test suite**

Run: `pnpm test`
Expected: All fetch tests PASS

**Step 6: Commit**

```
feat(fetch)!: return FetchPromise from all HTTP methods
```

---

### Task 7: Update global instance exports

**Files:**
- Modify: `packages/fetch/src/index.ts` (lines 102-123)

**Context:** The global exports bind engine methods: `export const get = baseEngine.get.bind(baseEngine)`. These should automatically return `FetchPromise` since the engine methods now do. Verify the types flow through correctly.

**Step 1: Verify types compile**

Run: `pnpm build`
Expected: Build succeeds with no type errors

**Step 2: Run full test suite**

Run: `pnpm test`
Expected: All tests PASS

**Step 3: Commit (if any changes needed)**

```
fix(fetch): ensure global instance exports return FetchPromise types
```

---

### Task 8: Update documentation and LLM helpers

**Files:**
- Modify: `llm-helpers/fetch.md`
- Modify: `docs/packages/fetch.md`

**Step 1: Update LLM helpers**

Add FetchPromise chaining examples. Update streaming section to use `.stream()` instead of `{ stream: true }`.

**Step 2: Update docs**

Add a "Response Chaining" section showing `.json()`, `.text()`, `.raw()`, `.stream()` usage.

**Step 3: Commit**

```
docs(fetch): update documentation for FetchPromise chaining API
```

---

### Task 9: Build and verify

**Step 1: Build all packages**

Run: `pnpm build`
Expected: Clean build

**Step 2: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

**Step 3: Run type check**

Run: `pnpm tsc --noEmit` (or equivalent)
Expected: No type errors
