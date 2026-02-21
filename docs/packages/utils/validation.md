---
title: Validation & Type Guards
description: Assertions, deep object validation, type guards, and error type utilities.
---

# Validation & Type Guards

## `assert()`

Basic assertion with custom error messages and types.

```ts
function assert(test: unknown, message?: string, ErrorClass?: typeof Error): void
```

**Example:**

```ts
import { assert } from '@logosdx/utils'

// Basic assertions
const processLoanApplication = (app: unknown) => {

    assert(app, 'Loan application is required')
    assert(typeof app === 'object', 'Application must be an object')
    assert(app.amount > 0, 'Loan amount must be positive')
    assert(app.category, 'Category is required')

    // Custom error types
    assert(
        ['premium', 'standard', 'basic'].includes(app.category),
        'Invalid category selection',
        ValidationError
    )

    // Now TypeScript knows app is valid
    return processValidApplication(app)
}

// Use in function parameters
const calculateInterest = (principal: number, rate: number, term: number) => {
    assert(principal > 0, 'Principal must be positive')
    assert(rate >= 0 && rate <= 1, 'Rate must be between 0 and 1')
    assert(term > 0, 'Term must be positive')
    assert(Number.isInteger(term), 'Term must be whole number of months')

    return principal * rate * term
}
```

---

## `assertObject()`

Deep object validation with path-based assertions.

```ts
function assertObject<T extends object>(
    obj: T,
    assertions: AssertionMap<T>
): void

type AssertionMap<T> = {
    [P in PathNames<T>]?: (value: PathValue<T, P>) => [boolean, string]
}
```

**Example:**

```ts
import { assertObject, attempt } from '@logosdx/utils'

// Validate complex customer data
const validateCustomerData = (data: unknown) => {

    assertObject(data, {
        // Basic required fields
        'id': (val) => [
            typeof val === 'string' && val.length > 0,
            'Customer ID must be non-empty string'
        ],

        'profile.email': (val) => [
            typeof val === 'string' && val.includes('@'),
            'Email must be valid format'
        ],

        'profile.name': (val) => [
            typeof val === 'string' && val.trim().length >= 2,
            'Name must be at least 2 characters'
        ],

        // Financial validation
        'loanHistory.totalLoans': (val) => [
            typeof val === 'number' && val >= 0,
            'Total loans must be non-negative number'
        ],

        'loanHistory.averageAmount': (val) => [
            typeof val === 'number' && val > 0,
            'Average loan amount must be positive'
        ],

        // Preference validation
        'preferences.theme': (val) => [
            ['light', 'dark', 'auto'].includes(val),
            'Theme must be light, dark, or auto'
        ],

        // Optional field validation
        'metadata.vipStatus': (val) => [
            val === undefined || typeof val === 'boolean',
            'VIP status must be boolean if present'
        ]
    })

    // If we get here, data is valid
    return data as ValidatedCustomerData
}

// Use with API responses
const loadCustomerProfile = async (customerId: string) => {

    const [rawData, fetchErr] = await attempt(() =>
        fetch(`/api/customers/${customerId}`).then(r => r.json())
    )

    if (fetchErr) {

        return { error: 'Could not load customer profile' }
    }

    const [customer, validationErr] = attemptSync(() =>
        validateCustomerData(rawData)
    )

    if (validationErr) {

        console.error('Customer data validation failed:', validationErr.message)
        return {
            error: 'Customer data is corrupted. Please contact support.',
            details: validationErr.message
        }
    }

    return { customer }
}
```

---

## Type Guards

Collection of utility functions for runtime type checking.

```ts
// Basic type guards
function isFunction(a: unknown): a is Function
function isObject(a: unknown): a is Object
function isPlainObject(a: unknown): a is object
function isPrimitive(val: unknown): boolean
function isUndefined(val: unknown): val is undefined
function isDefined(val: unknown): val is NonNullable<unknown>
function isNull(val: unknown): val is null

// Collection validation
function allKeysValid<T extends object>(
    item: T,
    check: (value: T[keyof T], key: string | number) => boolean
): boolean

function allItemsValid<I extends Iterable<unknown>>(
    item: I,
    check: (value: unknown) => boolean
): boolean
```

