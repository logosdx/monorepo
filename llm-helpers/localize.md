---
description: Usage patterns for the @logosdx/localize package.
globs: *.ts
---

# @logosdx/localize Usage Patterns


Type-safe internationalization system with path-based message retrieval, template string formatting, ICU-lite pluralization, Intl formatting, async locale loading, namespace scoping, and event-driven locale changes.

## Core API


```typescript
import {
    LocaleManager,
    LocaleEvent,
    ScopedLocale,
    getMessage,
    format,
    reachIn,
    parsePlural,
    createIntlFormatters
} from '@logosdx/localize'

import { attempt } from '@logosdx/utils'

// Define your locale structure for type safety
interface AppLocale {
    common: {
        buttons: { save: string; cancel: string }
        messages: { welcome: string; error: string }
    }
    auth: {
        login: { title: string; username: string; password: string }
        errors: { invalid: string; expired: string }
    }
    dashboard: {
        greeting: string  // "Hello, {name}! Welcome back."
        stats: string     // "You have {count, plural, one {# item} other {# items}}."
    }
}

type LocaleCode = 'en' | 'es' | 'fr'

// Create locale configuration
const locales: LocaleManager.ManyLocales<AppLocale, LocaleCode> = {
    en: {
        code: 'en',
        text: 'English',
        labels: {
            common: {
                buttons: { save: 'Save', cancel: 'Cancel' },
                messages: { welcome: 'Welcome', error: 'Error occurred' }
            },
            auth: {
                login: { title: 'Sign In', username: 'Username', password: 'Password' },
                errors: { invalid: 'Invalid credentials', expired: 'Session expired' }
            },
            dashboard: {
                greeting: 'Hello, {name}! Welcome back.',
                stats: 'You have {count, plural, one {# item} other {# items}}.'
            }
        }
    }
}

// Initialize locale manager
const i18n = new LocaleManager<AppLocale, LocaleCode>({
    current: 'en',
    fallback: 'en',
    locales
})

// Type-safe message retrieval
const saveButton = i18n.t('common.buttons.save')  // "Save"
const greeting = i18n.t('dashboard.greeting', { name: 'John' })  // "Hello, John! Welcome back."
const stats = i18n.t('dashboard.stats', { count: 5 })  // "You have 5 items."
```

## LocaleManager Class


```typescript
class LocaleManager<
    Locale extends LocaleManager.LocaleType,
    Code extends string = string
> extends EventTarget {

    fallback: Code
    current: Code
    t: LocaleManager<Locale, Code>['text']  // Alias for text method

    constructor(opts: LocaleManager.LocaleOpts<Locale, Code>)

    // Event system — on() returns an unsubscribe function
    on(ev: LocaleManager.LocaleEventName, listener: LocaleManager.LocaleListener<Code>, once?: boolean): () => void
    off(ev: LocaleManager.LocaleEventName, listener: LocaleManager.LocaleListener<Code>): void

    // Core methods
    text<K extends PathLeaves<Locale>>(key: K, values?: LocaleManager.LocaleFormatArgs): string
    async changeTo(code: Code): Promise<void>
    updateLang<C extends Code>(code: C, locale: DeepOptional<Locale>): void
    clone(): LocaleManager<Locale, Code>

    // Async loading
    register<C extends Code>(code: C, opts: LocaleManager.LazyLocale<Locale>): void
    isLoaded(code: Code): boolean

    // Namespace scoping
    ns(prefix: string): ScopedLocale<Locale, Code>

    // Intl formatting (auto-uses current locale)
    get intl(): LocaleManager.IntlFormatters

    // Getters
    get locales(): Array<{ code: Code; text: string }>
}

// Type definitions
declare module './manager.ts' {
    export namespace LocaleManager {
        export type LocaleReacher<T> = PathLeaves<T>
        export type LocaleFormatArgs = Array<StrOrNum> | Record<StrOrNum, StrOrNum>
        export type LocaleType = { [K in StrOrNum]: StrOrNum | LocaleType }

        export type ManyLocales<Locale extends LocaleType, Code extends string> = {
            [P in Code]: {
                code: Code
                text: string
                labels: Locale | DeepOptional<Locale>
            }
        }

        export type LocaleOpts<Locale extends LocaleType, Code extends string = string> = {
            current: Code
            fallback: Code
            locales: ManyLocales<Locale, Code>
        }

        export interface LazyLocale<Locale extends LocaleType> {
            text: string
            loader: () => Promise<Locale>
        }

        export type LocaleEventName = 'change' | 'loading' | 'error'
        export type LocaleListener<Code extends string = string> = (e: LocaleEvent<Code>) => void

        export interface IntlFormatters {
            number(value: number, opts?: Intl.NumberFormatOptions): string
            date(value: Date | number, opts?: Intl.DateTimeFormatOptions): string
            relative(value: number, unit: Intl.RelativeTimeFormatUnit, opts?: Intl.RelativeTimeFormatOptions): string
        }
    }
}
```

