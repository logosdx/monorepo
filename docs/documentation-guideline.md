# LogosDX Documentation Guidelines


## Purpose

These guidelines help create documentation that transfers understanding, not just information. Great docs enable developers (human and AI) to truly comprehend your library - its purpose, design, and usage - not just parrot its syntax.


## Core Principles


### 1. Invisible Structure

Users shouldn't notice the documentation framework - they should simply find what they need. Structure serves content, not the other way around.

**Good**: Natural sections that emerge from the material
**Bad**: Meta-documentation noise ("This section covers...", "Following the three-pillar framework...")


### 2. Natural Voice

Write in your own voice, demonstrating expertise and judgment. Avoid formulaic or robotic language.

**Good**: "We chose error tuples over try-catch because deeply nested error handling becomes hard to follow and debug"
**Bad**: "This document provides comprehensive documentation for error handling following established patterns"


### 3. Expert Perspective

Show deep understanding through:

- Honest discussion of tradeoffs
- Clear reasoning about design decisions
- Anticipation of questions and confusion
- Analogies that illuminate concepts


### 4. Concise Examples

Examples should be minimal but complete. Show what matters, omit what doesn't.

**Good**: 3 examples (basic + realistic + edge case) in ~50 lines
**Bad**: 10 progressive examples covering every option combination in 500 lines


## What Documentation Must Cover


Every package should answer three questions:


### 1. What can I do with this?

**API Surface Coverage:**

- Function signatures with complete type information
- All parameters (required and optional) with defaults
- Return types and possible values
- Error types and conditions
- Configuration schemas
- Interface definitions

**Standards:**

- Zero ambiguity
- Exhaustive coverage
- TypeScript syntax
- Precise, factual


### 2. Why is it designed this way?

**Design & Philosophy Coverage:**

- What problem does this solve? Why should I care?
- How does it work? What's the mechanism?
- How is it structured? What's the architecture?
- What primitives/concepts does it build on?
- What was traded off for what gain?
- Why not approach X instead?
- How should I think about this?

**Standards:**

- Start with the problem and why it matters
- Explain reasoning, not just decisions
- Be honest about limitations
- Provide judgment frameworks ("use X when Y")
- Let structure emerge naturally from content


### 3. How do I use it in practice?

**Pattern & Usage Coverage:**

- Basic usage (happy path)
- Realistic usage (with error handling, real context)
- Edge cases (non-obvious scenarios)
- Integration patterns (composing with other tools)
- Common mistakes and anti-patterns

**Standards:**

- Complete, runnable code
- Real scenarios, not toy examples
- Show imports, types, context
- Demonstrate best practices
- **Keep it concise** - 3 examples typically sufficient


## File Organization


### Main Package Document Structure

Every package's main documentation file must include:

1. **Overview** (1 paragraph)
   - What this package is (formal cause)
   - What problem it solves and why it matters (telos/final cause)
   - How it achieves this, if it fits naturally (efficient cause)

2. **Getting Started** (Facts + Patterns combined)
   - The shortest possible introduction to usage
   - 1-3 high-impact examples that highlight strengths
   - Points to full API reference for details

3. **Core Concepts** (Philosophy condensed)
   - Essential mental models and design decisions
   - Key tradeoffs and when to use
   - Points to full philosophy doc (if separate)


### Default Structure

Most packages use a single documentation file:

```
docs/packages/
└── packagename.md
    ├── Overview (1 paragraph)
    ├── Getting Started (quick examples)
    ├── Core Concepts (condensed philosophy)
    ├── API Reference (exhaustive)
    ├── Design (if needed)
    └── Usage Patterns (concise examples)
```


### When to Split into Separate Files

Extract into separate files when content deserves deep, focused discussion:

**Indicators for separate `philosophy.md`:**

- Multiple significant design decisions with tradeoffs
- Non-obvious architectural choices requiring explanation
- Competing approaches that were considered and rejected
- Complex mental models essential for understanding

**Examples needing separate philosophy docs:**

- `utils` - Error tuple rationale, inflight deduplication reasoning, stale-while-revalidate design
- `observer` - Event propagation models, memory management tradeoffs, pub/sub patterns
- `state-machine` - State transition semantics, determinism guarantees

**Examples not needing separate philosophy docs:**

- `fetch` - Straightforward HTTP client wrapper
- `storage` - Simple persistence abstraction
- `localize` - Standard i18n implementation

**When to extract `patterns.md`:**

- Large collection of usage recipes
- Complex integration scenarios
- Many edge cases worth demonstrating

```
docs/packages/
├── utils/
│   ├── api.md
│   ├── philosophy.md
│   └── patterns.md
└── fetch.md              (simple packages can stay single-file)
```


### File Naming

