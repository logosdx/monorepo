# @logosdx/kit

## 2.0.0

### Major Changes

- 96fe247: # @logosdx/utils Major Reorganization & API Improvements

  ## Utils Package

  ### Changed

  - **Breaking:** `refactor(config): makeNestedConfig now returns object with allConfigs() and getConfig(path, default) methods instead of single overloaded function`

    - **Old API**: `config()` returned full config, `config('path')` accessed nested value
    - **New API**: `config.allConfigs()` returns full config, `config.getConfig('path', default?)` accesses nested value
    - **Rationale**: Eliminates confusing function overload, provides clearer API surface
    - **Migration**: Replace `config()` → `config.allConfigs()`, `config('path')` → `config.getConfig('path')`

  - `refactor(structure): reorganized internal module structure for better discoverability`
    - Moved async operations (`attempt`, `retry`, `batch`, `inflight`) to dedicated `async/` directory
    - Split `validation.ts` into focused modules: `type-guards.ts`, `assert.ts`, `comparisons.ts`, `environment.ts`, `values.ts`
    - Split `misc.ts` into domain-specific modules: `misc/index.ts`, `array-utils/`, `object-utils/`
    - Split `units.ts` into `units/time.ts` and `units/bytes.ts`
    - Updated all internal imports to reflect new structure

  ### Added

  - `feat(config): new castValuesToTypes() function for type coercion from environment variables`

    - Supports `parseUnits` option for parsing time durations ('5m', '1hour') and byte sizes ('10mb', '100gb')
    - Supports `skipConversion` callback for selective value preservation (e.g., API keys)
    - Recursively processes nested objects
    - Mutates input object in-place for performance

  - `feat(config): new makeNestedConfig() with enhanced configuration loading`

    - Converts flat environment variable structures to nested objects
    - Supports custom separators, prefix stripping, and casing control
    - Optional memoization support via `memoizeOpts`
    - Improved error messages for configuration conflicts

  - `feat(array-utils): extracted array utilities to dedicated module`

    - `itemsToArray()`: Normalizes single items to arrays
    - `oneOrMany()`: Unwraps single-item arrays
    - `chunk()`: Splits arrays into batches

  - `feat(object-utils): extracted object utilities to dedicated module`
    - `reach()`: Deep property access with dot notation
    - `setDeep()`: Deep property setting with automatic intermediate object creation
    - `setDeepMany()`: Batch deep property setting

  ### Fixed

  - `fix(imports): updated all cross-module imports to use new structure`
    - Flow control modules now import from `../async/`
    - All modules now import validation from `../validation/index.ts`
    - Memoization imports updated for new async location

  ## Kit Package

  ### Changed

  - `refactor(deps): updated to support new @logosdx/utils major version`
    - No API changes to kit itself
    - Compatible with reorganized utils structure

  ***

  **Testing**: All 121 tests pass, including 26 comprehensive tests for `makeNestedConfig` covering all options and edge cases.

  **Migration Guide**:

  ```typescript
  // Before (v1.x)
  const config = makeNestedConfig(process.env, opts);
  const fullConfig = config();
  const dbHost = config("db.host");

  // After (v2.x)
  const config = makeNestedConfig(process.env, opts);
  const fullConfig = config.allConfigs();
  const dbHost = config.getConfig("db.host");
  const dbHostWithDefault = config.getConfig("db.host", "localhost");
  ```

### Patch Changes

- Updated dependencies [96fe247]
  - @logosdx/utils@3.0.0
  - @logosdx/fetch@5.0.3
  - @logosdx/localize@1.0.16
  - @logosdx/observer@2.0.12
  - @logosdx/state-machine@1.0.16
  - @logosdx/storage@1.0.16

## 1.0.20

### Patch Changes

- Updated dependencies [6416ac4]
  - @logosdx/utils@2.5.0
  - @logosdx/fetch@5.0.2
  - @logosdx/localize@1.0.15
  - @logosdx/observer@2.0.11
  - @logosdx/state-machine@1.0.15
  - @logosdx/storage@1.0.15

## 1.0.19

### Patch Changes

- Updated dependencies [8fda604]
  - @logosdx/utils@2.4.0
  - @logosdx/fetch@5.0.1
  - @logosdx/localize@1.0.14
  - @logosdx/observer@2.0.10
  - @logosdx/state-machine@1.0.14
  - @logosdx/storage@1.0.14

## 1.0.18

### Patch Changes

- Updated dependencies [ba282ad]
  - @logosdx/fetch@5.0.0

## 1.0.17

### Patch Changes

- Updated dependencies [9edb1c4]
- Updated dependencies [6560f02]
  - @logosdx/observer@2.0.9
  - @logosdx/utils@2.3.0
  - @logosdx/fetch@4.0.1
  - @logosdx/localize@1.0.13
  - @logosdx/state-machine@1.0.13
  - @logosdx/storage@1.0.13

## 1.0.16

### Patch Changes

