# @logosdx/localize v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Evolve LocaleManager into a mid-tier production i18n tool with bug fixes, ICU-lite pluralization, Intl formatting, async locale loading, and namespace scoping.

**Architecture:** Extend the existing LocaleManager class with new methods and extracted helpers in new files (`plural.ts`, `intl.ts`, `scoped.ts`). No rewrite, no plugin system. TDD throughout.

**Tech Stack:** TypeScript, Vitest, `Intl.PluralRules`, `Intl.NumberFormat`, `Intl.DateTimeFormat`, `Intl.RelativeTimeFormat`

**Design doc:** `docs/plans/2026-02-18-localize-v2-design.md`

**Test file locations:**
- Main tests: `tests/src/localize.ts` (existing — uses `@logosdx/localize` imports)
- New test files will be added alongside for new features
- Helpers: `tests/src/_helpers.ts` (sandbox, stubWarn, etc.)

**Source files:**
- `packages/localize/src/helpers.ts` — format(), getMessage(), reachIn(), LocaleEvent
- `packages/localize/src/manager.ts` — LocaleManager class
- `packages/localize/src/types.ts` — module augmentation with namespace types
- `packages/localize/src/index.ts` — barrel exports

**Note on tests:** Existing tests use `@logosdx/localize` package imports (not relative). This diverges from CLAUDE.md guidance but is the established pattern in this test file. New tests should follow the same pattern for consistency within the file. The tests also use `sandbox` from `sinon` via `_helpers.ts`.

**Note on event name migration:** The existing test file references `'locale-change'` in several places. These must be updated to `'change'` as part of Task 2. The React binding (`packages/react/src/localize.ts`) also references `'locale-change'` and must be updated.

---

### Task 1: Fix `format()` bugs

**Files:**
- Modify: `packages/localize/src/helpers.ts:91-120`
- Test: `tests/src/localize.ts`

**Step 1: Write failing tests for the bugs**

Add these tests inside the existing `describe('@logosdx/localize', ...)` block, after the last `it()`:

```typescript
it('filters out undefined and null from array values', () => {

    const lang = { msg: 'Hello {0} and {1}' };

    const instance = new LocaleManager<typeof lang, 'en'>({
        current: 'en',
        fallback: 'en',
        locales: { en: { code: 'en', text: 'English', labels: lang } }
    });

    // The bug: || instead of && means nothing gets filtered
    const result = instance.text('msg', ['World', undefined as any]);
    expect(result).to.eq('Hello World and {1}');
});

it('handles empty object values without error', () => {

    const lang = { msg: 'Hello {name}' };

    const instance = new LocaleManager<typeof lang, 'en'>({
        current: 'en',
        fallback: 'en',
        locales: { en: { code: 'en', text: 'English', labels: lang } }
    });

    // The bug: values.length on object is undefined, not 0
    const result = instance.text('msg', {} as any);
    expect(result).to.eq('Hello {name}');
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test localize`
Expected: At least one new test fails

**Step 3: Fix `format()` in helpers.ts**

In `packages/localize/src/helpers.ts`, make these changes:

1. Line 95: Change `v !== undefined || v !== null` to `v !== undefined && v !== null`
2. Lines 98-100: Replace the length check:

```typescript
export const format = (str: string, values: LocaleManager.LocaleFormatArgs) => {

    if (Array.isArray(values)) {

        values = values.filter(v => v !== undefined && v !== null);
    }

    const isEmpty = Array.isArray(values)
        ? values.length === 0
        : Object.keys(values).length === 0;

    if (isEmpty) {
        return str;
    }

    const flatVals = objToFlatEntries(values) as [string, StrOrNum][];

    const args = flatVals.filter(

        ([,v]) => (
            typeof v === 'number' ||
            typeof v === 'string' ||
            typeof v === 'boolean' ||
            typeof v === 'bigint'
        )
    );

    for (const [key, value] of args) {

        str = str?.replace(new RegExp(`\\{${key}\\}`, 'gi'), value.toString());
    }

    return str;
};
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test localize`
Expected: All tests pass including new ones

**Step 5: Commit**

```bash
git add packages/localize/src/helpers.ts tests/src/localize.ts
git commit -m "fix(localize): fix format() filter logic and empty object handling"
```

---

### Task 2: Fix event names, drop LOC_CHANGE, fix `on()` cleanup return

**Files:**
- Modify: `packages/localize/src/helpers.ts:134-138`
- Modify: `packages/localize/src/manager.ts:110-122,146-197`
- Modify: `packages/localize/src/types.ts:40-42`
- Modify: `packages/localize/src/index.ts`
- Modify: `packages/react/src/localize.ts:91-93`
- Test: `tests/src/localize.ts`

**Step 1: Update tests for new event names and cleanup return**

Find and replace all `'locale-change'` with `'change'` in `tests/src/localize.ts`.

Update the existing events test and add a cleanup return test:

