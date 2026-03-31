---
description: Usage patterns for the @logosdx/localize package.
globs: '*.ts, *.tsx'
---

# @logosdx/localize Usage Patterns

> **Error handling rule:** Use `attempt()` from `@logosdx/utils` for ALL async locale operations — `changeTo()`, lazy loader functions, and any I/O. Never use try-catch.

Type-safe i18n with async lazy loading, ICU-lite pluralization, Intl formatting, namespace scoping, and observer-based locale events.

## Core Setup


```typescript
import { LocaleManager } from '@logosdx/localize'

// Define your locale shape — all leaf values are strings
interface AppLocale extends LocaleManager.LocaleType {
    greeting: string
    nav: {
        home: string
        logout: string
    }
    products: {
        count: string  // ICU plural syntax
    }
}

type LocaleCode = 'en' | 'es' | 'ja'

const english: AppLocale = {
    greeting: 'Hello, {name}!',
    nav: { home: 'Home', logout: 'Logout' },
    products: { count: '{count, plural, one {# product} other {# products}} in cart' }
}

const i18n = new LocaleManager<AppLocale, LocaleCode>({
    current: 'en',
    fallback: 'en',   // missing keys in current locale fall back to this
    locales: {
        en: { code: 'en', text: 'English', labels: english },
        es: { code: 'es', text: 'Español', labels: spanishPartial }  // DeepOptional<AppLocale>
    }
})
```

## LocaleManager Class


```typescript
class LocaleManager<Locale extends LocaleManager.LocaleType, Code extends string = string> {

    current: Code          // mutable — reflects active locale code
    fallback: Code         // mutable — merge base for missing keys

    // t() is an alias for text() — both are identical
    t<K extends PathLeaves<Locale>>(key: K, values?: LocaleFormatArgs): string
    text<K extends PathLeaves<Locale>>(key: K, values?: LocaleFormatArgs): string

    readonly intl: IntlFormatters         // lazy-created, re-created on locale change
    readonly locales: { code: Code; text: string }[]  // loaded + registered-but-unloaded

    on(ev: LocaleEventName, listener: LocaleListener<Code>): () => void
    once(ev: LocaleEventName, listener: LocaleListener<Code>): () => void
    off(ev: LocaleEventName, listener?: LocaleListener<Code>): void

    register<C extends Code>(code: C, opts: LazyLocale<Locale>): void
    isLoaded(code: Code): boolean
    async changeTo(code: Code): Promise<void>
    updateLang<C extends Code>(code: C, locale: DeepOptional<Locale>): void

    ns(prefix: string): ScopedLocale<Locale, Code>
    clone(): LocaleManager<Locale, Code>
}
```

## Types


```typescript
namespace LocaleManager {

    type LocaleType = { [K in StrOrNum]: StrOrNum | LocaleType }
    type LocaleReacher<T> = PathLeaves<T>
    type LocaleFormatArgs = Array<StrOrNum> | Record<StrOrNum, StrOrNum>

    type ManyLocales<Locale, Code extends string> = {
        [P in Code]: { code: Code; text: string; labels: Locale | DeepOptional<Locale> }
    }

    interface LocaleOpts<Locale extends LocaleType, Code extends string = string> {
        current: Code
        fallback: Code
        locales: ManyLocales<Locale, Code>
    }

    interface LazyLocale<Locale extends LocaleType> {
        text: string                          // human-readable label for language picker
        loader: () => Promise<Locale>         // called on first changeTo()
    }

    interface LocaleEventShape<Code extends string = string> {
        change:  { code: Code }
        loading: { code: Code }
        error:   { code: Code }
    }

    type LocaleEventName = keyof LocaleEventShape
    type LocaleListener<Code extends string = string> = (data: { code: Code }) => void

    interface IntlFormatters {
        number(value: number, opts?: Intl.NumberFormatOptions): string
        date(value: Date | number, opts?: Intl.DateTimeFormatOptions): string
        relative(value: number, unit: Intl.RelativeTimeFormatUnit, opts?: Intl.RelativeTimeFormatOptions): string
    }
}
```

## Translation — t() / text()


```typescript
// Named object substitution — {name}, {count}, ...
i18n.t('greeting', { name: 'Maria' })
// "Hello, Maria!"

// Positional array substitution — {0}, {1}, ...
i18n.t('greeting', ['Maria'])
// "Hello, Maria!"  (if greeting = 'Hello, {0}!')

// Nested key using dot-path — fully type-safe via PathLeaves<Locale>
i18n.t('nav.logout')
// "Logout"

// Missing key returns bracketed key string + warns in non-production
i18n.t('does.not.exist' as any)
// "[does.not.exist]" + console.warn
```

## ICU-lite Pluralization


