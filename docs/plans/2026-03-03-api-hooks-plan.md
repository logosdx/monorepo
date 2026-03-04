# Apollo-Style API Hooks — Implementation Plan


> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Apollo-style `useQuery`/`useMutation`/`useAsync` hooks as a new `@logosdx/react/api` subpath export with auto-refetch, polling, and ObserverEngine-driven invalidation.

**Architecture:** Three-tier hook layer (inline hooks → factories → context binding) built on plain React state and FetchEngine. ObserverEngine optional for event-driven invalidation. Existing `createFetchContext` hooks unchanged.

**Tech Stack:** React 18/19, @logosdx/fetch (FetchEngine), @logosdx/observer (ObserverEngine), @logosdx/utils (attempt), Vitest + JSDOM for tests.

**Design doc:** `docs/plans/2026-03-03-api-hooks-design.md`

---

## Key Conventions

- **Imports in source:** `import { attempt } from '@logosdx/utils'`, `import type { FetchEngine } from '@logosdx/fetch'`
- **Imports in tests:** Relative paths — `import { ... } from '../../../../packages/react/src/api/index.ts'`
- **Test helpers:** `import { renderHook, flush } from '../_helpers.ts'`
- **Fetch mock:** `globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(data))`
- **Cleanup:** Always `unmount()` + `engine.destroy()` in tests
- **Assertions:** Chai-style via Vitest (`expect(...).to.be...`, `expect(...).to.deep.equal(...)`)
- **Function style:** Newline after opening brace, 4-block structure where applicable
- **Error handling:** `attempt()` for I/O, never try-catch

---


### Task 1: Types

**Files:**
- Create: `packages/react/src/api/types.ts`

Pure type definitions. No tests needed.

**Step 1: Create the types file**

```ts
import type { DependencyList } from 'react';
import type { FetchEngine, CallConfig, FetchError } from '@logosdx/fetch';
import type { ObserverEngine } from '@logosdx/observer';

// === Return shapes ===

export type QueryResult<T> = {
    data: T | null;
    loading: boolean;
    error: FetchError | null;
    refetch: () => void;
    cancel: () => void;
};

export type MutationResult<T> = {
    data: T | null;
    loading: boolean;
    error: FetchError | null;
    mutate: <Payload = unknown>(payload?: Payload, overrides?: Record<string, unknown>) => Promise<T>;
    reset: () => void;
    cancel: () => void;
    called: boolean;
};

// === Option types ===

export type EmitEntry<E> = {
    event: keyof E;
    payload?: (data: any) => any;
};

export type EmitConfig<E> =
    | keyof E
    | EmitEntry<E>
    | (keyof E | EmitEntry<E>)[];

export type QueryOptions<H, P, E = Record<string, any>> = {
    defaults?: CallConfig<H, P>;
    reactive?: CallConfig<H, P>;
    skip?: boolean;
    pollInterval?: number;
    invalidateOn?: (keyof E)[];
};

export type MutationOptions<H, P, E = Record<string, any>> = {
    defaults?: CallConfig<H, P>;
    emitOnSuccess?: EmitConfig<E>;
};

export type AsyncOptions<E = Record<string, any>> = {
    skip?: boolean;
    pollInterval?: number;
    invalidateOn?: (keyof E)[];
};
```

**Step 2: Commit**

```bash
git add packages/react/src/api/types.ts
git commit -m "feat(react): add API hook type definitions"
```

---


### Task 2: useQuery Hook

**Files:**
- Create: `tests/src/react/api/use-query.test.ts`
- Create: `packages/react/src/api/use-query.ts`

**Step 1: Write the failing tests**

Create `tests/src/react/api/use-query.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';

import { FetchEngine } from '../../../../packages/fetch/src/index.ts';
import { useQuery } from '../../../../packages/react/src/api/use-query.ts';
import { renderHook, flush } from '../_helpers.ts';

const jsonResponse = (data: unknown, status = 200) => new Response(
    JSON.stringify(data),
    { status, headers: { 'content-type': 'application/json' } }
);

const originalFetch = globalThis.fetch;

describe('@logosdx/react api: useQuery', () => {

    afterEach(() => {

        globalThis.fetch = originalFetch;
    });

    it('auto-fetches on mount and returns data (not full response)', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ users: ['alice', 'bob'] })
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useQuery<{ users: string[] }>(engine, '/users')
        );

        expect(result.current.loading).to.be.true;
        expect(result.current.data).to.be.null;
        expect(result.current.error).to.be.null;

        await flush();

        expect(result.current.loading).to.be.false;
        expect(result.current.data).to.deep.equal({ users: ['alice', 'bob'] });
        expect(result.current.error).to.be.null;

        unmount();
        engine.destroy();
    });

    it('sets error state on failed request', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ message: 'Not found' }, 404)
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useQuery(engine, '/missing')
        );

        await flush();

        expect(result.current.loading).to.be.false;
        expect(result.current.data).to.be.null;
        expect(result.current.error).to.not.be.null;
        expect(result.current.error!.status).to.equal(404);

        unmount();
        engine.destroy();
    });

    it('re-fetches when reactive config changes', async () => {

        globalThis.fetch = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ page: 1 }))
            .mockResolvedValueOnce(jsonResponse({ page: 2 }));

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        let page = 1;

        const { result, rerender, unmount } = renderHook(() =>
            useQuery(engine, '/items', {
                reactive: { params: { page } },
            })
        );

        await flush();
        expect(result.current.data).to.deep.equal({ page: 1 });

        page = 2;
        rerender();
        await flush();

        expect(result.current.data).to.deep.equal({ page: 2 });
        expect(globalThis.fetch).toHaveBeenCalledTimes(2);

        unmount();
        engine.destroy();
    });

    it('does not fetch when skip is true', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useQuery(engine, '/skipped', { skip: true })
        );

        await flush();

        expect(result.current.loading).to.be.false;
        expect(result.current.data).to.be.null;
        expect(globalThis.fetch).not.toHaveBeenCalled();

        unmount();
        engine.destroy();
    });

    it('merges defaults and reactive config', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useQuery(engine, '/with-config', {
                defaults: { headers: { 'X-Custom': 'value' } },
                reactive: { params: { page: 1 } },
            })
        );

        await flush();

        const [url, options] = (globalThis.fetch as any).mock.calls[0];
        expect(url.toString()).to.include('page=1');
        expect(options.headers.get('x-custom')).to.equal('value');

        unmount();
        engine.destroy();
    });

    it('refetch() re-executes the query', async () => {

        globalThis.fetch = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ count: 1 }))
            .mockResolvedValueOnce(jsonResponse({ count: 2 }));

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useQuery(engine, '/counter')
        );

        await flush();
        expect(result.current.data).to.deep.equal({ count: 1 });

        act(() => { result.current.refetch(); });
        await flush();

        expect(result.current.data).to.deep.equal({ count: 2 });
        expect(globalThis.fetch).toHaveBeenCalledTimes(2);

        unmount();
        engine.destroy();
    });

    it('cancel() aborts the in-flight request', async () => {

        globalThis.fetch = vi.fn().mockImplementation(
            () => new Promise(() => {})
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useQuery(engine, '/slow')
        );

        expect(result.current.loading).to.be.true;

        act(() => { result.current.cancel(); });
        await flush();

        expect(result.current.loading).to.be.true;

        unmount();
        engine.destroy();
    });

    it('cleans up in-flight request on unmount', async () => {

        globalThis.fetch = vi.fn().mockImplementation(
            () => new Promise(() => {})
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { unmount } = renderHook(() =>
            useQuery(engine, '/hang')
        );

        unmount();
        engine.destroy();
    });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/alonso/projects/logos-dx/monorepo && pnpm test api/use-query`
