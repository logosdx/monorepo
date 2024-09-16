# @logos-ui/kit

## 2.0.9

### Patch Changes

- Updated dependencies [5ee6904]
  - @logos-ui/fetch@3.1.0

## 2.0.8

### Patch Changes

- Updated dependencies [2b64cfa]
  - @logos-ui/fetch@3.0.0

## 2.0.7

### Patch Changes

- ca76a50: Bump again
- Updated dependencies [ca76a50]
  - @logos-ui/dom@2.0.6
  - @logos-ui/fetch@2.0.6
  - @logos-ui/localize@2.0.6
  - @logos-ui/observer@2.0.6
  - @logos-ui/state-machine@2.0.6
  - @logos-ui/storage@2.0.6
  - @logos-ui/utils@2.0.5

## 2.0.6

### Patch Changes

- 0566a67: Bump all dependencies for cjs / esm build
- Updated dependencies [0566a67]
  - @logos-ui/dom@2.0.5
  - @logos-ui/fetch@2.0.5
  - @logos-ui/localize@2.0.5
  - @logos-ui/observer@2.0.5
  - @logos-ui/state-machine@2.0.5
  - @logos-ui/storage@2.0.5
  - @logos-ui/utils@2.0.4

## 2.0.5

### Patch Changes

- 489c5d5: Fix typo on typing from refactor

## 2.0.4

### Patch Changes

- 176ed64: Export better utility typings for Kit
- Updated dependencies [176ed64]
  - @logos-ui/utils@2.0.3
  - @logos-ui/dom@2.0.4
  - @logos-ui/fetch@2.0.4
  - @logos-ui/localize@2.0.4
  - @logos-ui/observer@2.0.4
  - @logos-ui/state-machine@2.0.4
  - @logos-ui/storage@2.0.4

## 2.0.3

### Patch Changes

- Updated dependencies [c167f6b]
  - @logos-ui/localize@2.0.3
  - @logos-ui/utils@2.0.2
  - @logos-ui/dom@2.0.3
  - @logos-ui/fetch@2.0.3
  - @logos-ui/observer@2.0.3
  - @logos-ui/state-machine@2.0.3
  - @logos-ui/storage@2.0.3

## 2.0.2

### Patch Changes

- c7051bb: Make modules CJS/ESM agnostic
- Updated dependencies [c7051bb]
  - @logos-ui/state-machine@2.0.2
  - @logos-ui/localize@2.0.2
  - @logos-ui/observer@2.0.2
  - @logos-ui/storage@2.0.2
  - @logos-ui/fetch@2.0.2
  - @logos-ui/utils@2.0.1
  - @logos-ui/dom@2.0.2

## 2.0.1

### Patch Changes

- 9de5826: Export correctly for esm / cjs
- Updated dependencies [9de5826]
  - @logos-ui/state-machine@2.0.1
  - @logos-ui/localize@2.0.1
  - @logos-ui/observer@2.0.1
  - @logos-ui/storage@2.0.1
  - @logos-ui/fetch@2.0.1
  - @logos-ui/dom@2.0.1

## 2.0.0

### Major Changes

- 847eb42: Build for ESM and CJS. Modules should now work in both.

### Patch Changes

- Updated dependencies [847eb42]
  - @logos-ui/state-machine@2.0.0
  - @logos-ui/localize@2.0.0
  - @logos-ui/observer@2.0.0
  - @logos-ui/storage@2.0.0
  - @logos-ui/fetch@2.0.0
  - @logos-ui/utils@2.0.0
  - @logos-ui/dom@2.0.0

## 1.2.0

### Minor Changes

- 14e5699: Fallback when changing to undefined, reacher prioritize keyname.

  - When change to a language that does not exist, lib was throwing undefined errors.
  - It should fallback.
  - - Language object reacher should also prioritize key names over iteration if they exist

### Patch Changes

- Updated dependencies [14e5699]
  - @logos-ui/localize@1.3.0

## 1.1.7

### Patch Changes

