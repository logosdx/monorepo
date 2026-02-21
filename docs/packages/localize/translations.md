---
title: Translations
description: Key resolution, variable substitution, and fallback merging in @logosdx/localize
---

# Translations


Translations are the core of `@logosdx/localize`. Keys are dot-notated paths into nested objects, variables use `{name}` placeholders, and missing keys surface visibly in development instead of silently breaking your UI.

[[toc]]

## `text()` and `t()`


`t()` is a shorthand alias for `text()`. Both resolve a dot-notated key against the current locale, substitute variables, and process any pluralization syntax.

```ts
const labels = {
    dashboard: {
        title: 'Welcome back, {name}',
        loans: {
            active: 'You have {count} active loans',
            due: 'Next payment due: {date}'
        }
    }
};

// Dot-notated keys with named variables
i18n.t('dashboard.title', { name: 'Carlos' });
// "Welcome back, Carlos"

i18n.t('dashboard.loans.active', { count: 3 });
// "You have 3 active loans"
```

### PathLeaves Type Safety


When you provide a generic type to `LocaleManager`, the `t()` method only accepts keys that resolve to leaf strings in your locale object. Intermediate object keys are excluded.

```ts
import { LocaleManager } from '@logosdx/localize';
import type { AppLocale, LocaleCodes } from './locale-keys';

const i18n = new LocaleManager<AppLocale, LocaleCodes>({
    current: 'en',
    fallback: 'en',
    locales: {
        en: { code: 'en', text: 'English', labels: enLabels }
    }
});

i18n.t('dashboard.title');          // OK — leaf string
i18n.t('dashboard.loans.active');   // OK — leaf string
i18n.t('dashboard.loans');          // Type error — not a leaf
i18n.t('nonexistent');              // Type error — path doesn't exist
```

## Variable Substitution


Variables use `{name}` placeholders and accept both objects and arrays.

```ts
// Named variables (recommended)
i18n.t('transfer.confirm', { amount: '500', recipient: 'Ana Torres' });

// Positional variables
// Template: "{0} sent {1} to {2}"
i18n.t('transfer.summary', ['Carlos', '$500', 'Ana Torres']);
```

::: tip
Named variables are preferred because they are self-documenting and order-independent. Positional variables work for simple cases but become hard to maintain as templates grow.
:::

## Missing Keys


When a translation key does not exist, the manager returns `[key]` and logs a warning in non-production environments. This makes missing translations visible in the UI during development without crashing the application.

```ts
i18n.t('nonexistent.key');
// Returns: "[nonexistent.key]"
// Console warning: Missing translation key: "nonexistent.key"
```

::: warning
The warning is only logged when `process.env.NODE_ENV !== 'production'`. In production builds, the `[key]` string is still returned but no warning is emitted.
:::

## Fallback Merging


When the current locale is different from the fallback, labels are deep-merged so that any keys missing in the current locale fall through to the fallback. This lets you ship partial translations incrementally.

```ts
const i18n = new LocaleManager({
    current: 'en',
    fallback: 'en',
    locales: {
        en: { code: 'en', text: 'English', labels: fullEnglish },
        fr: { code: 'fr', text: 'Français', labels: partialFrench }
    }
});

await i18n.changeTo('fr');
// Keys present in partialFrench use French text.
// Keys missing from partialFrench fall back to English.
```

This is particularly useful during incremental localization rollouts. Translators can work through sections at their own pace while the application remains fully functional with fallback text.

## Updating Translations at Runtime


`updateLang()` deep-merges new labels into an existing locale at runtime. If the updated locale is the current one, the manager re-merges and emits a `change` event automatically.

```ts
import { attempt } from '@logosdx/utils';

// Fetch updated translations from an API
const [patch, err] = await attempt(() =>
    fetch('/api/translations/en/dashboard').then(r => r.json())
);

if (!err) {
    i18n.updateLang('en', {
        dashboard: patch
    });
    // If 'en' is current, the change event fires and UI can refresh.
}
```
