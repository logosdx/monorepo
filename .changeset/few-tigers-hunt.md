---
"@logosdx/utils": minor
---

Add ability to reach into config with path parameter

The `makeNestedConfig` function now supports an optional `path` parameter that allows you to extract specific values from the nested configuration. This enables direct access to deeply nested config values with type safety and optional default values.

```ts
const getConfig = makeNestedConfig(process.env, {
  filter: (key) => key.startsWith('APP_'),
  stripPrefix: 'APP_'
});

// Get entire config
const config = getConfig();

// Get specific value with type-safe path
const dbHost = getConfig('db.host');

// Get specific value with default fallback
const timeout = getConfig('api.timeout', 5000);
```
