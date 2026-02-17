import type {
    MatchTypes,
    RequestKeyOptions,
    RequestSerializer,
    _InternalHttpMethods
} from '../types.ts';


/**
 * Base interface for all policy rules.
 *
 * Extends MatchTypes for route matching and provides common fields
 * shared across all resilience policies (dedupe, cache, rate-limit, retry).
 *
 * @template S - Instance state type
 * @template H - Headers type
 * @template P - Params type
 */
export interface BasePolicyRule<S = unknown, H = unknown, P = unknown> extends MatchTypes {

    /** HTTP methods this rule applies to */
    methods?: _InternalHttpMethods[] | undefined;

    /** Enable/disable for matched routes */
    enabled?: boolean | undefined;

    /** Custom serializer for this rule's key generation */
    serializer?: RequestSerializer<S, H, P> | undefined;
}


/**
 * Base interface for all policy configurations.
 *
 * Provides common fields shared across all resilience policy configs
 * (dedupe, cache, rate-limit, retry).
 *
 * @template S - Instance state type
 * @template H - Headers type
 * @template P - Params type
 * @template TRule - The specific rule type that extends BasePolicyRule
 */
export interface BasePolicyConfig<
    S = unknown,
    H = unknown,
    P = unknown,
    TRule extends BasePolicyRule<S, H, P> = BasePolicyRule<S, H, P>
> {

    /** Enable policy globally */
    enabled?: boolean | undefined;

    /** HTTP methods to apply by default */
    methods?: _InternalHttpMethods[] | undefined;

    /** Default serializer for key generation */
    serializer?: RequestSerializer<S, H, P> | undefined;

    /** Route-specific rules */
    rules?: TRule[] | undefined;
}


/**
 * Internal state managed by ResiliencePolicy base class.
 *
 * This is the memoized state computed from config during initialization.
 *
 * @template TRule - The specific rule type that extends BasePolicyRule
 * @template S - Instance state type (defaults to any for flexibility)
 * @template H - Headers type (defaults to any for flexibility)
 * @template P - Params type (defaults to any for flexibility)
 */
export interface PolicyInternalState<TRule, S = any, H = any, P = any> {

    /** Whether the policy is globally enabled */
    enabled: boolean;

    /** Set of HTTP methods this policy applies to */
    methods: Set<string>;

    /** The serializer function for key generation */
    serializer: RequestSerializer<S, H, P>;

    /** Memoized rule cache: method:path -> resolved rule or null */
    rulesCache: Map<string, TRule | null>;
}


/**
 * Context passed to skip callbacks and serializers.
 *
 * Re-exported from types.ts for convenience.
 */
export type { RequestKeyOptions };