Expected: FAIL — `use-query.ts` does not exist yet

**Step 3: Write the implementation**

Create `packages/react/src/api/use-query.ts`:

```ts
import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';

import { attempt } from '@logosdx/utils';
import type { FetchEngine, FetchError } from '@logosdx/fetch';
import type { ObserverEngine } from '@logosdx/observer';
import type { QueryResult, QueryOptions } from './types.ts';

/**
 * Apollo-style query hook — auto-fetches on mount, re-fetches when reactive
 * config changes. Returns `{ data, loading, error, refetch, cancel }`.
 *
 * `data` is the parsed response body (not the full FetchResponse).
 *
 *     const { data, loading, error } = useQuery<User[]>(api, '/users', {
 *         reactive: { params: { page: 1 } },
 *     });
 *
 * @param engine - FetchEngine instance
 * @param path - Request path (appended to engine's baseUrl)
 * @param options - Query options (defaults, reactive, skip, pollInterval, invalidateOn)
 * @param observer - Optional ObserverEngine for invalidateOn support
 */
export function useQuery<
    T = unknown,
    H = FetchEngine.InstanceHeaders,
    P = FetchEngine.InstanceParams,
    E extends Record<string, any> = Record<string, any>,
>(
    engine: FetchEngine<H, P, any, any>,
    path: string,
    options?: QueryOptions<H, P, E>,
    observer?: ObserverEngine<E>,
): QueryResult<T> {

    const defaults = options?.defaults;
    const reactive = options?.reactive;
    const skip = options?.skip ?? false;
    const pollInterval = options?.pollInterval;
    const invalidateOn = options?.invalidateOn;

    const reactiveKey = reactive ? JSON.stringify(reactive) : '';
    const key = path + reactiveKey;

    const [loading, setLoading] = useState(!skip);
    const [data, setData] = useState<T | null>(null);
    const [error, setError] = useState<FetchError | null>(null);
    const [refetchCount, setRefetchCount] = useState(0);

    const abortRef = useRef<AbortController | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => () => { mountedRef.current = false; }, []);

    useEffect(() => {

        if (skip) {

            setLoading(false);
            return;
        }

        abortRef.current?.abort();
        abortRef.current = new AbortController();

        const controller = abortRef.current;

        setLoading(true);

        const config = {
            ...defaults,
            ...reactive,
            abortController: controller,
        };

        const promise = attempt(
            () => engine.get<T>(path, config as any)
        );

        promise.then(([res, err]) => {

            if (controller.signal.aborted || !mountedRef.current) return;

            if (err) {

                setLoading(false);
                setData(null);
                setError(err as FetchError);
                return;
            }

            setLoading(false);
            setData(res!.data);
            setError(null);
        });

        return () => controller.abort();

    }, [key, skip, refetchCount]);

    // Polling
    useEffect(() => {

        if (!pollInterval || skip) return;

        const interval = setInterval(
            () => setRefetchCount(c => c + 1),
            pollInterval,
        );

        return () => clearInterval(interval);

    }, [pollInterval, skip]);

    // Observer invalidation
    useEffect(() => {

        if (!observer || !invalidateOn?.length) return;

        const cleanups = invalidateOn.map(event =>
            observer.on(event as any, () => setRefetchCount(c => c + 1))
        );

        return () => cleanups.forEach(fn => fn());

    }, [observer, JSON.stringify(invalidateOn)]);

    const refetch = useCallback(
        () => setRefetchCount(c => c + 1),
        [],
    );

    const cancel = useCallback(() => {

        abortRef.current?.abort();
    }, []);

    return { data, loading, error, refetch, cancel };
}
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/alonso/projects/logos-dx/monorepo && pnpm test api/use-query`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add packages/react/src/api/use-query.ts tests/src/react/api/use-query.test.ts
git commit -m "feat(react): add useQuery hook with auto-fetch and reactive config"
```

---


### Task 3: useMutation Hook

**Files:**
- Create: `tests/src/react/api/use-mutation.test.ts`
- Create: `packages/react/src/api/use-mutation.ts`

**Step 1: Write the failing tests**

Create `tests/src/react/api/use-mutation.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';

import { FetchEngine } from '../../../../packages/fetch/src/index.ts';
import { ObserverEngine } from '../../../../packages/observer/src/index.ts';
import { useMutation } from '../../../../packages/react/src/api/use-mutation.ts';
import { renderHook, flush } from '../_helpers.ts';

const jsonResponse = (data: unknown, status = 200) => new Response(
    JSON.stringify(data),
    { status, headers: { 'content-type': 'application/json' } }
);

const originalFetch = globalThis.fetch;

