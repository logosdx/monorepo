# Claude Code Review Guidelines

This document provides comprehensive instructions for code reviews and feedback on the @logosdx monorepo. Follow these standards to ensure code quality, consistency, and maintainability.

## 🏗️ Repository Structure & Organization

### Monorepo Architecture

- **Source code**: `packages/*/src/` - Each package has its own source directory
- **Documentation**: `docs/` - Centralized documentation for all packages
- **Tests**: `tests/src/` - Mirrors source structure for validation
- **Scripts**: `scripts/` - Build, release, and utility scripts

### Package Organization

- **Independent packages**: Each package builds and publishes separately
- **Cross-package imports**: Use package names (`@logosdx/utils`) not relative paths
- **Test imports**: Use relative paths (`../../packages/utils/src/index.ts`) to validate actual implementation

```ts
// ✅ Cross-package imports (production code)
import { attempt } from '@logosdx/utils';
import { ObserverEngine } from '@logosdx/observer';

// ✅ Test imports (relative paths)
import { attempt } from '../../../../packages/utils/src/index.ts';
import { ObserverEngine } from '../../../../packages/observer/src/engine.ts';

// ❌ Wrong import pattern in tests
import { attempt } from '@logosdx/utils'; // Won't validate actual implementation
```

## 🧠 TypeScript Development Standards

### Code Style Conventions

#### Syntax & Formatting

- Newline **after** function declaration:

  ```ts
  function doSomething() {

      // logic
  }
  ```

- Newline **after** opening blocks:

  ```ts
  if (condition) {

      // logic
  }
  ```

- Prefer **vertical space** over horizontal when functions are long
- Group functions in this order:
  1. Declaration block
  2. Validation block
  3. Business logic block
  4. Commit block

#### Naming Philosophy

- Use **meaningful names** that explain **what** the thing is
  - ✅ `userExists`, `fetchInvoiceTotal`
  - ❌ `x`, `data`, `handleIt`
- Functions and variables should **read like English**

### Comments & JSDoc

- JSDoc all **functions and classes**
- Comments and docs must explain **WHY** something exists — not how or what
- **Ambiguous validation logic must be commented** explicitly
- Always provide **usage examples**:

  ```ts
  /**
   * Throttles notifications per user to prevent spam.
   *
   * @example
   * const limiter = new ThrottleEngine({ maxPerMinute: 3 });
   */
  ```

## 🚫 Error Handling Standards

### Core Principle: Use Go-style error monad for fail-prone operations

Use utilities from `@logosdx/utils` for operations that can fail (async, I/O, network) — these provide safe, legible, consistent control flow.

```ts
import { attempt, attemptSync } from '@logosdx/utils'

// ✅ For fail-prone operations (async, I/O, network)
const [result, err] = await attempt(() => fetch('/api/users'))
if (err) return handleError(err)

const [fileContent, readErr] = attemptSync(() => readFileSync('config.json'))
if (readErr) throw readErr

// ✅ Business logic functions return actual results
function modifyUserEmail(user: User, newEmail: string): User {
    // Validation
    if (!isValidEmail(newEmail)) {
        throw new InvalidEmailError()
    }

    // Business logic
    user.email = newEmail
    return user
}

// ✅ Composition: Use error monad for I/O, return results for business logic
async function updateUserEmail(userId: string, newEmail: string): Promise<User> {
    // Fail-prone operation (I/O)
    const [user, fetchErr] = await attempt(() => fetchUser(userId))
    if (fetchErr) throw fetchErr

    // Business logic (returns actual result)
    const modifiedUser = modifyUserEmail(user, newEmail)

    // Fail-prone operation (I/O)
    const [, saveErr] = await attempt(() => saveUser(modifiedUser))
    if (saveErr) throw saveErr

    return modifiedUser
}
```

### When to Use Error Monad vs Direct Returns

#### ✅ Use Error Monad (`[result, error]`) for

- **Async operations**: `fetch()`, database queries, file I/O
- **External API calls**: Third-party services, network requests
- **System operations**: File system, process spawning
- **Unpredictable failures**: Network timeouts, disk full, permissions

#### ✅ Use Direct Returns for

- **Business logic**: Data transformations, calculations, validations
- **Pure functions**: Mathematical operations, string manipulation
- **Deterministic operations**: Type checking, object manipulation
- **Internal utilities**: Helper functions, data processing

### Function Structure Examples

