---
title: Async Loading
description: Lazy-loaded locales with register(), changeTo(), and loading lifecycle events
---

# Async Loading


Large applications should not bundle every locale upfront. Use `register()` to declare a locale with a lazy loader, and the manager fetches the data on first `changeTo()` call. The loading lifecycle emits events so your UI can show spinners, handle errors, and stay in sync.

[[toc]]

## Registering Lazy Locales


`register(code, { text, loader })` declares a locale without loading its labels. The `loader` function is called the first time `changeTo()` targets that locale code.

```ts
import { LocaleManager } from '@logosdx/localize';
import { attempt } from '@logosdx/utils';

const i18n = new LocaleManager({
    current: 'en',
    fallback: 'en',
    locales: {
        en: { code: 'en', text: 'English', labels: english }
    }
});

// Register lazy-loaded locales
i18n.register('ja', {
    text: '日本語',
    loader: () => import('./locales/ja.json')
});

i18n.register('de', {
    text: 'Deutsch',
    loader: async () => {
        const [res, err] = await attempt(() => fetch('/api/locales/de'));
        if (err) throw err;
        return res.json();
    }
});
```

## Triggering the Loader


`changeTo()` triggers the loader automatically when the target locale is registered but not yet loaded.

```ts
i18n.isLoaded('ja');  // false

await i18n.changeTo('ja');

i18n.isLoaded('ja');  // true
```

## Loading Lifecycle


The loading sequence emits events in this order:

1. `loading` event fires with `{ code }` when the async loader begins
2. The loader function executes
3. On success: `change` event fires with `{ code }`
4. On failure: `error` event fires with `{ code }`, then the promise rejects

```ts
i18n.on('loading', ({ code }) => {
    showSpinner(`Loading ${code}...`);
});

i18n.on('change', ({ code }) => {
    hideSpinner();
    refreshUI();
});

i18n.on('error', ({ code }) => {
    hideSpinner();
    showToast(`Failed to load locale: ${code}`);
});

const [, err] = await attempt(() => i18n.changeTo('ja'));
if (err) {
    console.error('Locale load failed:', err.message);
}
```

## Race Guard


If multiple `changeTo()` calls happen concurrently for the same locale, the manager deduplicates them. The loader runs once, and all awaiting callers resolve when it completes.

```ts
// Both calls share the same loader execution
const p1 = i18n.changeTo('ja');
const p2 = i18n.changeTo('ja');

await Promise.all([p1, p2]);
// The loader for 'ja' only ran once
```

## `isLoaded()` Check


Returns `true` if the locale's labels are currently in memory, `false` if the locale is registered but not yet loaded (or unknown).

```ts
i18n.isLoaded('en');  // true  — provided in constructor
i18n.isLoaded('ja');  // false — registered but not loaded
i18n.isLoaded('xx');  // false — unknown locale
```

## Available Locales


The `locales` getter returns all known locales, both loaded and registered-but-unloaded.

```ts
i18n.locales;
// [
//     { code: 'en', text: 'English' },
//     { code: 'ja', text: '日本語' },
//     { code: 'de', text: 'Deutsch' }
// ]
```

::: tip
Use the `locales` getter to build a language selector UI. It includes every locale the manager knows about, regardless of whether labels have been loaded yet.
:::

## Error Handling


Always use `attempt()` when calling `changeTo()` for lazy-loaded locales. If the loader throws, the error propagates through the returned promise.

```ts
import { attempt } from '@logosdx/utils';

const [, err] = await attempt(() => i18n.changeTo('de'));

if (err) {
    console.error('Failed to switch locale:', err.message);
    // The manager stays on the previous locale
}
```

::: warning
If `changeTo()` is called with a code that is neither loaded nor registered, the manager falls back to the fallback locale and logs a console warning. No error is thrown in this case.
:::
