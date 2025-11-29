# CLAUDE.md - Tests Folder Memory

This file provides context about the test structure, patterns, and conventions used in the LogosDX monorepo tests.

## Structure Overview

```
tests/
├── benchmark/         # Performance tests (250k ops, memory leak detection)
├── experiments/       # Gitignored playground for test ideas
├── _memory-tests/     # Memory leak detection tests (not regular tests)
├── src/               # Main test files mirroring package structure
│   ├── _helpers.ts    # Centralized test utilities and mocking
│   ├── _playground.ts # Example code and experiments
│   ├── setup.ts       # Global test setup (beforeEach/afterEach hooks)
│   └── [modules]/     # Tests organized by package
├── package.json       # Test dependencies (vitest, sinon, fast-check, jsdom)
├── vitest.config.ts   # Vitest configuration
└── tsconfig.json      # TypeScript config extending monorepo base
```

## Testing Framework & Tools

- **Core**: Vitest (`vitest`) - Vite-native testing framework
- **Assertions**: Vitest's built-in `expect` API (Jest-compatible, built on Chai)
- **Mocking**: Vitest's `vi` object + Sinon sandbox for stubs
- **Property Testing**: fast-check (10,000+ test runs)
- **DOM Testing**: JSDOM environment (configured in vitest.config.ts)
- **Coverage**: V8 provider via `@vitest/coverage-v8`

## Memory & Performance Testing

- Separate memory tests in `tests/_memory-tests/`
- Uses `--expose-gc` for garbage collection control
- The place to visualize memory usage and test for leaks
- Uses a custom test harness for manual or automated runs
- Exposed via `pnpm memory` and `pnpm memory:ui` scripts

## Import Strategy (CRITICAL)

**Tests use relative imports to validate actual implementation:**

```typescript
// ✅ Test imports (bypasses build, validates source)
import { attempt } from '../../../packages/utils/src/index.ts';

// ❌ Don't use package imports in tests
import { attempt } from '@logosdx/utils';
```

This follows the monorepo CLAUDE.md directive to ensure tests validate actual source code.

## Test Structure Patterns

### Standard Test Organization

```typescript
describe('@logosdx/[package-name]', () => {
    it('should [specific behavior]', () => {
        // Test implementation
    });
});
```

### Mock Management Pattern

```typescript
import { vi, beforeEach, afterEach } from 'vitest';
import Sinon from 'sinon';

const sandbox = Sinon.createSandbox();

beforeEach(() => {
    // Console mocks are set up globally via setup.ts
});

afterEach(() => {
    sandbox.restore(); // Clean up Sinon stubs
    vi.restoreAllMocks(); // Clean up Vitest mocks
});
```

## Test Coverage Requirements

Each exported function MUST test:

- ✅ **Happy path**: Expected usage scenarios
- ✅ **Error paths**: Network failures, invalid responses, I/O errors
- ✅ **Bad inputs**: null, undefined, wrong types, malformed data
- ✅ **Edge cases**: Empty arrays, circular refs, large datasets
- ✅ **Security**: Prototype pollution prevention, input sanitization


## Testing Strategy Framework

Use these 9 strategies to systematically identify missing test cases:


### 1. Happy Path / Representative Examples

> "If everything is normal, what should this do?"

Test typical usage with valid inputs. The obvious cases that documentation would show.


### 2. Boundary & Corner Cases

> "Where is the function most fragile in its input space?"

| Boundary Type | Examples                                          |
| ------------- | ------------------------------------------------- |
| Empty values  | `""`, `[]`, `{}`, `0`, `null`, `undefined`        |
| Limits        | Max int, very long strings, deeply nested objects |
| Edge values   | First/last element, exactly at threshold          |
| Type edges    | `NaN`, `Infinity`, `-0`                           |

```typescript
// Example: testing timeout boundaries
it('should handle 0ms timeout', ...);
it('should handle negative timeout', ...);
it('should handle Infinity timeout', ...);
```


### 3. Invalid Input & Robustness (Negative Testing)

> "How should this fail when used incorrectly?"

- Wrong types passed to parameters
- Callbacks that throw errors
- Functions returning unexpected types
- Missing required fields

```typescript
it('should handle serializer that throws', async () => {

    const api = new FetchEngine({
        serializer: () => { throw new Error('Failed'); }
    });
    // What's the expected behavior?
});
```

### Vitest Mocking with `vi`

```typescript
import { vi, expect, it, beforeEach, afterEach } from 'vitest';

// Create mock functions
const mockFn = vi.fn();
const mockImpl = vi.fn(() => 'mocked value');

// Spying on methods
const spy = vi.spyOn(object, 'method');

// Fake timers
beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

it('should advance timers', async () => {

    const callback = vi.fn();
    setTimeout(callback, 1000);

    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);
});
```

### 4. State & Sequence Tests

> "What if behavior depends on what happened before?"

- Order of operations matters
- State changes mid-operation
- Repeated calls with same/different inputs
- Resource lifecycle (create → use → destroy)

