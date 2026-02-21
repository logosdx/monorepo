---
title: Localize
description: Type-safe i18n with async loading, ICU pluralization, Intl formatting, and namespace scoping
---

# Localize


`@logosdx/localize` is a type-safe localization engine for TypeScript applications. It goes beyond simple key-value lookups with ICU-lite pluralization, built-in `Intl` formatting for numbers, dates, and relative time, lazy-loaded locales via async loaders, and namespace scoping for feature-isolated translations. Missing keys return `[key]` with a dev warning instead of silent failures. Locale switching is async, events keep your UI in sync, and the whole API is designed to be copy-paste ready in any runtime.

[[toc]]

## Installation


::: code-group

```bash [npm]
npm install @logosdx/localize
```

```bash [yarn]
yarn add @logosdx/localize
```

```bash [pnpm]
pnpm add @logosdx/localize
```

:::

**CDN:**

```html
<script src="https://cdn.jsdelivr.net/npm/@logosdx/localize@latest/dist/browser.min.js"></script>
<script>
    const { LocaleManager } = LogosDx.Localize;
</script>
```

## Quick Start


```ts
import { LocaleManager } from '@logosdx/localize';

const english = {
    greeting: 'Hello, {name}!',
    products: {
        count: '{count, plural, one {# product} other {# products}} in your cart'
    }
};

const spanish = {
    greeting: 'Hola, {name}!',
    products: {
        count: '{count, plural, one {# producto} other {# productos}} en tu carrito'
    }
};

const i18n = new LocaleManager({
    current: 'en',
    fallback: 'en',
    locales: {
        en: { code: 'en', text: 'English', labels: english },
        es: { code: 'es', text: 'Español', labels: spanish }
    }
});

// Translated text with variable substitution
i18n.t('greeting', { name: 'Maria' });
// "Hello, Maria!"

// ICU-lite pluralization
i18n.t('products.count', { count: 1 });
// "1 product in your cart"

i18n.t('products.count', { count: 5 });
// "5 products in your cart"

// Intl formatting follows the current locale
i18n.intl.number(2499.99, { style: 'currency', currency: 'USD' });
// "$2,499.99"

// Async locale switching with observer-based events
const unsub = i18n.on('change', ({ code }) => console.log('Now using:', code));
await i18n.changeTo('es');
unsub();
```

## What's Next


| Page | Description |
|------|-------------|
| [Translations](./translations) | Key resolution, variables, fallback merging |
| [Pluralization](./pluralization) | ICU-lite syntax and locale-aware categories |
| [Intl Formatting](./intl) | Numbers, dates, and relative time formatting |
| [Async Loading](./async-loading) | Lazy loaders, loading lifecycle, race guards |
| [Namespaces](./namespaces) | Scoped translations for feature modules |
| [Events](./events) | Observer-based change, loading, and error events |
| [Type Extractor](./type-extractor) | CLI to generate TypeScript types from JSON files |
| [API Reference](./api) | Complete interface and class signatures |