- `{package}.md` - Single-file documentation (simpler packages)
- `{package}/api.md` - API reference (when split)
- `{package}/philosophy.md` - Design and concepts (when split)
- `{package}/patterns.md` - Usage patterns (when split)


## Writing Guidelines by Type


### API Reference (Facts)


**Purpose**: Provide precise, unambiguous facts about your API.

**Structure:**

- Function name as heading
- Brief paragraph explaining purpose, effect, and motivation to use (telos)
- Function signatures with complete types
- Parameters with types, defaults, constraints
- Return types and possible values
- Error types and when they occur
- Complete configuration schemas

**Example - Good:**

```typescript
## memoize()

Caches async function results with configurable TTL and LRU eviction, preventing duplicate concurrent requests (thundering herd). Returns stale data while fetching fresh in the background for faster response times. Use this when you need to cache expensive I/O operations (API calls, database queries) while maintaining reasonable freshness guarantees.

function memoize<T extends AsyncFunc>(
    fn: T,
    opts?: MemoizeOptions<T>
): EnhancedMemoizedFunction<T>

interface MemoizeOptions<T> {
    ttl?: number                    // Default: 60000 (must be > 0)
    maxSize?: number                // Default: 1000 (must be > 0)
    staleIn?: number                // Default: undefined (must be >= 0, < ttl)
    staleTimeout?: number           // Default: undefined (>= 0)
    generateKey?: (args: Parameters<T>) => string
    onError?: (error: Error, args: Parameters<T>) => void
}

type EnhancedMemoizedFunction<T> = T & {
    cache: {
        clear(): void
        delete(key: string): boolean
        has(key: string): boolean
        size: number
        stats(): CacheStats
    }
}
```

**Example - Bad:**

```typescript
function memoize(fn, options)
// Memoizes a function with caching options
```

**Standards:**

- Document every public API
- Include all optional parameters with defaults
- Specify constraints (must be > 0, etc.)
- List all possible return values and errors
- Use TypeScript syntax even in prose


### Philosophy (Design & Concepts)


**Purpose**: Teach the underlying reasoning, mental models, and decision-making.

**Natural Structure** (emerges from content):

- Problem statement
- How it works (mechanism)
- Architecture and structure
- Primitives and foundations
- Tradeoffs and alternatives
- When to use / not use
- Performance characteristics
- Common misconceptions

**Example - Good:**

```markdown
## Why Error Tuples?

### The Problem

Try-catch blocks create deeply nested code that becomes hard to follow. When you have multiple async operations, each requiring different error handling, you end up with nested try-catch blocks or one giant catch that treats all errors the same.

```typescript
// Deeply nested and hard to follow
try {
    const user = await fetchUser(id);
    try {
        const orders = await fetchOrders(user.id);
        try {
            return await processOrders(orders);
        } catch (processErr) {
            // Which operation failed? How to handle specifically?
        }
    } catch (ordersErr) {
        // Different handling for orders failure
    }
} catch (userErr) {
    // Different handling for user failure
}
```

Additionally, try-catch makes it easy to accidentally ignore errors - a missing catch means silent failure.

### The Solution

`attempt()` and `attemptSync()` wrap try-catch blocks and return `[result, error]` tuples. On success: `[value, null]`. On failure: `[null, Error]`. This makes error handling explicit at each step while avoiding nesting.

```typescript
const [user, userErr] = await attempt(() => fetchUser(id));
if (userErr) return handleUserError(userErr);

const [orders, ordersErr] = await attempt(() => fetchOrders(user.id));
if (ordersErr) return handleOrdersError(ordersErr);

return processOrders(orders);
```

The flat structure makes it obvious what can fail and where. Error handling is right there, not buried in a distant catch block.

### Implementation

`attempt()` is just a try-catch wrapper that returns tuples:

```typescript
try {
    return [await fn(), null]
} catch (e) {
    return [null, e as Error]
}
```

This lets you ignore errors when they don't matter (just don't check the second value) while encouraging explicit error handling for every async call.

### When to Use

**Use error tuples for:**

- I/O operations (network, filesystem, database)
- Operations with external failure modes
- Code requiring granular error handling per operation

**Use try-catch for:**

- Top-level error boundaries
- Catching programming errors you can't predict
- Never for business logic control flow

### Performance

No meaningful overhead - just an array allocation. The try-catch is still there internally, so no performance difference from hand-written try-catch.

```

**Example - Bad:**

```markdown
## Error Tuples

Error tuples return `[result, error]` instead of throwing. This is useful for error handling.

Use `attempt()` for async functions and `attemptSync()` for sync functions.
```

**Standards:**

- Start with why this exists and why I should care
- Explain how it actually works (mechanism, not just API)
- Show what it's built on (primitives)
- Discuss structure and architecture
- Compare alternatives honestly
- Provide decision frameworks
- Include performance characteristics
- Anticipate and address confusion
- **Let section headers emerge naturally** - no formulaic labels


