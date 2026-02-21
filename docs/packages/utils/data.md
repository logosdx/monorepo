---
title: Data Operations
description: Deep clone, equality, merge, path access, nested config, and type coercion utilities.
---

# Data Operations

## `clone()`

Deep clone any JavaScript value, including modern types like Maps, Sets, and WeakRefs.

```ts
function clone<T>(value: T): T
```

**Example:**

```ts
import { clone } from '@logosdx/utils'

// Complex state with modern JS types
const appState = {
    users: new Map([
        ['user1', {
            name: 'Alice',
            permissions: new Set(['read', 'write', 'admin']),
            lastLogin: new Date(),
            metadata: new WeakRef(heavyObject)
        }]
    ]),
    config: {
        features: new Map([['darkMode', true]]),
        cache: new WeakMap([[key, value]]),
        history: [
            { timestamp: new Date(), action: 'login' }
        ]
    }
}

// Perfect deep clone that preserves all types
const clonedState = clone(appState)
// Maps are Maps, Sets are Sets, Dates are Dates, WeakRefs are WeakRefs

// Safe state updates
const updateUserPermissions = (state: AppState, userId: string, newPermissions: string[]) => {

    const newState = clone(state)
    const user = newState.users.get(userId)

    if (user) {

        user.permissions = new Set(newPermissions)
        user.lastModified = new Date()
    }

    return newState
}
```

---

## `equals()`

Deep equality comparison that handles all JavaScript types correctly.

```ts
function equals(a: unknown, b: unknown): boolean
```

**Example:**

```ts
import { equals } from '@logosdx/utils'

// Compare complex objects
const state1 = {
    users: new Map([['u1', { name: 'Alice', roles: new Set(['admin']) }]]),
    lastSync: new Date('2023-01-01')
}

const state2 = {
    users: new Map([['u1', { name: 'Alice', roles: new Set(['admin']) }]]),
    lastSync: new Date('2023-01-01')
}

console.log(equals(state1, state2)) // true

// Use in React components to prevent unnecessary re-renders
const MyComponent = ({ data }) => {

    const [prevData, setPrevData] = useState(data)

    useEffect(() => {

        if (!equals(prevData, data)) {

            // Data actually changed, update UI
            setPrevData(data)
            updateExpensiveVisualization(data)
        }
    }, [data, prevData])

    // Component only re-renders when data actually changes
}

// Use for offer comparison
const compareOffers = (offer1: Offer, offer2: Offer) => {

    if (equals(offer1.terms, offer2.terms)) {

        return 'These offers have identical terms'
    }

    return 'These offers have different terms'
}
```

---

## `merge()`

Deep merge objects while preserving types and handling edge cases.

```ts
function merge<T, U>(target: T, source: U, options?: MergeOptions): T & U

interface MergeOptions {
    mergeArrays?: boolean;
    mergeSets?: boolean;
}
```

**Example:**

```ts
import { merge } from '@logosdx/utils'

// Basic merging
const defaultConfig = {
    api: { timeout: 5000, retries: 3 },
    features: { darkMode: false, beta: false }
}

const userConfig = {
    api: { timeout: 10000 },
    features: { darkMode: true }
}

const finalConfig = merge(defaultConfig, userConfig)
// Result: {
//   api: { timeout: 10000, retries: 3 },
//   features: { darkMode: true, beta: false }
// }

// Advanced merging with modern types
const currentState = {
    users: new Map([['u1', { name: 'Alice' }]]),
    permissions: new Set(['read']),
    history: [{ action: 'login' }]
}

const updates = {
    users: new Map([['u2', { name: 'Bob' }]]),
    permissions: new Set(['write']),
    history: [{ action: 'logout' }]
}

const newState = merge(currentState, updates, {
    mergeArrays: true,
    mergeSets: true
})

// Customer profile merging
const mergeCustomerProfiles = (existing: CustomerProfile, updates: Partial<CustomerProfile>) => {

    return merge(existing, updates, {
        mergeArrays: false,
        mergeSets: false
    })
}
```

