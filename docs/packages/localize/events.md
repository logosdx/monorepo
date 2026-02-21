---
title: Events
description: Observer-based change, loading, and error events for locale lifecycle
---

# Events


`LocaleManager` uses `ObserverEngine` internally for event handling. It does **not** extend `EventTarget`. Listeners receive plain `{ code }` objects, and `on()` returns an unsubscribe function.

[[toc]]

## Event Types


| Event | When Emitted | Payload |
|-------|-------------|---------|
| `change` | After the active locale switches successfully | `{ code }` |
| `loading` | When an async loader begins fetching a registered locale | `{ code }` |
| `error` | When an async loader fails | `{ code }` |

## Subscribing with `on()`


`on()` returns an unsubscribe function. Listeners receive a plain `{ code }` object — not a DOM event, not a custom event class.

```ts
// Subscribe to locale changes
const unsub = i18n.on('change', ({ code }) => {
    console.log('Locale changed to:', code);
    refreshUI();
});

// Listen for loading state (useful for spinners)
const unsubLoading = i18n.on('loading', ({ code }) => {
    showSpinner(`Loading ${code}...`);
});

// Handle load failures
const unsubError = i18n.on('error', ({ code }) => {
    showToast(`Failed to load locale: ${code}`);
});

// Cleanup
unsub();
unsubLoading();
unsubError();
```

## One-time Listeners with `once()`


`once()` is a separate method that automatically unsubscribes after the first emission. It also returns an unsubscribe function in case you need to cancel before it fires.

```ts
const unsub = i18n.once('change', ({ code }) => {
    console.log('First locale switch:', code);
});

// If you need to cancel before it fires:
unsub();
```

## Removing Listeners with `off()`


`off()` removes a listener by reference. The listener parameter is optional — calling `off()` without a listener removes **all** listeners for that event.

```ts
const handler = ({ code }) => console.log('Changed to:', code);
i18n.on('change', handler);

// Remove specific listener
i18n.off('change', handler);

// Remove ALL change listeners
i18n.off('change');
```

## React Integration


Use the unsubscribe function pattern in `useEffect` for clean React integration:

```ts
import { useEffect, useState } from 'react';

function useLocale(i18n) {

    const [locale, setLocale] = useState(i18n.current);

    useEffect(() => {

        const unsub = i18n.on('change', ({ code }) => {
            setLocale(code);
        });

        return unsub;
    }, [i18n]);

    return locale;
}
```

## Production Monitoring


Track locale usage and loading failures for analytics:

```ts
// Track locale adoption
i18n.on('change', ({ code }) => {
    analytics.track('locale_change', { locale: code });
});

// Monitor loading performance
i18n.on('loading', ({ code }) => {
    performance.mark(`locale-load-start-${code}`);
});

i18n.on('change', ({ code }) => {
    performance.mark(`locale-load-end-${code}`);
    performance.measure(
        `locale-load-${code}`,
        `locale-load-start-${code}`,
        `locale-load-end-${code}`
    );
});

// Alert on failures
i18n.on('error', ({ code }) => {
    errorReporter.captureMessage(`Locale load failed: ${code}`);
});
```
