---
"@logosdx/fetch": patch
---

fix(fetch): preserve full baseUrl path when constructing request URLs

Previously, `#makeUrl` unconditionally removed the last character from the baseUrl, which would incorrectly truncate paths like `/org/1/v1` to `/org/1/v`. Now only trailing slashes are removed.
