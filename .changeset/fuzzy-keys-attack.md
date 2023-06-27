---
"@logos-ui/utils": patch
"@logos-ui/dom": patch
"@logos-ui/fetch": patch
"@logos-ui/forms": patch
"@logos-ui/kit": patch
"@logos-ui/localize": patch
"@logos-ui/observer": patch
"@logos-ui/riot-kit": patch
"@logos-ui/riot-utils": patch
"@logos-ui/state-machine": patch
"@logos-ui/storage": patch
---

Check against global to detect NodeJS because of build time issues when `process` when not reading as `global.process`
