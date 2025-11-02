# CLAUDE.md - Packages Folder Memory

This file provides comprehensive context about the LogosDX monorepo package architecture, patterns, and conventions.

## Package Architecture Overview


**8 Packages in Layered Architecture:**

```
@logosdx/kit (orchestrator - depends on all)
    ├── @logosdx/fetch ──────────┐
    ├── @logosdx/localize ───────┤
    ├── @logosdx/observer ───────┤──── @logosdx/utils (foundation)
    ├── @logosdx/state-machine ──┤
    ├── @logosdx/storage ────────┤
    └── @logosdx/dom ────────────┘
```

All packages depend on `@logosdx/utils` as the foundation layer.

## Standard Package Structure

Every package follows identical organization:

```
package-name/
├── src/
│   ├── index.ts       # Barrel exports
│   ├── types.ts       # Type definitions (where applicable)
│   └── [modules].ts   # Feature implementations
├── package.json       # Workspace deps, build config
├── tsconfig.json      # Extends monorepo config
└── dist/              # Build outputs (CJS, ESM, types)
```

## Core Patterns & Conventions

### 1. Four-Block Function Structure (MANDATORY)

```typescript
async function updateUserEmail(userID: UUID, newEmail: EmailAddress): Promise<User> {
    // === Declaration block ===
    let retryCount = 0;

    // === Validation block ===
    if (!isValidEmail(newEmail)) throw new InvalidEmailError();

    // === Business logic block ===
    const [user, err] = await attempt(() => fetchUser(userID));
    if (err) throw err;

    // === Commit block ===
    const [, saveErr] = await attempt(() => saveUser(user));
    if (saveErr) throw saveErr;

    return user;
}
```

> [!NOTE]
> The `// ===` comments are only there for placement instructions. They should not be part of the code.

### 2. Error Handling Philosophy (Go-style)

**Use `attempt`/`attemptSync` instead of try-catch:**

```typescript
// ✅ Preferred pattern
const [result, err] = await attempt(() => riskyOperation());
if (err) return handleError(err);

// ❌ Avoid try-catch for business logic validation
try {
    // Some business logic that shouldn't fail
}
catch (err) {
    // Business logic validation only
}
```

### 3. Validation-First Approach

**Validate all inputs before business logic:**

```typescript
function processData(input: Data): ProcessedData {
    // Validation block (prevents failures)
    if (!isObject(input)) throw new TypeError('Input must be object');
    if (!input.required) throw new ValidationError('Missing required field');

    // Business logic block (pure transforms)
    return transform(input);
}
```

### 4. Cleanup Function Pattern

Most utilities return cleanup functions:

```typescript
// DOM event management
const cleanup = html.events.on(element, 'click', handler);
// Later: cleanup();

// Observer subscriptions
const unsubscribe = observer.on('event.*', handler);
// Later: unsubscribe();

// Component lifecycle
const component = createComponent(config);
// Later: component.cleanup();
```

## TypeScript Patterns & Conventions

### Module Augmentation Pattern

```typescript
declare module './engine.ts' {
    export namespace FetchEngine {
        export interface InstanceHeaders {
            // Extensible interface for user augmentation
        }
    }
}
```

### Namespace Organization

```typescript
export class FetchEngine {
    constructor(config: FetchEngine.Config) { }
}

export namespace FetchEngine {
    export interface Config {
        baseUrl: string;
        headers?: Headers;
    }

    export interface Options {
        retry?: boolean;
        timeout?: number;
    }
}
```

## Package Deep Dive

### @logosdx/utils (Foundation)

**Purpose**: Core utilities, types, and flow control primitives

**Key Exports:**

- **Flow Control**: `attempt`, `attemptSync`, `retry`, `debounce`, `throttle`, `circuitBreaker`
- **Data Operations**: `clone`, `merge`, `equals`, `reach`, `chunk`, `batch`
- **Validation**: `assert`, `isObject`, `isDefined`, `isFunction`, environment detection
- **Types**: `Func`, `AsyncFunc`, `PathValue`, `DeepOptional`, `Truthy`
- **Data Structures**: `PriorityQueue`, `Deferred`

**Critical Patterns:**

- Error tuples: `[result, error]` from `attempt()`
- Validation-first function structure
- Type guards and assertions
- Environment detection (browser, Node.js, React Native, Cloudflare)

### @logosdx/fetch (HTTP Layer)

**Purpose**: Full-featured fetch wrapper with advanced capabilities

**Key Features:**

- `FetchEngine` class with configurable options
- **Enhanced response objects**: Returns `FetchResponse<T>` instead of raw data
- **Built-in retry logic**: Exponential backoff with circuit breaker
- **Method-specific config**: Different headers/params per HTTP method
- **Lifecycle hooks**: Request/response interceptors
- **Type safety**: Full TypeScript generics support

**Usage Pattern:**

```typescript
const api = new FetchEngine({ baseUrl: '/api' });
const [users, err] = await attempt(() => api.get<User[]>('/users'));
if (err) return handleError(err);
```

### @logosdx/observer (Event Layer)

**Purpose**: Powerful event system with regex support and queue management

**Key Components:**

