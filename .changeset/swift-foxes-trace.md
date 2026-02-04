---
"@logosdx/fetch": minor
---

### Added

* `feat(fetch):` Add `requestIdHeader` engine config option for automatic request ID header injection, enabling end-to-end distributed tracing without manual `modifyConfig` wiring
* `feat(fetch):` Add per-request `requestId` option to `CallConfig`, allowing callers to override the auto-generated ID with an external trace ID from upstream services
* `feat(fetch):` Add `stream` option to `CallConfig` for returning raw `Response` objects with unconsumed body streams — cache and deduplication are skipped while rate limiting and lifecycle events still fire

```typescript
// Distributed tracing
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    requestIdHeader: 'X-Request-Id'
});

// Auto-generated ID sent as header + available in all events
await api.get('/orders');

// Override with upstream trace ID for end-to-end correlation
await api.get('/orders', { requestId: incomingTraceId });

// Stream mode — raw Response with unconsumed body
const { data: response } = await api.get('/sse', { stream: true });
const reader = response.body.getReader();
```
