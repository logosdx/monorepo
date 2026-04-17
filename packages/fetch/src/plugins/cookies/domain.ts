/**
 * RFC 6265 §5.1.3 — Domain matching utilities.
 */


/**
 * Canonicalize a domain string: lowercase and strip one leading dot.
 * Applied to both Domain attribute values and request hostnames.
 *
 * @example
 *     canonicalizeDomain('.Example.COM') // → 'example.com'
 */
export function canonicalizeDomain(domain: string): string {

    return domain.toLowerCase().replace(/^\./, '');
}


/**
 * Returns true if `requestHost` is an IPv4 or IPv6 address.
 * IP addresses cannot be subdomain-matched — only exact host-only matching.
 */
export function isIpAddress(host: string): boolean {

    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
    if (host.startsWith('[') && host.endsWith(']')) return true;

    return false;
}


/**
 * RFC 6265 §5.1.3 — Domain matching.
 *
 * A cookie with domain `cookieDomain` is sent to `requestHost` if either:
 * - They are identical (case-insensitive), or
 * - `cookieDomain` is a suffix of `requestHost`, the character before the
 *   suffix is a ".", and `requestHost` is not an IP address.
 *
 * @example
 *     matchesDomain('example.com', 'api.example.com') // → true
 *     matchesDomain('example.com', 'notexample.com')  // → false
 */
export function matchesDomain(cookieDomain: string, requestHost: string): boolean {

    const cd = canonicalizeDomain(cookieDomain);
    const rh = requestHost.toLowerCase();

    if (cd === rh) return true;

    if (!rh.endsWith('.' + cd)) return false;
    if (isIpAddress(rh)) return false;

    return true;
}