- **ObserverEngine**: Regex event matching with cleanup
- **EventQueue**: Priority, concurrency, and rate limiting
- **EventGenerator**: Async iteration over events
- **Built-in monitoring**: Statistics and performance tracking

**Pattern:**

```typescript
const observer = new ObserverEngine();
const unsubscribe = observer.on('user\\..*', (event) => {
    console.log('User event:', event);
});
```

### @logosdx/dom (Browser Layer)

**Purpose**: Type-safe DOM manipulation utilities

**Organization:**

- `html.css` - Style and class management
- `html.attrs` - Attribute manipulation
- `html.events` - Event handling with cleanup
- `html.behaviors` - MutationObserver integration

**Pattern:**

```typescript
const element = createElWith('div', {
    attrs: { id: 'container' },
    css: { backgroundColor: 'blue' },
    events: { click: handler }
});
```

### @logosdx/state-machine (State Layer)

**Purpose**: Stream-based state management with history

**Features:**

- Reducer-based state updates
- Time travel debugging (state history)
- Parent-child relationships
- Bidirectional synchronization
- Event emission on changes

### @logosdx/storage (Persistence Layer)

**Purpose**: Type-safe localStorage/sessionStorage wrapper

**Features:**

- Generic typing for storage shapes
- Prefixed key management
- Event-driven change notifications
- Object assignment and merging

### @logosdx/localize (i18n Layer)

**Purpose**: Internationalization with type safety

**Features:**

- Path-based message retrieval with `PathLeaves<T>`
- Locale switching with fallbacks
- Template string formatting
- Event notifications for locale changes

### @logosdx/kit (Orchestration Layer)

**Purpose**: Unified package that combines all components

**Key Feature:**

```typescript
// appKit factory with complete type inference
const kit = appKit<MyKitType>({
    observer: { /* typed options */ },
    stateMachine: { /* typed options */ }
});
// kit.observer, kit.stateMachine are fully typed
```

## Import/Export Strategies

### Production Imports (In Packages)

```typescript
// ✅ Use package imports in production code
import { attempt } from '@logosdx/utils';
import { FetchEngine } from '@logosdx/fetch';
```

### Test Imports (In Tests)

```typescript
// ✅ Use relative imports in tests to validate implementation
import { attempt } from '../../../packages/utils/src/index.ts';
```

### Export Patterns

```typescript
// Barrel exports in index.ts
export * from './engine.js';
export * from './types.js';
export type { Config } from './engine.js';

// Named exports for clarity
export { FetchEngine, FetchError } from './engine.js';
```

## Build & Distribution

### Consistent Build Strategy

```json
{
    "scripts": {
        "build": "node ../../scripts/build.mjs"
    },
    "exports": {
        ".": {
            "import": "./dist/index.mjs",
            "require": "./dist/index.js",
            "types": "./dist/index.d.ts"
        }
    }
}
```

**Output Formats:**

- **ESM**: `.mjs` files for modern bundlers
- **CJS**: `.js` files for Node.js compatibility
- **Types**: `.d.ts` files for TypeScript
- **UMD**: Browser globals (`LogosDx.Utils`, `LogosDx.Dom`, etc.)

### Package Configuration Standards

```json
{
    "sideEffects": false,              // Enable tree-shaking
    "dependencies": {
        "@logosdx/utils": "workspace:^" // Workspace dependencies
    }
}
```

## Integration Patterns

### Event System Integration

Most packages integrate with observer system:

```typescript
// Storage emits change events
storage.on('change', handler);

// Fetch engines emit lifecycle events
engine.on('request.success', handler);

// State machines emit state changes
stateMachine.on('state.change', handler);
```

### Composition Patterns

```typescript
// Utilities compose together
const [result, err] = await attempt(() =>
    retry(() =>
        fetch('/api/data')
    )
);

// Components share cleanup patterns
const cleanupFns = [
    observer.on('event', handler),
    html.events.on(element, 'click', handler),
    storage.on('change', handler)
];

// Later cleanup all at once
cleanupFns.forEach(fn => fn());
```

## Development Guidelines

### Required Patterns

- ✅ Use `attempt`/`attemptSync` for I/O operations
- ✅ Validate inputs in validation block
- ✅ Follow 4-block function structure
- ✅ Return cleanup functions where applicable
- ✅ Use meaningful English names
- ✅ Dogfood @logosdx/utils throughout

### Anti-patterns

- ❌ `try-catch` for I/O (use `attempt` instead)
- ❌ Business logic in error tuples
- ❌ Missing input validation
- ❌ Forgetting cleanup functions
- ❌ Generic foo/bar examples (use domain concepts)

## Summary

This is a **production-grade, type-safe utility library** featuring:

1. **Layered Architecture**: Clear dependency hierarchy
2. **Consistent Patterns**: 4-block functions, error tuples, cleanup functions
3. **Advanced TypeScript**: Path types, conditionals, module augmentation
4. **Event-Driven Design**: Comprehensive observer pattern integration
5. **Developer Experience**: Type safety, meaningful errors, cleanup management
6. **Enterprise Ready**: Proper builds, tree-shaking, multiple output formats

Each package follows established conventions while providing focused, well-documented functionality for building complex TypeScript applications.
