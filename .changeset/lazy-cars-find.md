---
"@logosdx/utils": patch
---

Fix `makeNestedConfig` type coercion order - now applies `castValuesToTypes` to the config object after setting deep values, ensuring proper type conversion of nested configuration values
