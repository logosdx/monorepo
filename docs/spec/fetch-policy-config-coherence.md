# Fetch policy config coherence


## Goal


Every FetchEngine config surface — runtime `config.set()`, per-call overrides, response metadata, convenience methods, and construction-time policy keys — drives the same behavior it reports. No path lets config say one thing while the request does another.


## Non-goals


- No per-call `skipDedupe` / `skipRateLimit` options.
- No extraction of the attempt-timeout machinery out of the retry plugin.
- No runtime mutation surface for custom (non-policy) plugins.
- No changes to `@logosdx/utils`.


## Success criteria


- [ ] `FetchPlugin` gains an optional `reconfigure` member; a plugin that doesn't implement it is unaffected by a `config.set()` targeting its key.
- [ ] A runtime `config.set()` of a policy key whose plugin was installed via the `plugins:` array throws, matching the construction-time ownership rule.
- [ ] `config.set('retry.maxAttempts', …)` after construction changes the attempt count used on the next request.
- [ ] `config.set()` against rate-limit, cache, or dedupe config rebuilds that policy's rule cache/state per its existing `init()` semantics (e.g. a new rate-limit budget produces fresh buckets).
- [ ] `config.set()` against the cache plugin's TTLs, rules, or methods reconfigures in place without evicting entries already in the request-flight store; a `config.set()` that changes the cache plugin's adapter throws instead of rebuilding the store.
- [ ] `attemptTimeout` aborts an individual attempt under `retry: false` (or `maxAttempts: 0`) the same way it does when retrying is enabled.
- [ ] `clearCache`, `clearCacheKey`, `deleteCache`, `invalidateCache`, `invalidatePath`, and `cacheStats` operate correctly when the cache/dedupe plugin is installed via the `plugins:` array or a post-construction `engine.use()` call, instead of only the config key.
- [ ] `res.config.retry` on a response reflects the retry configuration actually used for that request, including a per-call override.
- [ ] A falsy explicit config key (e.g. `dedupePolicy: false`) plus the same-name plugin in `plugins:` warns once at construction and installs the plugin, instead of throwing.
- [ ] A truthy explicit config key plus the same-name plugin still throws at construction.


## Approach


Optional `reconfigure` hook on `FetchPlugin`, invoked by the engine on its own `config-change` event; each divergence point (F2-F5) fixed at its own source — see `docs/design/fetch-policy-config-coherence.md`.


