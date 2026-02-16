# FetchEngine TypeScript Patterns

## Module Augmentation

Extend the global FetchEngine type interfaces for project-wide type safety:

```typescript
declare module '@logosdx/fetch' {

    namespace FetchEngine {

        interface InstanceHeaders {
            Authorization?: string
            'Content-Type'?: string
            'X-API-Key'?: string
        }

        interface InstanceParams {
            version?: string
            format?: 'json' | 'xml'
        }

        interface InstanceResponseHeaders extends Record<string, string> {
            'x-rate-limit-remaining'?: string
            'x-rate-limit-reset'?: string
            'x-request-id'?: string
        }

        interface InstanceState {
            authToken?: string
            userId?: string
            sessionId?: string
        }
    }
}
```

After augmentation, both custom instances and the global instance use these types:

```typescript
// Global instance — types flow automatically
import { state, get } from '@logosdx/fetch'

state.set('authToken', 'token-123')      // typed
const [res] = await attempt(() => get<User>('/me'))
res.headers['x-rate-limit-remaining']     // typed
res.config.headers.Authorization          // typed

// Custom instance — types flow from constructor
const api = new FetchEngine({
    baseUrl: '/api',
    validate: {
        headers: (headers) => {
            if (!headers.Authorization) throw new Error('Auth required')
        },
    },
})
```

## Typed Responses

### Per-Request Type Parameters

```typescript
// Type the response body
const [res] = await attempt(() => api.get<User[]>('/users'))
res.data  // User[]

// Type response body AND response headers
interface CustomResponseHeaders {
    'x-total-count': string
    'x-page': string
}

const [res] = await attempt(() => api.get<User[], CustomResponseHeaders>('/users'))
res.data                            // User[]
res.headers['x-total-count']        // string (typed)
```

### Response Shape

```typescript
interface FetchResponse<T, H, P, RH> {
    data: T                  // Parsed body — typed via generic
    headers: Partial<RH>     // Response headers — from augmentation or per-request
    status: number           // HTTP status code
    request: Request         // Original Request object
    config: FetchConfig<H, P>  // Config used — typed headers and params
}
```

## Typed State with modifyConfig

```typescript
// State flows through modifyConfig
const api = new FetchEngine({
    baseUrl: '/api',
    modifyConfig: (opts, state) => {

        // state is typed as FetchEngine.InstanceState
        if (state.authToken) {

            opts.headers.Authorization = `Bearer ${state.authToken}`
        }
        return opts
    },
})

api.state.set('authToken', 'token-123')  // autocompletes
api.state.set('userId', '42')            // autocompletes
```

## Typed Validation

```typescript
const api = new FetchEngine({
    baseUrl: '/api',
    validate: {
        headers: (headers, method?) => {

            // headers typed as FetchEngine.InstanceHeaders
            if (!headers.Authorization && method !== 'OPTIONS') {

                throw new Error('Authorization required')
            }
        },
        state: (state) => {

            // state typed as FetchEngine.InstanceState
            if (state.userId && !state.sessionId) {

                throw new Error('Session required with user')
            }
        },
    },
})
```

## Custom Instance Generics

For cases where module augmentation isn't desired (e.g., multiple APIs with different types):

```typescript
interface ApiHeaders {
    Authorization: string
    'X-Team-Id': string
}

interface ApiParams {
    include?: string
}

interface ApiState {
    token: string
}

interface ApiResponseHeaders {
    'x-ratelimit': string
}

const api = new FetchEngine<ApiHeaders, ApiParams, ApiState, ApiResponseHeaders>({
    baseUrl: 'https://team-api.example.com',
})

api.headers.set('Authorization', 'Bearer ...')  // typed
api.headers.set('X-Team-Id', 'team-42')         // typed
api.state.set('token', 'abc')                   // typed

const [res] = await attempt(() => api.get<Project[]>('/projects'))
res.headers['x-ratelimit']                      // typed
res.config.headers['X-Team-Id']                 // typed
```

## FetchError Type Narrowing

```typescript
const [response, err] = await attempt(() => api.get('/users'))

if (err) {

    if (isFetchError(err)) {

        // Full typed access
        err.status      // number
        err.method      // HttpMethods
        err.path        // string
        err.data        // response body if available
        err.requestId   // string
        err.step        // 'fetch' | 'parse' | 'response'
        err.attempt     // number

        // Convenience methods
        err.isCancelled()      // user/app aborted
        err.isTimeout()        // timeout fired
        err.isConnectionLost() // network/server dropped
    }
}
```

## Global Instance Imports

```typescript
// The global instance exports destructured managers
import fetch, { get, post, headers, params, state, config, on, off } from '@logosdx/fetch'

// These are bound to the global FetchEngine instance
headers.set('Authorization', 'Bearer token')
state.set('authToken', 'token-123')
const [res] = await attempt(() => get<User[]>('/users'))
```
