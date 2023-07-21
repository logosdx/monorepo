---
"@logos-ui/dom": minor
---

**Features:**

Added utilities `isInViewport` and `isScrolledIntoView` for detecting when an element is visible in the viewport.

**Fixes:**

- Fixed `$` utility only returning type of `Element[]`. It now accepts a generic that will default to `HTMLElement[]`, which is the more common use case.
- Fixed `createElWith()` utility which was not binding events due to a doubled `Object.entries()` call to the passed arguments.