## Path-Based Message Retrieval


**WHY**: The `PathLeaves<T>` type provides compile-time safety by generating union types of all valid dot-notation paths in your locale structure. This prevents typos and ensures translations exist.

```typescript
// Type-safe path navigation with PathLeaves<T>
type MessagePaths = PathLeaves<AppLocale>
// Generates: "common.buttons.save" | "common.buttons.cancel" | "auth.login.title" | etc.

// Direct message access
const messages = {
    save: i18n.t('common.buttons.save'),
    loginTitle: i18n.t('auth.login.title'),
    invalidCreds: i18n.t('auth.errors.invalid')
}

// Missing keys return `[key]` with a dev-mode console warning
const missing = i18n.t('nonexistent.key' as any)
// Returns: "[nonexistent.key]"
// Dev console: "Missing translation key: "nonexistent.key""

// Using reachIn helper directly
const directAccess = reachIn(
    localeObject,
    'common.buttons.save',
    'Save' // Default fallback
)
```

## Template Formatting


**WHY**: Supports both array-based (positional) and object-based (named) substitution with automatic null/undefined filtering for robust template processing.

```typescript
// Array-based substitution (positional)
const statsMessage = i18n.t('dashboard.stats', [5, 'notifications'])
// Returns: "You have 5 notifications."

// Object-based substitution (named parameters)
const greetingMessage = i18n.t('dashboard.greeting', { name: 'Maria' })
// Returns: "Hello, Maria! Welcome back."

// Null safety — null/undefined values are filtered out automatically
const safeMessage = format('Hello {name}', { name: null as any })
// Returns: "Hello {name}" (placeholder preserved when value is missing)

// Using format helper directly
const customMessage = format('Hello {name}, you have {count} items', {
    name: 'Alice',
    count: 10
})
// Returns: "Hello Alice, you have 10 items"
```

## Pluralization


**WHY**: ICU-lite syntax provides locale-aware pluralization without requiring a full ICU library. Uses `Intl.PluralRules` for correct category selection across languages.

```typescript
// ICU-lite plural syntax in translation strings
const labels = {
    items: '{count, plural, one {# item} other {# items}}',
    messages: '{count, plural, zero {No messages} one {# message} other {# messages}}'
}

// Pluralization resolves automatically during t() calls
i18n.t('items', { count: 1 })   // "1 item"
i18n.t('items', { count: 5 })   // "5 items"
i18n.t('messages', { count: 0 }) // "No messages"

// Supported categories: zero, one, two, few, many, other
// Category selection uses Intl.PluralRules for locale correctness

// Direct usage via parsePlural helper
parsePlural('{n, plural, one {# thing} other {# things}}', { n: 3 }, 'en')
// Returns: "3 things"
```

## Intl Formatting