describe('@logosdx/react api: useMutation', () => {

    afterEach(() => {

        globalThis.fetch = originalFetch;
    });

    it('starts idle — loading false, data null, called false', () => {

        globalThis.fetch = vi.fn();

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useMutation(engine, 'post', '/users')
        );

        expect(result.current.loading).to.be.false;
        expect(result.current.data).to.be.null;
        expect(result.current.error).to.be.null;
        expect(result.current.called).to.be.false;
        expect(result.current.mutate).to.be.a('function');
        expect(result.current.reset).to.be.a('function');
        expect(result.current.cancel).to.be.a('function');

        expect(globalThis.fetch).not.toHaveBeenCalled();

        unmount();
        engine.destroy();
    });

    it('mutate() fires request and resolves with data', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ id: 1, name: 'Alice' }, 201)
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useMutation<{ id: number; name: string }>(engine, 'post', '/users')
        );

        let resolved: any;
        act(() => {
            resolved = result.current.mutate({ name: 'Alice' });
        });

        await flush();

        const returnedData = await resolved;
        expect(returnedData).to.deep.equal({ id: 1, name: 'Alice' });

        expect(result.current.loading).to.be.false;
        expect(result.current.data).to.deep.equal({ id: 1, name: 'Alice' });
        expect(result.current.error).to.be.null;
        expect(result.current.called).to.be.true;

        unmount();
        engine.destroy();
    });

    it('sets error state on failure', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ message: 'Validation failed' }, 422)
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useMutation(engine, 'post', '/users')
        );

        act(() => { result.current.mutate({ name: '' }); });

        await flush();

        expect(result.current.loading).to.be.false;
        expect(result.current.data).to.be.null;
        expect(result.current.error).to.not.be.null;
        expect(result.current.error!.status).to.equal(422);
        expect(result.current.called).to.be.true;

        unmount();
        engine.destroy();
    });

    it('reset() clears state back to idle', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ id: 1 }, 201)
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useMutation(engine, 'post', '/users')
        );

        act(() => { result.current.mutate({ name: 'Alice' }); });
        await flush();

        expect(result.current.called).to.be.true;
        expect(result.current.data).to.not.be.null;

        act(() => { result.current.reset(); });

        expect(result.current.data).to.be.null;
        expect(result.current.error).to.be.null;
        expect(result.current.called).to.be.false;
        expect(result.current.loading).to.be.false;

        unmount();
        engine.destroy();
    });

    it('emitOnSuccess emits event on observer after success (string form)', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ id: 1, name: 'Alice' }, 201)
        );

        interface Events { 'users.created': { id: number; name: string } }

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
        const observer = new ObserverEngine<Events>();
        const handler = vi.fn();

        observer.on('users.created', handler);

        const { result, unmount } = renderHook(() =>
            useMutation<{ id: number; name: string }, any, any, Events>(
                engine, 'post', '/users',
                { emitOnSuccess: 'users.created' },
                observer
            )
        );

        act(() => { result.current.mutate({ name: 'Alice' }); });
        await flush();

        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0]![0]).to.deep.equal({ id: 1, name: 'Alice' });

        unmount();
        engine.destroy();
    });

    it('emitOnSuccess emits event with custom payload transform', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ id: 1, name: 'Alice' }, 201)
        );

        interface Events { 'audit.log': { action: string } }

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
        const observer = new ObserverEngine<Events>();
        const handler = vi.fn();

        observer.on('audit.log', handler);

        const { result, unmount } = renderHook(() =>
            useMutation<{ id: number; name: string }, any, any, Events>(
                engine, 'post', '/users',
                {
                    emitOnSuccess: {
                        event: 'audit.log',
                        payload: () => ({ action: 'create' }),
                    },
                },
                observer
            )
        );

        act(() => { result.current.mutate({ name: 'Alice' }); });
        await flush();

        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0]![0]).to.deep.equal({ action: 'create' });

        unmount();
        engine.destroy();
    });

    it('emitOnSuccess supports array of events', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ id: 1 }, 201)
        );

        interface Events {
            'users.created': { id: number };
            'dashboard.refresh': { id: number };
        }

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
        const observer = new ObserverEngine<Events>();
        const handler1 = vi.fn();
        const handler2 = vi.fn();

        observer.on('users.created', handler1);
        observer.on('dashboard.refresh', handler2);

        const { result, unmount } = renderHook(() =>
            useMutation<{ id: number }, any, any, Events>(
                engine, 'post', '/users',
                { emitOnSuccess: ['users.created', 'dashboard.refresh'] },
                observer
            )
        );

        act(() => { result.current.mutate({}); });
        await flush();

        expect(handler1).toHaveBeenCalledOnce();
        expect(handler2).toHaveBeenCalledOnce();

        unmount();
        engine.destroy();
    });

    it('del method works as mutation', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({}));

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useMutation(engine, 'delete', '/users/1')
        );

        act(() => { result.current.mutate(); });
        await flush();

        expect(result.current.loading).to.be.false;
        expect(result.current.error).to.be.null;
        expect(result.current.called).to.be.true;

        unmount();
        engine.destroy();
    });

    it('put method works as mutation', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ id: 1, name: 'Updated' })
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useMutation<{ id: number; name: string }>(engine, 'put', '/users/1')
        );

        act(() => { result.current.mutate({ name: 'Updated' }); });
        await flush();

        expect(result.current.data).to.deep.equal({ id: 1, name: 'Updated' });

        unmount();
        engine.destroy();
    });

    it('patch method works as mutation', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ id: 1, name: 'Patched' })
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useMutation<{ id: number; name: string }>(engine, 'patch', '/users/1')
        );

        act(() => { result.current.mutate({ name: 'Patched' }); });
        await flush();

        expect(result.current.data).to.deep.equal({ id: 1, name: 'Patched' });

        unmount();
        engine.destroy();
    });

    it('cancel() aborts the in-flight mutation', async () => {

        globalThis.fetch = vi.fn().mockImplementation(
            () => new Promise(() => {})
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useMutation(engine, 'post', '/users')
        );

        act(() => { result.current.mutate({ name: 'Alice' }); });
        act(() => { result.current.cancel(); });

        await flush();

        unmount();
        engine.destroy();
    });

    it('defaults config is passed to engine', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useMutation(engine, 'post', '/with-headers', {
                defaults: { headers: { 'X-Custom': 'value' } },
            })
        );

        act(() => { result.current.mutate({}); });
        await flush();

        const [, options] = (globalThis.fetch as any).mock.calls[0];
        expect(options.headers.get('x-custom')).to.equal('value');

        unmount();
        engine.destroy();
    });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/alonso/projects/logos-dx/monorepo && pnpm test api/use-mutation`
Expected: FAIL — `use-mutation.ts` does not exist yet

**Step 3: Write the implementation**

Create `packages/react/src/api/use-mutation.ts`:

```ts
import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';

import { attempt } from '@logosdx/utils';
import type { FetchEngine, FetchError } from '@logosdx/fetch';
import type { ObserverEngine } from '@logosdx/observer';
import type { MutationResult, MutationOptions, EmitConfig, EmitEntry } from './types.ts';

function emitEvents<E extends Record<string, any>>(
    observer: ObserverEngine<E>,
    config: EmitConfig<E>,
    data: unknown,
): void {

    const entries = Array.isArray(config) ? config : [config];

    for (const entry of entries) {

        if (typeof entry === 'string' || typeof entry === 'symbol') {

            observer.emit(entry as any, data as any);
        }
        else {

            const typed = entry as EmitEntry<E>;
            const payload = typed.payload ? typed.payload(data) : data;
            observer.emit(typed.event as any, payload as any);
        }
    }
}

/**
 * Apollo-style mutation hook — idle until `mutate()` is called.
 * Returns `{ data, loading, error, mutate, reset, cancel, called }`.
 *
 * `mutate()` returns a Promise that resolves with the parsed response body.
 *
 *     const { mutate, loading, error } = useMutation<User>(api, 'post', '/users', {
 *         emitOnSuccess: 'users.created',
 *     }, observer);
 *
 *     const user = await mutate({ name: 'Alice' });
 *
 * @param engine - FetchEngine instance
 * @param method - HTTP method (post, put, delete, patch)
 * @param path - Request path
 * @param options - Mutation options (defaults, emitOnSuccess)
 * @param observer - Optional ObserverEngine for emitOnSuccess
 */
export function useMutation<
    T = unknown,
    H = FetchEngine.InstanceHeaders,
    P = FetchEngine.InstanceParams,
    E extends Record<string, any> = Record<string, any>,
