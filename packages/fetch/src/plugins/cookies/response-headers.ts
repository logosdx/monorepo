/**
 * Read the `set-cookie` entries from a FetchResponse-style plain headers
 * object.
 *
 * `FetchResponse.headers` is `Partial<RH>` — a plain object keyed by the
 * user-provided generic `RH`. Because `RH` rarely declares `'set-cookie'`,
 * callers would otherwise need a cast. Taking `unknown` and runtime-narrowing
 * lets consumers pass `response.headers` directly without assertions.
 *
 * The executor preserves multi-value `set-cookie` headers as a `string[]`
 * (see `executor.ts`). This helper normalizes every shape the field may
 * legally take:
 *
 *   - Missing / undefined / null / non-object → []
 *   - string[]                                → filtered to string values only
 *   - single string                           → wrapped in [str]
 *   - anything else                           → []
 *
 * The lookup is case-tolerant: both `set-cookie` (lowercase, the preferred
 * form) and `Set-Cookie` are checked.
 */
export function getSetCookieHeaders(headers: unknown): string[] {

    if (headers === null || typeof headers !== 'object') return [];

    // Reflect.get returns the value at the key without requiring the key to
    // be in the object's static type. Return type is propagated as-inferred
    // and narrowed below via `Array.isArray` / `typeof` runtime guards.
    const raw =
        Reflect.get(headers, 'set-cookie') ??
        Reflect.get(headers, 'Set-Cookie');

    if (raw == null) return [];

    if (Array.isArray(raw)) {

        return raw.filter((v): v is string => typeof v === 'string');
    }

    if (typeof raw === 'string') return [raw];

    return [];
}