- Updated dependencies [0cf6edd]
- Updated dependencies [0cf6edd]
- Updated dependencies [0cf6edd]
- Updated dependencies [0cf6edd]
  - @logosdx/utils@2.2.0
  - @logosdx/fetch@4.0.0
  - @logosdx/localize@1.0.12
  - @logosdx/observer@2.0.8
  - @logosdx/state-machine@1.0.12
  - @logosdx/storage@1.0.12

## 1.0.15

### Patch Changes

- Updated dependencies [9e6afcd]
- Updated dependencies [e1c0ba2]
  - @logosdx/utils@2.1.2
  - @logosdx/fetch@3.0.1
  - @logosdx/localize@1.0.11
  - @logosdx/observer@2.0.7
  - @logosdx/state-machine@1.0.11
  - @logosdx/storage@1.0.11

## 1.0.14

### Patch Changes

- Updated dependencies [7fdab75]
  - @logosdx/fetch@3.0.0

## 1.0.13

### Patch Changes

- Updated dependencies [fdec519]
  - @logosdx/fetch@2.0.0

## 1.0.12

### Patch Changes

- Updated dependencies [cd91503]
  - @logosdx/fetch@1.2.0

## 1.0.11

### Patch Changes

- Updated dependencies [c6a8fd2]
  - @logosdx/observer@2.0.6

## 1.0.10

### Patch Changes

- Updated dependencies [2c6c8cc]
  - @logosdx/utils@2.1.1
  - @logosdx/fetch@1.1.5
  - @logosdx/localize@1.0.10
  - @logosdx/observer@2.0.5
  - @logosdx/state-machine@1.0.10
  - @logosdx/storage@1.0.10

## 1.0.9

### Patch Changes

- Updated dependencies [755e80d]
  - @logosdx/utils@2.1.0
  - @logosdx/fetch@1.1.4
  - @logosdx/localize@1.0.9
  - @logosdx/observer@2.0.4
  - @logosdx/state-machine@1.0.9
  - @logosdx/storage@1.0.9

## 1.0.8

### Patch Changes

- Updated dependencies [cbd0e23]
  - @logosdx/utils@2.0.3
  - @logosdx/fetch@1.1.3
  - @logosdx/localize@1.0.8
  - @logosdx/observer@2.0.3
  - @logosdx/state-machine@1.0.8
  - @logosdx/storage@1.0.8

## 1.0.7

### Patch Changes

- eecc5d4: Export type so they aren't compiled into ESM files
- Updated dependencies [eecc5d4]
  - @logosdx/fetch@1.1.2
  - @logosdx/localize@1.0.7
  - @logosdx/observer@2.0.2
  - @logosdx/state-machine@1.0.7
  - @logosdx/storage@1.0.7
  - @logosdx/utils@2.0.2

## 1.0.6

### Patch Changes

- 43b3457: ### Fixed

  - Export bug from utils.
  - Better naming for options

- Updated dependencies [43b3457]
  - @logosdx/fetch@1.1.1
  - @logosdx/localize@1.0.6
  - @logosdx/observer@2.0.1
  - @logosdx/state-machine@1.0.6
  - @logosdx/storage@1.0.6
  - @logosdx/utils@2.0.1

## 1.0.5

### Patch Changes

- Updated dependencies [68b2d8b]
  - @logosdx/observer@2.0.0
  - @logosdx/utils@2.0.0
  - @logosdx/fetch@1.1.0
  - @logosdx/localize@1.0.5
  - @logosdx/state-machine@1.0.5
  - @logosdx/storage@1.0.5

## 1.0.4

### Patch Changes

- 062ceab: Missed update
- Updated dependencies [062ceab]
  - @logosdx/fetch@1.0.4
  - @logosdx/localize@1.0.4
  - @logosdx/observer@1.0.4
  - @logosdx/state-machine@1.0.4
  - @logosdx/storage@1.0.4

## 1.0.3

### Patch Changes

- a84138b: Force release due to bad build
- Updated dependencies [1dcc2d1]
- Updated dependencies [a84138b]
  - @logosdx/utils@1.1.0
  - @logosdx/fetch@1.0.3
  - @logosdx/localize@1.0.3
  - @logosdx/observer@1.0.3
  - @logosdx/state-machine@1.0.3
  - @logosdx/storage@1.0.3

## 1.0.2

### Patch Changes

- 0704421: publish .d.ts files
- Updated dependencies [0704421]
  - @logosdx/state-machine@1.0.2
  - @logosdx/localize@1.0.2
  - @logosdx/observer@1.0.2
  - @logosdx/storage@1.0.2
  - @logosdx/fetch@1.0.2
  - @logosdx/utils@1.0.2

## 1.0.0

### Major Changes

- b051504: Re-release as LogosDX

### Patch Changes

- Updated dependencies [b051504]
  - @logosdx/fetch@1.0.0
  - @logosdx/localize@1.0.0
  - @logosdx/observer@1.0.0
  - @logosdx/state-machine@1.0.0
  - @logosdx/storage@1.0.0
  - @logosdx/utils@1.0.0
