---
type: Domain
---

# redis-bus

## What it does

`@logosdx/redis-bus` is a Redis Streams–backed message bus (in progress — README only, no source implementation yet). It targets broadcast and queue semantics, automatic retry with exponential backoff, dead-letter routing, stalled-consumer reclaim, orphan-consumer sweep, and graceful shutdown. Requires Redis 7+ or Valkey 7.2+, with `ioredis` as a peer dependency.

## Artifacts

(none — no skill reference exists yet)

## CLI code

(none — [`packages/redis-bus/`](../../packages/redis-bus) contains only a README; no `src/` directory exists)

## Docs

- `packages/redis-bus/README.md` — design and API preview (225 LOC); includes `createMessageBus` usage example

## Coupling

- Intended to use `@logosdx/utils` (`attempt` pattern is shown in README examples).
- No coupling to other packages confirmed from source (source does not exist yet).

## Conventions worth knowing

- [`packages/redis-bus/`](../../packages/redis-bus) appears in git status as an untracked directory — it was added to the working tree but not yet committed or implemented.
- The `createMessageBus` factory function is described in the README but not yet implemented in source.