>(
    engine: FetchEngine<H, P, any, any>,
    method: 'post' | 'put' | 'delete' | 'patch',
    path: string,
    options?: MutationOptions<H, P, E>,
    observer?: ObserverEngine<E>,
): MutationResult<T> {

    const defaults = options?.defaults;
    const emitOnSuccess = options?.emitOnSuccess;

    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<T | null>(null);
    const [error, setError] = useState<FetchError | null>(null);
    const [called, setCalled] = useState(false);

    const abortRef = useRef<AbortController | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => () => { mountedRef.current = false; }, []);

    const mutate = useCallback(<Payload = unknown>(
        payload?: Payload,
        overrides?: Record<string, unknown>,
    ): Promise<T> => {

        abortRef.current?.abort();
        abortRef.current = new AbortController();

        const controller = abortRef.current;

        setLoading(true);
        setData(null);
        setError(null);

        const config = {
            ...defaults,
            ...overrides,
            abortController: controller,
        };

        const engineMethod = engine[method].bind(engine);

        return attempt(
            () => engineMethod<T>(path, payload, config as any)
        ).then(([res, err]) => {

            if (!mountedRef.current) return undefined as any;

            if (err) {

                setLoading(false);
                setData(null);
                setError(err as FetchError);
                setCalled(true);
                return undefined as any;
            }

            const responseData = res!.data;

            setLoading(false);
            setData(responseData);
            setError(null);
            setCalled(true);

            if (observer && emitOnSuccess) {

                emitEvents(observer, emitOnSuccess, responseData);
            }

            return responseData;
        });

    }, [path, method]);

    const reset = useCallback(() => {

        setLoading(false);
        setData(null);
        setError(null);
        setCalled(false);
    }, []);

    const cancel = useCallback(() => {

        abortRef.current?.abort();
    }, []);

    return { data, loading, error, mutate, reset, cancel, called };
}
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/alonso/projects/logos-dx/monorepo && pnpm test api/use-mutation`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add packages/react/src/api/use-mutation.ts tests/src/react/api/use-mutation.test.ts
git commit -m "feat(react): add useMutation hook with emitOnSuccess support"
```

---


### Task 4: useAsync Hook

**Files:**
- Create: `tests/src/react/api/use-async.test.ts`
- Create: `packages/react/src/api/use-async.ts`

**Step 1: Write the failing tests**

Create `tests/src/react/api/use-async.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';

import { FetchEngine } from '../../../../packages/fetch/src/index.ts';
import { useAsync } from '../../../../packages/react/src/api/use-async.ts';
import { renderHook, flush } from '../_helpers.ts';

const jsonResponse = (data: unknown, status = 200) => new Response(
    JSON.stringify(data),
    { status, headers: { 'content-type': 'application/json' } }
);

const originalFetch = globalThis.fetch;

describe('@logosdx/react api: useAsync', () => {

    afterEach(() => {

        globalThis.fetch = originalFetch;
    });

    it('auto-executes on mount and returns data', async () => {

        const fn = vi.fn().mockResolvedValue({ users: ['alice'] });

        const { result, unmount } = renderHook(() =>
            useAsync<{ users: string[] }>(fn, [])
        );

        expect(result.current.loading).to.be.true;

        await flush();

        expect(result.current.loading).to.be.false;
        expect(result.current.data).to.deep.equal({ users: ['alice'] });
        expect(result.current.error).to.be.null;

        unmount();
    });

    it('re-executes when deps change', async () => {

        const fn = vi.fn()
            .mockResolvedValueOnce({ page: 1 })
            .mockResolvedValueOnce({ page: 2 });

        let page = 1;

        const { result, rerender, unmount } = renderHook(() =>
            useAsync(fn, [page])
        );

        await flush();
        expect(result.current.data).to.deep.equal({ page: 1 });

        page = 2;
        rerender();
        await flush();

        expect(result.current.data).to.deep.equal({ page: 2 });
        expect(fn).toHaveBeenCalledTimes(2);

        unmount();
    });

    it('does not execute when skip is true', async () => {

        const fn = vi.fn().mockResolvedValue({ ok: true });

        const { result, unmount } = renderHook(() =>
            useAsync(fn, [], { skip: true })
        );

        await flush();

        expect(result.current.loading).to.be.false;
        expect(result.current.data).to.be.null;
        expect(fn).not.toHaveBeenCalled();

        unmount();
    });

    it('sets error state on rejection', async () => {

        const err = new Error('boom');
        const fn = vi.fn().mockRejectedValue(err);

        const { result, unmount } = renderHook(() =>
            useAsync(fn, [])
        );

        await flush();

        expect(result.current.loading).to.be.false;
        expect(result.current.data).to.be.null;
        expect(result.current.error).to.equal(err);

        unmount();
    });

    it('unwraps FetchResponse when fn returns one', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ name: 'Alice' })
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useAsync<{ name: string }>(
                () => engine.get<{ name: string }>('/user'),
                [],
            )
        );

        await flush();

        expect(result.current.data).to.deep.equal({ name: 'Alice' });

        unmount();
        engine.destroy();
    });

    it('refetch() re-executes the function', async () => {

        const fn = vi.fn()
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 2 });

        const { result, unmount } = renderHook(() =>
            useAsync(fn, [])
        );

        await flush();
        expect(result.current.data).to.deep.equal({ count: 1 });

        act(() => { result.current.refetch(); });
        await flush();

        expect(result.current.data).to.deep.equal({ count: 2 });
        expect(fn).toHaveBeenCalledTimes(2);

        unmount();
    });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/alonso/projects/logos-dx/monorepo && pnpm test api/use-async`
Expected: FAIL — `use-async.ts` does not exist yet

**Step 3: Write the implementation**

Create `packages/react/src/api/use-async.ts`:

```ts
import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';

import type { DependencyList } from 'react';
import type { ObserverEngine } from '@logosdx/observer';
import type { QueryResult, AsyncOptions } from './types.ts';

/**
 * Checks whether a value looks like a FetchResponse (has `.data` and `.status`
 * and `.request`). Used to auto-unwrap FetchResponse from FetchEngine methods.
 */
function isFetchResponse(value: unknown): value is { data: unknown } {

    return (
        typeof value === 'object'
        && value !== null
        && 'data' in value
        && 'status' in value
        && 'request' in value
    );
}

/**
 * Generic async hook — wraps any async function with loading/error/data state.
 * Auto-executes on mount and when deps change.
 *
 * If the function returns a FetchResponse (from FetchEngine methods),
 * the `.data` property is automatically unwrapped.
 *
 *     const { data, loading, error } = useAsync(
 *         () => myApi.getUsers(page),
 *         [page],
 *     );
 *
 * @param fn - Async function to execute
 * @param deps - React dependency list — re-executes when these change
 * @param options - skip, pollInterval, invalidateOn
 * @param observer - Optional ObserverEngine for invalidateOn support
 */
export function useAsync<
    T = unknown,
    E extends Record<string, any> = Record<string, any>,
>(
    fn: () => Promise<any>,
    deps: DependencyList,
    options?: AsyncOptions<E>,
    observer?: ObserverEngine<E>,
): QueryResult<T> {

    const skip = options?.skip ?? false;
    const pollInterval = options?.pollInterval;
    const invalidateOn = options?.invalidateOn;

    const [loading, setLoading] = useState(!skip);
    const [data, setData] = useState<T | null>(null);
    const [error, setError] = useState<any>(null);
    const [refetchCount, setRefetchCount] = useState(0);

    const mountedRef = useRef(true);

    useEffect(() => () => { mountedRef.current = false; }, []);

    useEffect(() => {

        if (skip) {

            setLoading(false);
            return;
        }

        setLoading(true);

        let cancelled = false;

        fn().then(
            (result) => {

                if (cancelled || !mountedRef.current) return;

                const unwrapped = isFetchResponse(result) ? result.data : result;

                setLoading(false);
                setData(unwrapped as T);
                setError(null);
            },
            (err) => {

                if (cancelled || !mountedRef.current) return;

                setLoading(false);
                setData(null);
                setError(err);
            },
        );

        return () => { cancelled = true; };

    }, [...deps, skip, refetchCount]);

    // Polling
    useEffect(() => {

        if (!pollInterval || skip) return;

        const interval = setInterval(
            () => setRefetchCount(c => c + 1),
            pollInterval,
        );

        return () => clearInterval(interval);

    }, [pollInterval, skip]);

    // Observer invalidation
    useEffect(() => {

        if (!observer || !invalidateOn?.length) return;

        const cleanups = invalidateOn.map(event =>
            observer.on(event as any, () => setRefetchCount(c => c + 1))
        );

        return () => cleanups.forEach(fn => fn());

    }, [observer, JSON.stringify(invalidateOn)]);

    const refetch = useCallback(
        () => setRefetchCount(c => c + 1),
        [],
    );

    const cancel = useCallback(() => {}, []);

    return { data, loading, error, refetch, cancel };
}
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/alonso/projects/logos-dx/monorepo && pnpm test api/use-async`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add packages/react/src/api/use-async.ts tests/src/react/api/use-async.test.ts
git commit -m "feat(react): add useAsync hook with FetchResponse auto-unwrap"
```

---


### Task 5: Polling & Observer Invalidation Tests

**Files:**
- Create: `tests/src/react/api/features.test.ts`

Tests for polling and observer-driven invalidation across useQuery and useAsync.

**Step 1: Write the tests**

Create `tests/src/react/api/features.test.ts`:

```ts
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

