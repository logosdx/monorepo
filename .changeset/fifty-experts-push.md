---
"@logosdx/utils": minor
---

feat(flow-control): add in-flight promise deduplication with withInflightDedup

- Add `withInflightDedup()` utility for concurrent promise deduplication - shares in-flight promises across concurrent calls with identical arguments, with no post-settlement caching
- Add lifecycle hooks (onStart, onJoin, onResolve, onReject) for observability and monitoring
- Add custom `keyFn` option for performance-critical hot paths and extracting discriminating fields
- Integrate `withInflightDedup` into `composeFlow` as fifth flow control primitive alongside retry, timeout, rate-limit, and circuit-breaker
- Fix serializer bugs: consistent object key ordering, proper WeakSet cleanup, circular reference handling
- Add comprehensive type support to serializer: BigInt, Symbol, Error, WeakMap/WeakSet, -0 distinction, NaN, Infinity
- Add 58 new tests (32 inflight deduplication + 21 serializer + 5 integration tests)
- Update documentation in utils.md, cheat-sheet.md, and llm-helpers/utils.md