---

## `reach()`

Type-safe property access with dot notation paths.

```ts
function reach<T, P extends PathNames<T>>(obj: T, path: P): PathValue<T, P> | undefined

// Type utilities for path navigation
type PathNames<T> = // All possible dot-notation paths in T
type PathValue<T, P extends string> = // Type at specific path
```

**Example:**

```ts
import { reach } from '@logosdx/utils'

// Complex nested data
interface CustomerData {
    profile: {
        personal: {
            name: string
            email: string
        }
        preferences: {
            theme: 'light' | 'dark' | 'auto'
            loanTypes: string[]
        }
    }
    loanHistory: {
        totalLoans: number
        averageAmount: number
    }
    metadata: Map<string, any>
}

const customer: CustomerData = {
    profile: {
        personal: { name: 'Alice', email: 'alice@example.com' },
        preferences: { theme: 'dark', subscriptions: ['personal', 'auto'] }
    },
    loanHistory: { totalLoans: 3, averageAmount: 15000 },
    metadata: new Map([['vip', true]])
}

// Type-safe property access
const name = reach(customer, 'profile.personal.name')           // string | undefined
const email = reach(customer, 'profile.personal.email')        // string | undefined
const theme = reach(customer, 'profile.preferences.theme') // 'light' | 'dark' | 'auto' | undefined
const totalLoans = reach(customer, 'loanHistory.totalLoans')   // number | undefined

// Safe access with fallbacks
const displayName = reach(customer, 'profile.personal.name') ?? 'Anonymous Customer'
const preferredTheme = reach(customer, 'profile.preferences.theme') ?? 'light'
const loanCount = reach(customer, 'loanHistory.totalLoans') ?? 0

// Build type-safe form systems
const createFormField = <T, P extends PathNames<T>>(
    data: T,
    path: P,
    label: string
) => {

    const value = reach(data, path)
    const type = typeof value

    return {
        path,
        label,
        value,
        type,
        required: value === undefined
    }
}

const nameField = createFormField(customer, 'profile.personal.name', 'Full Name')
const emailField = createFormField(customer, 'profile.personal.email', 'Email Address')
```

## `setDeep()`

Set values deep within nested objects using dot notation paths. Creates intermediate objects automatically.

```ts
function setDeep<T, P extends PathNames<T>>(
    obj: T,
    path: P,
    value: PathValue<T, P>
): void
```

**Parameters:**

- `obj` - Object to modify (mutated in place)
- `path` - Dot-separated path to target property
- `value` - Value to set at the path

**Example:**

```ts
import { setDeep } from '@logosdx/utils'

// Building configuration incrementally
const config: any = {}

setDeep(config, 'server.port', 3000)
setDeep(config, 'server.host', 'localhost')
setDeep(config, 'database.connection.timeout', 5000)

console.log(config)
// { server: { port: 3000, host: 'localhost' }, database: { connection: { timeout: 5000 } } }

// Setting metrics in monitoring
const metrics: any = { memory: { heap: 100 } }

setDeep(metrics, 'memory.rss', 1024)
setDeep(metrics, 'cpu.user', 50)

console.log(metrics)
// { memory: { heap: 100, rss: 1024 }, cpu: { user: 50 } }

// API response building
function buildSuccessResponse(data: any) {

    const response: any = {}

    setDeep(response, 'status.code', 200)
    setDeep(response, 'status.message', 'OK')
    setDeep(response, 'data.results', data)
    setDeep(response, 'data.timestamp', Date.now())

    return response
}
```

## `setDeepMany()`

Set multiple values deep within nested objects using dot notation paths. Fails fast on first error with helpful error messages including entry index.

```ts
function setDeepMany<T>(
    obj: T,
    entries: Array<[PathNames<T>, any]>
): void
```

**Parameters:**

- `obj` - Object to modify (mutated in place)
- `entries` - Array of `[path, value]` tuples to set

**Example:**

