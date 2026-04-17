import type { Cookie, CookieConfig } from './types.ts';
import { getMatchingCookies } from './serializer.ts';


const DEFAULT_MAX_COOKIES = 3000;
const DEFAULT_MAX_PER_DOMAIN = 50;
const DEFAULT_MAX_COOKIE_SIZE = 4096;


/** Stable key for a cookie entry: domain + path + name */
function cookieKey(domain: string, path: string, name: string): string {

    return `${domain}\x00${path}\x00${name}`;
}


/**
 * Options accepted by CookieJar.
 *
 * `onChange` is fired after every mutation. The plugin uses this to
 * coalesce persistence via `queueMicrotask` — any burst of mutations
 * in a single tick produces exactly one adapter save.
 */
export interface CookieJarOptions extends Pick<
    CookieConfig,
    'maxCookies' | 'maxCookiesPerDomain' | 'maxCookieSize' | 'httpApi'
> {
    onChange?: () => void;
}


/**
 * RFC 6265 §5.3 — In-memory cookie storage with eviction.
 *
 * Handles duplicate detection, expiry eviction, session cleanup,
 * and per-domain / total cookie limits.
 *
 * The jar is synchronous. Persistence (adapter.save) is fire-and-forget
 * and managed by the plugin layer via the `onChange` callback.
 */
export class CookieJar {

    #store: Map<string, Cookie> = new Map();
    #maxCookies: number;
    #maxPerDomain: number;
    #maxCookieSize: number;
    #httpApi: boolean;
    #onChange: (() => void) | undefined;

    constructor(config?: CookieJarOptions) {

        this.#maxCookies = config?.maxCookies ?? DEFAULT_MAX_COOKIES;
        this.#maxPerDomain = config?.maxCookiesPerDomain ?? DEFAULT_MAX_PER_DOMAIN;
        this.#maxCookieSize = config?.maxCookieSize ?? DEFAULT_MAX_COOKIE_SIZE;
        this.#httpApi = config?.httpApi ?? true;
        this.#onChange = config?.onChange;
    }

    /**
     * Seed the jar from a pre-existing cookie array (e.g., loaded from adapter).
     * Applies full set() semantics: eviction, dedup, size check.
     *
     * Fires `onChange` exactly once after the bulk import finishes so a
     * persistence backend does not see N redundant writes for one load.
     */
    load(cookies: Cookie[]): void {

        for (const cookie of cookies) {

            this.#setInternal(cookie);
        }

        this.#onChange?.();
    }

    /**
     * Retrieve cookies matching the given URL, per RFC 6265 §5.4.
     *
     * Updates `lastAccessTime` on every returned cookie (§5.4 step 3) and
     * fires `onChange` once if any match was retrieved. Non-retrieval calls
     * (no matches) do not mutate state and do not fire the callback.
     *
     * The `httpApi` flag from construction determines whether `httpOnly`
     * cookies are included: `true` for the HTTP request pipeline (default),
     * `false` for non-HTTP APIs such as `document.cookie`.
     */
    get(url: URL): Cookie[] {

        const matches = getMatchingCookies(
            [...this.#store.values()],
            url,
            this.#httpApi
        );

        if (matches.length === 0) return matches;

        const now = Date.now();

        for (const cookie of matches) {

            const key = cookieKey(cookie.domain, cookie.path, cookie.name);
            const updated: Cookie = { ...cookie, lastAccessTime: now };
            this.#store.set(key, updated);
        }

        this.#onChange?.();

        return matches.map(c => ({ ...c, lastAccessTime: now }));
    }

    /**
     * Store a cookie per RFC 6265 §5.3.
     *
     * - Cookies with expiryTime in the past are treated as deletion requests.
     * - Duplicate name+domain+path replaces old entry, preserving creationTime.
     * - Expired cookies are evicted before inserting.
     * - Per-domain and total limits are enforced after insert.
     *
     * Fires `onChange` after the mutation completes.
     */
    set(cookie: Cookie): void {

        this.#setInternal(cookie);
        this.#onChange?.();
    }

    /**
     * Remove a specific cookie by domain + path + name.
     *
     * Fires `onChange` regardless of whether the cookie existed — callers
     * asking to delete a cookie is a meaningful event even when there is
     * nothing to remove.
     */
    delete(domain: string, path: string, name: string): void {

        this.#store.delete(cookieKey(domain, path, name));
        this.#onChange?.();
    }

    /**
     * Remove all cookies, or only those matching a specific domain.
     */
    clear(domain?: string): void {

        if (!domain) {

            this.#store.clear();
            this.#onChange?.();
            return;
        }

        for (const [key, cookie] of this.#store) {

            if (cookie.domain === domain) {

                this.#store.delete(key);
            }
        }

        this.#onChange?.();
    }

    /**
     * Remove all session cookies (persistentFlag = false).
     * Call this when a logical "session end" occurs.
     */
    clearSession(): void {

        for (const [key, cookie] of this.#store) {

            if (!cookie.persistentFlag) {

                this.#store.delete(key);
            }
        }

        this.#onChange?.();
    }

    /**
     * Return all non-expired cookies without updating access times.
     *
     * Use this for inspection, serialization, or export. It does not fire
     * `onChange`. For request-time retrieval use `get(url)`.
     */
    all(): Cookie[] {

        this.#evictExpired();

        return [...this.#store.values()];
    }

    // -----------------------------------------------------------------------

    /**
     * Internal set without firing onChange. Used by load() so a bulk
     * import only fires the callback once.
     */
    #setInternal(cookie: Cookie): void {

        this.#evictExpired();

        const key = cookieKey(cookie.domain, cookie.path, cookie.name);
        const size = (cookie.name + cookie.value).length;

        // Drop oversized cookies
        if (size > this.#maxCookieSize) return;

        // Expired/deleted cookie: remove if present, do not insert
        if (cookie.expiryTime !== Infinity && cookie.expiryTime <= Date.now()) {

            this.#store.delete(key);
            return;
        }

        // Preserve creationTime from existing entry (RFC 6265 §5.3 step 11)
        const existing = this.#store.get(key);

        const entry: Cookie = existing
            ? { ...cookie, creationTime: existing.creationTime }
            : cookie;

        this.#store.set(key, entry);

        this.#enforcePerDomainLimit(cookie.domain);
        this.#enforceTotalLimit();
    }

    #evictExpired(): void {

        const now = Date.now();

        for (const [key, cookie] of this.#store) {

            if (cookie.expiryTime !== Infinity && cookie.expiryTime <= now) {

                this.#store.delete(key);
            }
        }
    }

    #enforcePerDomainLimit(domain: string): void {

        const domainCookies = [...this.#store.values()]
            .filter(c => c.domain === domain)
            .sort((a, b) => a.lastAccessTime - b.lastAccessTime);

        while (domainCookies.length > this.#maxPerDomain) {

            const oldest = domainCookies.shift()!;
            this.#store.delete(cookieKey(oldest.domain, oldest.path, oldest.name));
        }
    }

    #enforceTotalLimit(): void {

        if (this.#store.size <= this.#maxCookies) return;

        const all = [...this.#store.values()]
            .sort((a, b) => a.lastAccessTime - b.lastAccessTime);

        while (all.length > this.#maxCookies) {

            const oldest = all.shift()!;
            this.#store.delete(cookieKey(oldest.domain, oldest.path, oldest.name));
        }
    }
}
