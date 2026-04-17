---
"@logosdx/fetch": minor
---

## Added

* `feat(cookies):` RFC 6265-compliant cookiePlugin for FetchEngine — captures `Set-Cookie` response headers and injects matching `Cookie` request headers transparently
* `feat(cookies):` CookieJar with full §5.3 storage model — duplicate handling, expiry eviction, per-domain and total limits (4096 bytes/cookie, 50/domain, 3000 total)
* `feat(cookies):` CookieAdapter interface for pluggable persistence (Redis, localStorage, filesystem) with syncOnRequest for horizontal scaling
* `feat(cookies):` Microtask-coalesced persistence — any burst of jar mutations produces exactly one adapter.save() per tick
* `feat(cookies):` Explicit flush() for graceful shutdown that surfaces adapter rejections
* `feat(cookies):` RFC 6265-compliant date parser (§5.1.1), domain matching (§5.1.3), path matching (§5.1.4), and Cookie header construction (§5.4)
* `feat(cookies):` MemoryAdapter reference implementation; documented patterns for localStorage and Redis adapters

## Changed

* `feat(fetch):` `cookies` config shorthand on `FetchEngine` — `cookies: true` enables the jar without importing `cookiePlugin` directly
* `feat(fetch):` `FetchResponse.headers` now preserves multi-value `Set-Cookie` headers as `string[]` (via `Headers.prototype.getSetCookie()` where available) instead of collapsing them into a comma-joined string
