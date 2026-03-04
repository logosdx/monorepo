# Apollo-Style API Hooks for @logosdx/react


## Summary

A new higher-level hook layer (`@logosdx/react/api`) that provides Apollo-style `useQuery` / `useMutation` / `useAsync` hooks on top of FetchEngine. Separate from the existing `createFetchContext` hooks, which remain unchanged.

Returns `{ data, loading, error, ... }` objects instead of tuples, strips HTTP transport details (no `response.headers`, `response.status`), and integrates with ObserverEngine for event-driven query invalidation.


## Goals

- Auto-refetch queries when reactive config changes (params, payload)
- Polling support via `pollInterval`
- Event-driven query invalidation via ObserverEngine (`invalidateOn` / `emitOnSuccess`)
- Typed observer events with autocomplete
- Three tiers: inline hooks, factory functions, context binding
- Generic `useAsync` wrapper for custom API classes


## Non-Goals

- Replacing existing `createFetchContext` hooks (those stay as-is)
- Client-side cache management (FetchEngine already handles caching)
- Optimistic updates (can be added later if needed)
- StateMachine integration (plain React state is sufficient)
- StorageAdapter integration (FetchEngine cache handles persistence if configured)


## Architecture

### New Export Path

    @logosdx/react/api

Peer dependencies: `@logosdx/fetch`, optionally `@logosdx/observer`.


### Three Tiers

```
Tier 3: createApiHooks(engine, observer?)
    │   Returns pre-bound versions of everything below
    │
    ├── Tier 2: createQuery / createMutation
    │   Factory functions that return reusable hooks
    │
    └── Tier 1: useQuery / useMutation / useAsync
        Inline hooks — the base layer
```


## Core Types

### Return Shapes

```ts
interface QueryResult<T> {
    data: T | null;
    loading: boolean;
    error: FetchError | null;
    refetch: (overrides?: CallConfig<H, P>) => void;
    cancel: () => void;
}

interface MutationResult<T> {
    data: T | null;
    loading: boolean;
    error: FetchError | null;
    mutate: <Payload>(payload?: Payload, overrides?: CallConfig<H, P>) => Promise<T>;
    reset: () => void;
    cancel: () => void;
    called: boolean;
}
```


### Option Types

```ts
interface QueryOptions<H, P, E> {
    defaults?: CallConfig<H, P>;      // Fixed config (headers, timeout) — no re-fetch
    reactive?: CallConfig<H, P>;      // Watched config (params, etc.) — changes trigger re-fetch
    skip?: boolean;                   // Don't auto-execute
    pollInterval?: number;            // Re-fetch every N ms
    invalidateOn?: (keyof E)[];       // Observer events that trigger re-fetch
}

interface MutationOptions<H, P, E> {
    defaults?: CallConfig<H, P>;      // Fixed config
    emitOnSuccess?: EmitConfig<E>;    // Observer events to emit on success
}

type EmitConfig<E> =
    | keyof E
    | { event: keyof E; payload?: (data: any) => any }
    | (keyof E | { event: keyof E; payload?: (data: any) => any })[];
```


## Hook APIs

### Tier 1: Inline Hooks

```ts
function useQuery<T, H, P, E>(
    engine: FetchEngine<H, P, any, any>,
    path: string,
    options?: QueryOptions<H, P, E>,
    observer?: ObserverEngine<E>
): QueryResult<T>;

function useMutation<T, H, P, E>(
    engine: FetchEngine<H, P, any, any>,
    method: 'post' | 'put' | 'delete' | 'patch',
    path: string,
    options?: MutationOptions<H, P, E>,
    observer?: ObserverEngine<E>
): MutationResult<T>;

function useAsync<T>(
    fn: (...args: any[]) => Promise<T>,
    deps: DependencyList,
    options?: {
        skip?: boolean;
        pollInterval?: number;
        invalidateOn?: string[];
        observer?: ObserverEngine;
    }
): QueryResult<T>;
```


### Tier 2: Factory Functions

