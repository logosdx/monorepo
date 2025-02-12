---
"@logos-ui/state-machine": major
"@logos-ui/localize": major
"@logos-ui/observer": major
"@logos-ui/storage": major
"@logos-ui/fetch": major
"@logos-ui/dom": major
"@logos-ui/kit": major
---

# Better semantics

Rename classes to use more precise and semantic names.

- `FetchFactory` -> `FetchEngine`
- `ObserverFactory` -> `ObserverEngine`
- `LocaleFactory` -> `LocaleManager`
- `StorageFactory` -> `StorageAdapter`

Why? Because these abstractions aren't factories, they are engines or adapters. They provide a way to interact with a specific system in a highly configurable way. It's more accurate to call them engines or adapters or managers.
