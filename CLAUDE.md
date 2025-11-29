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

## 📦 Release Cycle


**We use [Changesets](https://github.com/changesets/changesets) with a `release` branch workflow.**

### Quick Reference

    ```bash
    # 1. Create changeset for your changes
    pnpm changeset

    # 2. Commit and push to master
    git add . && git commit -m "feat: description" && git push

    # 3. CI creates "Version Packages" PR - review and merge to master

    # 4. Merge master to release branch
    git checkout release && git merge master && git push origin release

    # 5. CI automatically: Tests → Publishes → Updates docs
    ```

### Detailed Flow

1. **Create Changeset**: `pnpm changeset` - describes changes and version bump
2. **Push to Master**: CI runs tests and creates "Version Packages" PR
3. **Review PR**: Verify versions and changelogs are correct
4. **Merge to Release**: `release` branch triggers automated publish workflow
5. **Automated CI**: Runs tests, publishes to npm, updates documentation

**See [CONTRIBUTING.md](./CONTRIBUTING.md) for complete release documentation.**

## 🏗️ Architecture

**Structure**: pnpm monorepo, packages build independently, test together

### Repository Structure Overview

```
monorepo/
├── packages/                    # 8 @logosdx packages in layered architecture
│   ├── utils/                  # Foundation layer (all packages depend on this)
│   ├── dom/                    # Browser utilities (depends on utils)
│   ├── fetch/                  # HTTP client (depends on utils)
│   ├── observer/               # Event system (depends on utils)
│   ├── localize/               # i18n system (depends on utils)
│   ├── state-machine/          # State management (depends on utils)
│   ├── storage/                # Persistence layer (depends on utils)
│   └── kit/                    # Orchestrator (depends on all above)
│
├── tests/                       # Comprehensive test suite
│   ├── src/                    # Test files mirroring package structure
│   ├── benchmark/              # Performance tests (250k ops, memory monitoring)
│   └── package.json            # Test dependencies (vitest, sinon, jsdom, fast-check)
│
├── docs/                       # VitePress documentation + TypeDoc integration
│   ├── packages/               # Individual package documentation
│   ├── public/images/          # Brand assets and static files
│   └── *.md                    # Getting started, philosophy, cheat sheets
│
├── llm-helpers/                # AI context guides for each package
├── scripts/                    # Build, documentation, and workflow scripts
├── internals/                  # Internal utilities and templates
├── typedoc/                    # Generated API documentation
└── CLAUDE.md                   # This file - development guidance
```

### Package Dependency Architecture

```
@logosdx/kit (orchestrator - depends on all)
    ├── @logosdx/fetch ──────────┐
    ├── @logosdx/localize ───────┤
    ├── @logosdx/observer ───────┤──── @logosdx/utils (foundation)
    ├── @logosdx/state-machine ──┤
    ├── @logosdx/storage ────────┤
    └── @logosdx/dom ────────────┘
```

**Key Architectural Principles:**
- **Foundation Layer**: `@logosdx/utils` provides core utilities used by all packages
- **Specialized Layers**: Each package focuses on specific domain (HTTP, DOM, events, etc.)
- **Orchestration Layer**: `@logosdx/kit` provides unified API and conditional instantiation
- **Zero Circular Dependencies**: Clean dependency tree with utils as foundation
- **Event-Driven Integration**: Most packages integrate with observer system

### Folder-Specific Purposes

| Folder | Purpose | Key Files | Memory File |
|--------|---------|-----------|-------------|
| `packages/` | Production code packages | `src/index.ts`, `package.json`, `tsconfig.json` | `/packages/CLAUDE.md` |
| `tests/` | Validation test suite with relative imports | `src/`, `_helpers.ts`, `benchmark/` | `/tests/CLAUDE.md` |
| `docs/` | VitePress documentation with TypeDoc integration | `*.md`, `packages/*.md`, `public/` | `/docs/CLAUDE.md` |
| `llm-helpers/` | AI context guides | `utils.md`, `fetch.md`, `observer.md`, `dom.md` | - |
| `scripts/` | Build and deployment | `build.mjs`, `docs.zsh`, `new-pkg.zsh` | - |
| `typedoc/` | Generated API documentation | Auto-generated HTML files | - |

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
- Use `vi.fn()` and `calledExactly(fn, count, msg)`

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

## ✅ Checklist

**Required**:

- [ ] Prefer attempt/attemptSync over try-catch
- [ ] Validate anything that will be used in business logic
- [ ] Do not try-catch (or attempt()) business logic, only I/O operations
- [ ] Use @logosdx/utils for all error handling, data ops, flow control
- [ ] Relative imports in tests
- [ ] JSDoc with examples explaining WHY
- [ ] 4-block function structure
- [ ] Meaningful names that read in clear English

**Anti-patterns**:

- [ ] Error tuple for pure business logic
- [ ] Missing error handling in async ops
- [ ] Package imports in tests (breaks validation)
- [ ] Writing or documenting "backwards compatibility" unless explicitly asked for

## 🎯 Code Review Checklist

### ✅ Structure & Organization

- [ ] Follows monorepo import patterns (package names in prod, relative in tests)
- [ ] Proper file organization (types.ts, index.ts exports)
- [ ] Logical grouping of functions and classes
- [ ] Keep up the `./llm-helpers` docs up to date
- [ ] Doesn't keep legacy code around

### ✅ TypeScript Standards

- [ ] No `try-catch` blocks (use `attempt`/`attemptSync`)
- [ ] Proper function structure (4-block pattern)
- [ ] Meaningful names that read like English
- [ ] JSDoc with examples and WHY explanations

### ✅ Dogfooding

- [ ] Uses `@logosdx/utils` for error handling, data operations, flow control
- [ ] Demonstrates best practices in examples

### ✅ Testing

- [ ] Uses relative imports in tests
- [ ] Tests all paths (happy, error, bad inputs, edge cases)
- [ ] Tests somewhat mirror source structure
