---
"@logosdx/hooks": patch
---

npm build targets es2022 like every other package

- The ESM and CJS output now uses native `#private` fields instead of SWC's `_class_private_field` helpers.
