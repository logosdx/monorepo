import {
    describe,
    it,
    expect
} from 'vitest'

import {
    attempt,
    attemptSync,
    wait,
    runInSeries,
    makeInSeries,
    nextLoop,
} from '../../../../packages/utils/src/index.ts';

describe('@logosdx/utils - Misc', () => {

    describe('attempt', () => {

        it('should attempt', async () => {

            const [result, error] = await attempt(async () => {

                throw new Error('poop');
            });

            expect(result).to.be.null;
            expect(error).to.be.an.instanceof(Error);
            expect(error!.message).to.equal('poop');

            const [result2, error2] = await attempt(async () => {

                return 'ok';
            });

            expect(result2).to.equal('ok');
            expect(error2).to.be.null;
        });

        it('should attemptSync', () => {

            const [result, error] = attemptSync(() => {

                throw new Error('poop');
            });

            expect(result).to.be.null;
            expect(error).to.be.an.instanceof(Error);
            expect(error!.message).to.equal('poop');

            const [result2, error2] = attemptSync(() => {

                return 'ok';
            });

            expect(result2).to.equal('ok');
            expect(error2).to.be.null;
        });

        it('should validate attempt parameters', async () => {

            try {
                await attempt('not a function' as any);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.be.an.instanceof(Error);
                expect((error as Error).message).to.equal('fn must be a function');
            }
        });

        it('should validate attemptSync parameters', () => {

            expect(() => attemptSync('not a function' as any)).to.throw('fn must be a function');
        });
    });

    describe('runInSeries', () => {

        it('should run functions in series', () => {

            const results: string[] = [];
            const fn1 = () => { results.push('first'); };
            const fn2 = () => { results.push('second'); };
            const fn3 = () => { results.push('third'); };

            const result = runInSeries([fn1, fn2, fn3]);

            expect(results).to.deep.equal(['first', 'second', 'third']);
            expect(result).to.deep.equal([undefined, undefined, undefined]);
        });

        it('should run functions in series with return values', () => {

            const fn1 = () => 'first';
            const fn2 = () => 'second';
            const fn3 = () => 'third';

            const result = runInSeries([fn1, fn2, fn3]);

            expect(result).to.deep.equal(['first', 'second', 'third']);
        });

        it('should handle empty array', () => {

            const result = runInSeries([]);

            expect(result).to.deep.equal([]);
        });

        it('should handle single function', () => {

            const fn = () => 'single';
            const result = runInSeries([fn]);

            expect(result).to.deep.equal(['single']);
        });

        it('should handle functions that throw', () => {

            const fn1 = () => 'first';
            const fn2 = () => { throw new Error('second failed'); };
            const fn3 = () => 'third';

            expect(() => runInSeries([fn1, fn2, fn3])).to.throw('second failed');
        });

        it('should work with any iterable', () => {

            const fn1 = () => 'first';
            const fn2 = () => 'second';

            // Test with Set
            const set = new Set([fn1, fn2]);
            const result1 = runInSeries(set);
            expect(result1).to.deep.equal(['first', 'second']);

            // Test with Map values
            const map = new Map([['a', fn1], ['b', fn2]]);
            const result2 = runInSeries(map.values());
            expect(result2).to.deep.equal(['first', 'second']);
        });
    });

    describe('makeInSeries', () => {

        it('should create a function that runs functions in series', () => {

            const logStep = (step: string) => `logged: ${step}`;
            const saveData = (data: any) => `saved: ${JSON.stringify(data)}`;
            const sendNotification = (message: string) => `sent: ${message}`;

            const inSeries = makeInSeries([logStep, saveData, sendNotification] as const);

            const result = inSeries(['processing'], [{ id: 1 }], ['User created']);

            expect(result).to.deep.equal([
                'logged: processing',
                'saved: {"id":1}',
                'sent: User created'
            ]);
        });

        it('should handle functions with different argument counts', () => {

            const fn1 = (a: string) => `fn1: ${a}`;
            const fn2 = (a: number, b: string) => `fn2: ${a}-${b}`;
            const fn3 = () => 'fn3: no args';

            const inSeries = makeInSeries([fn1, fn2, fn3]);

            const result = inSeries(['hello'], [42, 'world']);

            expect(result).to.deep.equal([
                'fn1: hello',
                'fn2: 42-world',
                'fn3: no args'
            ]);
        });

        it('should handle empty array', () => {

            const inSeries = makeInSeries([]);

            const result = inSeries();

            expect(result).to.deep.equal([]);
        });

        it('should handle single function', () => {

            const fn = (x: number) => x * 2;
            const inSeries = makeInSeries([fn]);

            const result = inSeries([5]);

            expect(result).to.deep.equal([10]);
        });

        it('should validate input parameters', () => {

            expect(() => makeInSeries('not an array' as any)).to.throw('fns must be an array');
            expect(() => makeInSeries([() => 'ok', 'not a function' as any])).to.throw('fns must be an array of functions');
        });

        it('should handle functions that throw', () => {

            const fn1 = (x: string) => `ok: ${x}`;
            const fn2 = () => { throw new Error('fn2 failed'); };
            const fn3 = (x: string) => `ok: ${x}`;

            const inSeries = makeInSeries([fn1, fn2, fn3] as const);

            expect(() => inSeries(['a'], [], ['c'])).to.throw('fn2 failed');
        });

        it('should handle missing arguments gracefully', () => {

            const fn1 = (a: string) => `fn1: ${a}`;
            const fn2 = (a: number, b: string) => `fn2: ${a}-${b}`;

            const inSeries = makeInSeries([fn1, fn2]);

            // Provide fewer arguments than functions
            const result = inSeries(['hello']);

            expect(result).to.deep.equal([
                'fn1: hello',
                'fn2: undefined-undefined'
            ]);
        });
    });

    describe('nextLoop', () => {

        it('should resolve after the next event loop', async () => {

            const start = Date.now();
            await nextLoop();
            const end = Date.now();

            // Should resolve quickly (within a few milliseconds)
            expect(end - start).to.be.lessThan(10);
        });

        it('should resolve in the correct order', async () => {

            const results: string[] = [];

            // Schedule immediate execution
            setImmediate(() => results.push('immediate'));

            // Schedule nextLoop execution
            nextLoop().then(() => results.push('nextLoop'));

            // Schedule setTimeout execution
            setTimeout(() => results.push('timeout'), 5);

            // Wait for all to complete
            await wait(10);

            // nextLoop should resolve before setTimeout but after immediate
            expect(results).to.deep.equal(['immediate', 'nextLoop', 'timeout']);
        });

        it('should work with async/await', async () => {

            let executed = false;

            const asyncFn = async () => {

                await nextLoop();
                executed = true;
            };

            await asyncFn();

            expect(executed).to.be.true;
        });

    });
});