# Observer Queue Recipes

## Creating a Queue

```typescript
const queue = observer.queue('data:process', async (item) => {

    await processItem(item)
    return result
}, {
    name: 'data-processor',
    concurrency: 3,              // Process 3 items at a time
    type: 'fifo',                // 'fifo' (default) or 'lifo'

    // Rate limiting
    rateLimitCapacity: 100,      // Token bucket capacity
    rateLimitIntervalMs: 1000,   // Refill interval

    // Timing
    pollIntervalMs: 100,         // Check for new items every 100ms
    processIntervalMs: 50,       // Delay between processing items
    taskTimeoutMs: 30000,        // Timeout per task
    jitterFactor: 0.1,           // Randomize timing by +-10%

    // Limits
    maxQueueSize: 1000,          // Reject items beyond this size
    autoStart: true,             // Start processing immediately
    debug: 'verbose',            // 'verbose' | 'minimal' | false
})
```

## Adding Items

```typescript
// Direct add with optional priority (higher = processed first)
queue.add(data)
queue.add(urgentData, 10)

// Emit to the observed event — also adds to queue
observer.emit('data:process', data)
```

## Queue Lifecycle

```typescript
// Control flow
queue.start()
queue.pause()
queue.resume()
queue.stop()

// Graceful shutdown — drain pending items, then stop
await queue.shutdown()

// Force shutdown — stop immediately
await queue.shutdown(true)

// Flush N items immediately
queue.flush(10)

// Purge all pending items
queue.purge()
```

## Queue State

```typescript
queue.isRunning   // true when actively processing
queue.isPaused    // true when paused
queue.isStopped   // true when stopped
queue.isDraining  // true during shutdown drain
queue.isIdle      // true when no items to process
queue.isWaiting   // true when waiting for new items
queue.pending     // number of items in queue
queue.state       // 'running' | 'paused' | 'stopped' | 'draining'
```

## Queue Events

### Lifecycle Events

```typescript
queue.on('start', () => console.log('Queue started'))
queue.on('started', () => console.log('Queue is running'))
queue.on('stopped', () => console.log('Queue stopped'))
queue.on('paused', () => console.log('Queue paused'))
queue.on('resumed', () => console.log('Queue resumed'))
```

### Processing Events

```typescript
queue.on('added', (item) => console.log('Added:', item))
queue.on('processing', (item) => console.log('Processing:', item))
queue.on('success', (item) => console.log('Done:', item))
queue.on('error', (item) => console.error('Failed:', item))
queue.on('timeout', (item) => console.warn('Timed out:', item))
queue.on('rejected', (item) => console.warn('Rejected:', item))
```

### State Events

```typescript
queue.on('empty', () => console.log('Queue is empty'))
queue.on('idle', () => console.log('All processing complete'))
queue.on('rate-limited', (item) => console.log('Rate limited'))
queue.on('drain', ({ pending }) => console.log(`Draining ${pending} items`))
queue.on('drained', ({ drained }) => console.log(`Drained ${drained} items`))
queue.on('flush', ({ pending }) => console.log(`Flushing ${pending} items`))
queue.on('flushed', ({ flushed }) => console.log(`Flushed ${flushed} items`))
queue.on('purged', ({ count }) => console.log(`Purged ${count} items`))
queue.on('shutdown', ({ force }) => console.log(force ? 'Force stopped' : 'Graceful'))
```

### Awaiting Events

```typescript
// Wait for a specific event with once()
const successItem = await queue.once('success')
const errorItem = await queue.once('error')
```

## Recipe: Priority Task Queue

```typescript
interface Task {
    id: string
    type: 'email' | 'sms' | 'push'
    payload: unknown
}

interface TaskEvents {
    'task:send': Task
}

const observer = new ObserverEngine<TaskEvents>()

const taskQueue = observer.queue('task:send', async (task) => {

    switch (task.type) {

        case 'email': return await sendEmail(task.payload)
        case 'sms': return await sendSMS(task.payload)
        case 'push': return await sendPush(task.payload)
    }
}, {
    concurrency: 5,
    taskTimeoutMs: 10000,
    rateLimitCapacity: 50,
    rateLimitIntervalMs: 1000,
})

// High priority tasks processed first
taskQueue.add({ id: '1', type: 'email', payload: data }, 10)
taskQueue.add({ id: '2', type: 'push', payload: data }, 1)
```

## Recipe: Worker with Monitoring

```typescript
const worker = observer.queue('jobs:process', processJob, {
    concurrency: 10,
    maxQueueSize: 500,
    taskTimeoutMs: 60000,
})

// Monitor
let processed = 0
let failed = 0

worker.on('success', () => processed++)
worker.on('error', () => failed++)
worker.on('idle', () => {

    console.log(`Batch complete: ${processed} ok, ${failed} failed`)
    processed = 0
    failed = 0
})

// Graceful shutdown on signal
process.on('SIGTERM', async () => {

    console.log('Draining queue...')
    await worker.shutdown()
    console.log('Clean exit')
    process.exit(0)
})
```

## Recipe: Backpressure with Rate Limiting

```typescript
const rateLimited = observer.queue('api:call', callExternalApi, {
    concurrency: 1,
    rateLimitCapacity: 10,       // 10 tokens
    rateLimitIntervalMs: 1000,   // refill every second
    maxQueueSize: 100,           // reject if queue gets too deep
})

rateLimited.on('rejected', (item) => {

    console.warn('Queue full, dropping:', item)
})

rateLimited.on('rate-limited', () => {

    console.log('Backing off — waiting for rate limit token')
})
```
