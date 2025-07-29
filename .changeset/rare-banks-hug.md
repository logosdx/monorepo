---
"@logosdx/utils": patch
---

## Summary

fix(utils): resolve retry falsy value bug and optimize clone performance

- Fix critical retry logic bug where falsy return values (null, undefined, false, 0, '')
    triggered unnecessary retries by checking error === null instead of result truthiness
- Optimize clone function by consolidating Error handlers and introducing useRawHandler
    set for types that don't need circular reference placeholders
- Leverage native structuredClone API for Error objects when available
- Add comprehensive test coverage for falsy value retry behavior and Error/Date cloning

Closes #73
