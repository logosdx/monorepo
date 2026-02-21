---
title: Namespaces
description: Scoped translations for feature module isolation
---

# Namespaces


`ns()` returns a `ScopedLocale` that prepends a prefix to every key lookup. Scopes can be nested and share the parent's `intl` formatters. This is the primary mechanism for isolating translations per feature module in large applications.

[[toc]]

## Basic Scoping


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
authT.t('login.title');     // "Sign In"
authT.t('register.title');  // "Create Account"

// Dashboard scope
const dashT = i18n.ns('dashboard');
dashT.t('welcome', { name: 'Elena' });  // "Welcome, Elena"
```

## Nested Scoping


Scopes can be nested to drill deeper into the translation tree. Each `ns()` call appends to the existing prefix.

```ts
const authT = i18n.ns('auth');
const loginT = authT.ns('login');

loginT.t('title');   // "Sign In"  (resolves 'auth.login.title')
loginT.t('submit');  // "Log In"   (resolves 'auth.login.submit')
```

## Shared Intl Formatters


`ScopedLocale` delegates to the parent manager's `intl` property. No duplicate formatter instances are created.

```ts
const loginT = i18n.ns('auth').ns('login');

loginT.intl.number(42);                                    // "42"
loginT.intl.date(new Date(), { dateStyle: 'medium' });     // "Feb 18, 2026"
loginT.intl.relative(-1, 'day');                           // "yesterday"
```

## Direct ScopedLocale Construction


You can create a `ScopedLocale` directly if you already have a manager reference. This is equivalent to calling `ns()` on the manager.

```ts
import { ScopedLocale } from '@logosdx/localize';

const authT = new ScopedLocale(i18n, 'auth');
authT.t('login.title');  // "Sign In"
```

## Feature Module Isolation


The typical pattern is to export a scoped translator from each feature module, so components never need to know about the full key hierarchy.

```ts
// features/auth/i18n.ts
import { i18n } from '../../i18n';

export const authT = i18n.ns('auth');
export const loginT = authT.ns('login');
export const registerT = authT.ns('register');
```

```ts
// features/auth/LoginForm.ts
import { loginT } from './i18n';

function renderLoginForm() {

    const title = loginT.t('title');       // "Sign In"
    const submit = loginT.t('submit');     // "Log In"
    const price = loginT.intl.number(29.99, { style: 'currency', currency: 'USD' });

    return `<h1>${title}</h1><button>${submit}</button><p>${price}</p>`;
}
```

::: tip
This pattern keeps translation keys short and feature-scoped. Components only import their own namespace and never reference keys from other features.
:::