## Change tree


    packages/fetch/src/
    ├── engine/
    │   ├── types.ts ................ M  (FetchPlugin: optional reconfigure member)
    │   ├── index.ts ................ M  (config-change subscription + routing; runtime ownership-conflict throw; #cachePlugin/#dedupePlugin refs captured from any install path; falsy-key + plugin warns instead of throwing)
    │   └── executor.ts ............. M  (response config attachment uses the per-request resolved retry config)
    └── plugins/
        ├── retry.ts ................ M  (reconfigure; zero-attempts path normalized through per-attempt wiring; resolution reused for response metadata)
        ├── rate-limit.ts ........... M  (reconfigure)
        ├── cache.ts ................ M  (reconfigure)
        ├── dedupe.ts ................ M  (reconfigure)
        └── cookies/plugin.ts ....... M  (reconfigure)

    tests/src/fetch/
    ├── engine/plugin-resolution.test.ts ....... M  (runtime set() ownership conflict; convenience methods across install paths; falsy-key + plugin warns and installs)
    ├── engine/configuration.test.ts ........... M  (config.set() changes behavior per policy; cache TTLs/rules/methods survive in place; adapter-changing set() throws)
    ├── executor/retry.test.ts ................. M  (attemptTimeout fires under retry: false)
    └── executor/per-call-overrides.test.ts .... M  (res.config.retry reflects the per-call resolved retry config)


## Outline


    packages/fetch/src/engine/types.ts
      FetchPlugin
        reconfigure — optional; invoked when the plugin's owned config key changes

    packages/fetch/src/engine/index.ts
      config-change subscription — routes a changed policy key to its installed plugin's reconfigure
      ownership-conflict check on set() — throws when the changed key's plugin came from the plugins: array, mirroring the construction-time rule
      #resolvePlugins / #buildPluginsFromOptions — capture cache/dedupe plugin refs regardless of install path
      use() ref capture — captures #cachePlugin/#dedupePlugin refs when the matching plugin is installed post-construction via use()
      falsy/truthy construction conflict check — distinguishes falsy from truthy explicit keys: falsy + same-name plugin warns once and installs; truthy + same-name plugin still throws

    packages/fetch/src/engine/executor.ts
      response config attachment — reports the retry config actually resolved for the current request instead of the engine-level default

    packages/fetch/src/plugins/retry.ts
      resolveRetryConfig — merges a per-call override over the current base config; reused by the executor's response metadata
      reconfigure — replaces the resolved base config when the retry key changes
      zero-attempts path — runs through the same per-attempt controller/timer wiring as the retry loop, so attemptTimeout always applies

    packages/fetch/src/plugins/rate-limit.ts
      RateLimitPolicy
        reconfigure — re-runs init() with the updated config, rebuilding rule cache and token buckets

    packages/fetch/src/plugins/cache.ts
      cachePlugin
        reconfigure — re-runs CachePolicy.init() with updated TTLs, rules, and methods; the wrapped SingleFlight store survives untouched; throws if the update changes the adapter, since SingleFlight binds its adapter at construction and cannot swap stores without dropping entries

    packages/fetch/src/plugins/dedupe.ts
      DedupePolicy
        reconfigure — re-runs init() with the updated config, rebuilding rule cache

    packages/fetch/src/plugins/cookies/plugin.ts
      reconfigure — applies an updated adapter/syncOnRequest/exclude without clearing the existing jar

    tests/src/fetch/engine/plugin-resolution.test.ts
      runtime set() on a plugins:-owned policy key throws
      cache/dedupe convenience methods work when installed via plugins: array or a post-construction use() call
      falsy config key + same-name plugin warns and installs; truthy key + plugin still throws

    tests/src/fetch/engine/configuration.test.ts
      config.set() on retry/rate-limit/cache/dedupe changes behavior on the next request
      cache entries survive a config.set() against TTLs, rules, or methods
      config.set() that changes the cache adapter throws

    tests/src/fetch/executor/retry.test.ts
      attemptTimeout aborts an attempt under retry: false / maxAttempts: 0

    tests/src/fetch/executor/per-call-overrides.test.ts
      res.config.retry reflects a per-call retry override


## Flows


    Flow: runtime policy reconfiguration
    1. caller calls engine.config.set(...) on a policy key (retry, rate-limit, cache, dedupe, or cookies)
    2. ConfigStore updates the stored config and emits config-change with the changed path
    3. the engine's config-change listener resolves the plugin owning that key; if it came from the plugins: array, the listener throws the same ownership-conflict message construction-time throws
    4. if the key is cachePolicy and the new value changes the adapter, the listener throws (the adapter is construction-only; a new adapter requires a new engine)
    5. otherwise the engine calls that plugin's reconfigure with the updated value
    6. the plugin rebuilds via its existing init() (or, for retry, replaces its resolved base config); subsequent requests observe the new behavior

    Flow: attemptTimeout fires with retrying disabled
    1. caller sets retry: false (engine-level or per-call), which resolves to maxAttempts: 0
    2. the request enters the retry plugin's execute hook with attemptTimeout set
    3. the zero-attempts path runs through the same per-attempt controller/timer wiring the multi-attempt loop uses
    4. the attempt aborts at attemptTimeout regardless of retry count; the resulting error carries timedOut: true

    Flow: cache/dedupe convenience methods across install paths
    1. the cache or dedupe plugin is installed via its config key, the plugins: array, or a post-construction use() call
    2. plugin resolution captures a reference to the installed plugin regardless of which path supplied it
    3. caller invokes a convenience method (e.g. clearCache, cacheStats)
    4. the method operates against the captured reference instead of silently no-oping

    Flow: response retry metadata matches request behavior
    1. caller issues a request with (or without) a per-call retry override
    2. the executor resolves the effective retry config for that request using the same resolution the retry plugin applies
    3. the response's config.retry field is populated with that resolved value
    4. the reported config always matches the retry behavior the request actually ran with

    Flow: falsy config key with a same-name plugin
    1. caller constructs an engine with a falsy explicit policy key (e.g. dedupePolicy: false) and a same-name plugin in plugins:
    2. plugin resolution sees the key configured nothing and the same-name plugin present
    3. a warning is logged once, naming the key and the plugin
    4. the plugin installs and becomes the sole owner of that policy; construction does not throw


## Checkpoints


| # | Checkpoint | Files/areas | Agent | Est. files | Verifies |
|---|------------|-------------|-------|------------|----------|
| 1 | F1 — reconfigure plumbing: plugin contract member, engine subscription, runtime ownership-conflict throw | `engine/types.ts`, `engine/index.ts`, `tests/.../engine/plugin-resolution.test.ts` | atomic-implementer (mode: feature) | ~3 | runtime `set()` on a `plugins:`-owned policy key throws; a plugin without `reconfigure` is unaffected |
| 2 | F1 — per-policy reconfigure wiring: retry, rate-limit, cache, dedupe, cookies | `plugins/retry.ts`, `plugins/rate-limit.ts`, `plugins/cache.ts`, `plugins/dedupe.ts`, `plugins/cookies/plugin.ts`, `tests/.../engine/configuration.test.ts` | atomic-implementer (mode: feature) | ~6 | `config.set()` on each policy key changes behavior on the next request; cache TTLs/rules/methods reconfigure in place while the store survives; a `config.set()` that changes the cache adapter throws |
| 3 | F2 — attemptTimeout wired through the zero-attempts retry path | `plugins/retry.ts`, `tests/.../executor/retry.test.ts` | atomic-implementer (mode: surgical) | ~2 | `attemptTimeout` aborts an attempt under `retry: false` the same way it does under retrying |
| 4 | F3 — cache/dedupe convenience methods work for any install path | `engine/index.ts`, `tests/.../engine/plugin-resolution.test.ts` | atomic-implementer (mode: surgical) | ~2 | convenience methods act on the plugin regardless of whether it came from a config key, `plugins:`, or a post-construction `use()` call |
| 5 | F4 — response retry metadata matches per-request resolution | `engine/executor.ts`, `plugins/retry.ts`, `tests/.../executor/per-call-overrides.test.ts` | atomic-implementer (mode: surgical) | ~3 | `res.config.retry` reflects the per-call resolved retry config, not the engine default |
| 6 | F5 — falsy config key + same-name plugin warns and installs | `engine/index.ts`, `tests/.../engine/plugin-resolution.test.ts` | atomic-implementer (mode: surgical) | ~2 | falsy key + same-name plugin warns once and installs; truthy key + plugin still throws |


## Risks


| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| Reconfiguring a policy mid-flight changes behavior for requests already in progress | med | requests resolve their own options at start; reconfigure rebuilds state for requests started after the `set()` call, not in-flight ones |
| cookies `reconfigure` accidentally clears cookies already loaded into the jar | med | reconfigure replaces only adapter/syncOnRequest/exclude; the jar's contents are left untouched |
| Sharing retry resolution between the plugin and the executor drifts apart over time | low | both call sites resolve through the same function/state; checkpoint 5's test asserts the reported config equals the config the request ran with |
| New test-server ports collide with existing allocations | low | existing suite uses 4121-4142 and 4300-4303; new tests pick unused ports outside that range |


## Change log

<!-- Populated on first amendment after the spec is approved. Do not log drafting/refinement turns. -->
