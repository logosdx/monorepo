# LogosDX Reference Index

Use this index to pick the smallest LogosDX reference file that matches the task.

## Package Guides

| Package | File | Use For |
|---|---|---|
| `@logosdx/dom` | `references/dom.md` | DOM manipulation, CSS styles, attributes, event handling, declarative behaviors, viewport/scroll utilities |
| `@logosdx/hooks` | `references/hooks.md` | Lifecycle hooks, middleware chains, priority ordering, plugins, pre/post wrapping, short-circuit control flow |
| `@logosdx/fetch` | `references/fetch.md` | HTTP client setup, retries, timeout behavior, dedupe/cache/rate-limit policies, request lifecycle events |
| `@logosdx/observer` | `references/observer.md` | Typed events, regex matching, async generators, event queues, component observation |
| `@logosdx/storage` | `references/storage.md` | Typed storage CRUD, key wrappers, storage events, custom storage implementations |
| `@logosdx/react` | `references/react.md` | Context factories, hook API behavior, provider composition, engine integration in React |
| `@logosdx/utils` | `references/utils.md` | Error tuple handling, retries/timeouts/rate control, memoization, data helpers, unit parsing/formatting helpers, TypeScript utility types |

## Common Task Routing

- Manipulate DOM elements, styles, attributes, or behaviors: read `references/dom.md`
- Add lifecycle hooks, middleware, or plugin systems: read `references/hooks.md`
- Build a resilient API client: read `references/fetch.md`
- Add a domain event bus or queue processor: read `references/observer.md`
- Persist and react to local/session state changes: read `references/storage.md`
- Wire engines into UI components: read `references/react.md`
- Standardize error handling and utility workflows: read `references/utils.md`
- Parse/format time and byte units (`parseTimeDuration`, `parseByteSize`, `formatTimeDuration`, `formatByteSize`): read `references/utils.md`
- Orchestrate multiple LogosDX packages in one app: read `references/react.md` and then package-specific files you touch

## Suggested Reading Order

1. Start with this file.
2. Open one package file for the immediate task.
3. Open additional package files only when cross-package integration is required.