```typescript
// ICU plural syntax in locale labels:
// {varName, plural, zero {…} one {# item} other {# items}}
// # is replaced by the numeric count value

const labels = {
    cart: '{count, plural, one {# item} other {# items}} in cart',
    inbox: '{unread, plural, zero {No messages} one {# message} other {# messages}}'
}

i18n.t('cart', { count: 0 })    // "0 items in cart"  (falls through to 'other')
i18n.t('cart', { count: 1 })    // "1 item in cart"
i18n.t('cart', { count: 5 })    // "5 items in cart"
i18n.t('inbox', { unread: 0 })  // "No messages"  (explicit 'zero' category)

// Plural categories resolved via Intl.PluralRules — locale-aware
// Supported: zero | one | two | few | many | other
// 'zero' exact-counts override Intl category; 'other' is final fallback
```

## Intl Formatting

> **Always use `manager.intl.date()`, `manager.intl.number()`, and `manager.intl.relative()` for locale-aware formatting.** Do NOT create raw `Intl.DateTimeFormat`, `Intl.NumberFormat`, or `Intl.RelativeTimeFormat` instances directly — the manager's intl formatters are cached, locale-aware, and automatically re-created when the locale changes.

```typescript
// Intl formatters — lazy-created, re-created on locale change
// All Intl formatters are cached by locale + serialized options
// Access via manager.intl (or i18n.intl)
//
// CORRECT:   i18n.intl.date(new Date(), { dateStyle: 'long' })
// INCORRECT: new Intl.DateTimeFormat(locale, opts).format(date)
const { intl } = i18n;

// Date formatting
intl.date(new Date(), { dateStyle: 'long' });        // "March 15, 2026" / "15 mars 2026"
intl.date(new Date(), { dateStyle: 'full' });         // full locale-aware date
intl.date(new Date());                                // "3/15/2026" — default short format
intl.date(Date.now());                                // accepts number or Date

// Number formatting
intl.number(1234.56);                                  // "1,234.56" / "1.234,56"
intl.number(1234.56, { style: 'currency', currency: 'USD' }); // "$1,234.56"
intl.number(0.42, { style: 'percent' });               // "42%"

// Relative time
intl.relative(-3, 'day');                              // "3 days ago" / "hace 3 días"
intl.relative(2, 'hour');                              // "in 2 hours"
intl.relative(1, 'month', { numeric: 'auto' });       // "next month"
```

## Async Lazy Loading


```typescript
import { attempt } from '@logosdx/utils'

// Register lazy loaders — called on first changeTo()
// The loader function returns the locale labels (must be async)
i18n.register('ja', {
    text: '日本語',
    loader: async () => {
        const [mod, err] = await attempt(() => import('./locales/ja.json'));
        if (err) throw err;
        return mod.default;
    }
})

i18n.register('es', {
    text: 'Español',
    loader: async () => {
        const [mod, err] = await attempt(() => import('./locales/es.json'));
        if (err) throw err;
        return mod.default;
    }
})

// Check load status
i18n.isLoaded('en')  // true — provided in constructor
i18n.isLoaded('ja')  // false — registered but not fetched yet

// Switch locale — triggers lazy load
// ALWAYS wrap changeTo() with attempt()
const [, err] = await attempt(() => i18n.changeTo('ja'))
if (err) console.error('Failed to load locale:', err)

i18n.isLoaded('ja')  // true now

// Race guard: concurrent changeTo() calls share one loader execution
const [, raceErr] = await attempt(() => Promise.all([
    i18n.changeTo('de'),
    i18n.changeTo('de')
]))  // loader ran exactly once
if (raceErr) console.error('Failed:', raceErr)

// Unknown code with no registration: warns + falls back to fallback locale
const [, unknownErr] = await attempt(() => i18n.changeTo('xx' as LocaleCode))
if (unknownErr) console.error('Unknown locale:', unknownErr)
```

## Lifecycle Events


```typescript
import { attempt } from '@logosdx/utils'

// Event sequence for a lazy-loaded locale:
// 1. 'loading' fires when loader starts
// 2. 'change'  fires on success
// 3. 'error'   fires on failure (promise also rejects)

// on() returns a cleanup function
const stopLoading = i18n.on('loading', ({ code }) => showSpinner(`Loading ${code}...`))
const stopChange = i18n.on('change', ({ code }) => console.log('Active locale:', code))
const stopError = i18n.on('error', ({ code }) => showToast(`Failed: ${code}`))

const [, changeErr] = await attempt(() => i18n.changeTo('ja'))
if (changeErr) console.error('Locale change failed:', changeErr)

stopLoading()  // cleanup
stopChange()
stopError()

// once() for one-shot reactions
i18n.once('change', ({ code }) => analytics.track('locale_changed', { code }))

// off() to remove by reference or all
i18n.on('change', handler)
i18n.off('change', handler)   // remove specific
i18n.off('change')            // remove all change listeners
```

## Namespace Scoping


```typescript
// ns() creates a ScopedLocale that prepends a prefix to all t() keys
const authT = i18n.ns('auth')
authT.t('login.title')    // resolves to i18n.t('auth.login.title')
authT.t('errors.invalid') // resolves to i18n.t('auth.errors.invalid')

// Scopes nest
const loginT = authT.ns('login')
loginT.t('title')          // resolves to i18n.t('auth.login.title')

// ScopedLocale passes intl and format values through to parent
authT.intl.number(9.99, { style: 'currency', currency: 'USD' })
authT.t('welcome', { name: 'Maria' })
```

