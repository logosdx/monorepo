---
"@logosdx/fetch": minor
---

Per-call retry config now wins in both directions, and `skipCache` is a typed call option

- A per-call `retry` config now overrides an engine-level `retry: false` (previously the engine-level `false` silently vetoed it). Per-call `retry: false` continues to disable retries for a single request.
- `skipCache: true` is now a typed, documented `CallConfig` option: bypass the response cache for one request — no lookup, no store. It previously worked but was absent from the types.