**WHY**: Wraps `Intl.NumberFormat`, `Intl.DateTimeFormat`, and `Intl.RelativeTimeFormat` with caching so formatters are created once per locale+options combination.

```typescript
// The intl getter auto-uses the current locale
const fmt = i18n.intl

// Number formatting
fmt.number(1499.99)                                       // "1,499.99"
fmt.number(9.99, { style: 'currency', currency: 'USD' })  // "$9.99"
fmt.number(0.85, { style: 'percent' })                     // "85%"

// Date formatting
fmt.date(new Date())                                       // "2/18/2026"
fmt.date(Date.now(), { dateStyle: 'full' })                // "Wednesday, February 18, 2026"

// Relative time formatting
fmt.relative(-3, 'day')                                    // "3 days ago"
fmt.relative(2, 'hour')                                    // "in 2 hours"

// Also available via createIntlFormatters directly
const esFmt = createIntlFormatters('es')
esFmt.number(1499.99)  // "1.499,99"

// The intl getter updates when locale changes
await i18n.changeTo('es')
i18n.intl.date(new Date())  // "18/2/2026"
```

## Async Loading


**WHY**: Lazy-loading locales avoids bundling every language upfront. The `register()` + `changeTo()` pattern keeps the initial bundle small and loads translations on demand.

```typescript
// Register lazy-loaded locales — only metadata, no labels loaded yet
i18n.register('es', {
    text: 'Español',
    loader: () => import('./locales/es.json').then(m => m.default)
})

i18n.register('fr', {
    text: 'Français',
    loader: () => fetch('/api/locales/fr').then(r => r.json())
})

// Check if a locale is already loaded into memory
i18n.isLoaded('es')  // false

// changeTo() triggers the loader automatically
// Emits: 'loading' event → loads → 'change' event
await i18n.changeTo('es')

i18n.isLoaded('es')  // true (cached for subsequent switches)

// The locales getter includes both loaded and registered locales
i18n.locales
// [{ code: 'en', text: 'English' }, { code: 'es', text: 'Español' }, { code: 'fr', text: 'Français' }]

// Error handling — emits 'error' event on loader failure
i18n.on('error', (e) => {
    console.error('Failed to load locale:', e.code)
})
```

## Namespace Scoping


**WHY**: Large apps need feature-scoped translations to avoid key collisions and keep components focused on their own namespace. `ns()` creates a lightweight proxy without duplicating data.

```typescript
// Create a scoped translator for a feature module
const authT = i18n.ns('auth')

authT.t('login.title')     // resolves to i18n.t('auth.login.title')
authT.t('errors.invalid')  // resolves to i18n.t('auth.errors.invalid')

// Scopes can be nested
const loginT = authT.ns('login')
loginT.t('title')           // resolves to i18n.t('auth.login.title')

// ScopedLocale also exposes intl formatting
authT.intl.number(42)       // delegates to i18n.intl.number(42)

// ScopedLocale class is also available for direct construction
const scoped = new ScopedLocale(i18n, 'dashboard')
scoped.t('greeting', { name: 'Alice' })
```

## Event System


**WHY**: Event-driven architecture allows components to react to locale changes without tight coupling, enabling automatic UI updates and resource reloading.

```typescript
// Events: 'change', 'loading', 'error'
// on() returns an unsubscribe function for cleanup

// Listen to locale changes
const unsub = i18n.on('change', (event: LocaleEvent<LocaleCode>) => {
    console.log('Locale changed to:', event.code)
    updateUILanguage(event.code)
})

// Loading events fire before async locale fetch
i18n.on('loading', (event) => {
    showLoadingSpinner(event.code)
})

// Error events fire when a lazy loader fails
i18n.on('error', (event) => {
    console.error('Failed to load:', event.code)
})

// One-time listener
i18n.on('change', (event) => {
    console.log('First change:', event.code)
}, true) // once = true

// Cleanup via returned function (preferred)
const unsub2 = i18n.on('change', handler)
unsub2()

// Or cleanup via off()
i18n.off('change', handler)

// Event object structure
class LocaleEvent<Code extends string = string> extends Event {
    code!: Code  // The locale code associated with the event
}
```

