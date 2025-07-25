---
"@logosdx/utils": minor
"@logosdx/fetch": patch
---

## Flow Control Utilities and Engine Improvements

### Added Flow Control Utilities

- **runInSeries/makeInSeries**: Execute functions sequentially
- **nextLoop**: Promise that resolves after next event loop
- **nTimes**: Utility to repeat operations N times
- **setImmediate polyfill**: Cross-platform immediate execution

### Batch Processing Enhancement

- Added `nextLoop()` call in batch processing to prevent blocking
- Improves performance for large batch operations

### Fetch Engine Improvements

- Fixed status code handling in error parsing (status fallback)
- Fixed `addEventListener` now returns cleanup function for better resource management