**Example:**

```ts
import {
    isFunction,
    isObject,
    isPrimitive,
    isDefined,
    allKeysValid,
    allItemsValid
} from '@logosdx/utils'

// Build custom type guards
const isLoanApplication = (value: unknown): value is LoanApplication => {

    if (!isObject(value)) return false

    const obj = value as Record<string, unknown>

    return (
        typeof obj.id === 'string' &&
        typeof obj.amount === 'number' &&
        obj.amount > 0 &&
        ['personal', 'auto', 'home', 'business'].includes(obj.type) &&
        isDefined(obj.applicant) &&
        isObject(obj.applicant)
    )
}

// Validate configuration objects
const validateConfig = (config: unknown) => {

    if (!isObject(config)) return false

    return allKeysValid(config, (value, key) => {

        // All config values must be defined and not functions
        return isDefined(value) && !isFunction(value)
    })
}

// Validate arrays
const validateStringArray = (arr: unknown): arr is string[] => {

    if (!Array.isArray(arr)) return false

    return allItemsValid(arr, (item) => typeof item === 'string')
}

// Use in request handlers
const handleLoanApplication = (req: Request) => {

    const body = req.body

    if (!isLoanApplication(body)) {

        return new Response('Invalid loan application format', { status: 400 })
    }

    // TypeScript now knows body is LoanApplication
    return processLoanApplication(body)
}

// Environment detection
import { isBrowser, isNode, isReactNative } from '@logosdx/utils'

const setupEnvironment = () => {

    if (isBrowser()) {

        // Browser-specific setup
        setupAnalytics()
        registerServiceWorker()
    }
    else if (isNode()) {

        // Node.js-specific setup
        setupLogging()
        connectToDatabase()
    }
    else if (isReactNative()) {

        // React Native-specific setup
        setupNativeModules()
    }
}
```

---

## Error Types & Utilities

All flow control utilities throw specific error types for better error handling:

```ts
// Error classes
class RetryError extends Error {}
class TimeoutError extends Error {}
class CircuitBreakerError extends Error {}
class RateLimitError extends Error {}
class ThrottleError extends Error {}
class AssertError extends Error {}

// Type guards
function isRetryError(error: unknown): error is RetryError
function isTimeoutError(error: unknown): error is TimeoutError
function isCircuitBreakerError(error: unknown): error is CircuitBreakerError
function isRateLimitError(error: unknown): error is RateLimitError
function isThrottleError(error: unknown): error is ThrottleError
function isAssertError(error: unknown): error is AssertError
```

**Example:**

```ts
import {
    attempt,
    isTimeoutError,
    isRetryError,
    isCircuitBreakerError,
    isRateLimitError
} from '@logosdx/utils'

const handleLoanProcessing = async (application: LoanApplication) => {

    const [result, err] = await attempt(() => processLoanWithAllProtections(application))

    if (err) {

        // Handle each error type specifically
        if (isTimeoutError(err)) {

            return {
                error: 'Your application is taking longer than expected. Please wait while we process it.',
                canRetry: true,
                suggestedDelay: 30000
            }
        }

        if (isRateLimitError(err)) {

            return {
                error: 'You\'re submitting applications too quickly. Please wait before trying again.',
                canRetry: true,
                suggestedDelay: err.retryAfter || 60000
            }
        }

        if (isCircuitBreakerError(err)) {

            return {
                error: 'Our loan processing system is temporarily experiencing issues. Your application will be reviewed manually.',
                canRetry: false,
                fallbackAction: 'manual_review'
            }
        }

        if (isRetryError(err)) {

            return {
                error: 'We encountered multiple issues processing your application. Please try again later.',
                canRetry: true,
                suggestedDelay: 300000 // 5 minutes
            }
        }

        // Unknown error
        console.error('Unexpected loan processing error:', err)
        return {
            error: 'An unexpected issue occurred. Please contact support if this persists.',
            canRetry: false,
            contactSupport: true
        }
    }

    return { success: true, result }
}
```