```ts
/**
 * Updates the email address for a given user.
 *
 * Ensures email format is valid and user exists before applying update.
 *
 * @example
 * const user = await updateUserEmail(userID, newEmail);
 */
async function updateUserEmail(userID: UUID, newEmail: EmailAddress): Promise<User> {

    // === Declaration block ===
    let retryCount = 0;

    // === Validation block ===
    if (!isValidEmail(newEmail)) {

        // This guards against malformed input from external systems
        throw new InvalidEmailError();
    }

    // === Business logic block ===
    // Fail-prone operation (I/O) - use error monad
    const [user, err] = await attempt(() => fetchUser(userID));

    if (err || !user) {

        throw new UserNotFoundError();
    }

    // Business logic - return actual result
    const modifiedUser = modifyUserEmail(user, newEmail);

    // === Commit block ===
    // Fail-prone operation (I/O) - use error monad
    const [ok, saveErr] = await attempt(() => saveUser(modifiedUser));

    if (saveErr) {

        throw saveErr;
    }

    return modifiedUser;
}

/**
 * Modifies a user's email address.
 *
 * Pure business logic function - returns actual result.
 *
 * @example
 * const modifiedUser = modifyUserEmail(user, 'new@example.com');
 */
function modifyUserEmail(user: User, newEmail: EmailAddress): User {

    // === Validation block ===
    if (!isValidEmail(newEmail)) {

        throw new InvalidEmailError();
    }

    // === Business logic block ===
    const modifiedUser = { ...user, email: newEmail };

    return modifiedUser;
}
```

## 🧪 Testing Standards

### Test File Structure

- **Mirror source structure**: `tests/src/` mirrors `packages/*/src/`
- **Relative imports**: Use `../../../../packages/utils/src/index.ts` not `@logosdx/utils`
- **Required for tests**: Relative imports validate actual implementation
- **Use `mockHelpers`** pattern with `calledExactly` for consistent verification

### Test Organization

- **Group by functionality**: `describe('flow-control: memo', () => {})`
- **Descriptive names**: `"should [behavior] when [condition]"`
- **Test all paths**: Positive cases, error cases, edge cases
- **Nest related tests** in sub-describes

### Mock & Assertion Patterns

```ts
// Use `mock.fn()` from `node:test`
const fn = mock.fn();
calledExactly(fn, 1, 'called once');

// Test both success and error paths
const [result, err] = await attempt(() => riskyOperation());
expect(err).to.be.instanceOf(Error);

// Integration testing
const observer = new ObserverEngine();
const component = observer.observe({});
component.cleanup(); // Test teardown
```

### Required Test Coverage

Each exported function must have:

- ✅ Unit tests
- ✅ Error-path tests
- ✅ Integration test (if interacting with DB or IO)

## 📦 TypeScript Patterns

### Type Organization

- **Dedicated `types.ts` files** for shared types across modules
- **`export type`** for type-only exports (enables tree-shaking)
- **Re-export from index**: `export type { Events } from './types.ts'`
- **Group logically** by domain/feature

### Generic & Type Patterns

```ts
// Descriptive names
export type Events<Shape> = keyof Shape;
export interface EventCallback<Shape> {
    (data: Shape): void;
}

// Proper constraints
export type EventData<Shape, E extends Events<Shape>> = Shape[E];

// Interface for extensibility
export interface BehaviorOptions {
    debounceMs?: number;
    root?: Element;
}
```

### Class Design

- **Static classes** → Stateless utilities (DOM, behaviors, helpers)
- **Instance classes** → Stateful components with private state and lifecycle
- **Always dogfood** `@logosdx/utils` for validation, error handling, flow control

### Instance Class Patterns

```ts
export class DataProcessor {
    #cache: Map<string, Data> = new Map();

    constructor(config: Config) {
        // === Declaration ===
        let x: string = '';

        // === Validation ===
        assert(isObject(config), 'Config required');

        // === Business Logic ===
        this.#config = clone(config);

        // === Commit ===
        definePrivateProps(this, {
            process: this.process,
            cleanup: this.cleanup
        });
    }

    // Debug method
    $facts() { return { cacheSize: this.#cache.size }; }
}
```

### Static Class Patterns

```ts
export class HtmlBehaviors {
    static isBound(el: Element, feature: string): boolean { }
    static markBound(el: Element, feature: string): void { }
    static bindBehavior(el: Element, feature: string, handler: Function): void {
        if (this.isBound(el, feature)) return;

        const [, err] = attemptSync(() => handler(el));
        if (err) console.warn(`Failed ${feature}:`, err);
        else this.markBound(el, feature);
    }
}
```

### Symbol Usage

- **When to use**: Private metadata on DOM elements, hidden internal state
- **When NOT to use**: Public APIs, simple private data (use `#private` fields)
- **Pattern**: Module-level constants with descriptive names
- **TypeScript**: Always type symbol properties with interfaces

```ts
const BINDING_SYMBOL = Symbol('bindings');
const TEARDOWN_SYMBOL = Symbol('teardowns');

interface BoundElement extends Element {
    [BINDING_SYMBOL]?: Set<string>;
    [TEARDOWN_SYMBOL]?: Map<string, () => void>;
}
```

## 🐕 Dogfooding Standards

### Core Principle

Always use `@logosdx/utils` throughout the monorepo to validate APIs and demonstrate best practices.

### Required Usage Patterns

```ts
// Error handling
const [result, err] = await attempt(() => fetch('/api'));
if (err) return handleError(err);

// Data operations
const cloned = clone(complexState);
if (!equals(oldState, newState)) triggerUpdate();

// Flow control
const debouncedSearch = debounce(search, 300);
const resilient = retry(circuitBreaker(apiCall), { retries: 3 });

// Validation
assert(isObject(config), 'Config required');
```

