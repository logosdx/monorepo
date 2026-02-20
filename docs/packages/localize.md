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

// Async locale switching
const unsub = i18n.on('change', (e) => console.log('Now using:', e.code));
await i18n.changeTo('es');
unsub();
```

## Core Concepts


### `text()` and `t()`


`t()` is a shorthand alias for `text()`. Both resolve a dot-notated key against the current locale, substitute variables, and process any pluralization syntax. If a key is missing, the return value is `[key]` and a warning is logged in development.

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

### Variable Substitution


Variables use `{name}` placeholders and accept both objects and arrays.

```ts
// Named variables (recommended)
i18n.t('transfer.confirm', { amount: '500', recipient: 'Ana Torres' });

// Positional variables
// Template: "{0} sent {1} to {2}"
i18n.t('transfer.summary', ['Carlos', '$500', 'Ana Torres']);
```

### Missing Keys


When a translation key does not exist, the manager returns `[key]` and logs a warning in non-production environments. This makes missing translations visible in the UI during development without crashing the application.

```ts
i18n.t('nonexistent.key');
// Returns: "[nonexistent.key]"
// Console warning: Missing translation key: "nonexistent.key"
```

## Pluralization


`@logosdx/localize` supports ICU-lite plural syntax using `Intl.PluralRules` for locale-aware category selection. The syntax is `{varName, plural, category {template}}` where `#` is replaced with the numeric value.

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

### Supported Categories


Categories are resolved by `Intl.PluralRules` based on the current locale. English uses `one` and `other`, but languages like Arabic, Polish, or Welsh use additional categories.

| Category | When Used |
|----------|-----------|
| `zero` | Explicit zero (if defined) |
| `one` | Singular (locale-dependent) |
| `two` | Dual forms (e.g., Arabic) |
| `few` | Small quantities (e.g., Polish) |
| `many` | Large quantities (e.g., Polish) |
| `other` | Default fallback (always required) |

## Intl Formatting


The `intl` getter provides cached `Intl.NumberFormat`, `Intl.DateTimeFormat`, and `Intl.RelativeTimeFormat` instances tied to the current locale. Formatters are cached for performance and reset automatically when the locale changes.

### `intl.number()`


```ts
i18n.intl.number(1499.99);
// "1,499.99"

i18n.intl.number(9.99, { style: 'currency', currency: 'USD' });
// "$9.99"

i18n.intl.number(0.15, { style: 'percent' });
// "15%"
```

### `intl.date()`


```ts
i18n.intl.date(new Date());
// "2/18/2026"

i18n.intl.date(new Date(), { dateStyle: 'full' });
// "Wednesday, February 18, 2026"

i18n.intl.date(new Date(), { year: 'numeric', month: 'long' });
// "February 2026"
```

### `intl.relative()`


```ts
i18n.intl.relative(-3, 'day');
// "3 days ago"

i18n.intl.relative(1, 'hour');
// "in 1 hour"

i18n.intl.relative(-1, 'month');
// "1 month ago"
```

## Locale Switching


`changeTo()` is async. If the target locale is already loaded, it switches immediately. If the locale was registered with an async loader, it triggers the loading sequence. If the locale code is not found at all, it falls back to the fallback locale with a console warning.

```ts
// Immediate switch (locale already loaded)
await i18n.changeTo('es');

// Fallback behavior (unknown locale)
await i18n.changeTo('xx');
// Console warning: Locale 'xx' not found. Using fallback 'en' instead.
```

### Fallback Merging


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

## Async Loading


Use `register()` to declare a locale with a lazy loader. The locale data is fetched on first `changeTo()` call, and the manager emits `loading` and `change` (or `error`) events during the process.

```ts
import { attempt } from '@logosdx/utils';

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

// Check if a locale is already loaded
i18n.isLoaded('ja');  // false

// Switching triggers the loader
await i18n.changeTo('ja');

i18n.isLoaded('ja');  // true
```