```typescript
it('should handle addHeader during in-flight request', ...);
it('should handle destroy called twice', ...);
it('should NOT join a failed in-flight request', ...);
```


### 5. Structural / White-Box Coverage

> "Have I exercised the implementation's interesting paths?"

- Every `if/else` branch
- Every `catch` block
- Cache hit vs miss paths
- Fallback/default paths

Review the implementation and ensure each code path has a test that exercises it.


### 6. Property-Based & Invariant Testing

> "What rules must always hold, regardless of input?"

| Invariant Type | Example                                    |
| -------------- | ------------------------------------------ |
| Determinism    | Same input always produces same output     |
| Uniqueness     | Different inputs produce different outputs |
| Bounds         | `count >= 0` always                        |
| Equality       | `clone(x)` equals `x`                      |

```typescript
import fc from 'fast-check';

it('should produce deterministic keys', () => {

    fc.assert(fc.property(
        fc.string(),
        (path) => {
            const key1 = serialize({ path });
            const key2 = serialize({ path });
            return key1 === key2;
        }
    ));
});
```


### 7. Combinatorial / Parameterized Testing

> "What combinations of parameters matter?"

- Config option combinations (enabled × methods × rules)
- HTTP methods × features
- Multiple flags that interact

```typescript
const methods = ['GET', 'POST', 'PUT', 'DELETE'];
const configs = [{ cache: true }, { cache: false }];

configs.forEach(config => {

    methods.forEach(method => {

        it(`should handle ${method} with ${JSON.stringify(config)}`, ...);
    });
});
```


### 8. Cross-Checks & Oracles

> "How do I know the result is truly correct?"

- Compare with known-good implementation
- Verify output format matches specification
- Behavior equivalence (same result with feature on vs off)

```typescript
it('should produce identical results with and without cache (first request)', async () => {

    const r1 = await apiWithCache.get('/json');
    const r2 = await apiWithoutCache.get('/json');
    expect(r1.data).to.deep.equal(r2.data);
});
```


### 9. Non-Functional Testing

> "What happens under stress or weird conditions?"

| Category           | Tests                                    |
| ------------------ | ---------------------------------------- |
| **Load**           | 100+ concurrent requests, large payloads |
| **Concurrency**    | Race conditions, concurrent mutations    |
| **Memory**         | No leaks under sustained load            |
| **Error Recovery** | Network failures, timeouts mid-operation |

```typescript
it('should handle 100 concurrent requests', async () => {

    const promises = Array.from({ length: 100 }, () => api.get('/json'));
    const results = await Promise.all(promises);
    expect(api.cacheStats().inflightCount).to.equal(0); // No leaks
});
```


### Quick Checklist

For each function/feature, verify:

- [ ] **Normal**: Works for typical inputs?
- [ ] **Boundaries**: Empty, zero, max, unicode?
- [ ] **Invalids**: Callbacks throw, wrong types?
- [ ] **Sequence**: Order matters? State changes?
- [ ] **Branches**: All code paths covered?
- [ ] **Properties**: Invariants always hold?
- [ ] **Combinations**: Parameter interactions?
- [ ] **Cross-check**: Results verifiably correct?
- [ ] **Non-functional**: Load, concurrency, errors?


## Helper Utilities (`_helpers.ts`)

- `setup()` / `teardown()` - Console mocking with real console forwarding (called via setup.ts)
- `mockHelpers(expect)` - Returns Vitest mock call count validators:
  - `calledExactly(mock, count, msg)` - Exact call count validation
  - `calledMoreThan(mock, count, msg)` - Minimum call validation
  - `calledAtLeast(mock, count, msg)` - At least N calls validation
- `runTimers(tickTime, nTimes)` - Advance fake timers with `vi.advanceTimersByTime()`
- `nextTick()` - Event loop testing helper (`process.nextTick` wrapper)
- `sandbox` - Sinon sandbox for stubs (exported for direct use)
- `stubLog`, `stubError`, `stubWarn`, etc. - Pre-configured console stubs

## Advanced Testing Patterns

### Property-Based Testing

```typescript
import fc from 'fast-check';

it('should handle all array types', () => {
    fc.assert(fc.property(
        fc.array(fc.anything()),
        (arr) => {
            const cloned = clone(arr);
            expect(equals(arr, cloned)).to.be.true;
        }
    ));
});
```

## Running Tests

```bash
# Full test suite
pnpm test

# Watch mode
pnpm tdd

# Coverage report
pnpm test:coverage

# Specific test files (filename contains "filepart")
pnpm test filepart

# Run tests matching a pattern
pnpm test --grep "pattern"

# Only marked tests (it.only, describe.only)
pnpm test:only

# CI mode with GitHub Actions reporter
pnpm test:ci
```

## Vitest Configuration Highlights

Key settings from `vitest.config.ts`:

- **Environment**: JSDOM (browser globals available)
- **Globals**: `true` (no need to import `describe`, `it`, `expect`)
- **Pool**: `forks` (isolated test processes)
- **Timeouts**: 10s for tests and hooks
- **Mocks**: Auto-cleared and restored between tests
- **Setup**: `src/setup.ts` runs before each test file