```ts
function createQuery<T, H, P, E>(
    engine: FetchEngine<H, P, any, any>,
    path: string,
    defaults?: QueryOptions<H, P, E>,
    observer?: ObserverEngine<E>
): (overrides?: Partial<QueryOptions<H, P, E>>) => QueryResult<T>;

function createMutation<T, H, P, E>(
    engine: FetchEngine<H, P, any, any>,
    method: 'post' | 'put' | 'delete' | 'patch',
    path: string,
    defaults?: MutationOptions<H, P, E>,
    observer?: ObserverEngine<E>
): (overrides?: Partial<MutationOptions<H, P, E>>) => MutationResult<T>;
```


### Tier 3: Context Binding

```ts
function createApiHooks<H, P, S, RH, E>(
    engine: FetchEngine<H, P, S, RH>,
    observer?: ObserverEngine<E>
): {
    useQuery: <T>(path: string, options?: QueryOptions<H, P, E>) => QueryResult<T>;
    useMutation: <T>(
        method: 'post' | 'put' | 'delete' | 'patch',
        path: string,
        options?: MutationOptions<H, P, E>
    ) => MutationResult<T>;
    useAsync: <T>(
        fn: (...args: any[]) => Promise<T>,
        deps: DependencyList,
        options?: { skip?: boolean; pollInterval?: number; invalidateOn?: (keyof E)[] }
    ) => QueryResult<T>;
    createQuery: <T>(
        path: string,
        defaults?: QueryOptions<H, P, E>
    ) => (overrides?: Partial<QueryOptions<H, P, E>>) => QueryResult<T>;
    createMutation: <T>(
        method: 'post' | 'put' | 'delete' | 'patch',
        path: string,
        defaults?: MutationOptions<H, P, E>
    ) => (overrides?: Partial<MutationOptions<H, P, E>>) => MutationResult<T>;
};
```


## Usage Examples

### Setup

```ts
import { FetchEngine } from '@logosdx/fetch';
import { ObserverEngine } from '@logosdx/observer';
import { createApiHooks } from '@logosdx/react/api';

interface AppEvents {
    'users.created': { id: string; name: string };
    'users.updated': { id: string };
    'users.deleted': { id: string };
    'dashboard.refresh': void;
}

const api = new FetchEngine({ baseUrl: '/api' });
const events = new ObserverEngine<AppEvents>();

const {
    useQuery,
    useMutation,
    useAsync,
    createQuery,
    createMutation,
} = createApiHooks(api, events);
```


### Query with Auto-Refetch

```ts
function UserList() {

    const [page, setPage] = useState(1);

    const { data, loading, error, refetch } = useQuery<User[]>('/users', {
        defaults: {
            headers: { 'X-Api-Version': '2' },
            timeout: 5000,
        },
        reactive: {
            params: { page, limit: 20 },
        },
        invalidateOn: ['users.created', 'users.deleted'],
    });

    if (loading) return <Spinner />;
    if (error) return <Error msg={error.message} />;

    return (
        <div>
            <ul>{data.map(u => <li key={u.id}>{u.name}</li>)}</ul>
            <Pagination page={page} onChange={setPage} />
            <button onClick={() => refetch()}>Refresh</button>
        </div>
    );
}
```


### Mutation with Event Emission

```ts
function CreateUser() {

    const { mutate, loading, error, called, data } = useMutation<User>('post', '/users', {
        defaults: {
            headers: { 'Content-Type': 'application/json' },
        },
        emitOnSuccess: 'users.created',
    });

    return (
        <form onSubmit={async (e) => {
            e.preventDefault();
            const user = await mutate({ name: 'Alice', email: 'alice@example.com' });
            navigate(`/users/${user.id}`);
        }}>
            <button disabled={loading}>{loading ? 'Creating...' : 'Create'}</button>
            {error && <p>Failed: {error.message}</p>}
        </form>
    );
}
```


### Multiple Events on Mutation

```ts
const { mutate } = useMutation<User>('post', '/users', {
    emitOnSuccess: [
        'users.created',
        { event: 'dashboard.refresh' },
        { event: 'audit.log', payload: (data) => ({ action: 'create', entity: data }) },
    ],
});
```


### Factory-Created Reusable Hooks

