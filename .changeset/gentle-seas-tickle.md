---
"@logosdx/utils": minor
---

feat(memo): implement stale-while-revalidate pattern for memoization

- Add `staleIn` option to define when cached data becomes stale
- Add `staleTimeout` option to control maximum wait time for fresh data
- Implement stale-while-revalidate behavior: return cached data immediately while fetching fresh data in background
- Fix caching issues with null/undefined/false return values using Symbol-based timeout detection
- Fix key generation for functions with no arguments
- Enhance cache handling to distinguish garbage-collected WeakRefs from legitimate undefined values
- Update comprehensive documentation across helper files, package docs, and cheat sheet
