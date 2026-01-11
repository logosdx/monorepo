import type {
    _InternalHttpMethods,
    RequestKeyOptions,
    RequestSerializer
} from '../types.ts';

import type {
    BasePolicyRule,
    BasePolicyConfig,
    PolicyInternalState
} from './types.ts';

import { findMatchingRule, validateMatchRules } from '../helpers.ts';


/**
 * Abstract base class for resilience policies.
 *
 * Provides the common three-method pattern used by all policies:
 * - `init`: Parse config, initialize state (O(1))
 * - `resolve`: Memoized lookup + dynamic checks (O(1) amortized)
 * - `compute`: Rule matching, memoized (O(n) first call only)
 *
 * Subclasses must implement:
 * - `getDefaultSerializer()`: Return the default serializer for this policy
 * - `getDefaultMethods()`: Return the default HTTP methods for this policy
 * - `mergeRuleWithDefaults(rule)`: Merge a rule with policy defaults
 *
 * @template TConfig - The policy config type extending BasePolicyConfig
 * @template TRule - The rule type extending BasePolicyRule
 * @template S - Instance state type
 * @template H - Headers type
 * @template P - Params type
 */
export abstract class ResiliencePolicy<
    TConfig extends BasePolicyConfig<any, any, any, TRule>,
    TRule extends BasePolicyRule<any, any, any>,
    S = any,
    H = any,
    P = any
> {

    protected state: PolicyInternalState<TRule, S, H, P> | null = null;
    protected config: TConfig | null = null;

    /**
     * Get the default serializer for this policy.
     * Subclasses must implement this.
     */
    protected abstract getDefaultSerializer(): RequestSerializer<S, H, P>;

    /**
     * Get the default HTTP methods for this policy.
     * Subclasses must implement this.
     */
    protected abstract getDefaultMethods(): _InternalHttpMethods[];

    /**
     * Merge a matched rule with policy defaults.
     * Subclasses must implement this to handle policy-specific fields.
     *
     * @param rule - The matched rule (or null for global defaults)
     * @returns The merged rule with all defaults applied
     */
    protected abstract mergeRuleWithDefaults(rule: TRule | null): TRule;


    /**
     * Whether the policy is initialized and enabled.
     */
    get isEnabled(): boolean {

        return this.state?.enabled ?? false;
    }


    /**
     * Initialize the policy with configuration.
     *
     * Parses the config (boolean or object), validates rules,
     * and sets up internal state for fast lookups.
     *
     * @param config - Boolean true for defaults, or full config object
     */
    init(config?: boolean | TConfig): void {

        if (!config) {

            this.state = null;
            this.config = null;
            return;
        }

        if (config === true) {

            this.state = {
                enabled: true,
                methods: new Set(this.getDefaultMethods()),
                serializer: this.getDefaultSerializer(),
                rulesCache: new Map()
            };
            this.config = {} as TConfig;
            return;
        }

        this.config = config;

        this.state = {
            enabled: config.enabled !== false,
            methods: new Set(config.methods ?? this.getDefaultMethods()),
            serializer: config.serializer ?? this.getDefaultSerializer(),
            rulesCache: new Map()
        };

        if (config.rules) {

            validateMatchRules(config.rules);
        }
    }


    /**
     * Resolve policy configuration for a specific request.
     *
     * Uses memoization for rule matching (O(n) only once per method+path).
     * Skip callbacks are always evaluated since they depend on request context.
     *
     * @param method - HTTP method (uppercase)
     * @param path - Request path
     * @param ctx - Full request context for skip callback
     * @param skipCallback - Optional skip callback from config
     * @returns Resolved rule or null if disabled
     */
    resolve(
        method: string,
        path: string,
        ctx: RequestKeyOptions<S, H, P>,
        skipCallback?: (ctx: RequestKeyOptions<S, H, P>) => boolean | undefined
    ): TRule | null {

        if (!this.state) return null;

        if (!this.state.enabled && !this.config?.rules?.length) {

            return null;
        }

        const upperMethod = method.toUpperCase();
        const cacheKey = `${upperMethod}:${path}`;

        let cached = this.state.rulesCache.get(cacheKey);

        if (cached === undefined) {

            cached = this.compute(upperMethod, path);
            this.state.rulesCache.set(cacheKey, cached);
        }

        if (cached === null) return null;

        if (skipCallback && skipCallback(ctx) === true) {

            return null;
        }

        return cached;
    }


    /**
     * Compute rule configuration for a method+path combination.
     *
     * This is the expensive O(n) operation that gets memoized.
     * Finds matching rule and merges with policy defaults.
     *
     * @param method - HTTP method (uppercase)
     * @param path - Request path
     * @returns Computed rule or null if disabled
     */
    protected compute(method: string, path: string): TRule | null {

        if (!this.state) return null;

        let enabled = this.state.enabled && this.state.methods.has(method);
        let matchedRule: TRule | null = null;

        if (this.config?.rules?.length) {

            const rule = findMatchingRule(
                this.config.rules,
                method,
                path,
                [...this.state.methods] as _InternalHttpMethods[]
            ) as TRule | undefined;

            if (rule) {

                if (rule.enabled === false) {

                    return null;
                }

                if (rule.methods) {

                    enabled = rule.methods.includes(method as _InternalHttpMethods);
                }
                else {

                    enabled = true;
                }

                matchedRule = rule;
            }
        }

        if (!enabled) return null;

        return this.mergeRuleWithDefaults(matchedRule);
    }


    /**
     * Clear the rules cache.
     *
     * Call this if you need to force re-computation of rules,
     * though typically this is not needed.
     */
    clearCache(): void {

        this.state?.rulesCache.clear();
    }
}
