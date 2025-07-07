import {
    describe,
    it,
    mock,
} from 'node:test'

// @ts-expect-error - chai is not a module
import { expect } from 'chai';

import { mockHelpers } from '../../_helpers';

import {
    attempt,
    rateLimit,
    RateLimitError,
    wait
} from '../../../../packages/utils/src/index.ts';

describe('@logosdx/utils', () => {

    const { calledExactly } = mockHelpers(expect);

    describe('flow-control: rateLimit', () => {

        it('should execute function normally when under rate limit', async () => {

            const mockFn = mock.fn(() => 'success');
            const rateLimitedFn = rateLimit(mockFn, {
                maxCalls: 5,
                windowMs: 100
            });

            const result1 = await rateLimitedFn();
            const result2 = await rateLimitedFn();
            const result3 = await rateLimitedFn();
            const result4 = await rateLimitedFn();
            const result5 = await rateLimitedFn();

            expect(result1).to.equal('success');
            expect(result2).to.equal('success');
            expect(result3).to.equal('success');
            expect(result4).to.equal('success');
            expect(result5).to.equal('success');

            calledExactly(mockFn, 5, 'happy path');
        });

        it('should throw RateLimitError when limit is exceeded and throws is true', async () => {

            const mockFn = mock.fn(() => 'success');
            const rateLimitedFn = rateLimit(mockFn, {
                maxCalls: 2,
                windowMs: 100,
                throws: true
            });

            const now = Date.now();
            // Should work for first two calls
            await rateLimitedFn();
            await rateLimitedFn();


            const [, error] = await attempt(() => rateLimitedFn());

            const afterRateLimit = Date.now();

            expect(afterRateLimit - now, 'Should throw immediately').to.be.lessThan(20);
            expect(error, 'Should throw RateLimitError').to.be.instanceOf(RateLimitError);

            calledExactly(mockFn, 2, 'rate limit exceeded and throws is true');
        });

        it('should call onLimitReached callback when limit is exceeded', async () => {

            const mockFn = mock.fn((n: number, s: string) => `success ${n} ${s}`);
            const onLimitReached = mock.fn();

            const rateLimitedFn = rateLimit(mockFn, {
                maxCalls: 1,
                windowMs: 100,
                throws: false,
                onLimitReached
            });

            await rateLimitedFn(1, 'a'); // First call succeeds

            const beforeRateLimit = new Date();

            await rateLimitedFn(2, 'b'); // Second call triggers rate limit

            expect(onLimitReached.mock.callCount()).to.equal(1);

            const firstCall = onLimitReached.mock.calls[0];

            expect(firstCall).to.not.be.undefined;

            const error = firstCall!.arguments[0];
            const nextAvailable = firstCall!.arguments[1];
            const args = firstCall!.arguments[2];

            expect(error).to.be.instanceOf(RateLimitError);
            expect(error.maxCalls).to.equal(1);

            expect(nextAvailable).to.be.instanceOf(Date);
            expect(nextAvailable.getTime()).to.be.greaterThan(beforeRateLimit.getTime());

            expect(args).to.deep.equal([2, 'b']);

            calledExactly(mockFn, 2, 'succeded despite onLimitReached callback called');
        });

        it('should reset rate limit after window expires', async () => {

            const mockFn = mock.fn(() => 'success');
            const rateLimitedFn = rateLimit(mockFn, {
                maxCalls: 1,
                windowMs: 50
            });

            // First call should succeed
            expect(await rateLimitedFn()).to.equal('success');

            // Wait for window to expire
            await wait(70);

            // Should be able to call again
            expect(await rateLimitedFn()).to.equal('success');

            calledExactly(mockFn, 2, 'rate limit reset after window expires');
        });

        it('should preserve function arguments and return values', async () => {

            const mockFn = mock.fn((a: number, b: string) => `${a}-${b}`);
            const rateLimitedFn = rateLimit(mockFn, {
                maxCalls: 5,
                windowMs: 1000
            });

            const result = await rateLimitedFn(42, 'test');

            expect(result).to.equal('42-test');
            const firstCall = mockFn.mock.calls[0];
            expect(firstCall).to.not.be.undefined;
            expect(firstCall!.arguments).to.deep.equal([42, 'test']);
        });

        it('should validate input parameters', () => {

            const mockFn = mock.fn();

            expect(() => {
                rateLimit(mockFn, {
                    maxCalls: 0,
                    windowMs: 1000
                });
            }).to.throw('maxCalls must be a positive number');

            expect(() => {
                rateLimit(mockFn, {
                    maxCalls: 5,
                    windowMs: -100
                });
            }).to.throw('windowMs must be a positive number');

            expect(() => {
                // @ts-expect-error - testing runtime validation
                rateLimit('not a function', {
                    maxCalls: 5,
                    windowMs: 1000
                });
            }).to.throw('fn must be a function');

            expect(() => {
                rateLimit(mockFn, {
                    maxCalls: 5,
                    windowMs: 1000,

                    // @ts-expect-error - testing runtime validation
                    onLimitReached: 'not a function'
                });
            }).to.throw('onLimitReached must be a function');
        });

        it('should not double wrap the function', async () => {

            const fn = mock.fn(() => 'ok');

            const wrappedFn = rateLimit(fn as any, { maxCalls: 1 });

            const [, error] = await attempt(() => rateLimit(wrappedFn, { maxCalls: 1 }) as any);

            expect(error).to.be.an.instanceof(Error);
            expect((error as Error).message).to.equal('Function is already wrapped by rateLimit');
        });
    });
});