```ts
import { setDeepMany } from '@logosdx/utils'

// Building complete response objects
const response: any = {}

setDeepMany(response, [
    ['status.code', 200],
    ['status.message', 'OK'],
    ['data.results', [1, 2, 3]],
    ['data.total', 3],
    ['meta.timestamp', Date.now()],
    ['meta.version', '1.0.0']
])

// Complex configuration
const appConfig: any = {}

setDeepMany(appConfig, [
    ['server.port', 3000],
    ['server.host', 'localhost'],
    ['database.url', 'postgres://localhost'],
    ['database.pool.min', 2],
    ['database.pool.max', 10],
    ['features.auth.enabled', true],
    ['features.logging.level', 'info'],
    ['features.monitoring.metrics', true]
])
```

**Error Messages:**

Validation errors include entry index for quick debugging:

```ts
// Invalid tuple format
setDeepMany(obj, [
    ['valid', 'works'],
    ['invalid']  // entry 1 must be a [path, value] tuple
])

// Empty path
setDeepMany(obj, [
    ['valid', 'works'],
    ['', 'oops']  // entry 1 must have a non-empty string path (received: string)
])
```

---

## `makeNestedConfig()`

Transform flat environment variables into nested configuration objects with automatic type coercion. Essential for 12-factor apps and containerized deployments.

```ts
function makeNestedConfig<C extends object, F extends Record<string, string>>(
    flatConfig: F,
    opts?: {
        filter?: (key: string, val: string) => boolean
        forceAllCapToLower?: boolean  // Default: true
        separator?: string            // Default: "_"
        stripPrefix?: string | number
        parseUnits?: boolean          // Default: false
        skipConversion?: (key: string, value: unknown) => boolean
        memoizeOpts?: MemoizeOptions | false
    }
): <P extends PathLeaves<C>>(path?: P, defaultValue?: PathValue<C, P>) => C
```

**Example:**

```ts
import { makeNestedConfig } from '@logosdx/utils'

// Define expected config shape for type safety
type AppConfig = {
    db: { host: string; port: number };
    debug: boolean;
    feature: { x: { enabled: boolean } };
    worker: { emails: { maxRunsPerMin: number } };
}

const config = makeNestedConfig<AppConfig>(process.env, {
    filter: (key) => key.startsWith('APP_'),
    stripPrefix: 'APP_',
    forceAllCapToLower: true
})

console.log(config())
// {
//   db: { host: 'localhost', port: 5432 },
//   debug: true,
//   feature: { x: { enabled: false } },
//   worker: { emails: { maxRunsPerMin: 100 } }
// }

// Reach into config with type-safe path parameter
const dbHost = config('db.host')              // 'localhost'
const dbPort = config('db.port')              // 5432
const isDebug = config('debug')               // true
const maxRuns = config('worker.emails.maxRunsPerMin')  // 100

// Use default values for missing configuration
const apiTimeout = config('api.timeout', 5000)        // 5000 (default)
const maxRetries = config('api.retries', 3)           // 3 (default)
const logLevel = config('logging.level', 'info')      // 'info' (default)

// Parse unit values (time durations and byte sizes)
// Given: APP_TIMEOUT='5m', APP_MAX_SIZE='10mb'
const configWithUnits = makeNestedConfig(process.env, {
    filter: (key) => key.startsWith('APP_'),
    stripPrefix: 'APP_',
    parseUnits: true
})
// { timeout: 300000, max: { size: 10485760 } }
```

---

## `castValuesToTypes()`

Intelligently coerce string values to their appropriate types. Recursively processes nested objects.

```ts
function castValuesToTypes(
    obj: object,
    opts?: {
        parseUnits?: boolean  // Default: false
        skipConversion?: (key: string, value: unknown) => boolean
    }
): void  // Mutates in place
```

**Example:**

