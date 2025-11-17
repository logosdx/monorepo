---
"@logosdx/utils": major
"@logosdx/kit": major
---

# @logosdx/utils Major Reorganization & API Improvements

## Utils Package

### Changed

* **Breaking:** `refactor(config): makeNestedConfig now returns object with allConfigs() and getConfig(path, default) methods instead of single overloaded function`
    * **Old API**: `config()` returned full config, `config('path')` accessed nested value
    * **New API**: `config.allConfigs()` returns full config, `config.getConfig('path', default?)` accesses nested value
    * **Rationale**: Eliminates confusing function overload, provides clearer API surface
    * **Migration**: Replace `config()` → `config.allConfigs()`, `config('path')` → `config.getConfig('path')`

* `refactor(structure): reorganized internal module structure for better discoverability`
    * Moved async operations (`attempt`, `retry`, `batch`, `inflight`) to dedicated `async/` directory
    * Split `validation.ts` into focused modules: `type-guards.ts`, `assert.ts`, `comparisons.ts`, `environment.ts`, `values.ts`
    * Split `misc.ts` into domain-specific modules: `misc/index.ts`, `array-utils/`, `object-utils/`
    * Split `units.ts` into `units/time.ts` and `units/bytes.ts`
    * Updated all internal imports to reflect new structure

### Added

* `feat(config): new castValuesToTypes() function for type coercion from environment variables`
    * Supports `parseUnits` option for parsing time durations ('5m', '1hour') and byte sizes ('10mb', '100gb')
    * Supports `skipConversion` callback for selective value preservation (e.g., API keys)
    * Recursively processes nested objects
    * Mutates input object in-place for performance

* `feat(config): new makeNestedConfig() with enhanced configuration loading`
    * Converts flat environment variable structures to nested objects
    * Supports custom separators, prefix stripping, and casing control
    * Optional memoization support via `memoizeOpts`
    * Improved error messages for configuration conflicts

* `feat(array-utils): extracted array utilities to dedicated module`
    * `itemsToArray()`: Normalizes single items to arrays
    * `oneOrMany()`: Unwraps single-item arrays
    * `chunk()`: Splits arrays into batches

* `feat(object-utils): extracted object utilities to dedicated module`
    * `reach()`: Deep property access with dot notation
    * `setDeep()`: Deep property setting with automatic intermediate object creation
    * `setDeepMany()`: Batch deep property setting

### Fixed

* `fix(imports): updated all cross-module imports to use new structure`
    * Flow control modules now import from `../async/`
    * All modules now import validation from `../validation/index.ts`
    * Memoization imports updated for new async location

## Kit Package

### Changed

* `refactor(deps): updated to support new @logosdx/utils major version`
    * No API changes to kit itself
    * Compatible with reorganized utils structure

---

**Testing**: All 121 tests pass, including 26 comprehensive tests for `makeNestedConfig` covering all options and edge cases.

**Migration Guide**:

```typescript
// Before (v1.x)
const config = makeNestedConfig(process.env, opts);
const fullConfig = config();
const dbHost = config('db.host');

// After (v2.x)
const config = makeNestedConfig(process.env, opts);
const fullConfig = config.allConfigs();
const dbHost = config.getConfig('db.host');
const dbHostWithDefault = config.getConfig('db.host', 'localhost');
```
