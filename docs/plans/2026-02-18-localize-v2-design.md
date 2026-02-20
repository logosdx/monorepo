# @logosdx/localize v2 Design


## Overview

Evolve LocaleManager into a mid-tier production i18n tool by fixing bugs, adding ICU-lite pluralization, Intl formatting, async locale loading, and namespace scoping.

Approach: extend the existing class with new methods and extracted helpers. No rewrite, no plugin system.


## Bug Fixes & Cleanup Pattern


### Bugs

1. **`format()` filter** (`helpers.ts:95`): `v !== undefined || v !== null` always true. Change to `&&`.
2. **`format()` length check** (`helpers.ts:98`): `values.length` is `undefined` on plain objects. Use `Object.keys(values).length` for objects.
3. **`reachIn` fallback**: reduce returns parent object instead of `undefined` when path not found, so `defValue` is never returned.

### Cleanup pattern

- `on()` returns an unsubscribe function (aligns with observer, fetch, dom)
- `off()` stays for manual removal

### Missing key handling

- Return `[key]` instead of `'?'` when key not found
- `console.warn` in dev mode (`process.env.NODE_ENV !== 'production'`)

### Event names

Drop `locale-` prefix. Event names become `change`, `loading`, `error`.

```typescript
type LocaleEventName = 'change' | 'loading' | 'error'
```

Drop `LOC_CHANGE` constant entirely — type-checked strings are sufficient.


## ICU-Lite Pluralization


### Syntax

```
{count, plural, zero {No messages} one {# item} other {# items}}
```

Supported categories: `zero`, `one`, `two`, `few`, `many`, `other` — resolved via `Intl.PluralRules` for locale-aware correctness.

### Implementation

- New `plural.ts` file with `parsePlural()` helper
- `format()` calls `parsePlural()` before variable substitution
- `#` inside plural blocks gets replaced with the actual count value
- No nested ICU (no `select` inside `plural`)

### Example

```typescript
const en = {
    items: '{count, plural, one {# item} other {# items}}',
    inbox: '{count, plural, zero {No messages} one {# message} other {# messages}}'
}

i18n.t('items', { count: 1 })   // "1 item"
i18n.t('items', { count: 5 })   // "5 items"
i18n.t('inbox', { count: 0 })   // "No messages"
```


## Intl Formatting Helpers


### API

```typescript
i18n.intl.number(1499.99)                                          // "1,499.99" (en)
i18n.intl.number(1499.99, { style: 'currency', currency: 'USD' }) // "$1,499.99"
i18n.intl.number(0.75, { style: 'percent' })                      // "75%"

i18n.intl.date(new Date())                                         // "2/18/2026" (en)
i18n.intl.date(new Date(), { dateStyle: 'full' })                  // "Wednesday, February 18, 2026"

i18n.intl.relative(-3, 'day')                                      // "3 days ago"
i18n.intl.relative(2, 'hour')                                      // "in 2 hours"
```

### Implementation

- New `intl.ts` with `createIntlFormatters(locale: string)` factory
- Returns cached `Intl.NumberFormat`, `Intl.DateTimeFormat`, `Intl.RelativeTimeFormat` instances
- Cache keyed by `locale + serialized options`
- Cache invalidated lazily on `changeTo()`
- `intl` property on manager is a getter returning formatters bound to `this.current`

### Types

```typescript
export namespace LocaleManager {
    export interface IntlFormatters {
        number(value: number, opts?: Intl.NumberFormatOptions): string
        date(value: Date | number, opts?: Intl.DateTimeFormatOptions): string
        relative(value: number, unit: Intl.RelativeTimeFormatUnit, opts?: Intl.RelativeTimeFormatOptions): string
    }
}
```


## Async Locale Loading


### API

```typescript
i18n.register('es', { text: 'Español', loader: () => import('./locales/es.json') })
i18n.register('fr', { text: 'Français', loader: () => import('./locales/fr.json') })

await i18n.changeTo('es')  // loads, caches, switches, emits
i18n.changeTo('en')         // already loaded, resolves immediately
```

### Implementation

- Private `loaders` map: `Map<Code, { text: string, loader: () => Promise<Locale> }>`
- `register(code, { text, loader })` stores without executing
- `changeTo()` return type: `void` → `Promise<void>`
    - Locale in `#_locales`: resolves immediately
    - Registered loader: calls it, stores result, switches
    - Loader fails: stays on current locale, warns, rejects promise
- `locales` getter includes registered-but-unloaded locales
- New `isLoaded(code): boolean` method

### Events

- `loading` fires before async load starts
- `change` fires after load completes and switch happens
- `error` fires if loader rejects


## Namespace Scoping


### API

```typescript
const authT = i18n.ns('auth')
authT.t('login.title')              // resolves to i18n.t('auth.login.title')

const loginT = authT.ns('login')
loginT.t('title')                    // resolves to i18n.t('auth.login.title')

authT.format.number(9.99)           // Intl formatters inherited
```

### Implementation

- New `scoped.ts` with `ScopedLocale` class
- Holds reference to parent manager + prefix string
- `t(key, values?)` prepends prefix, delegates to parent `text()`
- `intl` getter delegates to parent
- `ns(subPrefix)` returns new `ScopedLocale` with concatenated prefix
- Keys typed as `string` (not path-narrowed) — full type safety is a future enhancement


## Performance


- **RegExp caching**: module-level `Map<string, RegExp>` in `format()` instead of creating per call
- **`#merge()` optimization**: single `merge(clone(fallback), current)` instead of two clones + two merges
- **Intl formatter caching**: covered in Intl section


## File Organization


```
packages/localize/src/
├── index.ts      # Barrel exports (updated)
├── types.ts      # Type definitions (updated)
├── manager.ts    # LocaleManager (extended)
├── helpers.ts    # format(), getMessage(), reachIn() (bug fixes)
├── plural.ts     # NEW — parsePlural() ICU-lite parser
├── intl.ts       # NEW — createIntlFormatters() factory
└── scoped.ts     # NEW — ScopedLocale class
```


## Breaking Changes


| Change | Risk |
|--------|------|
| Missing key returns `[key]` instead of `'?'` | Low — `'?'` was useless |
| `changeTo()` returns `Promise<void>` instead of `void` | Low — ignoring returned Promise is valid |
| Event names drop `locale-` prefix | Medium — consumers must update listeners |
| `LOC_CHANGE` constant removed | Medium — consumers must use string `'change'` |
