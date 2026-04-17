/**
 * A single RFC 6265-compliant cookie entry.
 * All 11 fields required by RFC 6265 §5.3 storage model.
 */
export interface Cookie {

    /** Cookie name */
    name: string;

    /** Cookie value */
    value: string;

    /** Canonicalized domain (lowercase, no leading dot) */
    domain: string;

    /** Cookie path, always starts with "/" */
    path: string;

    /**
     * Expiry time as ms epoch.
     * Use Infinity for session cookies (persistent-flag = false).
     */
    expiryTime: number;

    /** Creation time as ms epoch */
    creationTime: number;

    /** Last access time as ms epoch — updated on each retrieval */
    lastAccessTime: number;

    /**
     * TRUE if cookie has explicit Expires or Max-Age.
     * FALSE = session cookie, cleared on clearSession().
     */
    persistentFlag: boolean;

    /**
     * TRUE = cookie only sent to exact origin host.
     * FALSE = cookie sent to domain and all subdomains.
     */
    hostOnlyFlag: boolean;

    /** TRUE = only sent over HTTPS */
    secureOnlyFlag: boolean;

    /** TRUE = excluded from non-HTTP API access */
    httpOnlyFlag: boolean;
}


/**
 * Pluggable persistence adapter.
 *
 * Implement this to persist cookies across FetchEngine instances
 * (e.g., Redis for horizontal scaling, localStorage for browsers,
 * a JSON file for CLIs).
 *
 * The jar calls load() once at init and save() after every mutation.
 * For shared-state backends (Redis), load() should always read fresh —
 * the jar will call it before each outgoing request when `syncOnRequest`
 * is enabled.
 */
export interface CookieAdapter {

    /** Load all persisted cookies. Called at init and optionally before each request. */
    load(): Promise<Cookie[]>;

    /** Persist the full current cookie store. Called after every mutation. */
    save(cookies: Cookie[]): Promise<void>;
}


/**
 * Configuration for cookiePlugin().
 */
export interface CookieConfig {

    /**
     * Pre-seed the jar with these cookies before any requests.
     * Useful for restoring a session from storage without a full adapter.
     */
    cookies?: Cookie[];

    /**
     * Persistence adapter for cross-instance and horizontal-scale scenarios.
     * When provided, the jar loads cookies from the adapter at init
     * and saves after every mutation.
     */
    adapter?: CookieAdapter;

    /**
     * Re-load from adapter before every outgoing request.
     * Use this when multiple FetchEngine instances share a backend (Redis).
     * Default: false (adapter is only loaded at init).
     */
    syncOnRequest?: boolean;

    /**
     * Domains or patterns to exclude from cookie handling.
     * Useful for third-party CDN requests that shouldn't receive cookies.
     */
    exclude?: (string | RegExp)[];

    /**
     * Maximum bytes per cookie (name + value + attributes).
     * Cookies exceeding this are silently dropped.
     * Default: 4096 (RFC 6265 §6.1 minimum).
     */
    maxCookieSize?: number;

    /**
     * Maximum cookies per domain.
     * Excess cookies are evicted oldest-last-access-time first.
     * Default: 50 (RFC 6265 §6.1 minimum).
     */
    maxCookiesPerDomain?: number;

    /**
     * Maximum total cookies across all domains.
     * Default: 3000 (RFC 6265 §6.1 minimum).
     */
    maxCookies?: number;

    /**
     * Set to false if the client is a non-HTTP API (e.g., a script
     * reading cookies directly). Causes httpOnly cookies to be excluded.
     * Default: true.
     */
    httpApi?: boolean;
}
