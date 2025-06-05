import {
    describe,
    it,
    before,
    after,
    mock,
    Mock
} from 'node:test'

// @ts-expect-error - chai is not a module
import { expect } from 'chai';

import { mockHelpers } from '../../_helpers';

import {
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
                windowMs: 1000
            });

            const result = rateLimitedFn();

            expect(result).to.equal('success');

            calledExactly(mockFn, 1, 'happy path');
        });

        it('should throw RateLimitError when limit is exceeded and throws is true', () => {

            const mockFn = mock.fn(() => 'success');
            const rateLimitedFn = rateLimit(mockFn, {
                maxCalls: 2,
                windowMs: 1000,
                throws: true
            });

            // Should work for first two calls
            rateLimitedFn();
            rateLimitedFn();

            // Third call should throw
            expect(() => rateLimitedFn()).to.throw(RateLimitError);

            calledExactly(mockFn, 2, 'rate limit exceeded and throws is true');
        });

        it('should return undefined when limit is exceeded and throws is false', () => {

            const mockFn = mock.fn(() => 'success');
            const rateLimitedFn = rateLimit(mockFn, {
                maxCalls: 2,
                windowMs: 1000,
                throws: false
            });

            // Should work for first two calls
            expect(rateLimitedFn()).to.equal('success');
            expect(rateLimitedFn()).to.equal('success');

            // Third call should return undefined
            expect(rateLimitedFn()).to.be.undefined;

            calledExactly(mockFn, 2, 'rate limit exceeded and throws is false');
        });

        it('should call onLimitReached callback when limit is exceeded', () => {

            const mockFn = mock.fn((n: number, s: string) => `success ${n} ${s}`);
            const onLimitReached = mock.fn();

            const rateLimitedFn = rateLimit(mockFn, {
                maxCalls: 1,
                windowMs: 1000,
                throws: false,
                onLimitReached
            });

            rateLimitedFn(1, 'a'); // First call succeeds
            rateLimitedFn(2, 'b'); // Second call triggers rate limit

            expect(onLimitReached.mock.callCount()).to.equal(1);

            const firstCall = onLimitReached.mock.calls[0];

            expect(firstCall).to.not.be.undefined;

            const error = firstCall!.arguments[0];
            const args = firstCall!.arguments[1];

            expect(error).to.be.instanceOf(RateLimitError);
            expect(error.maxCalls).to.equal(1);

            expect(args).to.deep.equal([2, 'b']);

            calledExactly(mockFn, 1, 'onLimitReached callback called');
        });

        it('should reset rate limit after window expires', async () => {

            const mockFn = mock.fn(() => 'success');
            const rateLimitedFn = rateLimit(mockFn, {
                maxCalls: 1,
                windowMs: 50
            });

            // First call should succeed
            expect(rateLimitedFn()).to.equal('success');

            // Wait for window to expire
            await wait(70);

            // Should be able to call again
            expect(rateLimitedFn()).to.equal('success');

            calledExactly(mockFn, 2, 'rate limit reset after window expires');
        });

        it('should preserve function arguments and return values', () => {

            const mockFn = mock.fn((a: number, b: string) => `${a}-${b}`);
            const rateLimitedFn = rateLimit(mockFn, {
                maxCalls: 5,
                windowMs: 1000
            });

            const result = rateLimitedFn(42, 'test');

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
    });
});