```ts
import { castValuesToTypes } from '@logosdx/utils'

const config = {
    debug: 'true',        // -> true
    verbose: 'yes',       // -> true
    silent: 'false',      // -> false
    disabled: 'no',       // -> false
    port: '3000',         // -> 3000
    timeout: '5000',      // -> 5000
    name: 'myapp',        // -> 'myapp' (unchanged)
    nested: {
        enabled: 'true',  // -> true (recursive)
        retries: '5'      // -> 5 (recursive)
    }
}

castValuesToTypes(config)  // Mutates in place

console.log(config.debug)  // true (boolean)
console.log(config.port)   // 3000 (number)

// Parse unit values
const configWithUnits = {
    timeout: '5m',
    maxSize: '10mb',
    debug: 'true'
}

castValuesToTypes(configWithUnits, { parseUnits: true })
console.log(configWithUnits.timeout)  // 300000 (5 minutes in ms)
console.log(configWithUnits.maxSize)  // 10485760 (10 MB in bytes)

// Skip conversion for specific keys
const configWithSkip = {
    apiKey: '12345',
    port: '3000'
}

castValuesToTypes(configWithSkip, {
    skipConversion: (key) => key.toLowerCase().includes('key')
})
console.log(configWithSkip.apiKey)  // '12345' (kept as string)
console.log(configWithSkip.port)    // 3000 (converted to number)
```

**Recognized values:**
- **Enabled**: `"true"`, `"yes"`, `true`
- **Disabled**: `"false"`, `"no"`, `false`
- **Numbers**: Strings containing only digits (`/^\d+$/`)

---

## `isEnabledValue()` / `isDisabledValue()`

Check if a value represents an enabled or disabled state.

```ts
function isEnabledValue(val: unknown): boolean
function isDisabledValue(val: unknown): boolean
function hasEnabledOrDisabledValue(val: unknown): boolean
```

**Example:**

```ts
import { isEnabledValue, isDisabledValue } from '@logosdx/utils'

// Environment variable checking
if (isEnabledValue(process.env.DEBUG)) {
    enableDebugMode()
}

if (isDisabledValue(process.env.FEATURE_FLAG)) {
    skipFeature()
}

// Configuration validation
const config = {
    featureA: 'true',
    featureB: 'no',
    featureC: 'maybe'
}

Object.entries(config).forEach(([key, value]) => {
    if (isEnabledValue(value)) {
        console.log(`${key}: enabled`)
    } else if (isDisabledValue(value)) {
        console.log(`${key}: disabled`)
    } else {
        console.warn(`${key}: invalid value`)
    }
})
```

---

## Unit Conversion & Formatting

Human-readable time and byte size utilities for configuration, logging, and display.

### Time Units

```ts
// Constants
const timeUnits: {
    sec: number, min: number, hour: number, day: number, week: number
    secs(n: number): number, mins(n: number): number, hours(n: number): number
    days(n: number): number, weeks(n: number): number
}

// Convenience functions
const seconds: (n: number) => number
const minutes: (n: number) => number
const hours: (n: number) => number
const days: (n: number) => number
const weeks: (n: number) => number
const months: (n: number) => number
const years: (n: number) => number

// Parse human-readable strings to milliseconds
const parseTimeDuration: (str: string) => number

// Format milliseconds to human-readable strings
const formatTimeDuration: (ms: number, opts?: {
    decimals?: number
    unit?: 'sec' | 'min' | 'hour' | 'day' | 'week' | 'month' | 'year'
}) => string
```

**Example:**

```ts
import {
    seconds, minutes, hours,
    parseTimeDuration,
    formatTimeDuration
} from '@logosdx/utils'

// Programmatic duration calculation
setTimeout(cleanup, minutes(5))     // 5 minutes = 300000ms
setInterval(poll, seconds(30))      // 30 seconds = 30000ms
cache.set(key, value, { ttl: hours(1) })  // 1 hour

// Parse configuration from environment variables
const config = {
    sessionTimeout: parseTimeDuration(process.env.SESSION_TIMEOUT || '1hour'),
    cacheExpiry: parseTimeDuration(process.env.CACHE_TTL || '15min'),
    heartbeat: parseTimeDuration(process.env.HEARTBEAT || '30sec')
}

// Supports multiple formats
parseTimeDuration('30sec')       // 30000
parseTimeDuration('30 secs')     // 30000
parseTimeDuration('30 seconds')  // 30000
parseTimeDuration('5m')          // 300000
parseTimeDuration('5min')        // 300000
parseTimeDuration('2.5 hours')   // 9000000 (decimals supported)

// Format for display (auto-selects unit)
formatTimeDuration(1000)          // "1sec"
formatTimeDuration(90000)         // "1.5min" (smart decimals)
formatTimeDuration(3600000)       // "1hour"

// Control formatting
formatTimeDuration(90000, { unit: 'sec' })      // "90sec"
formatTimeDuration(90000, { decimals: 0 })      // "2min"

// Logging with readable durations
logger.info(`Cache expires in: ${formatTimeDuration(cache.ttl)}`)
logger.debug(`Request took: ${formatTimeDuration(elapsed)}`)
```

