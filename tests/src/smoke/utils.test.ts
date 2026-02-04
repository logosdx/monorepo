const ns = () => (window as any).LogosDx.Utils;

describe('smoke: @logosdx/utils', () => {

    beforeAll(async () => {

        await (window as any).__loadBundle('utils');
    });

    it('namespace is loaded', () => {

        expect(ns()).toBeDefined();
    });

    it('attempt() resolves with [result, null] on success', async () => {

        const [result, err] = await ns().attempt(() => Promise.resolve(42));

        expect(result).toBe(42);
        expect(err).toBeNull();
    });

    it('attempt() resolves with [null, error] on failure', async () => {

        const [result, err] = await ns().attempt(() => Promise.reject(new Error('boom')));

        expect(result).toBeNull();
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('boom');
    });

    it('clone() deep-clones an object with no shared references', () => {

        const original = { a: 1, nested: { b: 2, arr: [3, 4] } };
        const cloned = ns().clone(original);

        expect(cloned).toEqual(original);
        expect(cloned).not.toBe(original);
        expect(cloned.nested).not.toBe(original.nested);
        expect(cloned.nested.arr).not.toBe(original.nested.arr);
    });

    it('merge() combines two objects', () => {

        const result = ns().merge({ a: 1 }, { b: 2 });
        expect(result).toEqual({ a: 1, b: 2 });
    });

    it('assert() passes on truthy, throws on falsy', () => {

        expect(() => ns().assert(true, 'ok')).not.toThrow();
        expect(() => ns().assert(false, 'nope')).toThrow();
    });

    it('PriorityQueue enqueues and dequeues in priority order', () => {

        const queue = new (ns().PriorityQueue)();

        queue.push('low', 10);
        queue.push('high', 1);
        queue.push('mid', 5);

        expect(queue.pop()).toBe('high');
        expect(queue.pop()).toBe('mid');
        expect(queue.pop()).toBe('low');
    });

    it('equals() compares values deeply', () => {

        expect(ns().equals({ a: [1, 2] }, { a: [1, 2] })).toBe(true);
        expect(ns().equals({ a: 1 }, { a: 2 })).toBe(false);
    });

    it('wait() resolves after delay', async () => {

        const start = Date.now();
        await ns().wait(50);
        const elapsed = Date.now() - start;

        expect(elapsed).toBeGreaterThanOrEqual(40);
    });

    it('retry() retries on failure and eventually succeeds', async () => {

        let calls = 0;

        const result = await ns().retry(
            () => {

                calls++;
                if (calls < 3) throw new Error('not yet');
                return 'done';
            },
            { retries: 5, delay: 10 },
        );

        expect(result).toBe('done');
        expect(calls).toBe(3);
    });

    it('rateLimit() throttles function calls', async () => {

        let count = 0;
        const limited = ns().rateLimit(() => count++, { maxCalls: 2, windowMs: 200 });

        await limited();
        await limited();

        expect(count).toBe(2);

        // Third call should throw (rate limit exceeded)
        await expect(limited()).rejects.toThrow();

        await ns().wait(250);
        await limited();
        expect(count).toBe(3);
    });
});