```typescript
class ScopedLocale<Locale extends LocaleManager.LocaleType, Code extends string = string> {

    t(key: string, values?: LocaleManager.LocaleFormatArgs): string
    ns(subPrefix: string): ScopedLocale<Locale, Code>
    readonly intl: LocaleManager.IntlFormatters
}
```

## Runtime Label Updates


```typescript
// updateLang() merges new labels into an existing locale
// If the target is the current locale, emits 'change' and resets intl cache
i18n.updateLang('en', {
    nav: { home: 'Dashboard' }  // partial update — other keys untouched
})

// Use case: override specific strings from a server config
const [overrides, err] = await attempt(() => fetch('/api/locale-overrides/en').then(r => r.json()))
if (!err) i18n.updateLang('en', overrides)
```

## Cloning


```typescript
// clone() creates an independent LocaleManager with the same config
// Useful for isolated contexts (email templating, SSR)
const serverI18n = i18n.clone()
const [, cloneErr] = await attempt(() => serverI18n.changeTo('ja'))  // doesn't affect the original
if (cloneErr) console.error('Clone locale change failed:', cloneErr)
```

## Standalone Helpers


```typescript
import { format, getMessage, reachIn } from '@logosdx/localize'

// reachIn — deep path accessor with default fallback
reachIn(labels, 'nav.home', '[nav.home]')
// "Home" — or "[nav.home]" if key is missing

// format — replace {key} / {0} placeholders in a string
format('Hello, {name}!', { name: 'Maria' })
// "Hello, Maria!"

format('Items: {0}, {1}', ['apples', 'bananas'])
// "Items: apples, bananas"

// getMessage — full pipeline: reachIn + parsePlural + format
// This is what LocaleManager.t() uses internally
getMessage(labels, 'products.count', { count: 3 }, 'en')
// "3 products in cart"
```

```typescript
import { parsePlural } from '@logosdx/localize'

// ICU-lite plural resolver — useful outside of LocaleManager
parsePlural('{count, plural, one {# thing} other {# things}}', { count: 5 }, 'en')
// "5 things"
```

```typescript
import { createIntlFormatters } from '@logosdx/localize'

// Cached IntlFormatters factory — same as LocaleManager.intl uses internally
const fmt = createIntlFormatters('fr')
fmt.number(1234.56)                           // "1 234,56"
fmt.date(new Date(), { dateStyle: 'full' })   // "mercredi 18 février 2026"
fmt.relative(-1, 'day')                       // "il y a 1 jour"
```

## Type Extractor CLI


```bash
# Generate TypeScript types from locale JSON files
npx logosdx-locale extract --dir ./i18n --out ./src/locale-keys.ts

# Options
# --dir <path>     Directory containing locale JSON files (required)
# --out <path>     Output path for generated .ts file (required)
# --locale <code>  Which JSON to use as type source (default: 'en')
# --name <name>    Interface name to generate (default: 'AppLocale')
# --watch          Re-generate on file changes
```

```typescript
// Programmatic extractor API
import { scanDirectory, generateOutput } from '@logosdx/localize/extractor'
import { writeFile } from 'node:fs/promises'
import { attempt } from '@logosdx/utils'

const scan = scanDirectory('./i18n', 'en')
const source = generateOutput(scan, 'AppLocale')
const [, writeErr] = await attempt(() => writeFile('./src/locale-keys.ts', source))
if (writeErr) console.error('Failed to write locale types:', writeErr)
```

```typescript
interface ScanResult {
    rootShape: Record<string, unknown> | null  // from flat en.json
    namespaces: Record<string, Record<string, unknown>>  // from subdirectories
    codes: string[]  // all locale codes discovered
}
```

## React Integration


```typescript
import { LocaleManager } from '@logosdx/localize'
import { createLocalizeContext } from '@logosdx/react'

const i18n = new LocaleManager<AppLocale, LocaleCode>({ current: 'en', fallback: 'en', locales })

// Returns [Provider, useHook] tuple
export const [AppLocaleProvider, useAppLocale] = createLocalizeContext(i18n)
```

```tsx
<AppLocaleProvider>
    <App />
</AppLocaleProvider>
```

```typescript
// In any child component
const { t, locale, changeTo, locales, instance } = useAppLocale()

t('home.greeting', { name: 'World' })  // type-safe translation
locale                                  // current code, triggers re-render on change
changeTo('es')                          // switch locale
locales                                 // [{ code: 'en', text: 'English' }, ...]
instance                                // raw LocaleManager escape hatch
```

## Package Exports


```typescript
// Main entry
import {
    LocaleManager,
    ScopedLocale,
    createIntlFormatters,
    parsePlural,
    format,
    getMessage,
    reachIn,
} from '@logosdx/localize'

// Extractor subpath (Node.js only)
import { scanDirectory, generateOutput } from '@logosdx/localize/extractor'

// CLI binary
// npx logosdx-locale extract ...
```
