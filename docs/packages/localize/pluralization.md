---
title: Pluralization
description: ICU-lite plural syntax with locale-aware category selection
---

# Pluralization


`@logosdx/localize` supports ICU-lite plural syntax using `Intl.PluralRules` for locale-aware category selection. This means pluralization rules are determined by the runtime, not hardcoded — so languages with complex plural forms (Arabic, Polish, Welsh) work correctly out of the box.

[[toc]]

## ICU-lite Syntax


The syntax is `{varName, plural, category {template}}` where `#` is replaced with the numeric value.

```ts
const labels = {
    cart: {
        items: '{count, plural, one {# item} other {# items}} in your cart',
        reviews: '{count, plural, zero {No reviews yet} one {# review} other {# reviews}}'
    }
};

i18n.t('cart.items', { count: 0 });
// "0 items in your cart"

i18n.t('cart.items', { count: 1 });
// "1 item in your cart"

i18n.t('cart.items', { count: 12 });
// "12 items in your cart"

i18n.t('cart.reviews', { count: 0 });
// "No reviews yet"
```

## Supported Categories


Categories are resolved by `Intl.PluralRules` based on the current locale. English uses `one` and `other`, but languages like Arabic, Polish, or Welsh use additional categories.

| Category | When Used | Example Languages |
|----------|-----------|-------------------|
| `zero` | Explicit zero (if defined) | Arabic, Latvian |
| `one` | Singular (locale-dependent) | English, Spanish, French |
| `two` | Dual forms | Arabic, Welsh |
| `few` | Small quantities | Polish, Czech, Russian |
| `many` | Large quantities | Polish, Russian, Arabic |
| `other` | Default fallback (always required) | All languages |

::: warning
The `other` category is required in every plural expression. It serves as the fallback when no other category matches.
:::

## Multi-language Examples


```ts
// English — uses 'one' and 'other'
const en = {
    notifications: '{count, plural, one {# notification} other {# notifications}}'
};

// Polish — uses 'one', 'few', 'many', and 'other'
const pl = {
    notifications: '{count, plural, one {# powiadomienie} few {# powiadomienia} many {# powiadomień} other {# powiadomień}}'
};

// Arabic — uses 'zero', 'one', 'two', 'few', 'many', 'other'
const ar = {
    notifications: '{count, plural, zero {لا إشعارات} one {إشعار واحد} two {إشعاران} few {# إشعارات} many {# إشعارًا} other {# إشعار}}'
};
```

## `parsePlural()` Standalone Helper


The `parsePlural` function is exported separately for use outside of `LocaleManager`. It resolves plural syntax in a string given a set of values and a locale code.

```ts
import { parsePlural } from '@logosdx/localize';

parsePlural(
    '{count, plural, one {# item} other {# items}}',
    { count: 5 },
    'en'
);
// "5 items"

parsePlural(
    'You have {count, plural, one {# message} other {# messages}}',
    { count: 1 },
    'en'
);
// "You have 1 message"
```

::: tip
`parsePlural` only handles the plural syntax. Variable substitution (`{name}` placeholders) is handled separately by the `format` helper. When using `t()` on the manager, both steps happen automatically.
:::

## Mixing Plurals with Variables


Plural expressions and regular variables can coexist in the same template string.

```ts
const labels = {
    order: {
        summary: '{customer} ordered {count, plural, one {# item} other {# items}} totaling {total}'
    }
};

i18n.t('order.summary', { customer: 'Elena', count: 3, total: '$149.97' });
// "Elena ordered 3 items totaling $149.97"
```
