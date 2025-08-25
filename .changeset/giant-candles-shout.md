---
"@logosdx/utils": minor
---

Enhanced debounce and throttle functions with improved interfaces

- **debounce**: Added `flush()` method to execute immediately and return result, `cancel()` method to stop pending execution, and `maxWait` option to prevent indefinite hanging
- **throttle**: Added `cancel()` method to clear throttle state and allow immediate re-execution
- Both functions now support async operations and maintain proper error handling
- Breaking change: Return types changed from simple functions to enhanced interfaces with additional methods
