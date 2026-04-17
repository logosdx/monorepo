// New modular imports
import { FetchEngine } from './engine/index.ts';

export {
    FetchError,
    isFetchError
} from './helpers/index.ts';

export type {
    FetchResponse,
    FetchConfig,
    DeduplicationConfig,
    DedupeRule,
    CacheConfig,
    CacheRule,
    RateLimitConfig,
    RateLimitRule,
    MatchTypes,
    RequestKeyOptions,
    RequestSerializer
} from './types.ts';

// Serializers (requestSerializer for dedupe/cache, endpointSerializer for rate-limit)
export {
    endpointSerializer,
    requestSerializer
} from './serializers/index.ts';

// Plugin classes and factory functions
export {
    ResiliencePolicy,
    DedupePolicy,
    dedupePlugin,
    CachePolicy,
    cachePlugin,
    RateLimitPolicy,
    rateLimitPlugin,
    retryPlugin,
    cookiePlugin,
    CookieJar,
    MemoryAdapter
} from './plugins/index.ts';

export type {
    BasePolicyRule,
    BasePolicyConfig,
    PolicyInternalState,
    CachePolicyState,
    RateLimitPolicyState,
    CookiePlugin,
    Cookie,
    CookieAdapter,
    CookieConfig,
    CookieJarOptions
} from './plugins/index.ts';

export { FetchEngine } from './engine/index.ts';
export { FetchState } from './state/index.ts';
export { ConfigStore } from './options/index.ts';
export { HeadersManager } from './properties/headers.ts';
export { ParamsManager } from './properties/params.ts';
export { PropertyStore } from './properties/store.ts';

export type {
    FetchEngineCore,
    FetchEnginePublic,
    FetchLifecycle,
    FetchPlugin,
    InternalReqOptions,
    ExecuteResult,
    CallConfig,
    InstanceResponseHeaders,
    FetchStreamPromise,
    ResponseDirective
} from './engine/index.ts';

export { FetchPromise } from './engine/index.ts';

export type {
    EventMap,
    EventData,
    DedupeEventData,
    CacheEventData,
    RateLimitEventData,
    StateEventData,
    PropertyEventData,
    OptionsEventData
} from './engine/index.ts';

export type {
    EngineConfig,
    EngineType,
    EngineRequestConfig as EngineRequestOpts,
    EngineLifecycle,
    ValidateConfig,
DetermineTypeFn,
    InstanceHeaders,
    InstanceParams,
    InstanceState
} from './options/types.ts';

export type {
    PropertyStoreOptions,
    PropertyValidateFn,
    MethodOverrides
} from './properties/store.ts';

const baseEngine = new FetchEngine({
    baseUrl: globalThis?.location?.origin ?? 'https://logosdx.dev',
});

/** See {@link FetchEngine.request}. */
export const request = baseEngine.request.bind(baseEngine);

/** See {@link FetchEngine.options}. */
export const options = baseEngine.options.bind(baseEngine);

/** See {@link FetchEngine.head}. */
export const head = baseEngine.head.bind(baseEngine);

/** See {@link FetchEngine.get}. */
export const get = baseEngine.get.bind(baseEngine);

/** See {@link FetchEngine.delete}. */
export const del = baseEngine.delete.bind(baseEngine);

/** See {@link FetchEngine.post}. */
export const post = baseEngine.post.bind(baseEngine);

/** See {@link FetchEngine.put}. */
export const put = baseEngine.put.bind(baseEngine);

/** See {@link FetchEngine.patch}. */
export const patch = baseEngine.patch.bind(baseEngine);

/** See {@link FetchEngine.headers}. */
export const headers = baseEngine.headers;

/** See {@link FetchEngine.params}. */
export const params = baseEngine.params;

/** See {@link FetchEngine.state}. */
export const state = baseEngine.state;

/** See {@link FetchEngine.config}. */
export const config = baseEngine.config;

// Event methods
/** See {@link FetchEngine.on}. */
export const on = baseEngine.on.bind(baseEngine);

/** See {@link FetchEngine.off}. */
export const off = baseEngine.off.bind(baseEngine);


/** See {@link FetchEngine}. */
export default baseEngine;
