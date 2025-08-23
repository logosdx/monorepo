# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚀 Commands

```bash
# Build/Test
pnpm build
pnpm test
pnpm tdd                    # Watch mode
pnpm test:only              # Run marked tests (it.only)
pnpm test:coverage

# Workflow
pnpm new                    # Create package
pnpm watch                  # Dev mode
pnpm build:docs
pnpm release               # Changesets

# Individual tests (from tests/)
pnpm test filepart         # Run test whose filename contains "filepart"
pnpm tdd                   # Watch specific tests
```

## 🏗️ Architecture

**Structure**: pnpm monorepo, packages build independently, test together

- `packages/`: @logosdx packages (utils, observer, fetch, dom, kit)
- `tests/`: Mirrors package structure, uses relative imports
- `llm-helpers/`: AI context guides (utils.md, observer.md, fetch.md, dom.md)

**Imports**:

```ts
// ✅ Production: package names
import { attempt } from '@logosdx/utils';

// ✅ Tests: relative paths (validates implementation, bypasses build)
import { attempt } from '../../../../packages/utils/src/index.ts';
```

## 🧠 Core Principles

**Safety**: Do not try something that might fail, except for I/O and network operations.
**Error Handling**: We prefer `attempt`/`attemptSync` instead of try-catch.
**Dogfooding**: Always use `@logosdx/utils` throughout monorepo.
**Function Structure**: Declaration → Validation → Business Logic → Commit
**Style**: Meaningful names, JSDoc that explain WHY with examples, newlines after block open.

### Syntax & Formatting

- Newline after function declaration and opening blocks:

    ```ts
    function doSomething() {

        // logic
    }

    if (condition) {

        // logic
    }
    else {

        // logic
    }

    for (const item of items) {

        // logic
    }

    while (condition) {

        // logic
    }
    ```

- Prefer vertical space over horizontal for long functions. Max 100 characters per line.
- Functions should follow this 4-block structure in order when it includes all of the following elements:
  1. Declaration: Declare everything that is needed to execute the function.
  2. Validation: Validate the input parameters (prevents failures).
  3. Business Logic: The main logic of the function.
  4. Commit: Anything that will affect the state of the application.

### Function Structure Example

```ts
async function updateUserEmail(userID: UUID, newEmail: EmailAddress): Promise<User> {

    // === Declaration block ===
    let retryCount = 0;

    // === Validation block ===
    if (!isValidEmail(newEmail)) {
        throw new InvalidEmailError();
    }

    // === Business logic block ===
    const [user, err] = await attempt(() => fetchUser(userID));
    if (err) throw err;

    const modifiedUser = modifyUserEmail(user, newEmail);

    if (someCondition(modifiedUser)) {
        somethingElse(modifiedUser);
    }

    // === Commit block ===
    const [, saveErr] = await attempt(() => saveUser(modifiedUser));
    if (saveErr) throw saveErr;

    return modifiedUser;
}
```

> [!NOTE]
> The `// ===` comments are only there for placement instructions. They should not be part of the code.

## 📋 Key Patterns

```ts
// Error tuple for I/O
const [result, err] = await attempt(() => fetch('/api'));
if (err) return handleError(err);

// Direct returns for business logic
function processData(input: Data): ProcessedData {
    if (!isValid(input)) throw new ValidationError();
    return transform(input);
}

// Class patterns
export class Engine {
    #state = new Map();
    constructor(config: Engine.Config) {
        assert(isObject(config), 'Config required');
        this.#config = clone(config);
    }
}

// Namespaced options
export namespace Engine {

    export interface Config {
        baseUrl: string;
        headers?: Headers;
        params?: Params;
    }
}

// Static utilities
export class Utils {
    static process(el: Element) {
        const [, err] = attemptSync(() => handler(el));
        if (err) console.warn('Failed:', err);
    }
}
```

## 🧪 Testing

- Use relative imports to validate implementation
- Test all paths (success, error, edge cases)
- `describe('module: feature', () => {})` naming
- Use `mock.fn()` and `calledExactly(fn, count, msg)`

```ts
const [result, err] = await attempt(() => riskyOperation());
expect(err).to.be.instanceOf(Error);
```

### Required Test Coverage

Each exported function must test:

- ✅ Happy path (expected usage)
- ✅ Error paths (network failures, invalid responses)
- ✅ Bad inputs (null, undefined, wrong types, malformed data)
- ✅ Edge cases and unintended usage patterns

## 📦 TypeScript

**Types**: Dedicated `types.ts`, `export type`, re-export from index
**Classes**: Static for stateless utils, Instance for stateful components
**Symbols**: DOM metadata only, not public APIs

```ts
export type Events<T> = keyof T;
export interface Options {
    timeout?: number;
}
```

## 🐕 Utils Usage

```ts
// Error handling
const [data, err] = await attempt(() => api.get('/users'));

// Data ops
const copy = clone(state);
const same = equals(a, b);
const merged = merge(obj1, obj2);

// Flow control
const debounced = debounce(handler, 300);
const resilient = retry(circuitBreaker(fn), { retries: 3 });

// Validation
assert(isObject(config), 'Config required');
```

## ✅ Checklist

**Required**:

- [ ] No try-catch (use attempt/attemptSync)
- [ ] @logosdx/utils for all error handling, data ops, flow control
- [ ] Relative imports in tests
- [ ] JSDoc with examples explaining WHY
- [ ] 4-block function structure
- [ ] Meaningful names that read like English

**Anti-patterns**:

- try-catch blocks
- Error tuple for pure business logic
- Missing error handling in async ops
- Package imports in tests (breaks validation)

## 🎯 Code Review Checklist

### ✅ Structure & Organization

- [ ] Follows monorepo import patterns (package names in prod, relative in tests)
- [ ] Proper file organization (types.ts, index.ts exports)
- [ ] Logical grouping of functions and classes
- [ ] Keep up the `./llm-helpers` docs up to date

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
- [ ] Tests all paths (happy, error, bad inputs, edge cases)
- [ ] Proper mock patterns with `calledExactly`

### ✅ Error Handling Patterns

- [ ] Uses error tuple (`[result, error]`) for fail-prone operations only
- [ ] Business logic functions return actual results, not error tuples
- [ ] Proper composition between error tuple and direct returns
- [ ] No `try-catch` blocks (use `attempt`/`attemptSync` for I/O)