- 2d7ac0d: **LocaleFactory**

  - Fixed need to filter out values that cannot be converted into a string.
  - Added ability to search and replace from nested objects or arrays when passed into replace values.

- Updated dependencies [2d7ac0d]
  - @logos-ui/localize@1.2.0

## 1.1.6

### Patch Changes

- Updated dependencies [6f60306]
  - @logos-ui/dom@1.3.0

## 1.1.5

### Patch Changes

- Updated dependencies [07dcb99]
  - @logos-ui/dom@1.2.0

## 1.1.4

### Patch Changes

- 5ef68a9: Once again...
- Updated dependencies [5ef68a9]
  - @logos-ui/utils@1.1.4
  - @logos-ui/dom@1.1.4
  - @logos-ui/fetch@1.1.4
  - @logos-ui/localize@1.1.4
  - @logos-ui/observer@1.1.4
  - @logos-ui/state-machine@1.1.4
  - @logos-ui/storage@1.1.4

## 1.1.3

### Patch Changes

- 432396d: Check against global to detect NodeJS because of build time issues when `process` when not reading as `global.process`
- Updated dependencies [432396d]
  - @logos-ui/utils@1.1.3
  - @logos-ui/dom@1.1.3
  - @logos-ui/fetch@1.1.3
  - @logos-ui/localize@1.1.3
  - @logos-ui/observer@1.1.3
  - @logos-ui/state-machine@1.1.3
  - @logos-ui/storage@1.1.3

## 1.1.2

### Patch Changes

- ba8b52d: Properly detect NodeJS so as to work with electron when stubbing window.
- Updated dependencies [ba8b52d]
  - @logos-ui/utils@1.1.2
  - @logos-ui/dom@1.1.2
  - @logos-ui/fetch@1.1.2
  - @logos-ui/localize@1.1.2
  - @logos-ui/observer@1.1.2
  - @logos-ui/state-machine@1.1.2
  - @logos-ui/storage@1.1.2

## 1.1.1

### Patch Changes

- e6e4d56: Added a window stub so packages can be used in NodeJS. Now, Observer, Localize, StateMachine, Storage, and whatever non-DOM related utility functions are usefule.
- Updated dependencies [e6e4d56]
  - @logos-ui/state-machine@1.1.1
  - @logos-ui/localize@1.1.1
  - @logos-ui/observer@1.1.1
  - @logos-ui/storage@1.1.1
  - @logos-ui/fetch@1.1.1
  - @logos-ui/utils@1.1.1
  - @logos-ui/dom@1.1.1

## 1.1.0

### Minor Changes

- e5d039d: Documentation for all packages is completed and can be found at [https://logosui.com](https://logosui.com). All packages are tested and ready for use. For bug reports, questions, and suggestions, please use [https://github.com/logos-ui/discuss](https://github.com/logos-ui/discuss).

### Patch Changes

- Updated dependencies [e5d039d]
  - @logos-ui/state-machine@1.1.0
  - @logos-ui/localize@1.1.0
  - @logos-ui/observer@1.1.0
  - @logos-ui/storage@1.1.0
  - @logos-ui/fetch@1.1.0
  - @logos-ui/utils@1.1.0
  - @logos-ui/dom@1.1.0

## 1.0.0

### Major Changes

- 58c0208: Initial commit!

  These packages were made to simplify the development of web applications, and reduce the decisions we make when building apps. You don't always need all the things, but you always need some things. When you apps are simple, they should remain so. When they grow in complexity, they should do so with ease.

  [Discussions can be had here](https://github.com/logos-ui/discuss). This will also include a link to the documentation (which is a WIP at the current moment). Domain not included here because it will in the future change. Enjoy using this neat piece of software utility, and do not be afraid to provide feedback; it is welcome!

### Patch Changes

- Updated dependencies [58c0208]
  - @logos-ui/state-machine@1.0.0
  - @logos-ui/localize@1.0.0
  - @logos-ui/observer@1.0.0
  - @logos-ui/storage@1.0.0
  - @logos-ui/fetch@1.0.0
  - @logos-ui/utils@1.0.0
  - @logos-ui/dom@1.0.0
