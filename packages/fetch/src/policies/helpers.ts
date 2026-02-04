import { assert } from '@logosdx/utils';
import type { MatchTypes, _InternalHttpMethods } from '../types.ts';


/**
 * Default HTTP methods that are subject to inflight deduplication.
 * Only GET requests are deduplicated by default since they are idempotent.
 */
export const DEFAULT_INFLIGHT_METHODS: Set<_InternalHttpMethods> = new Set(['GET']);


/**
 * Checks if a path matches a rule's match type.
 *
 * Rules should specify exactly one match type. If multiple are specified,
 * they are checked in order: is → startsWith → endsWith → includes → match.
 *
 * @param rule - The rule containing match type(s)
 * @param path - The request path to match against
 * @returns false if the path matches the rule's criteria
 *
 * @example
 * ```typescript
 * matchPath({ is: '/users' }, '/users');           // true
 * matchPath({ startsWith: '/api' }, '/api/users'); // true
 * matchPath({ endsWith: '.json' }, '/data.json');  // true
 * matchPath({ includes: 'admin' }, '/admin/dash'); // true
 * matchPath({ match: /^\/v\d+/ }, '/v2/users');    // true
 * ```
 */
export const matchPath = (rule: MatchTypes, path: string): boolean => {

    // 'is' is an exact match that can't be combined with others
    if (rule.is !== undefined) {

        return path === rule.is;
    }

    // For other match types, all specified types must match (AND logic)
    // If no types are specified, return false

    let hasMatch = true;
    let hasMatchType = false;

    if (rule.startsWith !== undefined) {

        hasMatchType = true;
        hasMatch = hasMatch && path.startsWith(rule.startsWith);
    }

    if (rule.endsWith !== undefined) {

        hasMatchType = true;
        hasMatch = hasMatch && path.endsWith(rule.endsWith);
    }

    if (rule.includes !== undefined) {

        hasMatchType = true;
        hasMatch = hasMatch && path.includes(rule.includes);
    }

    if (rule.match !== undefined) {

        hasMatchType = true;
        hasMatch = hasMatch && rule.match.test(path);
    }

    // Must have at least one match type and all specified types must match
    return hasMatchType && hasMatch;
};


const toSet = <T>(arr?: T[] | Set<T>): Set<T> | undefined => {

    if (!arr) return;

    return arr instanceof Set ? arr : new Set(arr);
};


/**
 * Checks if a method matches the rule's method constraints.
 *
 * @param method - The HTTP method to check
 * @param ruleMethods - Methods specified in the rule (undefined means inherit from defaults)
 * @param defaultMethods - Default methods when rule doesn't specify any
 * @returns true if the method is allowed by the rule
 */
export const matchMethod = (
    method: string,
    ruleMethods: _InternalHttpMethods[] | undefined,
    defaultMethods: _InternalHttpMethods[] | undefined,
): boolean => {

    const methods = toSet(ruleMethods) ?? toSet(defaultMethods) ?? DEFAULT_INFLIGHT_METHODS;
    const normalizedMethod = method.toUpperCase() as _InternalHttpMethods;

    return methods.has(normalizedMethod);
};


/**
 * Validates an array of match rules.
 *
 * Each rule must be an object specifying at least one match type:
 * is, startsWith, endsWith, includes, or match.
 *
 * Rules can specify multiple match types, which are combined with a logical AND.
 * Except for 'is', which cannot be combined with other types, because it logically
 * contradicts anything except an exact match.
 *
 * @param rules - Array of match rules to validate
 * @throws {AssertionError} If any rule is invalid
 *
 * @example
 * ```typescript
 * const rules = [
 *     { is: '/users' },
 *     { startsWith: '/api' },
 *     { endsWith: '.json' },
 *     { includes: 'admin' },
 *     { match: /^\/v\d+/ },
 *     { startsWith: '/public', endsWith: '.html' },
 *     { includes: 'user', match: /\/dash/ }
 * ];
 *
 * validateMatchRules(rules); // No error thrown
 * ```
 */
export const validateMatchRules = <T extends MatchTypes>(
    rules: T[]
) => {

    assert(Array.isArray(rules), 'rules must be an array');

    for (const r in rules) {

        const rule = rules[r]!;

        assert(rule && typeof rule === 'object', `rule[${r}] must be an object`);

        const matchTypes = ['is', 'startsWith', 'endsWith', 'includes', 'match'] as const;

        assert(
            matchTypes.some(type => rule[type] !== undefined),
            `rule[${r}] must specify at least one match type (is, startsWith, endsWith, includes, match)`
        );

        for (const type of matchTypes) {

            const value = rule[type];

            if (value === undefined) {

                continue;
            }

            if (type === 'match') {

                assert(
                    value instanceof RegExp,
                    `rule[${r}].match must be a RegExp`
                );

                continue;
            }

            assert(
                typeof value === 'string',
                `rule[${r}].${type} must be a string`
            );

            assert(
                (value as string).length > 0,
                `rule[${r}].${type} cannot be an empty string`
            );
        }

        // If 'is' is defined, no other match types should be defined
        if (rule.is !== undefined) {

            assert(
                !matchTypes
                    .filter(type => type !== 'is')
                    .some(type => rule[type] !== undefined),
                `rule[${r}] 'is' contradicts with other match types and cannot be used together`
            );
        }
    }
}


/**
 * Finds the first matching rule from a list of rules.
 *
 * Rules are checked in order - first match wins. Both path and method
 * must match for a rule to be considered a match.
 *
 * @param rules - Array of rules to check
 * @param method - HTTP method of the request
 * @param path - Request path
 * @param defaultMethods - Default methods to use when rule doesn't specify any
 * @returns The first matching rule, or undefined if no rules match
 *
 * @example
 * ```typescript
 * const rules = [
 *     { startsWith: '/admin', enabled: false },
 *     { endsWith: '/stream', enabled: false },
 *     { startsWith: '/api', methods: ['GET', 'POST'] }
 * ];
 *
 * findMatchingRule(rules, 'GET', '/admin/users', ['GET']);
 * // Returns: { startsWith: '/admin', enabled: false }
 * ```
 */
export const findMatchingRule = <T extends MatchTypes & { methods?: _InternalHttpMethods[] | undefined }>(
    rules: T[],
    method: string,
    path: string,
    defaultMethods: _InternalHttpMethods[]
): T | undefined => {

    for (const rule of rules) {

        if (matchPath(rule, path) && matchMethod(method, rule.methods, defaultMethods)) {

            return rule;
        }
    }

    return undefined;
};
