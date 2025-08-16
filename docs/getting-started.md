---
outline: deep
---

# Getting Started

In your project, install the packages you need.

::: code-group

```bash [npm]
npm install @logosdx/observer @logosdx/utils @logosdx/fetch # ...etc.
```

```bash [yarn]
yarn add @logosdx/observer @logosdx/utils @logosdx/fetch # ...etc.
```

```bash [pnpm]
pnpm add @logosdx/observer @logosdx/utils @logosdx/fetch # ...etc.
```

:::

Or in your browser, use the CDN:

```html
<script src="https://cdn.jsdelivr.net/npm/@logosdx/observer@latest/dist/browser/bundle.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@logosdx/utils@latest/dist/browser/bundle.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@logosdx/fetch@latest/dist/browser/bundle.js"></script>
<!-- ...etc. -->

<script>
    const { ObserverEngine } = LogosDX.Observer;
    const { composeFlow, attempt } = LogosDX.Utils;
    const { FetchFactory } = LogosDX.Fetch;

    // ...
</script>
```

## Usage

**Normal observer patterns, but with type safety.**

```ts
import { ObserverEngine } from '@logosdx/observer';

// Define your events like a civilized person
interface AppEvents {
    'user:login': { userId: string; token: string; timestamp: number };
    'user:logout': { userId: string };
    'user:login-failed': { userId: string; error: Error };
    'system:ready': void;
}

const observer = new ObserverEngine<AppEvents>();

// Listen and emit with full type safety
observer.on('user:login', ({ userId, timestamp }) => {

    console.log(`User ${userId} logged in at ${new Date(timestamp)}`);
});

observer.emit('user:login', {
    userId: 'alice',
    token: 'alice-token',
    timestamp: Date.now()
});
```

**But what if you wanted to get weird?**

```ts
const stopBeingNosy = observer.on(/^user:/, ({ event, data }) => {

    console.log(`🕵🏻‍♂️ ${data.userId} is doing something`, event, '👀');
});

observer.emit('user:login', {
    userId: 'alice',
    timestamp: Date.now()
});

// 🕵🏻‍♂️ alice is doing something user:login 👀

observer.on('stop-being-nosy', () => stopBeingNosy());
```

**Let's give these users something to actually log in to.**

```ts
import { FetchFactory } from '@logosdx/fetch';
import { attempt } from '@logosdx/utils'

// Your Fetch instance can have a state from which you can make
// decisions about the request.
type ApiState = {
    authToken: string;
    userId: string;
}

// You can also define headers and query params
// you will expect throughout your app.
type ApiHeaders = {
    'X-User-ID': string;
}

type ApiQueryParams = {
    page: string;
}

const api = new FetchFactory<ApiHeaders, ApiQueryParams, ApiState>({
    baseUrl: 'https://rainbow-loans.com',
    retryConfig: {
        maxAttempts: 3,
        retryableStatusCodes: [501, 502, 503, 504]
    },
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    modifyOptions: (opts, state) => {

        if (state.authToken) {
            opts.headers.Authorization = `Bearer ${state.authToken}`
        }

        if (state.userId) {
            opts.headers['X-User-ID'] = state.userId
        }

        return opts
    }
});

observer.on('user:login', ({ userId, token }) => {

    // Once you have a token, you can set the state of the
    // Fetch instance to use it in the next request.
    api.setState({ authToken: token, userId });
});

observer.on('user:logout', () => {

    // When the user logs out, you can clear the state of the
    // Fetch instance to avoid using the token in the next request.
    api.setState({ authToken: null, userId: null });
});

export const signIn = async (user: string, password: string) => {

    // Go-style error handling, with type safety.
    const [resPayload, err] = await attempt(() => api.post('/signin', { user, password }));

    if (err) {

        observer.emit('user:login-failed', {
            userId: user,
            error: err
        });

        throw err;
    }

    const { userId, token } = resPayload;

    observer.emit('user:login', {
        userId: user,
        token,
        timestamp: Date.now()
    });

    return user;
}
```

**And, unfortunately for them, you use a really shitty payments API.**

```ts
import { composeFlow, attempt } from '@logosdx/utils';

const painPal = new FetchFactory({
    baseUrl: 'https://painpal.com',
    retryConfig: {
        maxAttempts: 3,
        retryableStatusCodes: [429, 501, 502, 503, 504]
    },
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-Key': 'painpal-api-key'
    }
});

const _makePayment = async (paymentToken: string, amount: number) => {

    const [resPayload, err] = await attempt(() => api.post('/payments', { paymentToken, amount }));

    if (err) {

        observer.emit('payment:failed', {
            paymentToken,
            amount,
            error: err
        });

        throw err;
    }

    observer.emit('payment:success', {
        paymentToken,
        amount,
        timestamp: Date.now()
    });

    return resPayload;
}

// This makePayment function is now rate-limited to 10
// calls per second, and has a circuit breaker that trips
// after 3 failures.
const makePayment = composeFlow(
    _makePayment,
    {
        circuitBreaker: {
            maxFailures: 3,
            resetAfter: 1000,
            onTripped: (error) => {

                console.log('PainPal is being sensitive again', error);
            }
        },
        rateLimit: {
            maxCalls: 10,
            windowMs: 1000,
            onLimitReached: (error, nextAvailable, args) => {

                console.log('We might be over-doing it...', error);
                console.log('Try again at', nextAvailable);
            }
        },
    }
);
```

**And you're done!**

You can deploy to production and be confident that if your users complain, it will be because of PainPal, not because you don't have the right abstractions in place.

## Other stuff

Get start with the packages:

- [@logosdx/observer](/packages/observer)
- [@logosdx/utils](/packages/utils)
- [@logosdx/fetch](/packages/fetch)
- [@logosdx/dom](/packages/dom)
- [@logosdx/storage](/packages/storage)
- [@logosdx/localize](/packages/localize)