# @logos-ui/riot-kit

## 2.0.2

### Patch Changes

- c7051bb: Make modules CJS/ESM agnostic
- Updated dependencies [c7051bb]
  - @logos-ui/riot-utils@2.0.2
  - @logos-ui/kit@2.0.2

## 2.0.1

### Patch Changes

- 9de5826: Export correctly for esm / cjs
- Updated dependencies [9de5826]
  - @logos-ui/riot-utils@2.0.1
  - @logos-ui/kit@2.0.1

## 2.0.0

### Major Changes

- 847eb42: Build for ESM and CJS. Modules should now work in both.

### Patch Changes

- Updated dependencies [847eb42]
  - @logos-ui/riot-utils@2.0.0
  - @logos-ui/kit@2.0.0

## 1.2.0

### Minor Changes

- 14e5699: Fallback when changing to undefined, reacher prioritize keyname.

  - When change to a language that does not exist, lib was throwing undefined errors.
  - It should fallback.
  - - Language object reacher should also prioritize key names over iteration if they exist

### Patch Changes

- Updated dependencies [14e5699]
  - @logos-ui/kit@1.2.0

## 1.1.8

### Patch Changes

- 2d7ac0d: **LocaleFactory**

  - Fixed need to filter out values that cannot be converted into a string.
  - Added ability to search and replace from nested objects or arrays when passed into replace values.

- Updated dependencies [2d7ac0d]
  - @logos-ui/kit@1.1.7

## 1.1.7

### Patch Changes

- @logos-ui/kit@1.1.6

## 1.1.6

### Patch Changes

- @logos-ui/kit@1.1.5

## 1.1.5

### Patch Changes

- e6a7f66: Export \* from riot utils

## 1.1.4

### Patch Changes

- 5ef68a9: Once again...
- Updated dependencies [5ef68a9]
  - @logos-ui/kit@1.1.4
  - @logos-ui/riot-utils@1.1.4

## 1.1.3

### Patch Changes

- 432396d: Check against global to detect NodeJS because of build time issues when `process` when not reading as `global.process`
- Updated dependencies [432396d]
  - @logos-ui/kit@1.1.3
  - @logos-ui/riot-utils@1.1.3

## 1.1.2

### Patch Changes

- ba8b52d: Properly detect NodeJS so as to work with electron when stubbing window.
- Updated dependencies [ba8b52d]
  - @logos-ui/kit@1.1.2
  - @logos-ui/riot-utils@1.1.2

## 1.1.1

### Patch Changes

- e6e4d56: Added a window stub so packages can be used in NodeJS. Now, Observer, Localize, StateMachine, Storage, and whatever non-DOM related utility functions are usefule.
- Updated dependencies [e6e4d56]
  - @logos-ui/riot-utils@1.1.1
  - @logos-ui/kit@1.1.1

## 1.1.0

### Minor Changes

- e5d039d: Documentation for all packages is completed and can be found at [https://logosui.com](https://logosui.com). All packages are tested and ready for use. For bug reports, questions, and suggestions, please use [https://github.com/logos-ui/discuss](https://github.com/logos-ui/discuss).

### Patch Changes

- Updated dependencies [e5d039d]
  - @logos-ui/riot-utils@1.1.0
  - @logos-ui/kit@1.1.0

## 1.0.0

### Major Changes

- 58c0208: Initial commit!

  These packages were made to simplify the development of web applications, and reduce the decisions we make when building apps. You don't always need all the things, but you always need some things. When you apps are simple, they should remain so. When they grow in complexity, they should do so with ease.

  [Discussions can be had here](https://github.com/logos-ui/discuss). This will also include a link to the documentation (which is a WIP at the current moment). Domain not included here because it will in the future change. Enjoy using this neat piece of software utility, and do not be afraid to provide feedback; it is welcome!

### Patch Changes

- Updated dependencies [58c0208]
  - @logos-ui/riot-utils@1.0.0
  - @logos-ui/kit@1.0.0
