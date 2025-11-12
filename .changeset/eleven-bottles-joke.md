---
"@logosdx/fetch": major
---

## @logosdx/fetch

### Changed

* **Breaking:** `refactor(response)`: Response headers changed from Web API `Headers` object to typed plain object with bracket notation access

    **Before:**
    ```typescript
    const response = await api.get('/users');
    const contentType = response.headers.get('content-type');
    if (response.headers.has('x-custom')) { }
    ```

    **After:**
    ```typescript
    const response = await api.get('/users');
    const contentType = response.headers['content-type'];
    if (response.headers['x-custom']) { }
    ```

    **Migration:** Replace all `.get()`, `.has()`, `.entries()` calls with bracket notation or `Object` methods. Response headers are now typed via `InstanceResponseHeaders` interface for better TypeScript support.

### Added

* `feat(lifecycle)`: Add `destroy()` method for cleaning up FetchEngine instances and preventing memory leaks
* `feat(lifecycle)`: Add `isDestroyed()` method to check if instance has been destroyed
* `feat(types)`: Add `RH` generic parameter for typed response headers via `InstanceResponseHeaders` interface

### Fixed

* `fix(memory)`: Prevent memory leaks by ensuring timeout cleanup in all code paths via finally block
* `fix(memory)`: Add instance-level AbortController for automatic event listener cleanup on destroy