### Byte Sizes

```ts
// Constants
const byteUnits: {
    kb: number, mb: number, gb: number, tb: number
    kbs(n: number): number, mbs(n: number): number
    gbs(n: number): number, tbs(n: number): number
}

// Convenience functions
const kilobytes: (n: number) => number
const megabytes: (n: number) => number
const gigabytes: (n: number) => number
const terabytes: (n: number) => number

// Parse human-readable strings to bytes
const parseByteSize: (str: string) => number

// Format bytes to human-readable strings
const formatByteSize: (bytes: number, opts?: {
    decimals?: number  // Default: 2
    unit?: 'kb' | 'mb' | 'gb' | 'tb'
}) => string
```

**Example:**

```ts
import {
    megabytes, kilobytes,
    parseByteSize,
    formatByteSize
} from '@logosdx/utils'

// Programmatic size calculation
const maxFileSize = megabytes(10)  // 10485760 bytes
const bufferSize = kilobytes(64)   // 65536 bytes

// Parse configuration
const config = {
    uploadLimit: parseByteSize(process.env.MAX_UPLOAD || '10mb'),
    diskQuota: parseByteSize(process.env.DISK_QUOTA || '100gb'),
    thumbnailMax: parseByteSize(process.env.THUMB_SIZE || '500kb')
}

// Supports multiple formats
parseByteSize('10kb')           // 10240
parseByteSize('10 kbs')         // 10240
parseByteSize('10 kilobytes')   // 10240
parseByteSize('2.5gb')          // 2684354560 (decimals supported)

// Format for display (auto-selects unit)
formatByteSize(1024)            // "1kb"
formatByteSize(1536)            // "1.5kb"
formatByteSize(10485760)        // "10mb"

// Control formatting
formatByteSize(1024, { unit: 'mb' })        // "0mb"
formatByteSize(1536, { decimals: 0 })       // "2kb"

// Display file sizes
files.forEach(file => {
    console.log(`${file.name}: ${formatByteSize(file.size)}`)
})
```

## Array Utilities

### `chunk()`

Split an array into smaller arrays of the specified size.

```ts
function chunk<T>(array: T[], size: number): T[][]
```

**Example:**

```ts
import { chunk } from '@logosdx/utils'

chunk([1, 2, 3, 4, 5, 6, 7], 3) // [[1, 2, 3], [4, 5, 6], [7]]
chunk(['a', 'b', 'c', 'd'], 2)   // [['a', 'b'], ['c', 'd']]

// Process large datasets in batches
async function processBatches(items: any[], batchSize = 10) {

    const batches = chunk(items, batchSize)

    for (const batch of batches) {

        await Promise.all(batch.map(processItem))
        console.log(`Processed batch of ${batch.length} items`)
    }
}

// Paginate results
function paginateResults<T>(results: T[], pageSize = 20) {

    const pages = chunk(results, pageSize)

    return pages.map((page, index) => ({
        page: index + 1,
        data: page,
        hasNext: index < pages.length - 1
    }))
}
```

---

### `itemsToArray()`

Normalize input to always return an array. Wraps single items, passes arrays through.

```ts
function itemsToArray<T>(items: T | T[]): T[]
```

**Example:**