### Available Locales


The `locales` getter returns all known locales, both loaded and registered.

```ts
i18n.locales;
// [
//     { code: 'en', text: 'English' },
//     { code: 'es', text: 'Español' },
//     { code: 'ja', text: '日本語' }
// ]
```

## Namespace Scoping


`ns()` returns a `ScopedLocale` that prepends a prefix to every key. Scopes can be nested and share the parent's `intl` formatters. This is useful for isolating translations per feature module.

```ts
const labels = {
    auth: {
        login: {
            title: 'Sign In',
            submit: 'Log In',
            error: 'Invalid credentials'
        },
        register: {
            title: 'Create Account',
            submit: 'Sign Up'
        }
    },
    dashboard: {
        welcome: 'Welcome, {name}'
    }
};

// Scope to a feature namespace
const authT = i18n.ns('auth');
authT.t('login.title');   // "Sign In"
authT.t('register.title');  // "Create Account"

// Nested scoping
const loginT = authT.ns('login');
loginT.t('title');   // "Sign In"
loginT.t('submit');  // "Log In"

// Scoped locales share the parent's intl formatters
loginT.intl.number(42);  // "42"

// Dashboard scope
const dashT = i18n.ns('dashboard');
dashT.t('welcome', { name: 'Elena' });  // "Welcome, Elena"
```

## Events


The `LocaleManager` emits three events: `change`, `loading`, and `error`. Subscribe with `on()`, which returns an unsubscribe function.

| Event | When Emitted |
|-------|-------------|
| `change` | After the active locale switches successfully |
| `loading` | When an async loader begins fetching a registered locale |
| `error` | When an async loader fails |

```ts
// Subscribe to locale changes
const unsub = i18n.on('change', (e) => {
    console.log('Locale changed to:', e.code);
    refreshUI();
});

// Listen for loading state (useful for spinners)
const unsubLoading = i18n.on('loading', (e) => {
    showSpinner(`Loading ${e.code}...`);
});

// Handle load failures
const unsubError = i18n.on('error', (e) => {
    showToast(`Failed to load locale: ${e.code}`);
});

// One-time listener
i18n.on('change', (e) => logFirstSwitch(e.code), true);

// Cleanup
unsub();
unsubLoading();
unsubError();
```

You can also use `off()` to remove a listener by reference:

```ts
const handler = (e) => console.log(e.code);
i18n.on('change', handler);

// Later
i18n.off('change', handler);
```

## Updating Translations


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

## Interfaces


```ts
type LocaleType = {
    [K in StrOrNum]: StrOrNum | LocaleType;
};

type ManyLocales<
    Locale extends LocaleType,
    Code extends string
> = {
    [P in Code]: {
        code: Code;
        text: string;
        labels: Locale | DeepOptional<Locale>;
    };
};

type LocaleOpts<
    Locale extends LocaleType,
    Code extends string = string
> = {
    current: Code;
    fallback: Code;
    locales: ManyLocales<Locale, Code>;
};

interface LazyLocale<Locale extends LocaleType> {
    text: string;
    loader: () => Promise<Locale>;
}

type LocaleEventName = 'change' | 'loading' | 'error';

type LocaleListener<Code extends string = string> = (
    e: LocaleEvent<Code>
) => void;

interface IntlFormatters {
    number(value: number, opts?: Intl.NumberFormatOptions): string;
    date(value: Date | number, opts?: Intl.DateTimeFormatOptions): string;
    relative(
        value: number,
        unit: Intl.RelativeTimeFormatUnit,
        opts?: Intl.RelativeTimeFormatOptions
    ): string;
}

class LocaleEvent<Code extends string = string> extends Event {
    code: Code;
}

declare class LocaleManager<
    Locale extends LocaleType,
    Code extends string = string
> extends EventTarget {

    constructor(opts: LocaleOpts<Locale, Code>);

    fallback: Code;
    current: Code;

    on(
        ev: LocaleEventName,
        listener: LocaleListener<Code>,
        once?: boolean
    ): () => void;

    off(
        ev: LocaleEventName,
        listener: LocaleListener<Code>
    ): void;

    locales: { code: Code; text: string }[];

    text<K extends PathLeaves<Locale>>(
        key: K,
        values?: LocaleFormatArgs
    ): string;

    t: LocaleManager<Locale, Code>['text'];

    changeTo(code: Code): Promise<void>;

    updateLang<C extends Code>(
        code: C,
        locale: DeepOptional<Locale>
    ): void;

    register<C extends Code>(
        code: C,
        opts: LazyLocale<Locale>
    ): void;

    isLoaded(code: Code): boolean;

    get intl(): IntlFormatters;

    ns(prefix: string): ScopedLocale<Locale, Code>;

    clone(): LocaleManager<Locale, Code>;
}

declare class ScopedLocale<
    Locale extends LocaleType,
    Code extends string = string
> {

    t(key: string, values?: LocaleFormatArgs): string;

    get intl(): IntlFormatters;

    ns(subPrefix: string): ScopedLocale<Locale, Code>;
}
```

