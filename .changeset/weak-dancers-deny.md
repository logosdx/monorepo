---
"@logosdx/fetch": patch
---

Remove formatHeaders feature as modern browsers handle header casing automatically. HTTP/2 standardizes headers to lowercase, making manual header formatting unnecessary. This simplifies the codebase while maintaining all existing functionality.