```ts
import { itemsToArray } from '@logosdx/utils'

itemsToArray('single')             // ['single']
itemsToArray(['already', 'array']) // ['already', 'array']
itemsToArray(42)                   // [42]

// Accept flexible input in your APIs
function processFiles(files: string | string[]) {

    const fileArray = itemsToArray(files)

    for (const file of fileArray) {
        console.log(`Processing: ${file}`)
    }
}

processFiles('single.txt')              // Works with single file
processFiles(['file1.txt', 'file2.txt']) // Works with multiple files
```

---

### `oneOrMany()`

Unwrap single-item arrays to the item itself. Returns the array unchanged if it has more than one element.

```ts
function oneOrMany<T>(items: T[]): T | T[]
```

**Example:**

```ts
import { oneOrMany } from '@logosdx/utils'

oneOrMany(['single'])           // 'single'
oneOrMany(['multiple', 'items']) // ['multiple', 'items']
oneOrMany([])                   // []

function findUsers(query: string): User | User[] {

    const results = database.search(query)
    return oneOrMany(results)
}
```

---

## Object Property Utilities

### `definePublicProps()`

Define visible, non-writable properties on an object. Properties show up in `Object.keys()` and `for...in` loops but cannot be modified.

```ts
function definePublicProps<T, U extends Record<string, unknown>>(
    target: T,
    props: U,
    configurable?: boolean  // default: false
): void
```

**Example:**

```ts
import { definePublicProps } from '@logosdx/utils'

const api = {}

definePublicProps(api, {
    version: '1.0.0',
    name: 'MyAPI'
})

console.log(api.version)       // '1.0.0'
console.log(Object.keys(api))  // ['version', 'name']
api.version = '2.0.0'          // Fails silently or throws in strict mode

// Immutable instance properties
class DataProcessor {

    constructor(config) {

        definePublicProps(this, {
            id: crypto.randomUUID(),
            createdAt: new Date()
        })
    }
}
```

---

### `definePrivateProps()`

Define hidden, non-writable properties on an object. Properties are not enumerable (hidden from `Object.keys()` and `for...in`) but still accessible by name.

```ts
function definePrivateProps<T, U extends Record<string, unknown>>(
    target: T,
    props: U,
    configurable?: boolean  // default: false
): void
```

**Example:**

```ts
import { definePrivateProps } from '@logosdx/utils'

const api = {}

definePrivateProps(api, {
    _cache: new Map(),
    _getId: () => crypto.randomUUID()
})

console.log(Object.keys(api)) // [] (hidden properties)
console.log(api._cache)       // Map instance (accessible but hidden)

class EventEmitter {

    constructor() {

        definePrivateProps(this, {
            _listeners: new Map(),
            _emit: this.emit.bind(this)
        })
    }
}
```

---

### `definePrivateGetters()`

Define hidden getter properties on an object. Useful for computed properties and lazy-loaded values.

```ts
function definePrivateGetters<T, U extends Record<string, Func>>(
    target: T,
    props: U,
    configurable?: boolean  // default: false
): void
```

**Example:**

```ts
import { definePrivateGetters } from '@logosdx/utils'

const user = { firstName: 'John', lastName: 'Doe' }

definePrivateGetters(user, {
    _fullName: () => `${user.firstName} ${user.lastName}`,
    _initials: () => `${user.firstName[0]}${user.lastName[0]}`
})

console.log(user._fullName)    // 'John Doe'
console.log(Object.keys(user)) // ['firstName', 'lastName'] (getters hidden)

class DataProcessor {

    constructor(data) {

        this.data = data

        definePrivateGetters(this, {
            _size: () => this.data.length,
            _isEmpty: () => this.data.length === 0
        })
    }
}
```

---

## `PriorityQueue`

A min-heap priority queue with O(log n) push/pop operations. Lower priority numbers dequeue first. Ties are broken by insertion order (FIFO by default).