### Data Operations

- `clone()` for safe copying (handles Maps, Sets, classes)
- `equals()` for reliable comparisons
- `merge()` for intelligent object merging
- `reach()` for safe nested property access

### Flow Control & Performance

- `debounce()` for user input, search, resize handlers
- `throttle()` for scroll, animation callbacks
- `rateLimit()` for API call limiting
- `retry()` + `circuitBreaker()` + `withTimeout()` for resilient network calls
- `batch()` for concurrent array processing

### Memory & Performance

- `memoize()` / `memoizeSync()` for expensive computations
- `definePrivateProps()` for non-enumerable class methods
- Use modern data structures (Map, Set) with utils that support them

## 📚 Documentation Standards

### Documentation Structure

1. **Problem Statement** - Why it exists, what problems it solves
2. **Core Philosophy** - Design principles with examples
3. **Problem-Solving Examples** - Real scenarios, not toy examples
4. **API Reference** - Link to TypeDoc
5. **Advanced Patterns** - Composition examples

### /docs Directory Requirements

**Primary focus**: Answer "what is this?", "why does it exist?", and "when should I use this?"

- **What is this?** - Clear, concise description of the package/utility
- **Why does it exist?** - Problem statement with real-world context
- **When should I use this?** - Use cases and scenarios where this is the right choice
- **Brief functionality showcase** - Demonstrate key features with examples
- **Link to TypeDoc** - "How to use" details belong in JSDoc and generated TypeDoc

### Documentation Patterns

- **Always contrast**: Show ❌ problematic vs ✅ good patterns
- **Real-world context**: Shopping carts, user data, not `foo`/`bar`
- **Show @logosdx/utils**: Demonstrate dogfooding in examples
- **Include fallbacks**: Error handling and graceful degradation

### Problem-driven Documentation Format

```markdown
#### The Problem: [Specific Real Scenario]
[Context about why this is challenging in production]

```typescript
// ❌ Fragile approach
// Comment explaining what breaks

// ✅ Resilient approach using @logosdx/utils
// Show proper error handling and fallbacks
```

```

## 🔄 Development Workflow

### Build & Release
- **Individual builds**: Each package builds independently with its own config
- **Coordinated releases**: Use changeset for version management and releases
- **Type generation**: Shared TypeScript configs for consistent type generation
- **Documentation**: TypeDoc generation for each package

### Quick Commands
```bash
# Create new package
pnpm run new

# Run tests
pnpm run test
pnpm run tdd

# Build everything
pnpm run build

# Generate docs
pnpm run build:docs
```

## 🎯 Code Review Checklist

When reviewing code, ensure:

### ✅ Structure & Organization

- [ ] Follows monorepo import patterns (package names in prod, relative in tests)
- [ ] Proper file organization (types.ts, index.ts exports)
- [ ] Logical grouping of functions and classes

### ✅ TypeScript Standards

- [ ] No `try-catch` blocks (use `attempt`/`attemptSync`)
- [ ] Proper function structure (4-block pattern)
- [ ] Meaningful names that read like English
- [ ] JSDoc with examples and WHY explanations

### ✅ Dogfooding

- [ ] Uses `@logosdx/utils` for error handling
- [ ] Uses `@logosdx/utils` for data operations
- [ ] Uses `@logosdx/utils` for flow control
- [ ] Demonstrates best practices in examples

### ✅ Testing

- [ ] Tests mirror source structure
- [ ] Uses relative imports in tests
- [ ] Tests all paths (success, error, edge cases)
- [ ] Proper mock patterns with `calledExactly`

### ✅ Documentation

- [ ] Problem statement with real-world context
- [ ] Shows ❌ vs ✅ patterns
- [ ] Links to TypeDoc
- [ ] Demonstrates dogfooding

### ✅ Performance & Memory

- [ ] Uses appropriate utilities (debounce, throttle, memo)
- [ ] Proper cleanup in integration tests
- [ ] No memory leaks in observer patterns

### ✅ Error Handling Patterns

- [ ] Uses error monad (`[result, error]`) for fail-prone operations only
- [ ] Business logic functions return actual results, not error tuples
- [ ] Proper composition between error monad and direct returns
- [ ] No `try-catch` blocks (use `attempt`/`attemptSync` for I/O)

## 🚨 Common Issues to Flag

### ❌ Anti-patterns

- `try-catch` blocks instead of `attempt`/`attemptSync`
- Error monad pattern used for pure business logic functions
- Business logic functions returning `[result, error]` tuples
- Missing error handling in async operations
- Inconsistent error handling patterns

### ✅ Best Practices to Encourage

- Error monad for I/O, direct returns for business logic
- Clear separation between fail-prone and deterministic operations
- Proper composition of error handling and business logic
- Meaningful names and clear function structure
- Dogfooding throughout the codebase
- Performance considerations with appropriate utilities

---

**Remember**: The goal is clean, readable, testable, and deterministic code that demonstrates the power and reliability of the @logosdx ecosystem.
