# Observer Event Architecture

## Event Type System

Define your events as a TypeScript interface. Keys are event names, values are payload types:

```typescript
interface AppEvents {
    'user:login': { userId: string; timestamp: number }
    'user:logout': { userId: string }
    'data:update': any[]
    'system:error': Error
}

const observer = new ObserverEngine<AppEvents>({ name: 'app-events' })
```

This gives you:
- Autocomplete on event names in `on()`, `once()`, `emit()`
- Type checking on event payloads
- Compile errors when event shapes change

## Constructor Options

```typescript
const observer = new ObserverEngine<AppEvents>({
    name: 'app-events',             // Optional: name for debugging
    spy: (action) => {              // Optional: observe all operations
        console.log(action.fn, action.event, action.data)
    },
    emitValidator: (event, data) => {  // Optional: validate before emit
        if (event === 'user:login' && !data.userId) {
            throw new Error('userId is required')
        }
    },
})
```

## Subscription Patterns

### Callback (most common)

```typescript
const cleanup = observer.on('user:login', (data) => {
    // data: { userId: string; timestamp: number }
    console.log('User logged in:', data.userId)
})

// Remove when done
cleanup()
```

### One-shot callback

```typescript
const cleanup = observer.once('user:login', (data) => {
    // Fires once, then auto-removes
    bootstrap(data)
})

// Optional: cancel before it fires
cleanup()
```

### Promise-based once

```typescript
// Without callback, once() returns a Promise
const loginData = await observer.once('user:login')
console.log('First login:', loginData.userId)
```

### Async generator

```typescript
// on() without callback returns an EventGenerator
const events = observer.on('user:login')

// Async iteration — events buffer while awaiting
for await (const data of events) {

    await saveToDatabase(data)

    if (shouldStop) {

        events.cleanup()
        break
    }
}

// Manual iteration
const next = await events.next()

// Generator properties
events.lastValue  // most recent value received
events.done       // boolean — is generator finished?
events.emit(data) // emit back to the underlying observer
events.cleanup()  // stop listening and end iteration
```

## Regex Matching

Regex listeners receive `{ event, data }` instead of just the payload:

```typescript
// Listen to all user-namespace events
observer.on(/^user:/, ({ event, data }) => {
    // event: string (e.g., 'user:login', 'user:logout')
    // data: any (union of all matching event types)
    analytics.track(event, data)
})
```

Regex works with generators too:

```typescript
const allUserEvents = observer.on(/^user:/)

for await (const { event, data } of allUserEvents) {

    console.log(`${event}:`, data)
}
```

## Removing Listeners

```typescript
// Option 1: Use the cleanup function from on()
const cleanup = observer.on('user:login', handler)
cleanup()

// Option 2: Use off() with the original callback reference
observer.off('user:login', specificHandler)

// Option 3: Remove all listeners for an event
observer.off('user:login')

// Option 4: Clear all listeners from the observer
observer.clear()
```

## Component Observation

Extend any plain object with event capabilities:

```typescript
const modal = { isOpen: false, title: '' }

interface ModalEvents {
    'open': { title: string }
    'close': void
}

const enhanced = observer.observe<typeof modal, ModalEvents>(modal)

// enhanced has: on, once, emit, off, clear, cleanup
enhanced.on('open', (data) => {

    enhanced.isOpen = true
    enhanced.title = data.title
})

enhanced.emit('open', { title: 'Confirm Delete' })

// Cleanup options
enhanced.clear()    // clear all listeners for this component
enhanced.cleanup()  // clear + remove internal tracking
```

## Inspector Methods

```typescript
observer.$has('user:login')     // true if event has listeners
observer.$has(/^user:/)         // true if regex matches any listeners
observer.$facts()               // { listenerCounts, state info }
observer.$internals()           // internal maps (debugging only)
```

## Debugging

```typescript
// Enable stack traces for all operations
observer.debug(true)

// Spy on every operation
const observer = new ObserverEngine({
    spy: (action) => {
        // action.fn: 'on' | 'once' | 'emit' | 'off' | 'clear'
        // action.event: string | RegExp
        // action.data: payload (for emit)
        console.log(`${action.fn}(${String(action.event)})`, action.data)
    },
})
```

## Error Handling

```typescript
import { EventError, isEventError } from '@logosdx/observer'

// EventError thrown by destroyed generators
const gen = observer.on('event')
gen.cleanup()

const [value, err] = await attempt(() => gen.next())

if (err && isEventError(err)) {

    console.log(err.event)     // event name
    console.log(err.listener)  // listener ref
}

// EmitValidator errors bubble normally
const observer = new ObserverEngine({
    emitValidator: (event, data) => {

        if (event === 'restricted') throw new Error('Access denied')
    },
})

// This throw propagates to the emit() callsite
observer.emit('restricted', {}) // throws Error('Access denied')
```
