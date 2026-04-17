import type { Cookie } from './types.ts';
import { parseDate } from './date-parser.ts';
import { canonicalizeDomain, matchesDomain } from './domain.ts';
import { defaultPath } from './path.ts';


/**
 * RFC 6265 §5.2 — Parse a Set-Cookie header value into a Cookie.
 *
 * @param header     - The raw Set-Cookie header value (not the "Set-Cookie:" prefix).
 * @param requestUrl - The URL of the request that received this header.
 *                     Used for domain validation and default path/domain.
 * @returns Parsed Cookie, or null if the header should be ignored.
 *
 * @example
 *     parseSetCookieHeader('session=abc; Path=/; Secure', new URL('https://example.com/'))
 */
export function parseSetCookieHeader(header: string, requestUrl: URL): Cookie | null {

    // §5.2 Phase 1 — parse name-value pair
    const semiIdx = header.indexOf(';');
    const nameValuePair = semiIdx >= 0 ? header.slice(0, semiIdx) : header;
    const unparsedAttributes = semiIdx >= 0 ? header.slice(semiIdx + 1) : '';

    const eqIdx = nameValuePair.indexOf('=');

    if (eqIdx < 0) return null;

    const cookieName = nameValuePair.slice(0, eqIdx).trim();
    const cookieValue = nameValuePair.slice(eqIdx + 1).trim();

    if (!cookieName) return null;

    // §5.2 Phase 2 — parse attributes
    let expiresTime: number | undefined;
    let maxAgeTime: number | undefined;
    let domainAttr = '';
    let pathAttr = '';
    let secure = false;
    let httpOnly = false;

    for (const part of unparsedAttributes.split(';')) {

        const eqI = part.indexOf('=');
        const attrName = (eqI >= 0 ? part.slice(0, eqI) : part).trim();
        const attrValue = eqI >= 0 ? part.slice(eqI + 1).trim() : '';
        const attrLower = attrName.toLowerCase();

        if (attrLower === 'expires') {

            const parsed = parseDate(attrValue);

            if (parsed !== null) {

                expiresTime = parsed;
            }
        }
        else if (attrLower === 'max-age') {

            // First char must be a digit or "-", rest must all be digits
            if (/^-?\d+$/.test(attrValue)) {

                const delta = parseInt(attrValue, 10);
                maxAgeTime = delta <= 0 ? 0 : Date.now() + delta * 1000;
            }
        }
        else if (attrLower === 'domain') {

            if (attrValue) {

                domainAttr = canonicalizeDomain(attrValue);
            }
        }
        else if (attrLower === 'path') {

            pathAttr = attrValue && attrValue.startsWith('/') ? attrValue : '';
        }
        else if (attrLower === 'secure') {

            secure = true;
        }
        else if (attrLower === 'httponly') {

            httpOnly = true;
        }
        // extension-av attributes are silently ignored per spec
    }

    // §5.3 — Resolve domain and host-only-flag
    const requestHost = requestUrl.hostname;
    let cookieDomain: string;
    let hostOnlyFlag: boolean;

    if (domainAttr) {

        if (!matchesDomain(domainAttr, requestHost)) return null;

        cookieDomain = domainAttr;
        hostOnlyFlag = false;
    }
    else {

        cookieDomain = requestHost.toLowerCase();
        hostOnlyFlag = true;
    }

    // §5.3 — Resolve path
    const cookiePath = pathAttr || defaultPath(requestUrl.pathname);

    // §5.3 — Resolve expiry: Max-Age takes precedence over Expires
    let expiryTime: number;
    let persistentFlag: boolean;

    if (maxAgeTime !== undefined) {

        expiryTime = maxAgeTime;
        persistentFlag = true;
    }
    else if (expiresTime !== undefined) {

        expiryTime = expiresTime;
        persistentFlag = true;
    }
    else {

        expiryTime = Infinity;
        persistentFlag = false;
    }

    const now = Date.now();

    return {
        name: cookieName,
        value: cookieValue,
        domain: cookieDomain,
        path: cookiePath,
        expiryTime,
        creationTime: now,
        lastAccessTime: now,
        persistentFlag,
        hostOnlyFlag,
        secureOnlyFlag: secure,
        httpOnlyFlag: httpOnly,
    };
}
