# CLAUDE.md - Tests Folder Memory

This file provides context about the test structure, patterns, and conventions used in the LogosDX monorepo tests.

## Structure Overview

```
tests/
├── benchmark/          # Performance tests (250k ops, memory leak detection)
├── src/               # Main test files mirroring package structure
│   ├── _helpers.ts    # Centralized test utilities and mocking
│   ├── _playground.ts # Example code and experiments
│   ├── index.ts       # Test runner entry point
│   └── [modules]/     # Tests organized by package
├── package.json       # Test dependencies (chai, sinon, fast-check, jsdom)
└── tsconfig.json      # TypeScript config extending monorepo base
```

## Testing Framework & Tools

- **Core**: Node.js built-in test runner (`node:test`)
- **Assertions**: Chai with `expect` syntax
- **Mocking**: Sinon with sandbox pattern
- **Property Testing**: fast-check (10,000+ test runs)
- **DOM Testing**: JSDOM for browser environment simulation

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
    describe('module: feature', () => {
        it('should [specific behavior]', () => {
            // Test implementation
        });
    });
});
```

### Mock Management Pattern
```typescript
const sandbox = Sinon.createSandbox();

beforeEach(() => {
    mockHelpers(); // Setup console mocks with forwarding
});

afterEach(() => {
    sandbox.restore(); // Clean up all mocks
});
```

## Test Coverage Requirements

Each exported function MUST test:
- ✅ **Happy path**: Expected usage scenarios
- ✅ **Error paths**: Network failures, invalid responses, I/O errors
- ✅ **Bad inputs**: null, undefined, wrong types, malformed data
- ✅ **Edge cases**: Empty arrays, circular refs, large datasets
- ✅ **Security**: Prototype pollution prevention, input sanitization

## Helper Utilities (`_helpers.ts`)

- `mockHelpers()` - Console mocking with real console forwarding
- `calledExactly(fn, count, msg)` - Sinon call count validation
- `calledMoreThan(fn, count, msg)` - Minimum call validation
- `calledAtLeast(fn, count, msg)` - Minimum call validation
- `runTimers()` - Mock timer advancement for timing tests
- `nextTick()` - Event loop testing helper

## Performance Testing

**Benchmark Structure:**
- **Queue stress tests**: 250,000 operations across 5 rounds
- **Memory leak detection**: Heap monitoring with `gc()` calls
- **Operation rate tracking**: ops/sec calculations
- **Cleanup verification**: Ensures no memory leaks

**Memory Testing Pattern:**
```typescript
for (let round = 1; round <= 5; round++) {
    // Force garbage collection
    if (global.gc) global.gc();

    // Run operations
    for (let i = 0; i < 250000; i++) {
        // Test operations
    }

    // Verify cleanup
    expect(queue.size).to.equal(0);
}
```

## Package-Specific Testing Notes

### @logosdx/utils (Most Comprehensive)
- **Flow Control**: retry, circuit-breaker, batch, memoization, rate limiting
- **Data Structures**: clone, equals, merge with extensive type support
- **Validation**: Environment detection, type guards, assertions
- **Security**: Prototype pollution prevention, circular reference handling

### @logosdx/fetch (HTTP Client)
- **Lifecycle Testing**: Full request/response cycle validation
- **Error Handling**: Network failures, timeout scenarios
- **Configuration**: Headers, params, method-specific options
- **Type Safety**: Generic response types and validation

### @logosdx/observer (Event System)
- **Regex Event Matching**: Pattern-based event subscription
- **Queue Management**: Priority, concurrency, rate limiting
- **Async Iteration**: EventGenerator testing with for-await loops
- **Cleanup**: Observer lifecycle and memory management

### @logosdx/dom (Browser Utilities)
- **JSDOM Environment**: Full DOM simulation for testing
- **Viewport Calculations**: Scroll, visibility, positioning
- **Event Management**: Click, form submission, clipboard operations
- **Behavior System**: MutationObserver integration testing

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

### Error Object Testing
Comprehensive error handling validation:
- Custom error types (FetchError, EventError, etc.)
- Error cloning and equality
- Stack trace preservation
- Error chaining and causation

## Key Testing Insights

1. **Validation-First**: Tests validate actual source using relative imports
2. **Comprehensive Coverage**: Extensive edge case and error testing
3. **Performance-Aware**: Memory leak prevention and benchmarking
4. **Security-Conscious**: Prototype pollution and injection prevention
5. **Type-Safe**: Heavy TypeScript validation throughout
6. **Real-World**: Uses actual browser environment (JSDOM)
7. **Maintainable**: Centralized helpers, consistent patterns

## Running Tests

```bash
# Full test suite
pnpm test

# Watch mode
pnpm tdd

# Coverage report
pnpm test:coverage

# Specific test file (filename contains "filepart")
pnpm test filepart

# Only marked tests (it.only)
pnpm test:only
```

This testing approach demonstrates enterprise-level quality standards with comprehensive coverage, performance monitoring, security considerations, and maintainable patterns throughout the codebase.