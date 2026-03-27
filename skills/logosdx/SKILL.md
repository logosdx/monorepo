---
name: logosdx
description: Implements LogosDX patterns for DOM manipulation, HTTP clients, lifecycle hooks, events, state machines, storage adapters, i18n/localization, and React context hooks. Use when tasks involve @logosdx libraries or code that imports from @logosdx/* packages. Trigger on any mention of HookEngine, FetchEngine, ObserverEngine, ObserverRelay, StateMachine, StateHub, StorageAdapter, LocaleManager, DomCollection, or the $() selector from @logosdx/dom. Also use when the user works with attempt/attemptSync error tuples, event queues, request deduplication/caching/rate-limiting, ICU pluralization, or any LogosDX pattern — even if they don't name the package explicitly.
metadata:
  references: dom, fetch, hooks, localize, observer, state-machine, storage, react, utils
---

# LogosDX Skill

Use this skill for LogosDX setup and integration. Read only the reference file(s) needed for the task.

## Quick Start

1. Identify package scope (`dom`, `fetch`, `hooks`, `localize`, `observer`, `state-machine`, `storage`, `react`, `utils`).
2. Open the matching file from `references/`.
3. Implement with strict typing and lifecycle cleanup.
4. Run project checks (typecheck/tests) before finishing.

## Critical Rules

- Define type shapes first (`headers`, `params`, `state`, `events`, storage schema, locale shape).
- Prefer package-native error flows (`attempt`, `attemptSync`, `isFetchError`).
- Always clean up resources (`cleanup()`, `off()`, `destroy()`).
- Keep React hook methods at component top level only.

## Task Routing

| Task | Reference |
|------|-----------|
| DOM manipulation, CSS, attributes, events, behaviors, viewport | `references/dom.md` |
| Lifecycle hooks, middleware, plugins, priority chains | `references/hooks.md` |
| HTTP client, retry, cache, dedupe, rate-limit, lifecycle events | `references/fetch.md` |
| i18n, translations, ICU pluralization, Intl formatting, locale switching | `references/localize.md` |
| Typed events, async generators, queues, observation, relay | `references/observer.md` |
| Finite state machines, guards, async invoke, StateHub coordination | `references/state-machine.md` |
| Storage CRUD, key scoping, events, custom drivers | `references/storage.md` |
| React factories, hooks, provider composition, API hooks | `references/react.md` |
| Error tuples, flow control, memoization, typed helpers, unit conversion | `references/utils.md` |
| Cross-package design (start here, then open package-specific files) | `references/REFERENCE.md` |