import { FetchEngine } from '../../../../packages/fetch/src/index.ts';
import { ObserverEngine } from '../../../../packages/observer/src/index.ts';
import { useQuery } from '../../../../packages/react/src/api/use-query.ts';
import { useAsync } from '../../../../packages/react/src/api/use-async.ts';
import { renderHook, flush } from '../_helpers.ts';

const jsonResponse = (data: unknown, status = 200) => new Response(
    JSON.stringify(data),
    { status, headers: { 'content-type': 'application/json' } }
);

const originalFetch = globalThis.fetch;

describe('@logosdx/react api: polling', () => {

    beforeEach(() => { vi.useFakeTimers(); });

    afterEach(() => {

        vi.useRealTimers();
        globalThis.fetch = originalFetch;
    });

    it('useQuery polls at the specified interval', async () => {

        let callCount = 0;

        globalThis.fetch = vi.fn().mockImplementation(() =>
            Promise.resolve(jsonResponse({ count: ++callCount }))
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useQuery(engine, '/metrics', { pollInterval: 5000 })
        );

        await flush();
        expect(result.current.data).to.deep.equal({ count: 1 });

        await vi.advanceTimersByTimeAsync(5000);
        await flush();
        expect(result.current.data).to.deep.equal({ count: 2 });

        await vi.advanceTimersByTimeAsync(5000);
        await flush();
        expect(result.current.data).to.deep.equal({ count: 3 });

        unmount();
        engine.destroy();
    });

    it('useQuery stops polling on unmount', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { unmount } = renderHook(() =>
            useQuery(engine, '/metrics', { pollInterval: 1000 })
        );

        await flush();
        unmount();

        const callsBefore = (globalThis.fetch as any).mock.calls.length;
        await vi.advanceTimersByTimeAsync(5000);
        const callsAfter = (globalThis.fetch as any).mock.calls.length;

        expect(callsAfter).to.equal(callsBefore);

        engine.destroy();
    });
});

describe('@logosdx/react api: observer invalidation', () => {

    afterEach(() => {

        globalThis.fetch = originalFetch;
    });

    it('useQuery refetches when invalidateOn event fires', async () => {

        globalThis.fetch = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ version: 1 }))
            .mockResolvedValueOnce(jsonResponse({ version: 2 }));

        interface Events { 'users.created': { id: number } }

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
        const observer = new ObserverEngine<Events>();

        const { result, unmount } = renderHook(() =>
            useQuery(engine, '/users', {
                invalidateOn: ['users.created'],
            }, observer)
        );

        await flush();
        expect(result.current.data).to.deep.equal({ version: 1 });

        observer.emit('users.created', { id: 1 });
        await flush();

        expect(result.current.data).to.deep.equal({ version: 2 });
        expect(globalThis.fetch).toHaveBeenCalledTimes(2);

        unmount();
        engine.destroy();
    });

    it('useAsync refetches when invalidateOn event fires', async () => {

        const fn = vi.fn()
            .mockResolvedValueOnce({ version: 1 })
            .mockResolvedValueOnce({ version: 2 });

        interface Events { 'data.updated': void }

        const observer = new ObserverEngine<Events>();

        const { result, unmount } = renderHook(() =>
            useAsync(fn, [], {
                invalidateOn: ['data.updated'],
            }, observer)
        );

        await flush();
        expect(result.current.data).to.deep.equal({ version: 1 });

        observer.emit('data.updated', undefined as any);
        await flush();

        expect(result.current.data).to.deep.equal({ version: 2 });
        expect(fn).toHaveBeenCalledTimes(2);

        unmount();
    });

    it('cleans up observer subscriptions on unmount', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));

        interface Events { 'users.created': void }

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
        const observer = new ObserverEngine<Events>();

        const { unmount } = renderHook(() =>
            useQuery(engine, '/users', {
                invalidateOn: ['users.created'],
            }, observer)
        );

        await flush();
        unmount();

        const callsBefore = (globalThis.fetch as any).mock.calls.length;
        observer.emit('users.created', undefined as any);
        await flush();
        const callsAfter = (globalThis.fetch as any).mock.calls.length;

        expect(callsAfter).to.equal(callsBefore);

        engine.destroy();
    });
});
```

**Step 2: Run tests to verify they pass**

Run: `cd /Users/alonso/projects/logos-dx/monorepo && pnpm test api/features`
Expected: All tests PASS (implementation already supports these features)

**Step 3: Commit**

```bash
git add tests/src/react/api/features.test.ts
git commit -m "test(react): add polling and observer invalidation tests for API hooks"
```

---


### Task 6: Factory Functions

**Files:**
- Create: `tests/src/react/api/factories.test.ts`
- Create: `packages/react/src/api/create-query.ts`
- Create: `packages/react/src/api/create-mutation.ts`

**Step 1: Write the failing tests**

Create `tests/src/react/api/factories.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';

import { FetchEngine } from '../../../../packages/fetch/src/index.ts';
import { ObserverEngine } from '../../../../packages/observer/src/index.ts';
import { createQuery } from '../../../../packages/react/src/api/create-query.ts';
import { createMutation } from '../../../../packages/react/src/api/create-mutation.ts';
import { renderHook, flush } from '../_helpers.ts';

const jsonResponse = (data: unknown, status = 200) => new Response(
    JSON.stringify(data),
    { status, headers: { 'content-type': 'application/json' } }
);

const originalFetch = globalThis.fetch;

