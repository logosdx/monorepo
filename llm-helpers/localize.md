---
description: Usage patterns for the @logosdx/localize package.
globs: *.ts
---

# @logosdx/localize Usage Patterns


Type-safe internationalization system with path-based message retrieval, template string formatting, locale switching with fallback support, and event-driven locale changes.

## Core API


```typescript
import { LocaleManager, getMessage, format, reachIn, LOC_CHANGE, LocaleEvent } from '@logosdx/localize'
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
        stats: string     // "You have {count} {type}."
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
                stats: 'You have {count} {type}.'
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

    // Event system
    on(ev: LocaleManager.LocaleEventName, listener: LocaleManager.LocaleListener<Code>, once = false)
    off(ev: LocaleManager.LocaleEventName, listener: EventListenerOrEventListenerObject)

    // Core methods
    text<K extends PathLeaves<Locale>>(key: K, values?: LocaleManager.LocaleFormatArgs): string
    changeTo(code: Code): void
    updateLang<C extends Code>(code: C, locale: DeepOptional<Locale>): void
    clone(): LocaleManager<Locale, Code>

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

        export type LocaleEventName = 'locale-change'
        export type LocaleListener<Code extends string = string> = (e: LocaleEvent<Code>) => void
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

// Dynamic path construction with error handling
const getNestedMessage = (section: string, key: string) => {
    const path = `${section}.${key}` as PathLeaves<AppLocale>
    const [message, err] = attemptSync(() => i18n.t(path))

    if (err) {
        console.warn(`Missing translation: ${path}`)
        return `[${path}]` // Fallback display
    }

    return message
}

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
// Returns: "¡Hola, Maria! Bienvenido de vuelta." (if locale is 'es')

// Null safety - null/undefined values are filtered out automatically
const safeMessage = i18n.t('dashboard.greeting', {
    name: null,        // Will be filtered out
    backup: 'User'     // Will be used if name is missing
})

// Using format helper directly
const customMessage = format('Hello {name}, you have {count} items', {
    name: 'Alice',
    count: 10
})
// Returns: "Hello Alice, you have 10 items"
```

## Locale Management


```typescript
// Locale switching with fallback handling
i18n.changeTo('es')  // Switch to Spanish
i18n.changeTo('invalid' as LocaleCode)  // Falls back to fallback locale with console warning

// Available locales
const availableLocales = i18n.locales
// Returns: [{ code: 'en', text: 'English' }, { code: 'es', text: 'Español' }]

// Dynamic locale updates
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

## Event System

**WHY**: Event-driven architecture allows components to react to locale changes without tight coupling, enabling automatic UI updates and resource reloading.

```typescript
// Listen to locale changes
i18n.on('locale-change', (event: LocaleEvent<LocaleCode>) => {
    console.log('Locale changed to:', event.code)
    updateUILanguage(event.code)
    loadLocalizedResources(event.code)
})

// One-time listener
i18n.on('locale-change', (event) => {
    console.log('First locale change:', event.code)
}, true) // once = true

// Cleanup pattern
const handleLocaleChange = (event) => { /* handler logic */ }
i18n.on('locale-change', handleLocaleChange)
// Later cleanup:
i18n.off('locale-change', handleLocaleChange)

// Event object structure
class LocaleEvent<Code extends string = string> extends Event {
    code!: Code  // The new locale code
}

const LOC_CHANGE = 'locale-change'
```

## Helper Functions


```typescript
// Direct helper usage
export const reachIn = <
    O extends LocaleManager.LocaleType = LocaleManager.LocaleType,
    P extends PathLeaves<O> = PathLeaves<O>,
    D extends PathValue<O, P> = PathValue<O, P>
>(obj: O, path: P, defValue: D): PathValue<O, P> | undefined

// String formatting
export const format = (str: string, values: LocaleManager.LocaleFormatArgs): string

// Message retrieval with formatting
export const getMessage = <L extends LocaleManager.LocaleType>(
    locale: L,
    reach: LocaleManager.LocaleReacher<L>,
    values?: LocaleManager.LocaleFormatArgs
): string

// Usage examples
const message = getMessage(localeObject, 'path.to.message', ['param1', 'param2'])
const formatted = format('Hello {name}', { name: 'John' })
const nested = reachIn(localeObject, 'deeply.nested.path', 'default value')
```

## Production Patterns

```typescript
// Resilient locale loading with error handling
const createI18nManager = async (initialLocale: LocaleCode) => {
    const [localeData, err] = await attempt(() => loadLocaleData())

    if (err) {
        console.warn('Failed to load locale data, using defaults:', err)
    }

    const manager = new LocaleManager<AppLocale, LocaleCode>({
        current: initialLocale,
        fallback: 'en',
        locales: localeData || defaultLocales
    })

    // Global error handling for missing translations
    const safeTranslate = (key: PathLeaves<AppLocale>, values?: any) => {
        const [translation, err] = attemptSync(() => manager.t(key, values))

        if (err) {
            console.warn(`Translation error for "${key}":`, err)
            return `[${key}]` // Development fallback
        }

        return translation
    }

    return { manager, t: safeTranslate }
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
```
