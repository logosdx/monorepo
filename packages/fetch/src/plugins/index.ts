export { ResiliencePolicy } from './base.ts';

export {
    DedupePolicy,
    dedupePlugin
} from './dedupe.ts';

export {
    CachePolicy,
    cachePlugin,
    type CachePolicyState,
} from './cache.ts';

export {
    RateLimitPolicy,
    rateLimitPlugin,
    type RateLimitPolicyState,
} from './rate-limit.ts';

export {
    retryPlugin
} from './retry.ts';

export type {
    BasePolicyRule,
    BasePolicyConfig,
    PolicyInternalState,
    RequestKeyOptions
} from './types.ts';

export {
    cookiePlugin,
    type CookiePlugin
} from './cookies/index.ts';

export type {
    Cookie,
    CookieAdapter,
    CookieConfig
} from './cookies/index.ts';

export {
    CookieJar,
    type CookieJarOptions,
    MemoryAdapter
} from './cookies/index.ts';