## Locale Management


```typescript
// Async locale switching
await i18n.changeTo('es')

// If locale is not found and not registered, falls back with console warning
await i18n.changeTo('invalid' as LocaleCode)
// Console: "WARNING: Locale 'invalid' not found. Using fallback 'en' instead."

// Available locales (includes both loaded and registered)
const availableLocales = i18n.locales
// Returns: [{ code: 'en', text: 'English' }, { code: 'es', text: 'Español' }]

// Dynamic locale updates (merges into existing labels)
i18n.updateLang('en', {
    common: {
        buttons: {
            save: 'Save Changes'  // Update existing translation
        }
    }
})

// Cloning for different contexts (admin vs user translations)
const adminI18n = i18n.clone()
adminI18n.updateLang('en', {
    common: { buttons: { save: 'Admin Save' } }
})
```

## Helper Functions


```typescript
// Direct helper usage
export const reachIn = <
    O extends LocaleManager.LocaleType,
    P extends PathLeaves<O>,
    D extends PathValue<O, P>
>(obj: O, path: P, defValue: D): PathValue<O, P> | undefined

// String formatting
export const format = (str: string, values: LocaleManager.LocaleFormatArgs): string

// Message retrieval with formatting and pluralization
export const getMessage = <L extends LocaleManager.LocaleType>(
    locale: L,
    reach: LocaleManager.LocaleReacher<L>,
    values?: LocaleManager.LocaleFormatArgs,
    localeCode?: string  // defaults to 'en', used for plural rules
): string

// ICU-lite plural parsing
export const parsePlural = (
    str: string,
    values: LocaleManager.LocaleFormatArgs,
    locale: string
): string

// Intl formatter factory
export const createIntlFormatters = (locale: string): LocaleManager.IntlFormatters

// Usage examples
const message = getMessage(localeObject, 'path.to.message', { count: 5 }, 'en')
const formatted = format('Hello {name}', { name: 'John' })
const nested = reachIn(localeObject, 'deeply.nested.path', 'default value')
const plural = parsePlural('{n, plural, one {# cat} other {# cats}}', { n: 3 }, 'en')
const fmt = createIntlFormatters('es')
```

## Production Patterns


```typescript
// Resilient locale loading with async registration
const createI18nManager = (initialLocale: LocaleCode) => {

    const manager = new LocaleManager<AppLocale, LocaleCode>({
        current: initialLocale,
        fallback: 'en',
        locales: {
            en: { code: 'en', text: 'English', labels: defaultLabels }
        }
    })

    // Register all other locales as lazy-loaded
    manager.register('es', {
        text: 'Español',
        loader: () => import('./locales/es.json').then(m => m.default)
    })

    manager.register('fr', {
        text: 'Français',
        loader: () => import('./locales/fr.json').then(m => m.default)
    })

    // Error monitoring
    manager.on('error', (e) => {
        reportError(`Failed to load locale: ${e.code}`)
    })

    return manager
}

// Environment-aware locale detection
const getSystemLocale = (): LocaleCode => {

    if (typeof navigator !== 'undefined') {

        const browserLang = navigator.language.split('-')[0] as LocaleCode
        return ['en', 'es', 'fr'].includes(browserLang) ? browserLang : 'en'
    }

    // Node.js environment
    const nodeLang = process.env.LANG?.split('.')[0]?.split('_')[0] as LocaleCode
    return nodeLang || 'en'
}

// Feature-scoped usage in components
const useAuth = (i18n: LocaleManager<AppLocale, LocaleCode>) => {

    const t = i18n.ns('auth')

    return {
        loginTitle: t.t('login.title'),
        formatPrice: (n: number) => t.intl.number(n, { style: 'currency', currency: 'USD' })
    }
}
```