### Patterns (Usage Examples)


**Purpose**: Demonstrate practical usage through concise, runnable code.

**Structure:**

Each function/feature should have **at most** 3 examples:

1. **Basic** - Happy path, minimal but complete
2. **Realistic** - Real-world usage with error handling
3. **Edge Case** - Non-obvious scenario (if applicable)

**Example - Good (Concise):**

```typescript
import { memoize, attempt } from '@logosdx/utils'

// Basic: Cache expensive API calls
const getUser = memoize(fetchUser, { ttl: 60000 })

const user1 = await getUser('42')  // Fetches
const user2 = await getUser('42')  // Cached

// Realistic: With error handling and stale-while-revalidate
const getPrice = memoize(fetchPrice, {
    ttl: 60000,
    staleIn: 30000,      // Stale after 30s
    staleTimeout: 1000   // Wait max 1s for fresh
})

const [price, err] = await attempt(() => getPrice('AAPL'))
if (err) return handleError(err)

// Edge case: Custom key for complex arguments
const getData = memoize(fetchResource, {
    keyFn: ([opts]) => `${opts.userId}:${opts.type}`
})

await getData({ userId: '42', type: 'profile', metadata: {...} })
```

**Example - Bad (Verbose):**

```typescript
// Example 1: Basic usage
const fn1 = memoize(...)

// Example 2: With TTL
const fn2 = memoize(..., { ttl: 60000 })

// Example 3: With maxSize
const fn3 = memoize(..., { maxSize: 100 })

// Example 4: With both
const fn4 = memoize(..., { ttl: 60000, maxSize: 100 })

// Example 5: With custom key
const fn5 = memoize(..., { keyFn: ... })

// Example 6: With error handler
const fn6 = memoize(..., { onError: ... })

// Example 7: With stale-while-revalidate
const fn7 = memoize(..., { staleIn: ... })

// ... (10 more variations)
```

**Standards:**

- **Minimal but complete** - 3 examples maximum per feature
- Show imports and types
- Demonstrate realistic scenarios
- Include error handling in realistic examples
- Use actual variable names, not placeholders
- Comment sparingly (code should speak)
- No progressive complexity ladders
- No exhaustive option combinations


## LLM Helper Documentation


### Purpose

The `llm-helpers/{package}.md` files serve a different purpose: providing optimized context for AI assistants to understand and use your library correctly.


### Structure

Use **explicit section headers**:

```markdown
# @logosdx/package-name

Brief one-sentence description.

## Facts (API)

[Concise but complete API reference]

## Philosophy

[Condensed design reasoning and mental models]

## Patterns

[Essential usage examples]
```


### Characteristics

**Different from user docs:**

- **More robotic** - Optimized for RAG systems
- **More structured** - Explicit labels for context retrieval
- **More condensed** - Shorter explanations, more information density
- **Manually curated** - Not auto-generated

**Example:**

```markdown
## Facts (API)

function memoize<T>(fn: T, opts?: MemoizeOptions<T>): EnhancedMemoizedFunction<T>
- Built-in inflight deduplication
- LRU eviction at maxSize
- TTL-based expiration
- Stale-while-revalidate support
- Pluggable cache adapters

Options: ttl (60000), maxSize (1000), staleIn (undefined), staleTimeout (undefined), generateKey, onError, adapter

## Philosophy

Solves thundering herd (duplicate concurrent requests) + caching. Uses error tuples internally. Async only (use memoizeSync for sync functions). LRU eviction uses access sequence for deterministic ordering.

When to use: API calls, database queries, expensive computations with reproducible results.
When not to use: Non-deterministic functions, side effects, sync functions.

## Patterns

// Basic with error handling
const getUser = memoize(fetchUser, { ttl: 60000 })
const [user, err] = await attempt(() => getUser('42'))

// Stale-while-revalidate for speed
const getPrice = memoize(fetchPrice, {
    ttl: 60000, staleIn: 30000, staleTimeout: 1000
})

// Custom key for hot paths
const getData = memoize(fetch, {
    keyFn: ([opts]) => opts.userId
})
```


## Quality Checklist


### Main Document Structure

- [ ] Overview paragraph covers what, why, and (if natural) how
- [ ] Getting Started has 1-3 high-impact examples
- [ ] Getting Started points to full API reference
- [ ] Core Concepts condenses key philosophy
- [ ] Core Concepts points to full philosophy doc (if separate)

### API Reference

- [ ] Every function has heading with its name
- [ ] Every function has telos paragraph (purpose, effect, motivation)
- [ ] Every public API documented
- [ ] All parameters with types, defaults, constraints
- [ ] Return types explicit
- [ ] Error types documented
- [ ] Configuration schemas complete
- [ ] No ambiguous language

### Philosophy

