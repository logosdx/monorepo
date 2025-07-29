import {
    before,
    describe,
    it,
    mock,
} from 'node:test'

import { expect } from 'chai';

import { mockHelpers } from '../../_helpers';

import {
    attempt,
    batch,
    wait,
} from '../../../../packages/utils/src/index.ts';

describe('@logosdx/utils - flow-control: batch', () => {

    const { calledExactly } = mockHelpers(expect);

    it('should batch', async () => {

        const func = async (n: number) => {

            await wait(10);
            return n;
        }

        const fn = mock.fn(func);
        const onStart = mock.fn();
        const onEnd = mock.fn();
        const onChunkStart = mock.fn();
        const onChunkEnd = mock.fn();

        const items = Array.from(
            { length: 100 },
            (_, i) => i
        );

        const promise1 = batch(fn, {
            items,
            concurrency: 40,
            onStart,
            onEnd,
            onChunkStart,
            onChunkEnd,
        });

        await wait(1);

        calledExactly(onStart, 1, 'batch onStart 1');
        calledExactly(onChunkStart, 1, 'batch onChunkStart 1');
        calledExactly(fn, 40, 'batch fn 1');

        await wait(10);

        calledExactly(onChunkStart, 2, 'batch onChunkStart 2');
        calledExactly(onChunkEnd, 1, 'batch onChunkEnd 2');
        calledExactly(fn, 80, 'batch fn 2');

        await wait(10);

        calledExactly(onChunkStart, 3, 'batch onChunkStart 3');
        calledExactly(onChunkEnd, 2, 'batch onChunkEnd 3');
        calledExactly(fn, 100, 'batch fn 3');
        calledExactly(onEnd, 0, 'batch onEnd 3');

        const result = await promise1;

        calledExactly(onEnd, 1, 'batch onEnd 4');

        expect(result.map(r => r.result)).to.deep.equal(items);
    });

    it('should batch in failureModes continue', async () => {

        const items = Array.from(
            { length: 100 },
            (_, i) => i
        );

        const fn = mock.fn((n: number) => {

            if (n % 2 === 0) {
                throw new Error('poop');
            }

            return 'ok';
        });

        const onError = mock.fn();

        const result = await batch(fn, {

            items,
            concurrency: 10,
            failureMode: 'continue',
            onError,
        });

        calledExactly(onError, 50, 'batch onError 1');

        const errors = result.filter(r => r.error);
        const results = result.filter(r => !r.error);

        expect(errors.length).to.equal(50);
        expect(results.length).to.equal(50);
    });

    it('should batch in failureMode abort', async () => {

        const items = Array.from(
            { length: 10 },
            (_, i) => i
        );

        const fn = mock.fn((n: number) => {

            if (n === 5) {
                throw new Error('abort test');
            }

            return 'ok';
        });

        const onError = mock.fn();

        const [result, error] = await attempt(
            () => batch(fn, {
                items,
                concurrency: 2,
                failureMode: 'abort',
                onError,
            })
        );

        expect(result).to.be.null;
        expect(error).to.be.an.instanceof(Error);
        expect(error!.message).to.equal('abort test');

        calledExactly(onError, 1, 'batch abort onError');
        calledExactly(fn, 6, 'batch abort fn');
    });

    it('should validate parameters', async () => {

        const items = [1, 2, 3];

        // fn must be a function
        const [, error1] = await attempt(
            () => batch('not a function' as any, { items })
        );
        expect(error1).to.be.an.instanceof(Error);
        expect((error1 as Error).message).to.equal('fn must be a function');

        // concurrency must be greater than 0
        const [, error2] = await attempt(
            () => batch(mock.fn(), { items, concurrency: 0 })
        );
        expect(error2).to.be.an.instanceof(Error);
        expect((error2 as Error).message).to.equal('concurrency must be greater than 0');

        // items must be an array
        const [, error3] = await attempt(
            () => batch(mock.fn(), { items: 'not an array' as any })
        );
        expect(error3).to.be.an.instanceof(Error);
        expect((error3 as Error).message).to.equal('items must be an array');

        // failureMode validation
        const [, error4] = await attempt(
            () => batch(mock.fn(), { items, failureMode: 'invalid' as any })
        );
        expect(error4).to.be.an.instanceof(Error);
        expect((error4 as Error).message).to.equal('failureMode must be either "abort" or "continue"');

        // callback function validation
        const [, error5] = await attempt(
            () => batch(mock.fn(), { items, onError: 'not a function' as any })
        );
        expect(error5).to.be.an.instanceof(Error);
        expect((error5 as Error).message).to.equal('onError must be a function');

        const [, error6] = await attempt(
            () => batch(mock.fn(), { items, onStart: 'not a function' as any })
        );
        expect(error6).to.be.an.instanceof(Error);
        expect((error6 as Error).message).to.equal('onStart must be a function');

        const [, error7] = await attempt(
            () => batch(mock.fn(), { items, onChunkStart: 'not a function' as any })
        );
        expect(error7).to.be.an.instanceof(Error);
        expect((error7 as Error).message).to.equal('onChunkStart must be a function');

        const [, error8] = await attempt(
            () => batch(mock.fn(), { items, onChunkEnd: 'not a function' as any })
        );
        expect(error8).to.be.an.instanceof(Error);
        expect((error8 as Error).message).to.equal('onChunkEnd must be a function');

        const [, error9] = await attempt(
            () => batch(mock.fn(), { items, onEnd: 'not a function' as any })
        );
        expect(error9).to.be.an.instanceof(Error);
        expect((error9 as Error).message).to.equal('onEnd must be a function');
    });

    it('should handle empty items array', async () => {

        const fn = mock.fn();
        const onStart = mock.fn();
        const onEnd = mock.fn();
        const onChunkStart = mock.fn();
        const onChunkEnd = mock.fn();

        const result = await batch(fn, {
            items: [],
            onStart,
            onEnd,
            onChunkStart,
            onChunkEnd
        });

        expect(result).to.deep.equal([]);
        calledExactly(fn, 0, 'empty items fn');
        calledExactly(onStart, 1, 'empty items onStart');
        calledExactly(onEnd, 1, 'empty items onEnd');
        calledExactly(onChunkStart, 0, 'empty items onChunkStart');
        calledExactly(onChunkEnd, 0, 'empty items onChunkEnd');
    });

    it('should handle concurrency of 1 (sequential)', async () => {

        const fn = mock.fn((n: number) => n * 2);
        const items = [1, 2, 3];

        const result = await batch(fn, {
            items,
            concurrency: 1
        });

        calledExactly(fn, 3, 'sequential fn calls');
        expect(result.map(r => r.result)).to.deep.equal([2, 4, 6]);
    });

    it('should handle concurrency larger than items length', async () => {

        const fn = mock.fn((n: number) => n * 2);
        const items = [1, 2];

        const result = await batch(fn, {
            items,
            concurrency: 10
        });

        calledExactly(fn, 2, 'large concurrency fn calls');
        expect(result.map(r => r.result)).to.deep.equal([2, 4]);
    });

    it('should use default values', async () => {

        const fn = mock.fn((n: number) => n);
        const items = Array.from({ length: 25 }, (_, i) => i);
        const onChunkStart = mock.fn();
        const onChunkEnd = mock.fn();

        const result = await batch(fn, { items, onChunkStart, onChunkEnd });

        // With default concurrency of 10, should process in 3 chunks
        calledExactly(fn, 25, 'default values fn calls');
        expect(result.length).to.equal(25);

        calledExactly(onChunkStart, 3, 'default values onChunkStart');
        calledExactly(onChunkEnd, 3, 'default values onChunkEnd');
    });

    it('should pass correct parameters to callbacks', async () => {

        const fn = mock.fn((n: number) => n);
        const items = Array.from({ length: 7 }, (_, i) => i);

        const onStart = mock.fn();
        const onChunkStart = mock.fn();
        const onChunkEnd = mock.fn();
        const onEnd = mock.fn();

        await batch(fn, {
            items,
            concurrency: 3,
            onStart,
            onChunkStart,
            onChunkEnd,
            onEnd
        });

        // onStart should be called with total chunks (3 chunks: 3+3+1)
        calledExactly(onStart, 1, 'callback params onStart');
        expect(onStart.mock.calls[0]!.arguments[0]).to.equal(3);

        // onChunkStart should be called 3 times with correct parameters
        calledExactly(onChunkStart, 3, 'callback params onChunkStart');

        // First chunk
        const firstChunkStartCall = onChunkStart.mock.calls[0]!.arguments[0];
        expect(firstChunkStartCall.index).to.equal(0);
        expect(firstChunkStartCall.total).to.equal(3);
        expect(firstChunkStartCall.items.length).to.equal(3);
        expect(firstChunkStartCall.processedCount).to.equal(0);
        expect(firstChunkStartCall.remainingCount).to.equal(6);
        expect(firstChunkStartCall.completionPercent).to.be.closeTo(33.33, 0.01);

        // Last chunk
        const lastChunkStartCall = onChunkStart.mock.calls[2]!.arguments[0];
        expect(lastChunkStartCall.index).to.equal(2);
        expect(lastChunkStartCall.total).to.equal(3);
        expect(lastChunkStartCall.items.length).to.equal(1);
        expect(lastChunkStartCall.processedCount).to.equal(6);
        expect(lastChunkStartCall.remainingCount).to.equal(0);
        expect(lastChunkStartCall.completionPercent).to.equal(100);

        // onEnd should be called with results
        calledExactly(onEnd, 1, 'callback params onEnd');
        expect(onEnd.mock.calls[0]!.arguments[0].length).to.equal(7);
    });

    it('should handle mixed success and failure results correctly', async () => {

        const items = [1, 2, 3, 4];

        const fn = mock.fn((n: number) => {
            if (n % 2 === 0) {
                throw new Error(`Error for ${n}`);
            }
            return `Success ${n}`;
        });

        const result = await batch(fn, {
            items,
            concurrency: 2,
            failureMode: 'continue'
        });

        expect(result.length).to.equal(4);

        // Check success cases
        expect(result[0]!.result).to.equal('Success 1');
        expect(result[0]!.error).to.be.null;
        expect(result[2]!.result).to.equal('Success 3');
        expect(result[2]!.error).to.be.null;

        // Check error cases
        expect(result[1]!.result).to.be.null;
        expect(result[1]!.error).to.be.an.instanceof(Error);
        expect(result[1]!.error!.message).to.equal('Error for 2');
        expect(result[3]!.result).to.be.null;
        expect(result[3]!.error).to.be.an.instanceof(Error);
        expect(result[3]!.error!.message).to.equal('Error for 4');
    });
});