```ts
// Define once at module level
const useUsers = createQuery<User[]>('/users', {
    defaults: { timeout: 5000 },
    invalidateOn: ['users.created', 'users.deleted'],
});

const useCreateUser = createMutation<User>('post', '/users', {
    emitOnSuccess: 'users.created',
});

// Use in any component
function Dashboard() {

    const { data, loading } = useUsers({
        reactive: { params: { page: 1 } },
    });

    const { mutate } = useCreateUser();
}
```


### Custom API Class with useAsync

```ts
class MyApi extends FetchEngine {
    getUsers(page: number) {
        return this.get<User[]>(`/users`, { params: { page } });
    }

    getUserById(id: string) {
        return this.get<User>(`/users/${id}`);
    }
}

const myApi = new MyApi({ baseUrl: '/api' });

function UserPage({ userId }: { userId: string }) {

    const { data, loading, error } = useAsync(
        () => myApi.getUserById(userId),
        [userId],
        { invalidateOn: ['users.updated'] },
    );

    if (loading) return <Spinner />;
    if (error) return <Error msg={error.message} />;
    return <UserProfile user={data} />;
}
```


### Polling

```ts
const { data } = useQuery<Metrics>('/metrics', {
    pollInterval: 30000,  // Refresh every 30 seconds
});
```


### Skip (Conditional Execution)

```ts
function UserDetail({ userId }: { userId: string | null }) {

    const { data, loading } = useQuery<User>(`/users/${userId}`, {
        skip: !userId,  // Don't fetch until userId is available
    });
}
```


## Observer Invalidation Flow

```
┌─────────────┐     mutate()      ┌──────────┐
│ CreateUser   │ ──────────────── │ POST     │
│ component    │                   │ /users   │
└─────────────┘                   └────┬─────┘
                                       │ success
                                       ▼
                              observer.emit('users.created', data)
                                       │
                          ┌────────────┼────────────┐
                          ▼            ▼            ▼
                    ┌──────────┐ ┌──────────┐ ┌──────────┐
                    │ UserList │ │ Dashboard│ │ Any      │
                    │ refetch  │ │ refetch  │ │ listener │
                    └──────────┘ └──────────┘ └──────────┘
```

Queries with `invalidateOn: ['users.created']` automatically re-fetch when that event fires. No explicit `refetchQueries` lists needed — fully decoupled via events.


## Implementation Notes

### Internal Behavior

- **useQuery**: Uses `useEffect` keyed on `JSON.stringify(reactive)`. When reactive config changes, aborts the previous request, starts a new one.
- **useMutation**: Idle until `mutate()` called. `mutate()` returns a Promise that resolves with the parsed `data` (not the full FetchResponse). On success, emits configured events.
- **useAsync**: Uses `useEffect` keyed on the React `deps` array. Same loading/error/data pattern.
- **Polling**: `setInterval` inside `useEffect`, cleared on unmount or when `pollInterval` changes.
- **Observer subscription**: `useEffect` subscribes to `invalidateOn` events, triggers refetch. Cleans up on unmount.
- **Error handling**: Uses `attempt()` internally. FetchError is exposed directly (preserves `.isCancelled()`, `.isTimeout()`, etc.).
- **Abort on unmount**: All in-flight requests are aborted when the component unmounts.


### What `data` Contains

The `data` field is `response.data` from FetchEngine's `FetchResponse<T>` — just the parsed response body. Users who need full response access (headers, status, config) should use the existing `createFetchContext` hooks or the `instance` escape hatch.


### File Structure

```
packages/react/src/
├── api/
│   ├── index.ts           # Barrel exports
│   ├── types.ts           # QueryResult, MutationResult, options
│   ├── use-query.ts       # useQuery hook
│   ├── use-mutation.ts    # useMutation hook
│   ├── use-async.ts       # useAsync hook
│   ├── create-query.ts    # createQuery factory
│   ├── create-mutation.ts # createMutation factory
│   └── create-api-hooks.ts# createApiHooks binding
├── fetch.ts               # Existing (unchanged)
├── observer.ts            # Existing (unchanged)
└── ...
```

New subpath export in `package.json`:

```json
{
    "./api": {
        "import": "./dist/api/index.mjs",
        "require": "./dist/api/index.js",
        "types": "./dist/api/index.d.ts"
    }
}
```