```typescript
it('has events', () => {

    const stub = sandbox.stub();

    l10bMngr.on('change', stub);
    l10bMngr.changeTo('en');

    const [arg] = stub.args;
    const [event] = arg!;

    expect(event.type).to.eq('change');
    expect(event.code).to.eq('en');

    l10bMngr.off('change', stub);
    l10bMngr.changeTo('en');

    expect(stub.calledOnce).to.be.true;
});

it('on() returns an unsubscribe function', () => {

    const stub = sandbox.stub();

    const unsub = l10bMngr.on('change', stub);
    l10bMngr.changeTo('es');

    expect(stub.calledOnce).to.be.true;

    unsub();
    l10bMngr.changeTo('en');

    expect(stub.calledOnce).to.be.true;
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test localize`
Expected: FAIL — `'change'` event not recognized, `on()` doesn't return a function

**Step 3: Implement changes**

**`types.ts`** — Update `LocaleEventName`:

```typescript
export type LocaleEventName = (
    'change' | 'loading' | 'error'
);
```

**`helpers.ts`** — Remove `LOC_CHANGE` constant. The `LocaleEvent` class stays.

Delete this line:
```typescript
export const LOC_CHANGE = 'locale-change';
```

**`manager.ts`** — Update `on()` to return cleanup, update all event dispatches:

1. Remove `LOC_CHANGE` from import (import only `getMessage`, `LocaleEvent`)
2. Update `on()`:

```typescript
on(
    ev: LocaleManager.LocaleEventName,
    listener: LocaleManager.LocaleListener<Code>,
    once = false
) {

    this.addEventListener(ev, listener as any, { once });

    return () => this.removeEventListener(ev, listener as any);
}
```

3. Replace all `new LocaleEvent<Code>(LOC_CHANGE)` with `new LocaleEvent<Code>('change')` — there are two occurrences: in `updateLang()` and `changeTo()`.

**`index.ts`** — Remove `LOC_CHANGE` from exports:

```typescript
export type * from './types.ts';

export {
    LocaleEvent,
    format,
    getMessage,
    reachIn
} from './helpers.ts'

export { LocaleManager } from './manager.ts'
```

**`packages/react/src/localize.ts`** — Update event name in useEffect:

Change line 91 `manager.on('locale-change', listener)` to `manager.on('change', listener)` and line 93 `manager.off('locale-change', listener)` to `manager.off('change', listener)`.

**Step 4: Run tests to verify they pass**

Run: `pnpm test localize`
Expected: All tests pass

Also run React localize tests:
Run: `pnpm test react/localize`
Expected: All tests pass

**Step 5: Commit**

```bash
git add packages/localize/src/ packages/react/src/localize.ts tests/src/localize.ts tests/src/react/localize.test.ts
git commit -m "refactor(localize): rename events, drop LOC_CHANGE, on() returns cleanup"
```

---

### Task 3: Fix `reachIn` fallback and missing key handling

**Files:**
- Modify: `packages/localize/src/helpers.ts:9-49,122-131`
- Test: `tests/src/localize.ts`

**Step 1: Write failing tests**

```typescript
it('returns [key] for missing translation keys', () => {

    const lang = { greeting: 'Hello' };

    const instance = new LocaleManager<typeof lang, 'en'>({
        current: 'en',
        fallback: 'en',
        locales: { en: { code: 'en', text: 'English', labels: lang } }
    });

    const result = instance.text('nonexistent.key' as any);
    expect(result).to.eq('[nonexistent.key]');
});

it('warns in dev mode when key is missing', () => {

    const lang = { greeting: 'Hello' };

    const instance = new LocaleManager<typeof lang, 'en'>({
        current: 'en',
        fallback: 'en',
        locales: { en: { code: 'en', text: 'English', labels: lang } }
    });

    instance.text('missing.key' as any);

    expect(stubWarn.called).to.be.true;
    expect(stubWarn.lastCall.args[0]).to.match(/missing.key/);
});
```

Add `stubWarn` to the imports from `_helpers`:

```typescript
import { sandbox, stubWarn } from './_helpers';
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test localize`
Expected: FAIL — currently returns `'?'` and doesn't warn

**Step 3: Fix `reachIn` and `getMessage`**

**`reachIn` fix** — The reduce never returns `undefined` when a key doesn't exist; it returns the last found parent object. Fix the reducer to return `undefined` on miss:

```typescript
export const reachIn = <
    O extends LocaleManager.LocaleType = LocaleManager.LocaleType,
    P extends PathLeaves<O> = PathLeaves<O>,
    D extends PathValue<O, P> = PathValue<O, P>
>(obj: O, path: P, defValue: D): PathValue<O, P> | undefined => {

    if (!path) {
        return;
    }

    // Allow for passing a flat object
    if (obj[path] !== undefined) {
        return obj[path] as PathValue<O, P>;
    }

    const pathArray = Array.isArray(path) ? path as string[] : path.match(/([^[.\]])+/g)!

    let found = true;

    const result = pathArray.reduce(
        (prevObj, key) => {

            if (
                prevObj &&
                prevObj[key] !== undefined
            ) {
                return prevObj[key] as O;
            }

            found = false;
            return undefined as unknown as O;
        },
        obj
    );

    if (!found || result === undefined) {
        return defValue as PathValue<O, P>;
    }

    return result as PathValue<O, P>;
}
```

