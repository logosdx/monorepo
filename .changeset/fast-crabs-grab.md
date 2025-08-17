---
"@logosdx/fetch": minor
---

feat(fetch): add global instance and dynamic request modifiers

- Add default global fetch instance for simplified usage without creating custom instances
- Export individual methods (get, post, put, etc.) for convenient destructuring
- Add smart URL handling - absolute URLs now bypass base URL configuration
- Add `changeModifyOptions()` method to dynamically update global request modifiers at runtime
- Add `changeModifyMethodOptions()` method to set method-specific modifiers dynamically
- Add new events: `fetch-modify-options-change` and `fetch-modify-method-options-change`
- Change default state type from `{}` to `FetchEngine.InstanceState` for better TypeScript support
- Global instance automatically uses current domain as base URL (or fallback to logosdx.dev)

