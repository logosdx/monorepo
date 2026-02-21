---
title: Utils
description: Production utilities that compose. Resilience built in.
---

# Utils

Building resilient applications requires more than basic utilities. @logosdx/utils provides everything you need: retry failed operations with backoff, protect services with circuit breakers, control flow with rate limiting and debouncing, optimize performance with memoization, safely clone and merge complex objects, and handle errors with Go-style tuples instead of exceptions. Every utility is designed to compose - stack retry on circuit breaker on timeout. Full TypeScript support catches errors at compile time. It's the foundation for applications that don't break in production.

## Installation


::: code-group

```bash [npm]
npm install @logosdx/utils
```

```bash [yarn]
yarn add @logosdx/utils
```

```bash [pnpm]
pnpm add @logosdx/utils
```

:::

**CDN:**
```html
<script src="https://cdn.jsdelivr.net/npm/@logosdx/utils@latest/dist/browser.min.js"></script>
<script>
  const { attempt, retry, clone } = LogosDx.Utils;
</script>
```

## Quick Start

```typescript
import { attempt } from '@logosdx/utils'

// Replace try-catch with error tuples
const [user, err] = await attempt(() =>
    fetch('/api/users/123').then(r => r.json())
)

if (err) {
    console.error('Failed to fetch user:', err.message)
    return
}

console.log('User loaded:', user.name)
```

## Core Concepts

Go-style error tuples provide predictable error handling without try-catch blocks. Functions return `[result, null]` on success or `[null, error]` on failure. Compose flow control utilities for resilient, production-ready operations.