**`getMessage` fix** — Change default value from `'?'` to `'[key]'` pattern and add dev warning:

```typescript
export const getMessage = <L extends LocaleManager.LocaleType>(
    locale: L,
    reach: LocaleManager.LocaleReacher<L>,
    values?: LocaleManager.LocaleFormatArgs
) => {

    const missingKey = `[${reach as string}]`;
    const str = reachIn(locale, reach, missingKey as never) as string;

    if (str === missingKey && process.env.NODE_ENV !== 'production') {

        console.warn(`Missing translation key: "${reach as string}"`);
    }

    return format(str, values || []);
};
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test localize`
Expected: All tests pass

**Step 5: Commit**

```bash
git add packages/localize/src/helpers.ts tests/src/localize.ts
git commit -m "fix(localize): fix reachIn fallback, missing keys return [key] with dev warning"
```

---

### Task 4: Performance — RegExp caching and #merge optimization

**Files:**
- Modify: `packages/localize/src/helpers.ts:91-120` (format function)
- Modify: `packages/localize/src/manager.ts:124-131` (#merge method)

**Step 1: Verify existing tests pass before refactoring**

Run: `pnpm test localize`
Expected: All pass (baseline)

**Step 2: Add RegExp cache to `format()`**

Add a module-level cache at the top of `helpers.ts` (after imports):

```typescript
const regexCache = new Map<string, RegExp>();

const getPlaceholderRegex = (key: string) => {

    let regex = regexCache.get(key);

    if (!regex) {

        regex = new RegExp(`\\{${key}\\}`, 'gi');
        regexCache.set(key, regex);
    }

    return regex;
};
```

Then in the `format()` function, replace the RegExp line:

```typescript
// Before:
str = str?.replace(new RegExp(`\\{${key}\\}`, 'gi'), value.toString());

// After:
const regex = getPlaceholderRegex(key);
regex.lastIndex = 0;
str = str?.replace(regex, value.toString());
```

**Step 3: Optimize `#merge()`**

In `manager.ts`, change `#merge()` from:

```typescript
#merge() {

    const fallback = clone(this.#_locales[this.fallback]);
    const current = clone(this.#_locales[this.current]);

    this.#_loc = merge({} as Locale, fallback.labels) as Locale;
    this.#_loc = merge(this.#_loc, current.labels) as Locale;
}
```

To:

```typescript
#merge() {

    const fallbackLabels = clone(this.#_locales[this.fallback].labels);
    this.#_loc = (this.current === this.fallback)
        ? fallbackLabels as Locale
        : merge(fallbackLabels, this.#_locales[this.current].labels) as Locale;
}
```

This avoids cloning the entire locale config (with `code` and `text` fields), clones only `labels`, and skips the second merge when current equals fallback.

**Step 4: Run tests to verify nothing broke**

Run: `pnpm test localize`
Expected: All tests pass

**Step 5: Commit**

```bash
git add packages/localize/src/helpers.ts packages/localize/src/manager.ts
git commit -m "perf(localize): cache RegExp in format(), optimize merge()"
```

---

### Task 5: ICU-lite pluralization — `parsePlural()`

**Files:**
- Create: `packages/localize/src/plural.ts`
- Modify: `packages/localize/src/helpers.ts` (call parsePlural from format)
- Modify: `packages/localize/src/index.ts` (export parsePlural)
- Test: `tests/src/localize.ts`

**Step 1: Write failing tests**

Add to `tests/src/localize.ts`:

```typescript
describe('localize: pluralization', () => {

    const lang = {
        items: '{count, plural, one {# item} other {# items}}',
        inbox: '{count, plural, zero {No messages} one {# message} other {# messages}}',
        mixed: 'You have {count, plural, one {# notification} other {# notifications}} from {name}',
    };

    type PluralLang = typeof lang;

    let instance: LocaleManager<PluralLang, 'en'>;

    it('instantiates with plural strings', () => {

        instance = new LocaleManager<PluralLang, 'en'>({
            current: 'en',
            fallback: 'en',
            locales: { en: { code: 'en', text: 'English', labels: lang } }
        });
    });

    it('resolves singular plural form', () => {

        expect(instance.t('items', { count: 1 })).to.eq('1 item');
    });

    it('resolves other plural form', () => {

        expect(instance.t('items', { count: 5 })).to.eq('5 items');
    });

    it('resolves zero plural form', () => {

        expect(instance.t('inbox', { count: 0 })).to.eq('No messages');
    });

    it('resolves one from inbox', () => {

        expect(instance.t('inbox', { count: 1 })).to.eq('1 message');
    });

    it('resolves plural mixed with regular variables', () => {

        expect(instance.t('mixed', { count: 3, name: 'Alice' } as any)).to.eq('You have 3 notifications from Alice');
    });

    it('resolves plural mixed with singular and regular variables', () => {

        expect(instance.t('mixed', { count: 1, name: 'Bob' } as any)).to.eq('You have 1 notification from Bob');
    });

    it('handles string without plural syntax unchanged', () => {

        const simpleLang = { hello: 'Hello {name}' };

        const simple = new LocaleManager<typeof simpleLang, 'en'>({
            current: 'en',
            fallback: 'en',
            locales: { en: { code: 'en', text: 'English', labels: simpleLang } }
        });

        expect(simple.t('hello', { name: 'World' })).to.eq('Hello World');
    });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test localize`
Expected: FAIL — plural syntax not parsed, raw ICU string returned

**Step 3: Create `plural.ts`**

Create `packages/localize/src/plural.ts`:

```typescript
/**
 * ICU-lite plural parser.
 *
 * Parses `{varName, plural, one {# item} other {# items}}` syntax
 * and resolves using `Intl.PluralRules` for locale-aware category selection.
 *
 * @example
 *
 *     parsePlural('{count, plural, one {# thing} other {# things}}', { count: 5 }, 'en')
 *     // > '5 things'
 */

import type { StrOrNum } from '@logosdx/utils';
import type { LocaleManager } from './manager.ts';

const PLURAL_PATTERN = /\{(\w+),\s*plural,\s*((?:[^{}]|\{[^{}]*\})+)\}/g;
const CATEGORY_PATTERN = /(\w+)\s*\{([^}]*)\}/g;

type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

const rulesCache = new Map<string, Intl.PluralRules>();

const getRules = (locale: string): Intl.PluralRules => {

    let rules = rulesCache.get(locale);

    if (!rules) {

        rules = new Intl.PluralRules(locale);
        rulesCache.set(locale, rules);
    }

    return rules;
};

const parseCategories = (body: string): Map<PluralCategory, string> => {

    const categories = new Map<PluralCategory, string>();

    let match: RegExpExecArray | null;
    CATEGORY_PATTERN.lastIndex = 0;

    while ((match = CATEGORY_PATTERN.exec(body)) !== null) {

        categories.set(match[1] as PluralCategory, match[2]!);
    }

    return categories;
};

export const parsePlural = (
    str: string,
    values: LocaleManager.LocaleFormatArgs,
    locale: string
): string => {

    if (!str || typeof str !== 'string' || !str.includes('plural')) {
        return str;
    }

    const valuesRecord = (
        Array.isArray(values) ? {} : values
    ) as Record<StrOrNum, StrOrNum>;

    PLURAL_PATTERN.lastIndex = 0;

    return str.replace(PLURAL_PATTERN, (_match, varName: string, body: string) => {

        const count = Number(valuesRecord[varName]);

        if (isNaN(count)) {
            return _match;
        }

        const categories = parseCategories(body);
        const rules = getRules(locale);
        const category = rules.select(count) as PluralCategory;

        // Try exact category first, then 'other' as fallback
        const template = (
            (count === 0 && categories.has('zero'))
                ? categories.get('zero')!
                : categories.get(category) ?? categories.get('other') ?? _match
        );

        return template.replace(/#/g, count.toString());
    });
};
```

**Step 4: Wire `parsePlural` into `format()` in helpers.ts**

Add import at top of `helpers.ts`:

```typescript
import { parsePlural } from './plural.ts';
```

In the `getMessage` function, call `parsePlural` before `format`:

```typescript
export const getMessage = <L extends LocaleManager.LocaleType>(
    locale: L,
    reach: LocaleManager.LocaleReacher<L>,
    values?: LocaleManager.LocaleFormatArgs,
    localeCode = 'en'
) => {

    const missingKey = `[${reach as string}]`;
    const str = reachIn(locale, reach, missingKey as never) as string;

    if (str === missingKey && process.env.NODE_ENV !== 'production') {

        console.warn(`Missing translation key: "${reach as string}"`);
    }

    const resolved = parsePlural(str, values || [], localeCode);

    return format(resolved, values || []);
};
```

Update `manager.ts` to pass locale code to `getMessage`:

In the `text()` method, change:

```typescript
text <K extends PathLeaves<Locale>>(key: K, values?: LocaleManager.LocaleFormatArgs) {

    return getMessage(this.#_loc, key, values, this.current);
}
```

**Step 5: Export `parsePlural` from index.ts**

Add to `packages/localize/src/index.ts`:

```typescript
export { parsePlural } from './plural.ts'
```

**Step 6: Run tests to verify they pass**

Run: `pnpm test localize`
Expected: All tests pass

**Step 7: Commit**

```bash
git add packages/localize/src/plural.ts packages/localize/src/helpers.ts packages/localize/src/manager.ts packages/localize/src/index.ts tests/src/localize.ts
git commit -m "feat(localize): add ICU-lite pluralization with Intl.PluralRules"
```

---

### Task 6: Intl formatting helpers

**Files:**
- Create: `packages/localize/src/intl.ts`
- Modify: `packages/localize/src/manager.ts` (add `format` getter)
- Modify: `packages/localize/src/types.ts` (add IntlFormatters type)
- Modify: `packages/localize/src/index.ts` (export)
- Test: `tests/src/localize.ts`

**Step 1: Write failing tests**

Add to `tests/src/localize.ts`:

```typescript
describe('localize: intl formatters', () => {

    const lang = { greeting: 'Hello' };

    let instance: LocaleManager<typeof lang, 'en' | 'de'>;

    it('instantiates with intl support', () => {

        instance = new LocaleManager<typeof lang, 'en' | 'de'>({
            current: 'en',
            fallback: 'en',
            locales: {
                en: { code: 'en', text: 'English', labels: lang },
                de: { code: 'de', text: 'Deutsch', labels: lang },
            }
        });
    });

    it('formats numbers', () => {

        const result = instance.intl.number(1499.99);
        expect(result).to.eq('1,499.99');
    });

    it('formats currency', () => {

        const result = instance.intl.number(1499.99, { style: 'currency', currency: 'USD' });
        expect(result).to.eq('$1,499.99');
    });

    it('formats percentages', () => {

        const result = instance.intl.number(0.75, { style: 'percent' });
        expect(result).to.eq('75%');
    });

    it('formats dates', () => {

        const date = new Date(2026, 1, 18);
        const result = instance.intl.date(date);
        expect(result).to.be.a('string');
        expect(result).to.include('2026');
    });

    it('formats relative time', () => {

        const result = instance.intl.relative(-3, 'day');
        expect(result).to.eq('3 days ago');
    });

    it('updates formatters when locale changes', () => {

        const before = instance.intl.number(1499.99);
        instance.changeTo('de');
        const after = instance.intl.number(1499.99);

        expect(before).to.not.eq(after);

        instance.changeTo('en');
    });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test localize`
Expected: FAIL — `instance.intl` is undefined

**Step 3: Create `intl.ts`**

Create `packages/localize/src/intl.ts`:

```typescript
/**
 * Cached Intl formatter factory.
 *
 * Creates and caches `Intl.NumberFormat`, `Intl.DateTimeFormat`, and
 * `Intl.RelativeTimeFormat` instances keyed by locale + serialized options.
 *
 * @example
 *
 *     const fmt = createIntlFormatters('en');
 *     fmt.number(1499.99)                                   // "1,499.99"
 *     fmt.number(9.99, { style: 'currency', currency: 'USD' }) // "$9.99"
 *     fmt.date(new Date())                                  // "2/18/2026"
 *     fmt.relative(-3, 'day')                               // "3 days ago"
 */

import type { LocaleManager } from './manager.ts';

const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat>();

const cacheKey = (locale: string, type: string, opts?: object) => {

    return `${locale}:${type}:${opts ? JSON.stringify(opts) : ''}`;
};

const getNumberFormat = (locale: string, opts?: Intl.NumberFormatOptions): Intl.NumberFormat => {

    const key = cacheKey(locale, 'number', opts);
    let fmt = cache.get(key) as Intl.NumberFormat | undefined;

    if (!fmt) {

        fmt = new Intl.NumberFormat(locale, opts);
        cache.set(key, fmt);
    }

    return fmt;
};

const getDateFormat = (locale: string, opts?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat => {

    const key = cacheKey(locale, 'date', opts);
    let fmt = cache.get(key) as Intl.DateTimeFormat | undefined;

    if (!fmt) {

        fmt = new Intl.DateTimeFormat(locale, opts);
        cache.set(key, fmt);
    }

    return fmt;
};

const getRelativeFormat = (locale: string, opts?: Intl.RelativeTimeFormatOptions): Intl.RelativeTimeFormat => {

    const key = cacheKey(locale, 'relative', opts);
    let fmt = cache.get(key) as Intl.RelativeTimeFormat | undefined;

    if (!fmt) {

        fmt = new Intl.RelativeTimeFormat(locale, opts);
        cache.set(key, fmt);
    }

    return fmt;
};

export const createIntlFormatters = (locale: string): LocaleManager.IntlFormatters => ({

    number: (value: number, opts?: Intl.NumberFormatOptions) =>
        getNumberFormat(locale, opts).format(value),

    date: (value: Date | number, opts?: Intl.DateTimeFormatOptions) =>
        getDateFormat(locale, opts).format(value),

    relative: (value: number, unit: Intl.RelativeTimeFormatUnit, opts?: Intl.RelativeTimeFormatOptions) =>
        getRelativeFormat(locale, opts).format(value, unit),
});

export const clearIntlCache = () => cache.clear();
```

**Step 4: Add `IntlFormatters` type to `types.ts`**

Add inside the `declare module './manager.ts'` block in `types.ts`:

```typescript
export interface IntlFormatters {
    number(value: number, opts?: Intl.NumberFormatOptions): string;
    date(value: Date | number, opts?: Intl.DateTimeFormatOptions): string;
    relative(value: number, unit: Intl.RelativeTimeFormatUnit, opts?: Intl.RelativeTimeFormatOptions): string;
}
```

**Step 5: Add `intl` getter to `manager.ts`**

Add import at top of `manager.ts`:

```typescript
import { createIntlFormatters } from './intl.ts';
```

Add the getter to the class body, after the `locales` getter:

```typescript
get intl(): LocaleManager.IntlFormatters {

    return createIntlFormatters(this.current);
}
```

**Step 6: Export from `index.ts`**

Add to `packages/localize/src/index.ts`:

```typescript
export { createIntlFormatters } from './intl.ts'
```

**Step 7: Run tests to verify they pass**

Run: `pnpm test localize`
Expected: All tests pass

**Step 8: Commit**

```bash
git add packages/localize/src/intl.ts packages/localize/src/types.ts packages/localize/src/manager.ts packages/localize/src/index.ts tests/src/localize.ts
git commit -m "feat(localize): add Intl formatting helpers with caching"
```

---

### Task 7: Async locale loading — `register()`, async `changeTo()`

**Files:**
- Modify: `packages/localize/src/manager.ts`
- Modify: `packages/localize/src/types.ts`
- Test: `tests/src/localize.ts`

**Step 1: Write failing tests**

Add to `tests/src/localize.ts`:

```typescript
describe('localize: async loading', () => {

    const english = { greeting: 'Hello', farewell: 'Goodbye' };
    const spanish: typeof english = { greeting: 'Hola', farewell: 'Adiós' };

    type AsyncLang = typeof english;
    type AsyncCodes = 'en' | 'es' | 'fr';

    let instance: LocaleManager<AsyncLang, AsyncCodes>;

    it('instantiates with register()', () => {

        instance = new LocaleManager<AsyncLang, AsyncCodes>({
            current: 'en',
            fallback: 'en',
            locales: {
                en: { code: 'en', text: 'English', labels: english }
            } as any
        });

        instance.register('es', {
            text: 'Español',
            loader: () => Promise.resolve(spanish)
        });
    });

    it('includes registered locales in locales list', () => {

        const list = instance.locales;
        expect(list).to.have.lengthOf(2);
        expect(list.find(l => l.code === 'es')).to.deep.include({ code: 'es', text: 'Español' });
    });

    it('isLoaded returns false for unloaded locale', () => {

        expect(instance.isLoaded('es')).to.be.false;
    });

    it('changeTo loads and switches to registered locale', async () => {

        await instance.changeTo('es');
        expect(instance.current).to.eq('es');
        expect(instance.text('greeting')).to.eq('Hola');
    });

    it('isLoaded returns true after loading', () => {

        expect(instance.isLoaded('es')).to.be.true;
    });

    it('emits loading event before load starts', async () => {

        const loadingStub = sandbox.stub();

        instance.changeTo('en');
        instance.register('fr', {
            text: 'Français',
            loader: () => Promise.resolve({ greeting: 'Bonjour', farewell: 'Au revoir' })
        });

        instance.on('loading', loadingStub);
        await instance.changeTo('fr');

        expect(loadingStub.calledOnce).to.be.true;
    });

    it('emits error event and stays on current locale when loader fails', async () => {

        const errInstance = new LocaleManager<AsyncLang, 'en' | 'bad'>({
            current: 'en',
            fallback: 'en',
            locales: {
                en: { code: 'en', text: 'English', labels: english }
            } as any
        });

        errInstance.register('bad', {
            text: 'Bad',
            loader: () => Promise.reject(new Error('Network error'))
        });

        const errorStub = sandbox.stub();
        errInstance.on('error', errorStub);

        const [, err] = await (async () => {

            try {
                await errInstance.changeTo('bad');
                return [undefined, undefined];
            }
            catch (e) {
                return [undefined, e];
            }
        })();

        expect(err).to.be.instanceOf(Error);
        expect(errInstance.current).to.eq('en');
        expect(errorStub.calledOnce).to.be.true;
    });

    it('changeTo resolves immediately for already-loaded locale', async () => {

        const start = performance.now();
        await instance.changeTo('en');
        const elapsed = performance.now() - start;

        expect(elapsed).to.be.lessThan(10);
        expect(instance.current).to.eq('en');
    });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test localize`
Expected: FAIL — `register` is not a function

**Step 3: Add types**

In `types.ts`, inside the `LocaleManager` namespace, add:

```typescript
export interface LazyLocale<Locale extends LocaleType> {
    text: string;
    loader: () => Promise<Locale>;
}
```

**Step 4: Implement `register()`, `isLoaded()`, and async `changeTo()`**

In `manager.ts`:

Add a private field for loaders after `#_locales`:

```typescript
#_loaders = new Map<Code, LocaleManager.LazyLocale<Locale>>();
```

Add `register()` method:

```typescript
register<C extends Code>(
    code: C,
    opts: LocaleManager.LazyLocale<Locale>
) {

    this.#_loaders.set(code, opts);
}
```

Add `isLoaded()` method:

```typescript
isLoaded(code: Code): boolean {

    return !!this.#_locales[code];
}
```

Update `locales` getter to include registered-but-unloaded locales:

```typescript
get locales() {

    type LangConf = LocaleManager.ManyLocales<Locale, Code>;

    const loaded = Object.values(this.#_locales) as LangConf[Code][];

    const result = loaded.map(
        ({ code, text }) => ({ code, text })
    );

    for (const [code, opts] of this.#_loaders) {

        if (!this.#_locales[code]) {

            result.push({ code, text: opts.text });
        }
    }

    return result;
}
```

Update `changeTo()` to be async-aware:

```typescript
async changeTo(code: Code) {

    if (code === this.current) {

        return;
    }

    // Already loaded
    if (this.#_locales[code]) {

        this.current = code;
        this.#merge();

        const event = new LocaleEvent<Code>('change');
        event.code = code;
        this.dispatchEvent(event);

        return;
    }

    // Has registered loader
    const lazyLocale = this.#_loaders.get(code);

    if (lazyLocale) {

        const loadingEvent = new LocaleEvent<Code>('loading');
        loadingEvent.code = code;
        this.dispatchEvent(loadingEvent);

        try {

            const labels = await lazyLocale.loader();

            this.#_locales[code] = {
                code,
                text: lazyLocale.text,
                labels,
            } as LocaleManager.ManyLocales<Locale, Code>[Code];

            this.current = code;
            this.#merge();

            const changeEvent = new LocaleEvent<Code>('change');
            changeEvent.code = code;
            this.dispatchEvent(changeEvent);
        }
        catch (err) {

            const errorEvent = new LocaleEvent<Code>('error');
            errorEvent.code = code;
            this.dispatchEvent(errorEvent);

            throw err;
        }

        return;
    }

    // Unknown locale — fallback
    console.warn(`WARNING: Locale '${code}' not found. Using fallback '${this.fallback}' instead.`);
    code = this.fallback;

    this.current = code;
    this.#merge();

    const event = new LocaleEvent<Code>('change');
    event.code = code;
    this.dispatchEvent(event);
}
```

**Step 5: Run tests to verify they pass**

Run: `pnpm test localize`
Expected: All tests pass

Also run React tests since `changeTo` signature changed:
Run: `pnpm test react/localize`
Expected: All pass (React binding ignores the returned Promise, which is fine)

**Step 6: Commit**

```bash
git add packages/localize/src/manager.ts packages/localize/src/types.ts tests/src/localize.ts
git commit -m "feat(localize): add async locale loading with register() and lazy changeTo()"
```

---

### Task 8: Namespace scoping — `ScopedLocale` and `ns()`

**Files:**
- Create: `packages/localize/src/scoped.ts`
- Modify: `packages/localize/src/manager.ts` (add `ns()` method)
- Modify: `packages/localize/src/index.ts` (export ScopedLocale)
- Test: `tests/src/localize.ts`

**Step 1: Write failing tests**

Add to `tests/src/localize.ts`:

```typescript
describe('localize: namespace scoping', () => {

    const lang = {
        auth: {
            login: { title: 'Sign In', submit: 'Log In' },
            errors: { invalid: 'Invalid credentials' },
        },
        dashboard: {
            greeting: 'Welcome back, {name}!',
            stats: '{count, plural, one {# item} other {# items}}',
        },
    };

    type NsLang = typeof lang;

    let instance: LocaleManager<NsLang, 'en'>;

    it('instantiates for namespace tests', () => {

        instance = new LocaleManager<NsLang, 'en'>({
            current: 'en',
            fallback: 'en',
            locales: { en: { code: 'en', text: 'English', labels: lang } }
        });
    });

    it('creates a scoped translator with ns()', () => {

        const authT = instance.ns('auth');
        expect(authT).to.be.an('object');
        expect(authT.t).to.be.a('function');
    });

    it('scoped t() prepends prefix', () => {

        const authT = instance.ns('auth');
        expect(authT.t('login.title')).to.eq('Sign In');
        expect(authT.t('login.submit')).to.eq('Log In');
        expect(authT.t('errors.invalid')).to.eq('Invalid credentials');
    });

    it('supports nested scoping', () => {

        const loginT = instance.ns('auth').ns('login');
        expect(loginT.t('title')).to.eq('Sign In');
        expect(loginT.t('submit')).to.eq('Log In');
    });

    it('scoped t() supports variable substitution', () => {

        const dashT = instance.ns('dashboard');
        expect(dashT.t('greeting', { name: 'Alice' })).to.eq('Welcome back, Alice!');
    });

    it('scoped t() supports pluralization', () => {

        const dashT = instance.ns('dashboard');
        expect(dashT.t('stats', { count: 1 })).to.eq('1 item');
        expect(dashT.t('stats', { count: 5 })).to.eq('5 items');
    });

    it('scoped intl delegates to parent', () => {

        const authT = instance.ns('auth');
        expect(authT.intl.number(42)).to.eq(instance.intl.number(42));
    });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test localize`
Expected: FAIL — `ns` is not a function

**Step 3: Create `scoped.ts`**

Create `packages/localize/src/scoped.ts`:

```typescript
import type { LocaleManager } from './manager.ts';

/**
 * Lightweight scoped translator that prepends a key prefix
 * and delegates to the parent LocaleManager.
 *
 * @example
 *
 *     const authT = i18n.ns('auth');
 *     authT.t('login.title')  // resolves to i18n.t('auth.login.title')
 *
 *     const loginT = authT.ns('login');
 *     loginT.t('title')       // resolves to i18n.t('auth.login.title')
 */
export class ScopedLocale<
    Locale extends LocaleManager.LocaleType,
    Code extends string = string
> {

    #manager: LocaleManager<Locale, Code>;
    #prefix: string;

    constructor(manager: LocaleManager<Locale, Code>, prefix: string) {

        this.#manager = manager;
        this.#prefix = prefix;
    }

    t(key: string, values?: LocaleManager.LocaleFormatArgs): string {

        return this.#manager.text(`${this.#prefix}.${key}` as any, values);
    }

    get intl(): LocaleManager.IntlFormatters {

        return this.#manager.intl;
    }

    ns(subPrefix: string): ScopedLocale<Locale, Code> {

        return new ScopedLocale(this.#manager, `${this.#prefix}.${subPrefix}`);
    }
}
```

**Step 4: Add `ns()` to `manager.ts`**

Add import at top of `manager.ts`:

```typescript
import { ScopedLocale } from './scoped.ts';
```

Add method to the class body:

```typescript
ns(prefix: string): ScopedLocale<Locale, Code> {

    return new ScopedLocale<Locale, Code>(this, prefix);
}
```

**Step 5: Export from `index.ts`**

Add to `packages/localize/src/index.ts`:

```typescript
export { ScopedLocale } from './scoped.ts'
```

**Step 6: Run tests to verify they pass**

Run: `pnpm test localize`
Expected: All tests pass

**Step 7: Commit**

```bash
git add packages/localize/src/scoped.ts packages/localize/src/manager.ts packages/localize/src/index.ts tests/src/localize.ts
git commit -m "feat(localize): add namespace scoping with ns() and ScopedLocale"
```

---

### Task 9: Update barrel exports, JSDoc, and llm-helpers

**Files:**
- Modify: `packages/localize/src/index.ts` (verify final exports)
- Modify: `packages/localize/src/manager.ts` (update class JSDoc)
- Modify: `llm-helpers/localize.md` (update documentation)

**Step 1: Verify final `index.ts` exports**

The final `index.ts` should be:

```typescript
export type * from './types.ts';

export {
    LocaleEvent,
    format,
    getMessage,
    reachIn
} from './helpers.ts'

export { parsePlural } from './plural.ts'
export { createIntlFormatters } from './intl.ts'
export { ScopedLocale } from './scoped.ts'
export { LocaleManager } from './manager.ts'
```

**Step 2: Update class JSDoc on `LocaleManager`**

Update the JSDoc comment at the top of the class in `manager.ts` to reflect the new API including `ns()`, `intl`, `register()`, and the new event names.

**Step 3: Update `llm-helpers/localize.md`**

Update the llm-helpers doc to include:
- New event names (`change`, `loading`, `error`)
- Removal of `LOC_CHANGE`
- `on()` returning cleanup function
- Missing key returning `[key]` instead of `'?'`
- Pluralization section with ICU-lite syntax
- Intl formatting section with `intl.number()`, `intl.date()`, `intl.relative()`
- Async loading section with `register()` and async `changeTo()`
- Namespace scoping section with `ns()`
- `ScopedLocale` class reference
- `isLoaded()` method

**Step 4: Build to verify types compile**

Run: `pnpm build` (from `packages/localize/`)
Expected: Build succeeds with no type errors

**Step 5: Run full test suite**

Run: `pnpm test`
Expected: All tests pass across all packages

**Step 6: Commit**

```bash
git add packages/localize/src/ llm-helpers/localize.md
git commit -m "docs(localize): update JSDoc and llm-helpers for v2 features"
```

---

### Task 10: Update skill reference

**Files:**
- Modify: `skill/references/localize.md` (if exists, otherwise skip)

Check if `skill/references/localize.md` exists. If not, this task is a no-op.

If it exists, update it to match the new API surface. If it doesn't exist, skip this task.

**Step 1: Check and update if needed**

Run: `ls skill/references/localize.md` to check existence.

**Step 2: Commit if changed**

```bash
git add skill/references/
git commit -m "docs(localize): update skill reference for v2"
```

---

Plan complete and saved to `docs/plans/2026-02-18-localize-v2-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** — I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** — Open new session with executing-plans, batch execution with checkpoints

Which approach?
