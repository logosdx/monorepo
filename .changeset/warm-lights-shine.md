---
"@logosdx/fetch": minor
---

### Added

- **Event timing data**: All request lifecycle events now include a `requestStart` timestamp (`Date.now()` captured at pipeline entry). Terminal events (`response`, `error`, `abort`) also include a `requestEnd` timestamp, enabling duration calculation directly from event data.

```typescript
engine.on('response', (event) => {
    const duration = event.requestEnd - event.requestStart;
    console.log(`Request completed in ${duration}ms`);
});
```

| Event | `requestStart` | `requestEnd` |
|-------|:-:|:-:|
| `before-request` | yes | - |
| `after-request` | yes | - |
| `retry` | yes | - |
| `response` | yes | yes |
| `error` | yes | yes |
| `abort` | yes | yes |
