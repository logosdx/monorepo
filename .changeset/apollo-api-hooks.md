---
"@logosdx/react": minor
---

## Added

* `feat(api):` Apollo-style `useQuery`, `useMutation`, and `useAsync` hooks with auto-fetch, reactive config, polling, and cancellation
* `feat(api):` `createQuery` and `createMutation` factory functions for reusable pre-bound hooks
* `feat(api):` `createApiHooks` binding that pre-wires FetchEngine and ObserverEngine to all API hooks
* `feat(api):` ObserverEngine integration — `invalidateOn` for automatic refetch on events, `emitOnSuccess` for mutation-driven event emission
* `feat(api):` New `@logosdx/react/api` subpath export