describe('@logosdx/react api: createQuery', () => {

    afterEach(() => {

        globalThis.fetch = originalFetch;
    });

    it('creates a reusable hook that auto-fetches', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ users: ['alice'] })
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
        const useUsers = createQuery<{ users: string[] }>(engine, '/users');

        const { result, unmount } = renderHook(() => useUsers());

        await flush();

        expect(result.current.data).to.deep.equal({ users: ['alice'] });

        unmount();
        engine.destroy();
    });

    it('factory defaults are merged with call-time overrides', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const useItems = createQuery(engine, '/items', {
            defaults: { headers: { 'X-Default': 'yes' } },
        });

        const { result, unmount } = renderHook(() =>
            useItems({ reactive: { params: { page: 1 } } })
        );

        await flush();

        const [url, options] = (globalThis.fetch as any).mock.calls[0];
        expect(url.toString()).to.include('page=1');
        expect(options.headers.get('x-default')).to.equal('yes');

        unmount();
        engine.destroy();
    });

    it('factory passes observer for invalidation', async () => {

        globalThis.fetch = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ v: 1 }))
            .mockResolvedValueOnce(jsonResponse({ v: 2 }));

        interface Events { 'users.created': void }

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
        const observer = new ObserverEngine<Events>();

        const useUsers = createQuery(engine, '/users', {
            invalidateOn: ['users.created'],
        }, observer);

        const { result, unmount } = renderHook(() => useUsers());

        await flush();
        expect(result.current.data).to.deep.equal({ v: 1 });

        observer.emit('users.created', undefined as any);
        await flush();
        expect(result.current.data).to.deep.equal({ v: 2 });

        unmount();
        engine.destroy();
    });
});

describe('@logosdx/react api: createMutation', () => {

    afterEach(() => {

        globalThis.fetch = originalFetch;
    });

    it('creates a reusable mutation hook', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ id: 1 }, 201)
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
        const useCreateUser = createMutation<{ id: number }>(engine, 'post', '/users');

        const { result, unmount } = renderHook(() => useCreateUser());

        expect(result.current.called).to.be.false;

        act(() => { result.current.mutate({ name: 'Alice' }); });
        await flush();

        expect(result.current.data).to.deep.equal({ id: 1 });
        expect(result.current.called).to.be.true;

        unmount();
        engine.destroy();
    });

    it('factory passes observer and emitOnSuccess', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ id: 1 }, 201)
        );

        interface Events { 'users.created': { id: number } }

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
        const observer = new ObserverEngine<Events>();
        const handler = vi.fn();

        observer.on('users.created', handler);

        const useCreateUser = createMutation<{ id: number }, any, any, Events>(
            engine, 'post', '/users',
            { emitOnSuccess: 'users.created' },
            observer
        );

        const { result, unmount } = renderHook(() => useCreateUser());

        act(() => { result.current.mutate({ name: 'Alice' }); });
        await flush();

        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0]![0]).to.deep.equal({ id: 1 });

        unmount();
        engine.destroy();
    });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/alonso/projects/logos-dx/monorepo && pnpm test api/factories`
Expected: FAIL — factory files don't exist yet

**Step 3: Write createQuery implementation**

Create `packages/react/src/api/create-query.ts`:

```ts
import type { FetchEngine } from '@logosdx/fetch';
import type { ObserverEngine } from '@logosdx/observer';
import type { QueryResult, QueryOptions } from './types.ts';
import { useQuery } from './use-query.ts';

/**
 * Factory that creates a reusable query hook pre-bound to an engine and path.
 *
 *     const useUsers = createQuery<User[]>(api, '/users', {
 *         invalidateOn: ['users.created'],
 *     }, observer);
 *
 *     // In any component:
 *     const { data, loading } = useUsers({ reactive: { params: { page: 1 } } });
 *
 * @param engine - FetchEngine instance
 * @param path - Request path
 * @param defaults - Default query options (merged with call-time overrides)
 * @param observer - Optional ObserverEngine for invalidateOn
 */
export function createQuery<
    T = unknown,
    H = FetchEngine.InstanceHeaders,
    P = FetchEngine.InstanceParams,
    E extends Record<string, any> = Record<string, any>,
>(
    engine: FetchEngine<H, P, any, any>,
    path: string,
    defaults?: QueryOptions<H, P, E>,
    observer?: ObserverEngine<E>,
): (overrides?: Partial<QueryOptions<H, P, E>>) => QueryResult<T> {

    return (overrides?: Partial<QueryOptions<H, P, E>>) => {

        const merged: QueryOptions<H, P, E> = {
            ...defaults,
            ...overrides,
            defaults: { ...defaults?.defaults, ...overrides?.defaults } as any,
            reactive: { ...defaults?.reactive, ...overrides?.reactive } as any,
            invalidateOn: overrides?.invalidateOn ?? defaults?.invalidateOn,
        };

        return useQuery<T, H, P, E>(engine, path, merged, observer);
    };
}
```

**Step 4: Write createMutation implementation**

Create `packages/react/src/api/create-mutation.ts`:

```ts
import type { FetchEngine } from '@logosdx/fetch';
import type { ObserverEngine } from '@logosdx/observer';
import type { MutationResult, MutationOptions } from './types.ts';
import { useMutation } from './use-mutation.ts';

/**
 * Factory that creates a reusable mutation hook pre-bound to an engine, method, and path.
 *
 *     const useCreateUser = createMutation<User>(api, 'post', '/users', {
 *         emitOnSuccess: 'users.created',
 *     }, observer);
 *
 *     // In any component:
 *     const { mutate, loading } = useCreateUser();
 *
 * @param engine - FetchEngine instance
 * @param method - HTTP method (post, put, delete, patch)
 * @param path - Request path
 * @param defaults - Default mutation options
 * @param observer - Optional ObserverEngine for emitOnSuccess
 */
export function createMutation<
    T = unknown,
    H = FetchEngine.InstanceHeaders,
    P = FetchEngine.InstanceParams,
    E extends Record<string, any> = Record<string, any>,
>(
    engine: FetchEngine<H, P, any, any>,
    method: 'post' | 'put' | 'delete' | 'patch',
    path: string,
    defaults?: MutationOptions<H, P, E>,
    observer?: ObserverEngine<E>,
): (overrides?: Partial<MutationOptions<H, P, E>>) => MutationResult<T> {

    return (overrides?: Partial<MutationOptions<H, P, E>>) => {

        const merged: MutationOptions<H, P, E> = {
            ...defaults,
            ...overrides,
            defaults: { ...defaults?.defaults, ...overrides?.defaults } as any,
            emitOnSuccess: overrides?.emitOnSuccess ?? defaults?.emitOnSuccess,
        };

        return useMutation<T, H, P, E>(engine, method, path, merged, observer);
    };
}
```

**Step 5: Run tests to verify they pass**

Run: `cd /Users/alonso/projects/logos-dx/monorepo && pnpm test api/factories`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add packages/react/src/api/create-query.ts packages/react/src/api/create-mutation.ts tests/src/react/api/factories.test.ts
git commit -m "feat(react): add createQuery and createMutation factory functions"
```

---


### Task 7: createApiHooks Binding

**Files:**
- Create: `tests/src/react/api/create-api-hooks.test.ts`
- Create: `packages/react/src/api/create-api-hooks.ts`

**Step 1: Write the failing tests**

