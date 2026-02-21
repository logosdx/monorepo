---
title: Intl Formatting
description: Cached number, date, and relative time formatting via Intl APIs
---

# Intl Formatting


The `intl` getter on `LocaleManager` provides cached `Intl.NumberFormat`, `Intl.DateTimeFormat`, and `Intl.RelativeTimeFormat` instances tied to the current locale. Formatters are cached for performance and the cache is intentionally retained across locale changes so switching back to a previous locale is instant.

[[toc]]

## `intl.number()`


Format numbers with locale-aware grouping, currency, and percentage styles.

```ts
i18n.intl.number(1499.99);
// "1,499.99"

i18n.intl.number(9.99, { style: 'currency', currency: 'USD' });
// "$9.99"

i18n.intl.number(0.15, { style: 'percent' });
// "15%"
```

After switching locales, the same calls produce locale-appropriate output:

```ts
await i18n.changeTo('de');

i18n.intl.number(1499.99);
// "1.499,99"

i18n.intl.number(9.99, { style: 'currency', currency: 'EUR' });
// "9,99 €"
```

## `intl.date()`


Format dates with predefined styles or custom options.

```ts
i18n.intl.date(new Date());
// "2/18/2026"

i18n.intl.date(new Date(), { dateStyle: 'full' });
// "Wednesday, February 18, 2026"

i18n.intl.date(new Date(), { year: 'numeric', month: 'long' });
// "February 2026"
```

```ts
await i18n.changeTo('es');

i18n.intl.date(new Date(), { dateStyle: 'full' });
// "miércoles, 18 de febrero de 2026"
```

## `intl.relative()`


Format relative time with various units.

```ts
i18n.intl.relative(-3, 'day');
// "3 days ago"

i18n.intl.relative(1, 'hour');
// "in 1 hour"

i18n.intl.relative(-1, 'month');
// "1 month ago"

i18n.intl.relative(2, 'week');
// "in 2 weeks"
```

## `createIntlFormatters()` Standalone Factory


The `createIntlFormatters` function is exported for use outside of `LocaleManager`. It creates a formatters object for a given locale code without needing a manager instance.

```ts
import { createIntlFormatters } from '@logosdx/localize';

const fmt = createIntlFormatters('ja');

fmt.number(1499.99);
// "1,499.99" (Japanese locale grouping)

fmt.date(new Date(), { dateStyle: 'long' });
// "2026年2月18日"

fmt.relative(-1, 'day');
// "1 日前"
```

## Caching Behavior


::: tip Performance
Formatter instances are cached globally by locale + options combination. The cache is **intentionally retained** across locale changes. Typical applications use a small number of locales, so the memory cost is negligible and switching back to a previously-used locale is instant.
:::

When the locale changes via `changeTo()`, the `intl` getter on the manager resets its reference so it creates formatters for the new locale. But previously-created formatters for other locales remain in the global cache and are reused if you switch back.

```ts
// First time — creates and caches formatters for 'en'
i18n.intl.number(42);

await i18n.changeTo('es');
// Creates and caches formatters for 'es'
i18n.intl.number(42);

await i18n.changeTo('en');
// Reuses cached formatters for 'en' — no new Intl objects created
i18n.intl.number(42);
```
