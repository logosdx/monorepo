# @logos-ui/kit

## 1.1.2

### Patch Changes

- ba8b52d: Properly detect NodeJS so as to work with electron when stubbing window.
- Updated dependencies [ba8b52d]
  - @logos-ui/utils@1.1.2
  - @logos-ui/dom@1.1.2
  - @logos-ui/fetch@1.1.2
  - @logos-ui/forms@0.0.5
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
  - @logos-ui/forms@0.0.4
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
  - @logos-ui/forms@0.0.3

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
  - @logos-ui/forms@0.0.2