Create `tests/src/react/api/create-api-hooks.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';

import { FetchEngine } from '../../../../packages/fetch/src/index.ts';
import { ObserverEngine } from '../../../../packages/observer/src/index.ts';
import { createApiHooks } from '../../../../packages/react/src/api/create-api-hooks.ts';
import { renderHook, flush } from '../_helpers.ts';

const jsonResponse = (data: unknown, status = 200) => new Response(
    JSON.stringify(data),
    { status, headers: { 'content-type': 'application/json' } }
);

const originalFetch = globalThis.fetch;

describe('@logosdx/react api: createApiHooks', () => {

    afterEach(() => {

        globalThis.fetch = originalFetch;
    });

    it('returns all hook functions', () => {

        const engine = new FetchEngine({ baseUrl: 'https://api.test' });
        const hooks = createApiHooks(engine);

        expect(hooks.useQuery).to.be.a('function');
        expect(hooks.useMutation).to.be.a('function');
        expect(hooks.useAsync).to.be.a('function');
        expect(hooks.createQuery).to.be.a('function');
        expect(hooks.createMutation).to.be.a('function');

        engine.destroy();
    });

    it('useQuery is pre-bound to engine', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ users: ['alice'] })
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
        const { useQuery } = createApiHooks(engine);

        const { result, unmount } = renderHook(() =>
            useQuery<{ users: string[] }>('/users')
        );

        await flush();
        expect(result.current.data).to.deep.equal({ users: ['alice'] });

        unmount();
        engine.destroy();
    });

    it('useMutation is pre-bound to engine', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ id: 1 }, 201)
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
        const { useMutation } = createApiHooks(engine);

        const { result, unmount } = renderHook(() =>
            useMutation<{ id: number }>('post', '/users')
        );

        act(() => { result.current.mutate({ name: 'Alice' }); });
        await flush();

        expect(result.current.data).to.deep.equal({ id: 1 });

        unmount();
        engine.destroy();
    });

    it('useAsync is available from binding', async () => {

        const fn = vi.fn().mockResolvedValue({ ok: true });

        const engine = new FetchEngine({ baseUrl: 'https://api.test' });
        const { useAsync } = createApiHooks(engine);

        const { result, unmount } = renderHook(() =>
            useAsync(fn, [])
        );

        await flush();
        expect(result.current.data).to.deep.equal({ ok: true });

        unmount();
        engine.destroy();
    });

    it('createQuery is pre-bound to engine and observer', async () => {

        globalThis.fetch = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ v: 1 }))
            .mockResolvedValueOnce(jsonResponse({ v: 2 }));

        interface Events { 'users.created': void }

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
        const observer = new ObserverEngine<Events>();
        const { createQuery } = createApiHooks(engine, observer);

        const useUsers = createQuery<{ v: number }>('/users', {
            invalidateOn: ['users.created'],
        });

        const { result, unmount } = renderHook(() => useUsers());

        await flush();
        expect(result.current.data).to.deep.equal({ v: 1 });

        observer.emit('users.created', undefined as any);
        await flush();
        expect(result.current.data).to.deep.equal({ v: 2 });

        unmount();
        engine.destroy();
    });

    it('createMutation is pre-bound with emitOnSuccess through observer', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ id: 1 }, 201)
        );

        interface Events { 'users.created': { id: number } }

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
        const observer = new ObserverEngine<Events>();
        const handler = vi.fn();

        observer.on('users.created', handler);

        const { createMutation } = createApiHooks(engine, observer);

        const useCreateUser = createMutation<{ id: number }>('post', '/users', {
            emitOnSuccess: 'users.created',
        });

        const { result, unmount } = renderHook(() => useCreateUser());

        act(() => { result.current.mutate({}); });
        await flush();

        expect(handler).toHaveBeenCalledOnce();

        unmount();
        engine.destroy();
    });

    it('full integration: mutation emits, query invalidates', async () => {

        let callCount = 0;
        globalThis.fetch = vi.fn().mockImplementation((url: URL) => {

            if (url.pathname === '/users') {
                return Promise.resolve(jsonResponse({ count: ++callCount }));
            }
            return Promise.resolve(jsonResponse({ id: 1 }, 201));
        });

        interface Events { 'users.created': { id: number } }

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
        const observer = new ObserverEngine<Events>();

        const { useQuery, useMutation } = createApiHooks(engine, observer);

        const { result, unmount } = renderHook(() => ({
            query: useQuery<{ count: number }>('/users', {
                invalidateOn: ['users.created'],
            }),
            mutation: useMutation<{ id: number }>('post', '/users', {
                emitOnSuccess: 'users.created',
            }),
        }));

        await flush();
        expect(result.current.query.data).to.deep.equal({ count: 1 });

        act(() => { result.current.mutation.mutate({ name: 'Alice' }); });
        await flush();
        await flush();

        expect(result.current.query.data).to.deep.equal({ count: 2 });

        unmount();
        engine.destroy();
    });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/alonso/projects/logos-dx/monorepo && pnpm test api/create-api-hooks`
Expected: FAIL — `create-api-hooks.ts` does not exist yet

**Step 3: Write the implementation**

Create `packages/react/src/api/create-api-hooks.ts`:

```ts
import type { DependencyList } from 'react';
import type { FetchEngine } from '@logosdx/fetch';
import type { ObserverEngine } from '@logosdx/observer';
import type {
    QueryResult,
    MutationResult,
    QueryOptions,
    MutationOptions,
    AsyncOptions,
} from './types.ts';

import { useQuery as useQueryBase } from './use-query.ts';
import { useMutation as useMutationBase } from './use-mutation.ts';
import { useAsync as useAsyncBase } from './use-async.ts';
import { createQuery as createQueryBase } from './create-query.ts';
import { createMutation as createMutationBase } from './create-mutation.ts';

/**
 * Creates a set of API hooks pre-bound to a FetchEngine and optional ObserverEngine.
 * Returns `{ useQuery, useMutation, useAsync, createQuery, createMutation }` with
 * the engine and observer already wired in.
 *
 *     const api = new FetchEngine({ baseUrl: '/api' });
 *     const events = new ObserverEngine<AppEvents>();
 *     const { useQuery, useMutation, createQuery } = createApiHooks(api, events);
 *
 *     // In components — no need to pass engine/observer:
 *     const { data } = useQuery<User[]>('/users');
 *     const { mutate } = useMutation<User>('post', '/users');
 *
 * @param engine - FetchEngine instance
 * @param observer - Optional ObserverEngine for invalidation and event emission
 */
export function createApiHooks<
    H = FetchEngine.InstanceHeaders,
    P = FetchEngine.InstanceParams,
    S = FetchEngine.InstanceState,
    RH = FetchEngine.InstanceResponseHeaders,
    E extends Record<string, any> = Record<string, any>,
>(
    engine: FetchEngine<H, P, S, RH>,
    observer?: ObserverEngine<E>,
) {

    function useQuery<T = unknown>(
        path: string,
        options?: QueryOptions<H, P, E>,
    ): QueryResult<T> {

        return useQueryBase<T, H, P, E>(engine, path, options, observer);
    }

    function useMutation<T = unknown>(
        method: 'post' | 'put' | 'delete' | 'patch',
        path: string,
        options?: MutationOptions<H, P, E>,
    ): MutationResult<T> {

        return useMutationBase<T, H, P, E>(engine, method, path, options, observer);
    }

    function useAsync<T = unknown>(
        fn: () => Promise<any>,
        deps: DependencyList,
        options?: AsyncOptions<E>,
    ): QueryResult<T> {

        return useAsyncBase<T, E>(fn, deps, options, observer);
    }

    function createQuery<T = unknown>(
        path: string,
        defaults?: QueryOptions<H, P, E>,
    ) {

        return createQueryBase<T, H, P, E>(engine, path, defaults, observer);
    }

    function createMutation<T = unknown>(
        method: 'post' | 'put' | 'delete' | 'patch',
        path: string,
        defaults?: MutationOptions<H, P, E>,
    ) {

        return createMutationBase<T, H, P, E>(engine, method, path, defaults, observer);
    }

    return { useQuery, useMutation, useAsync, createQuery, createMutation };
}
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/alonso/projects/logos-dx/monorepo && pnpm test api/create-api-hooks`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add packages/react/src/api/create-api-hooks.ts tests/src/react/api/create-api-hooks.test.ts
git commit -m "feat(react): add createApiHooks context binding"
```

---


### Task 8: Barrel Exports & Package Configuration

**Files:**
- Create: `packages/react/src/api/index.ts`
- Modify: `packages/react/src/index.ts`
- Modify: `packages/react/package.json`

**Step 1: Create the barrel export**

Create `packages/react/src/api/index.ts`:

```ts
export { useQuery } from './use-query.ts';
export { useMutation } from './use-mutation.ts';
export { useAsync } from './use-async.ts';
export { createQuery } from './create-query.ts';
export { createMutation } from './create-mutation.ts';
export { createApiHooks } from './create-api-hooks.ts';