## Type Extractor CLI


The type extractor scans your locale JSON files and generates a TypeScript interface plus a `LocaleCodes` union type, so your `LocaleManager` generics stay in sync with your translation files automatically.

### Usage

```bash
npx logosdx-locale extract --dir ./i18n --out ./src/locale-keys.ts
```

| Flag | Default | Description |
|------|---------|-------------|
| `--dir` | — | Directory containing locale JSON files |
| `--out` | — | Output path for the generated `.ts` file |
| `--locale` | First found | Which locale to use as the type source |
| `--name` | `AppLocale` | Name of the generated interface |
| `--watch` | `false` | Re-generate on file changes |

### Directory Structures

The extractor supports flat files, namespaced subdirectories, and mixed layouts.

```
# Flat — one JSON file per locale
i18n/
├── en.json
├── es.json
└── fr.json

# Namespaced — subdirectories per locale
i18n/
├── en/
│   ├── common.json
│   ├── auth.json
│   └── dashboard.json
├── es/
│   ├── common.json
│   └── auth.json
└── fr/
    └── common.json

# Mixed — top-level keys alongside namespace files
i18n/
├── en.json
├── en/
│   ├── auth.json
│   └── dashboard.json
```

### Generated Output

Given `en/common.json` and `en/auth.json`, the extractor produces a file like this:

```ts
// Auto-generated by @logosdx/localize — do not edit manually

export interface AppLocale {
    common: {
        buttons: {
            save: string;
            cancel: string;
        };
        messages: {
            welcome: string;
            error: string;
        };
    };
    auth: {
        login: {
            title: string;
            username: string;
            password: string;
        };
        errors: {
            invalid: string;
            expired: string;
        };
    };
}

export type LocaleCodes = 'en' | 'es' | 'fr';
```

### Wiring Into LocaleManager

Import the generated types and pass them as generics to `LocaleManager`:

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

// All t() calls are now type-checked against your JSON structure
i18n.t('common.buttons.save');
i18n.t('auth.login.title');
```

### Watch Mode

During development, use `--watch` to regenerate the output file whenever a locale JSON file is added, removed, or modified:

```bash
npx logosdx-locale extract --dir ./i18n --out ./src/locale-keys.ts --watch
```

This pairs well with your dev server so type errors surface immediately when translations change.

### Programmatic API

If you need to integrate extraction into a build script or custom tooling:

```ts
import { scanDirectory, generateOutput } from '@logosdx/localize/extractor';
import { writeFile } from 'node:fs/promises';

// Scan locale files and build a structure descriptor
const scan = await scanDirectory('./i18n', { locale: 'en' });

// Generate the TypeScript source string
const source = generateOutput(scan, { name: 'AppLocale' });

// Write to disk
await writeFile('./src/locale-keys.ts', source);
```
