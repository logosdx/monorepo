---
"@logos-ui/localize": minor
"@logos-ui/kit": minor
"@logos-ui/riot-kit": minor
---

Fallback when changing to undefined, reacher prioritize keyname.

- When change to a language that does not exist, lib was throwing undefined errors.
- It should fallback.
- - Language object reacher should also prioritize key names over iteration if they exist