- [ ] Problem statement clear
- [ ] Mechanism explained
- [ ] Structure described
- [ ] Foundations identified
- [ ] Tradeoffs discussed honestly
- [ ] Decision frameworks provided ("when to use")
- [ ] Performance characteristics noted
- [ ] Common mistakes warned against
- [ ] Alternatives compared
- [ ] Section headers emerge naturally from content

### Patterns

- [ ] Examples are runnable
- [ ] Common use cases covered
- [ ] **Maximum 3 examples per feature**
- [ ] Error handling shown in realistic examples
- [ ] Edge cases demonstrated (if non-obvious)
- [ ] Integration patterns included (if applicable)
- [ ] Best practices modeled
- [ ] Code is concise


## Common Mistakes


### ❌ Meta-Documentation Noise

```markdown
This document provides comprehensive documentation for memoization
following the three-pillar framework (Memory, Reasoning, Examples).

## Memory: The "What"

This section covers the complete API reference...
```

**Problem**: Framework labels visible to users. Self-referential noise.

**Fix**: Just write the content naturally.


### ❌ Robotic Template Following

```markdown
## Function: retry()

### Purpose
Retries a function.

### Parameters
- fn: Function to retry
- options: Retry options

### Returns
Promise
```

**Problem**: Tells WHAT but not WHY or WHEN. No judgment or expertise.

**Fix**: Explain the problem, reasoning, and decision framework.


### ❌ Excessive Example Variations

```markdown
// Example 1: Basic
retry(fn, { retries: 3 })

// Example 2: With delay
retry(fn, { retries: 3, delay: 1000 })

// Example 3: With backoff
retry(fn, { retries: 3, delay: 1000, backoff: 2 })

// Example 4: With jitter
retry(fn, { retries: 3, delay: 1000, backoff: 2, jitter: 0.1 })

// ... (20 more variations)
```

**Problem**: Verbosity without insight. Every option combination shown.

**Fix**: Show 3 examples: basic, realistic with error handling, edge case.


### ❌ Examples Without Context

```typescript
retry(fn, { retries: 3 })
```

**Problem**: Where does `fn` come from? What types? How to handle errors?

**Fix**: Show complete, runnable code with imports, types, error handling.


### ❌ Philosophy Without Tradeoffs

```markdown
Error tuples are better than try-catch because they make errors explicit.
```

**Problem**: One-sided view. No discussion of costs or alternatives.

**Fix**: Honest comparison showing when each approach is appropriate.


### ❌ Formulaic Section Headers

```markdown
## Design Philosophy

### Final Cause (Why It Exists)
### Efficient Cause (How It Works)
### Formal Cause (Structure)
### Material Cause (Primitives)
```

**Problem**: Framework concepts leaked into user-facing documentation.

**Fix**: Natural headers that emerge from content (e.g., "The Problem", "How It Works", "When to Use").


## Testing Your Documentation


### The Human Test

Can a developer who has never seen your library:

1. Understand what problem it solves? (Philosophy)
2. Find the exact API they need? (API Reference)
3. Get working code in <5 minutes? (Patterns)


### The AI Test

Ask an AI assistant (Claude, GPT, etc.) to:

1. Explain when to use feature X vs feature Y
2. Write code solving a realistic problem
3. Debug an issue or anti-pattern

If the AI struggles with judgment or reasoning, your philosophy docs need work.
If the AI makes syntax errors, your API reference needs work.
If the AI can't produce working examples, your patterns need work.


## Summary


Great documentation requires answering three questions with the right balance:

| What to Cover           | Purpose                     | Standard                     |
| ----------------------- | --------------------------- | ---------------------------- |
| **What can I do?**      | API surface, capabilities   | Exhaustive, precise, typed   |
| **Why is it this way?** | Design decisions, tradeoffs | Honest, reasoned, insightful |
| **How do I use it?**    | Practical patterns          | Concise, complete, realistic |

**Remember**: Information without wisdom is just noise. Teach judgment and understanding, not just syntax.


## Invisible Philosophical Framework

These Aristotelian concepts guide philosophy sections (but remain invisible to readers):

**Four Causes** (hierarchical order for presenting ideas):

1. Final - Why does this exist? What problem does it solve?
2. Efficient - How does it work? What's the mechanism?
3. Formal - How is it structured? What's the architecture?
4. Material - What is it built from? What primitives?

**Additional Concepts** (thinking tools for writers):

- **Potentiality ↔ Actuality**: How does this library actualize potentials? What transformations does it enable?
- **Hylomorphism**: What is the "matter" (data, state) and "form" (structure, logic) of this system?
- **Laws of Thought**: Identity, Non-Contradiction, Excluded Middle guide clear reasoning
- **Law of Sufficient Reason**: Provide complete explanations, avoid "just because" answers

These are thinking tools for writers, not section headers or labels for readers. Let the structure emerge naturally from the content while being guided by these principles.
