---
"@logosdx/hooks": major
---

Initial beta release of @logosdx/hooks - a lightweight, type-safe hook system for extending function behavior.

Features:

- `HookEngine` class for wrapping functions with before/after/error extension points
- `make()` and `wrap()` methods for creating hookable functions
- Extension options: `once`, `ignoreOnFail`
- Context methods: `setArgs`, `setResult`, `returnEarly`, `fail`, `removeHook`
- `HookError` and `isHookError()` for typed error handling
