/**
 * RFC 6265 §5.1.1 — Cookie-date parsing algorithm.
 *
 * This is NOT Date.parse(). The RFC defines a lenient tokenizing algorithm
 * that handles the wide variety of date formats found in real-world cookies.
 * Delimiters are: TAB, space-/, ;-@, [-`, {-~
 */

const DELIMITER_RE = /[\x09\x20-\x2F\x3B-\x40\x5B-\x60\x7B-\x7E]+/;

const TIME_RE = /^(\d{1,2}):(\d{1,2}):(\d{1,2})/;

const DAY_OF_MONTH_RE = /^(\d{1,2})$/;

const YEAR_RE = /^(\d{2,4})$/;

const MONTH_MAP: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3,
    may: 4, jun: 5, jul: 6, aug: 7,
    sep: 8, oct: 9, nov: 10, dec: 11,
};


/**
 * Parse a cookie date string per RFC 6265 §5.1.1.
 *
 * @returns ms epoch timestamp, or null if the date is invalid.
 *
 * @example
 *     parseDate('Thu, 01 Jan 2099 00:00:00 GMT') // → Date.UTC(2099,0,1,0,0,0)
 *     parseDate('garbage')                        // → null
 */
export function parseDate(str: string): number | null {

    const tokens = str.split(DELIMITER_RE).filter(Boolean);

    let foundTime = false;
    let foundDayOfMonth = false;
    let foundMonth = false;
    let foundYear = false;

    let hour = 0;
    let minute = 0;
    let second = 0;
    let dayOfMonth = 0;
    let month = 0;
    let year = 0;

    for (const token of tokens) {

        if (!foundTime) {

            const m = TIME_RE.exec(token);

            if (m) {

                hour = parseInt(m[1]!, 10);
                minute = parseInt(m[2]!, 10);
                second = parseInt(m[3]!, 10);
                foundTime = true;
                continue;
            }
        }

        if (!foundDayOfMonth) {

            const m = DAY_OF_MONTH_RE.exec(token);

            if (m) {

                dayOfMonth = parseInt(m[1]!, 10);
                foundDayOfMonth = true;
                continue;
            }
        }

        if (!foundMonth) {

            const key = token.slice(0, 3).toLowerCase();
            const monthIdx = MONTH_MAP[key];

            if (monthIdx !== undefined) {

                month = monthIdx;
                foundMonth = true;
                continue;
            }
        }

        if (!foundYear) {

            const m = YEAR_RE.exec(token);

            if (m) {

                year = parseInt(m[1]!, 10);
                foundYear = true;
                continue;
            }
        }
    }

    if (!foundTime || !foundDayOfMonth || !foundMonth || !foundYear) {

        return null;
    }

    if (year >= 70 && year <= 99) {

        year += 1900;
    }
    else if (year >= 0 && year <= 69) {

        year += 2000;
    }

    if (dayOfMonth < 1 || dayOfMonth > 31) return null;
    if (year < 1601) return null;
    if (hour > 23) return null;
    if (minute > 59) return null;
    if (second > 59) return null;

    return Date.UTC(year, month, dayOfMonth, hour, minute, second);
}