```ts
class PriorityQueue<T> {
    constructor(options?: PriorityQueueOptions<T>)

    push(value: T, priority?: number): void    // Add item (default priority: 0)
    pop(): T | null                            // Remove highest-priority item
    popMany(count?: number): T[]               // Remove multiple items
    peek(): T | null                           // View next item without removing
    peekMany(count?: number): T[]              // View multiple items
    find(predicate: (value: T) => boolean): T | null

    heapify(items: Node<T>[]): void            // Build heap from array
    clone(): PriorityQueue<T>                  // Independent copy
    toSortedArray(): T[]                       // Extract sorted array

    size(): number
    isEmpty(): boolean
    clear(): void

    [Symbol.iterator](): IterableIterator<T>   // Iterate in priority order
}

interface PriorityQueueOptions<T> {
    lifo?: boolean      // LIFO for equal priorities (default: false/FIFO)
    compare?: (a: Node<T>, b: Node<T>) => number  // Custom comparator
    maxHeap?: boolean   // Invert priority order (default: false)
}
```

**Example:**

```ts
import { PriorityQueue } from '@logosdx/utils'

// Task scheduling
const taskQueue = new PriorityQueue<{ name: string; deadline: Date }>()

taskQueue.push({ name: 'Critical fix', deadline: new Date() }, 1)
taskQueue.push({ name: 'Nice to have', deadline: new Date() }, 10)
taskQueue.push({ name: 'Urgent review', deadline: new Date() }, 2)

taskQueue.peek()  // { name: 'Critical fix', ... } (priority 1)
taskQueue.pop()   // { name: 'Critical fix', ... }
taskQueue.pop()   // { name: 'Urgent review', ... } (priority 2)
taskQueue.pop()   // { name: 'Nice to have', ... } (priority 10)

// Max-heap (highest priority first)
const leaderboard = new PriorityQueue<string>({ maxHeap: true })

leaderboard.push('Alice', 95)
leaderboard.push('Bob', 87)
leaderboard.push('Charlie', 92)

leaderboard.pop() // 'Alice' (score 95)
leaderboard.pop() // 'Charlie' (score 92)

// Iterate in priority order
const queue = new PriorityQueue<string>()
queue.push('low', 3)
queue.push('high', 1)
queue.push('medium', 2)

for (const item of queue) {
    console.log(item) // 'high', 'medium', 'low'
}

// LIFO tie-breaking
const lifoQueue = new PriorityQueue<string>({ lifo: true })
lifoQueue.push('first', 1)
lifoQueue.push('second', 1)
lifoQueue.pop() // 'second' (newest with same priority)
```

---

## Miscellaneous Utilities

### `noop`

A no-operation function that accepts any arguments and returns nothing. Useful as a default callback.

```ts
const noop: (...args: any[]) => any
```

**Example:**

```ts
import { noop } from '@logosdx/utils'

// Default callback
function createHandler(onSuccess = noop, onError = noop) {
    // ...
}

// Disable logging in production
const logger = isProduction ? { log: noop, warn: noop, error: noop } : console
```

---

### `generateId()`

Generates a random ID string. Simple and fast, suitable for non-cryptographic use.

```ts
function generateId(): string  // Returns '_' + random alphanumeric (e.g., '_a3f7k2m')
```

**Example:**

```ts
import { generateId } from '@logosdx/utils'

const id = generateId() // '_a3f7k2m'

// Use for temporary identifiers
const tempElements = items.map(item => ({
    key: generateId(),
    ...item
}))
```

---

### `nTimes()`

Execute a function N times and return the results as an array. The function receives the current iteration index.

```ts
function nTimes<T>(fn: (iteration: number) => T, n: number): T[]
```

**Example:**

```ts
import { nTimes } from '@logosdx/utils'

nTimes(() => createEl('span'), 3)    // [span, span, span]
nTimes(() => Math.random(), 5)       // [0.12, 0.45, 0.78, 0.23, 0.91]
nTimes((i) => (i + 1) * 2, 3)       // [2, 4, 6]

// Generate test data
const mockUsers = nTimes((i) => ({
    id: `user-${i}`,
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`
}), 10)
```
