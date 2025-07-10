import {
    describe,
    it,
    mock,
    before,
    after,
} from 'node:test'

// @ts-expect-error - chai is not a module
import { expect } from 'chai';

import { mockHelpers, runTimers, nextTick } from '../../_helpers';

import {
    attempt,
    rateLimit,
    RateLimitError,
    wait,
    RateLimitTokenBucket
} from '../../../../packages/utils/src/index.ts';

describe('@logosdx/utils', () => {

    const { calledExactly } = mockHelpers(expect);

    describe('RateLimitTokenBucket', () => {
        before(() => {
            mock.timers.enable({ apis: ['Date', 'setTimeout'] });
        });

        after(() => {
            mock.timers.reset();
        });

        it('should create a token bucket', () => {
            const bucket = new RateLimitTokenBucket(5, 100);

            expect(bucket.tokens).to.equal(5);
            expect(bucket.getNextAvailable()).to.be.instanceOf(Date);
            expect(bucket.getWaitTimeMs(1)).to.eq(0);
        });

        it('should consume and refill tokens', () => {
            const bucket = new RateLimitTokenBucket(2, 50);

            // Initial tokens
            expect(bucket.tokens).to.equal(2);

            expect(bucket.consume()).to.equal(true); // now 1
            expect(bucket.consume()).to.equal(true); // now 0
            expect(bucket.consume()).to.equal(false); // should block

            // Advance time to refill 1 token
            mock.timers.tick(50);
            expect(bucket.consume()).to.equal(true); // now 0 again

            // Advance time to refill another token
            mock.timers.tick(50);
            expect(bucket.consume()).to.equal(true); // again
        });

        it('should wait for tokens to be available', () => {
            const bucket = new RateLimitTokenBucket(2, 50);

            bucket.consume(); // consume first token
            bucket.consume(); // consume second token
            expect(bucket.tokens).to.equal(0);

            // Advance time by less than refill interval
            mock.timers.tick(25);
            bucket.consume(0); // trigger refill
            expect(bucket.tokens).to.equal(0); // should not have refilled yet

            // Advance time to complete refill interval
            mock.timers.tick(25);
            bucket.consume(0); // trigger refill
            expect(bucket.tokens).to.equal(1); // should have 1 token available
        });

        it('should handle zero capacity gracefully', () => {
            const bucket = new RateLimitTokenBucket(0, 100);

            expect(bucket.tokens).to.equal(0);
            expect(bucket.consume()).to.equal(false);
        });

        it('should handle consuming more tokens than capacity', () => {
            const bucket = new RateLimitTokenBucket(3, 100);

            expect(bucket.consume(5)).to.equal(false);
            expect(bucket.tokens).to.equal(3); // shouldn't affect existing tokens
        });

        it('should handle concurrent consume calls', async () => {
            const bucket = new RateLimitTokenBucket(2, 100);

            const results = await Promise.all([
                bucket.consume(),
                bucket.consume(),
                bucket.consume()
            ]);

            expect(results.filter(r => r === true)).to.have.length(2);
            expect(results.filter(r => r === false)).to.have.length(1);
        });

        it('should handle concurrent waitForToken calls', async () => {
            // Use real timers for this async test
            mock.timers.reset();

            const bucket = new RateLimitTokenBucket(1, 10);
            bucket.consume(); // exhaust tokens

            const start = Date.now();
            const promises = [
                bucket.waitForToken(),
                bucket.waitForToken(),
                bucket.waitForToken()
            ];

            await Promise.all(promises);
            const elapsed = Date.now() - start;

            // All should complete around the same time (not sequentially)
            expect(elapsed).to.be.lessThan(50);

            // Re-enable mock timers
            mock.timers.enable({ apis: ['Date'] });
        });

        it('should not exceed capacity during refill', () => {
            const bucket = new RateLimitTokenBucket(2, 50);

            // Start with full capacity, advance time much longer than needed for refill
            mock.timers.tick(500); // 10x the refill time
            bucket.consume(0); // trigger refill

            expect(bucket.tokens).to.equal(2); // Should cap at capacity
        });

        it('should handle rapid successive calls efficiently', () => {
            const bucket = new RateLimitTokenBucket(100, 10);

            const start = Date.now();
            for (let i = 0; i < 50; i++) {
                bucket.consume();
            }
            const elapsed = Date.now() - start;

            expect(elapsed).to.be.lessThan(10); // Should be very fast
            expect(bucket.tokens).to.equal(50);
        });

        it('should consume tokens atomically after waiting', async () => {
            // Use real timers for this async test
            mock.timers.reset();

            const bucket = new RateLimitTokenBucket(1, 10);

            bucket.consume(); // exhaust tokens
            expect(bucket.tokens).to.equal(0);

            // Wait for refill
            await wait(15);
            bucket.consume(0); // trigger refill
            expect(bucket.tokens).to.equal(1);

            // waitAndConsume should consume the available token
            const success = await bucket.waitAndConsume();
            expect(success).to.equal(true);
            expect(bucket.tokens).to.equal(0); // should be consumed

            // Re-enable mock timers
            mock.timers.enable({ apis: ['Date'] });
        });

        it('should handle aborted waitAndConsume', async () => {
            // Use real timers for this async test
            mock.timers.reset();

            const bucket = new RateLimitTokenBucket(1, 1000); // Long refill time
            bucket.consume(); // exhaust tokens

            const controller = new AbortController();
            controller.abort(); // Already aborted

            const success = await bucket.waitAndConsume(1, {
                abortController: controller
            });

            expect(success).to.equal(false);
            expect(bucket.tokens).to.equal(0); // should not consume if aborted

            // Re-enable mock timers
            mock.timers.enable({ apis: ['Date'] });
        });

        it('should respect count parameter in waitAndConsume', async () => {
            // Use real timers for this async test
            mock.timers.reset();

            const bucket = new RateLimitTokenBucket(3, 5);

            bucket.consume(3); // exhaust all tokens
            expect(bucket.tokens).to.equal(0);

            // Wait for refill of all tokens
            await wait(20); // 3 tokens * 5ms each + buffer
            bucket.consume(0); // trigger refill
            expect(bucket.tokens).to.equal(3);

            const success = await bucket.waitAndConsume(2);
            expect(success).to.equal(true);
            expect(bucket.tokens).to.equal(1); // should have 3 - 2 = 1 remaining

            // Re-enable mock timers
            mock.timers.enable({ apis: ['Date'] });
        });

        it('should reset to full capacity', () => {
            const bucket = new RateLimitTokenBucket(5, 100);
            bucket.consume(3);

            expect(bucket.tokens).to.equal(2);
            bucket.reset();
            expect(bucket.tokens).to.equal(5);
        });

        it('should reset last refill time', () => {
            const bucket = new RateLimitTokenBucket(2, 50);

            bucket.consume(2);
            expect(bucket.tokens).to.equal(0);

            // Advance time partially
            mock.timers.tick(30);
            bucket.consume(0); // trigger refill
            expect(bucket.tokens).to.equal(0); // should not have full token yet

            bucket.reset();

            // Should be at full capacity regardless of elapsed time
            expect(bucket.tokens).to.equal(2);
        });

        it('should call onRateLimit callback with correct parameters', async () => {
            // Use real timers for this async test
            mock.timers.reset();

            const bucket = new RateLimitTokenBucket(1, 10);
            const callback = mock.fn();

            bucket.consume(); // exhaust tokens

            await bucket.waitForToken(1, { onRateLimit: callback });

            expect(callback.mock.callCount()).to.equal(1);
            const call = callback.mock.calls[0]!;
            expect(call.arguments[0]).to.be.instanceOf(RateLimitError);
            expect(call.arguments[1]).to.be.instanceOf(Date);

            // Re-enable mock timers
            mock.timers.enable({ apis: ['Date'] });
        });

        it('should apply jitterFactor to wait time', async () => {
            // Use real timers for this async test
            mock.timers.reset();

            const bucket = new RateLimitTokenBucket(1, 10);

            const times = [];
            for (let i = 0; i < 10; i++) {
                bucket.consume(); // exhaust tokens
                const start = Date.now();
                await bucket.waitForToken(1, { jitterFactor: 10 });
                times.push(Date.now() - start);
            }

            // Times should vary due to jitterFactor
            const min = Math.min(...times);
            const max = Math.max(...times);
            expect(max - min).to.be.greaterThan(3); // Should have variation

            // Re-enable mock timers
            mock.timers.enable({ apis: ['Date'] });
        });

        it('should track statistics correctly', () => {
            const bucket = new RateLimitTokenBucket(2, 100);

            // Test initial state
            let stats = bucket.snapshot;
            expect(stats.totalRequests).to.equal(0);
            expect(stats.rejectedRequests).to.equal(0);
            expect(stats.successfulRequests).to.equal(0);
            expect(stats.rejectionRate).to.equal(0);
            expect(stats.currentTokens).to.equal(2);
            expect(stats.capacity).to.equal(2);

            // Consume some tokens
            expect(bucket.consume()).to.equal(true);
            expect(bucket.consume()).to.equal(true);
            expect(bucket.consume()).to.equal(false); // should be rejected

            stats = bucket.snapshot;
            expect(stats.totalRequests).to.equal(3);
            expect(stats.rejectedRequests).to.equal(1);
            expect(stats.successfulRequests).to.equal(2);
            expect(stats.rejectionRate).to.equal(1/3);
            expect(stats.currentTokens).to.equal(0);
        });

        it('should handle overflow protection', () => {
            const bucket = new RateLimitTokenBucket(2, 100);

            // Consume tokens
            bucket.consume();
            bucket.consume();
            expect(bucket.tokens).to.equal(0);

            // Simulate very long delay (positive overflow)
            mock.timers.tick(100 * 2 * 3); // 3x the max expected refill time
            bucket.consume(); // This should trigger overflow protection and consume 1 token
            expect(bucket.tokens).to.equal(1); // Should reset to full capacity (2) then consume 1
        });

        it('should support deterministic testing with mock timers', () => {
            const bucket = new RateLimitTokenBucket(2, 100);

            // Initial state
            expect(bucket.tokens).to.equal(2);

            // Consume all tokens
            bucket.consume();
            bucket.consume();
            expect(bucket.tokens).to.equal(0);

            // Advance time by 50ms (half refill time)
            mock.timers.tick(50);
            bucket.consume(0); // trigger refill
            expect(bucket.tokens).to.equal(0); // Should not have full token yet

            // Advance time by another 50ms (total 100ms = 1 token)
            mock.timers.tick(50);
            bucket.consume(0); // trigger refill
            expect(bucket.tokens).to.equal(1); // Should have 1 token

            // Advance time by another 100ms (total 200ms = 2 tokens)
            mock.timers.tick(100);
            bucket.consume(0); // trigger refill
            expect(bucket.tokens).to.equal(2); // Should have full capacity
        });

        it('should track wait time statistics', async () => {
            // Use real timers for this async test
            mock.timers.reset();

            const bucket = new RateLimitTokenBucket(1, 10);

            bucket.consume(); // exhaust tokens
            expect(bucket.tokens).to.equal(0);

            const initialStats = bucket.snapshot;
            expect(initialStats.waitCount).to.equal(0);
            expect(initialStats.totalWaitTime).to.equal(0);
            expect(initialStats.averageWaitTime).to.equal(0);

            // Wait for token - this will actually wait and track timing
            await bucket.waitForToken();

            const finalStats = bucket.snapshot;
            expect(finalStats.waitCount).to.equal(1);
            expect(finalStats.totalWaitTime).to.be.greaterThan(5); // Should be around 10ms
            expect(finalStats.averageWaitTime).to.be.greaterThan(5);

            // Re-enable mock timers
            mock.timers.enable({ apis: ['Date'] });
        });
    });

    describe('flow-control: rateLimit', () => {
        before(() => {
            mock.timers.enable({ apis: ['Date'] });
        });

        after(() => {
            mock.timers.reset();
        });

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

            // Should work for first two calls
            await rateLimitedFn();
            await rateLimitedFn();

            const [, error] = await attempt(() => rateLimitedFn());

            expect(error, 'Should throw RateLimitError').to.be.instanceOf(RateLimitError);

            calledExactly(mockFn, 2, 'rate limit exceeded and throws is true');
        });

        it('should call onLimitReached callback when limit is exceeded', async () => {
            // Use real timers for this async test
            mock.timers.reset();

            const mockFn = mock.fn((n: number, s: string) => `success ${n} ${s}`);
            const onLimitReached = mock.fn();

            const rateLimitedFn = rateLimit(mockFn, {
                maxCalls: 1,
                windowMs: 20,
                throws: false,
                onLimitReached
            });

            await rateLimitedFn(1, 'a'); // First call succeeds

            const beforeRateLimit = Date.now();

            // Second call should trigger rate limit and wait
            await rateLimitedFn(2, 'b');

            expect(onLimitReached.mock.callCount()).to.equal(1);

            const firstCall = onLimitReached.mock.calls[0];
            expect(firstCall).to.not.be.undefined;

            const error = firstCall!.arguments[0];
            const nextAvailable = firstCall!.arguments[1];
            const args = firstCall!.arguments[2];

            expect(error).to.be.instanceOf(RateLimitError);
            expect(error.maxCalls).to.equal(1);

            expect(nextAvailable).to.be.instanceOf(Date);
            expect(nextAvailable.getTime()).to.be.greaterThan(beforeRateLimit);

            expect(args).to.deep.equal([2, 'b']);

            calledExactly(mockFn, 2, 'succeeded despite onLimitReached callback called');

            // Re-enable mock timers
            mock.timers.enable({ apis: ['Date'] });
        });

        it('should reset rate limit after window expires', async () => {
            // Use real timers for this async test
            mock.timers.reset();

            const mockFn = mock.fn(() => 'success');
            const rateLimitedFn = rateLimit(mockFn, {
                maxCalls: 1,
                windowMs: 10
            });

            // First call should succeed
            expect(await rateLimitedFn()).to.equal('success');

            // Wait for window to expire
            await wait(15);

            // Should be able to call again
            expect(await rateLimitedFn()).to.equal('success');

            calledExactly(mockFn, 2, 'rate limit reset after window expires');

            // Re-enable mock timers
            mock.timers.enable({ apis: ['Date'] });
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

        it('should handle burst traffic followed by normal rate', async () => {
            // Use real timers for this async test
            mock.timers.reset();

            const mockFn = mock.fn(() => 'success');
            const rateLimitedFn = rateLimit(mockFn, {
                maxCalls: 3,
                windowMs: 30 // 10ms per token
            });

            // Initial burst - should succeed
            await rateLimitedFn(); // token 1
            await rateLimitedFn(); // token 2
            await rateLimitedFn(); // token 3

            // Wait for 1 more token
            await wait(15);

            await rateLimitedFn(); // should succeed with new token

            calledExactly(mockFn, 4, 'burst traffic handled correctly');

            // Re-enable mock timers
            mock.timers.enable({ apis: ['Date'] });
        });

        it('should handle precise timing boundaries', async () => {
            // Use real timers for this async test
            mock.timers.reset();

            const mockFn = mock.fn(() => 'success');
            const rateLimitedFn = rateLimit(mockFn, {
                maxCalls: 2,
                windowMs: 20, // 10ms per token
                throws: true
            });

            // Use up all tokens
            await rateLimitedFn();
            await rateLimitedFn();

            // Should be rate limited immediately
            const [, error1] = await attempt(() => rateLimitedFn());
            expect(error1).to.be.instanceOf(RateLimitError);

            // Wait for token refill
            await wait(15);
            const result = await rateLimitedFn();
            expect(result).to.equal('success');

            calledExactly(mockFn, 3, 'precise timing boundaries');

            // Re-enable mock timers
            mock.timers.enable({ apis: ['Date'] });
        });

        it('should handle multiple overlapping time windows', async () => {
            // Use real timers for this async test
            mock.timers.reset();

            const mockFn = mock.fn(() => 'success');
            const rateLimitedFn = rateLimit(mockFn, {
                maxCalls: 2,
                windowMs: 20, // 10ms per token
                throws: true
            });

            // First window
            await rateLimitedFn(); // t=0
            await rateLimitedFn(); // t=0

            // Wait for first token refill
            await wait(15);
            await rateLimitedFn(); // t=15

            // Should be rate limited now
            const [, error] = await attempt(() => rateLimitedFn());
            expect(error).to.be.instanceOf(RateLimitError);

            calledExactly(mockFn, 3, 'multiple overlapping windows');

            // Re-enable mock timers
            mock.timers.enable({ apis: ['Date'] });
        });

        it('should handle errors in wrapped function', async () => {
            const mockFn = mock.fn(() => {
                throw new Error('Function error');
            });
            const rateLimitedFn = rateLimit(mockFn, {
                maxCalls: 2,
                windowMs: 100,
                throws: true
            });

            // First call should throw and consume token
            const [, error1] = await attempt(() => rateLimitedFn());
            expect(error1).to.be.instanceOf(Error);
            expect((error1 as Error).message).to.equal('Function error');

            // Second call should also throw and consume token
            const [, error2] = await attempt(() => rateLimitedFn());
            expect(error2).to.be.instanceOf(Error);
            expect((error2 as Error).message).to.equal('Function error');

            // Third call should be rate limited
            const [, error3] = await attempt(() => rateLimitedFn());
            expect(error3).to.be.instanceOf(RateLimitError);

            calledExactly(mockFn, 2, 'errors in wrapped function');
        });

        it('should handle async function return values correctly', async () => {
            const mockFn = mock.fn(async (delay: number) => {
                // Simulate async work
                return Promise.resolve(`result-${delay}`);
            });
            const rateLimitedFn = rateLimit(mockFn, {
                maxCalls: 3,
                windowMs: 150
            });

            const result1 = await rateLimitedFn(100);
            const result2 = await rateLimitedFn(200);
            const result3 = await rateLimitedFn(300);

            expect(result1).to.equal('result-100');
            expect(result2).to.equal('result-200');
            expect(result3).to.equal('result-300');

            calledExactly(mockFn, 3, 'async function return values');
        });
    });
});