export type {
    QueryResult,
    MutationResult,
    QueryOptions,
    MutationOptions,
    AsyncOptions,
    EmitConfig,
    EmitEntry,
} from './types.ts';
```

**Step 2: Add re-export to main index.ts**

Add to `packages/react/src/index.ts`:

```ts
export {
    useQuery,
    useMutation,
    useAsync,
    createQuery,
    createMutation,
    createApiHooks,
} from './api/index.ts';
```

Also re-export the types:

```ts
export type {
    QueryResult,
    MutationResult,
    QueryOptions,
    MutationOptions,
    AsyncOptions,
    EmitConfig,
    EmitEntry,
} from './api/index.ts';
```

**Step 3: Add subpath export to package.json**

Add to the `"exports"` field in `packages/react/package.json`:

```json
"./api": {
    "types": "./dist/types/api/index.d.ts",
    "require": "./dist/cjs/api/index.js",
    "import": "./dist/esm/api/index.mjs"
}
```

**Step 4: Verify build works**

Run: `cd /Users/alonso/projects/logos-dx/monorepo/packages/react && pnpm build`
Expected: Build succeeds, `dist/esm/api/index.mjs`, `dist/cjs/api/index.js`, `dist/types/api/index.d.ts` all exist.

**Step 5: Run full test suite**

Run: `cd /Users/alonso/projects/logos-dx/monorepo && pnpm test react`
Expected: All tests PASS (both existing and new)

**Step 6: Commit**

```bash
git add packages/react/src/api/index.ts packages/react/src/index.ts packages/react/package.json
git commit -m "feat(react): add @logosdx/react/api subpath export"
```

---


### Task 9: Update Skill Reference & Documentation

**Files:**
- Modify: `skill/references/react.md` (canonical reference)

**Step 1: Add API hooks section to react.md**

Add a new section after the existing "State Machine Hook" section, before "Subpath Imports":

```markdown
## API Hooks (Apollo-Style)

Higher-level hooks for API interactions. Return `{ data, loading, error }` objects (not tuples). Auto-refetch on reactive config changes. ObserverEngine integration for event-driven invalidation.

### Setup

\`\`\`typescript
import { FetchEngine } from '@logosdx/fetch'
import { ObserverEngine } from '@logosdx/observer'
import { createApiHooks } from '@logosdx/react/api'

interface AppEvents {
    'users.created': { id: string; name: string }
    'users.deleted': { id: string }
}

const api = new FetchEngine({ baseUrl: '/api' })
const events = new ObserverEngine<AppEvents>()

const { useQuery, useMutation, useAsync, createQuery, createMutation } = createApiHooks(api, events)
\`\`\`

### useQuery — Auto-Fetch with Reactive Config

\`\`\`typescript
const { data, loading, error, refetch, cancel } = useQuery<User[]>('/users', {
    defaults: { headers: { 'X-Api-Version': '2' } },    // Fixed — no re-fetch
    reactive: { params: { page, limit: 20 } },           // Watched — changes trigger re-fetch
    skip: !isReady,                                       // Conditional execution
    pollInterval: 30000,                                  // Re-fetch every 30s
    invalidateOn: ['users.created', 'users.deleted'],     // Re-fetch on observer event
})
\`\`\`

### useMutation — Fire on Demand

\`\`\`typescript
const { mutate, loading, error, data, called, reset, cancel } = useMutation<User>('post', '/users', {
    defaults: { headers: { 'Content-Type': 'application/json' } },
    emitOnSuccess: 'users.created',                       // Emit observer event on success
})

// mutate() returns Promise<T> — await in handlers
const user = await mutate({ name: 'Alice' })

// emitOnSuccess supports: string | { event, payload? } | array of either
emitOnSuccess: [
    'users.created',
    { event: 'audit.log', payload: (data) => ({ action: 'create', entity: data }) },
]
\`\`\`

### useAsync — Wrap Any Async Function

\`\`\`typescript
class MyApi extends FetchEngine {
    getUsers(page: number) { return this.get<User[]>('/users', { params: { page } }) }
}

const { data, loading, error } = useAsync<User[]>(
    () => myApi.getUsers(page),
    [page],                                                // React deps — re-executes on change
    { invalidateOn: ['users.created'] },
)
// Auto-unwraps FetchResponse — data is User[], not FetchResponse<User[]>
\`\`\`

### Factory Functions — Reusable Hooks

\`\`\`typescript
// Define once at module level
const useUsers = createQuery<User[]>('/users', {
    invalidateOn: ['users.created', 'users.deleted'],
})
const useCreateUser = createMutation<User>('post', '/users', {
    emitOnSuccess: 'users.created',
})

// Use in any component
const { data } = useUsers({ reactive: { params: { page: 1 } } })
const { mutate } = useCreateUser()
\`\`\`
```

**Step 2: Update the "Subpath Imports" section**

Add the new `./api` import:

```typescript
import { createApiHooks, useQuery, useMutation, useAsync } from '@logosdx/react/api'
```

**Step 3: Commit**

```bash
git add skill/references/react.md
git commit -m "docs(skill): add API hooks reference to react.md"
```

---


### Task 10: Final Verification

**Step 1: Run the full test suite**

Run: `cd /Users/alonso/projects/logos-dx/monorepo && pnpm test`
Expected: All tests PASS across the entire monorepo

**Step 2: Run type checking**

Run: `cd /Users/alonso/projects/logos-dx/monorepo/packages/react && pnpm lint`
Expected: No TypeScript errors

**Step 3: Run build**

Run: `cd /Users/alonso/projects/logos-dx/monorepo && pnpm build`
Expected: All packages build successfully

**Step 4: Verify the new exports exist in dist**

Run: `ls packages/react/dist/esm/api/ && ls packages/react/dist/cjs/api/ && ls packages/react/dist/types/api/`
Expected: `index.mjs`, `index.js`, `index.d.ts` (plus individual hook files) exist in each directory
