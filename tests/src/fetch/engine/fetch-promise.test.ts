import {
    describe,
    it,
    expect
} from 'vitest';

import {
    FetchPromise
} from '../../../../packages/fetch/src/engine/fetch-promise.ts';


describe('FetchPromise: constructor', () => {

    it('should create an instance that extends Promise', () => {

        const fp = new FetchPromise((resolve) => resolve({ data: 'ok' } as any));

        expect(fp).to.be.instanceOf(Promise);
        expect(fp).to.be.instanceOf(FetchPromise);
    });

    it('should resolve like a normal promise', async () => {

        const fp = new FetchPromise((resolve) => resolve({ data: 42 } as any));
        const result = await fp;

        expect(result).to.deep.equal({ data: 42 });
    });

    it('should reject like a normal promise', async () => {

        const fp = new FetchPromise((_, reject) => reject(new Error('fail')));

        await expect(fp).rejects.toThrow('fail');
    });
});


describe('FetchPromise: directive getters', () => {

    it('should have undefined directive by default', () => {

        const fp = new FetchPromise((resolve) => resolve({ data: null } as any));

        expect(fp.directive).to.be.undefined;
        expect(fp.isStream).to.be.false;
    });
});


describe('FetchPromise: directive methods', () => {

    it('should set json directive', () => {

        const fp = new FetchPromise((resolve) => resolve({ data: null } as any));
        const result = fp.json();

        expect(result).to.equal(fp);
        expect(fp.directive).to.equal('json');
    });

    it('should set text directive', () => {

        const fp = new FetchPromise((resolve) => resolve({ data: null } as any));
        const result = fp.text();

        expect(result).to.equal(fp);
        expect(fp.directive).to.equal('text');
    });

    it('should set blob directive', () => {

        const fp = new FetchPromise((resolve) => resolve({ data: null } as any));
        const result = fp.blob();

        expect(result).to.equal(fp);
        expect(fp.directive).to.equal('blob');
    });

    it('should set arrayBuffer directive', () => {

        const fp = new FetchPromise((resolve) => resolve({ data: null } as any));
        const result = fp.arrayBuffer();

        expect(result).to.equal(fp);
        expect(fp.directive).to.equal('arrayBuffer');
    });

    it('should set formData directive', () => {

        const fp = new FetchPromise((resolve) => resolve({ data: null } as any));
        const result = fp.formData();

        expect(result).to.equal(fp);
        expect(fp.directive).to.equal('formData');
    });

    it('should set raw directive', () => {

        const fp = new FetchPromise((resolve) => resolve({ data: null } as any));
        const result = fp.raw();

        expect(result).to.equal(fp);
        expect(fp.directive).to.equal('raw');
    });

    it('should set stream directive and isStream flag', () => {

        const fp = new FetchPromise((resolve) => resolve({ data: null } as any));
        const result = fp.stream();

        expect(result).to.equal(fp);
        expect(fp.directive).to.equal('stream');
        expect(fp.isStream).to.be.true;
    });
});


describe('FetchPromise: override guard', () => {

    it('should throw when setting a directive twice', () => {

        const fp = new FetchPromise((resolve) => resolve({ data: null } as any));
        fp.json();

        expect(() => fp.text()).to.throw('Response type already set');
    });

    it('should throw when setting same directive twice', () => {

        const fp = new FetchPromise((resolve) => resolve({ data: null } as any));
        fp.json();

        expect(() => fp.json()).to.throw('Response type already set');
    });

    it('should throw on stream after another directive', () => {

        const fp = new FetchPromise((resolve) => resolve({ data: null } as any));
        fp.blob();

        expect(() => fp.stream()).to.throw('Response type already set');
    });

    it('should throw on directive after stream', () => {

        const fp = new FetchPromise((resolve) => resolve({ data: null } as any));
        fp.stream();

        expect(() => fp.json()).to.throw('Response type already set');
    });

    const directives = ['json', 'text', 'blob', 'arrayBuffer', 'formData', 'raw', 'stream'] as const;

    for (const first of directives) {

        for (const second of directives) {

            it(`should throw when calling .${second}() after .${first}()`, () => {

                const fp = new FetchPromise((resolve) => resolve({ data: null } as any));
                (fp as any)[first]();

                expect(() => (fp as any)[second]()).to.throw('Response type already set');
            });
        }
    }
});


describe('FetchPromise: abort and finish tracking', () => {

    it('should default isFinished and isAborted to false', () => {

        const fp = new FetchPromise((resolve) => resolve({ data: null } as any));

        expect(fp.isFinished).to.be.false;
        expect(fp.isAborted).to.be.false;
    });

    it('should abort with reason via abort()', () => {

        const controller = new AbortController();
        const fp = FetchPromise.create(() => new Promise(() => {}), controller);

        fp.abort('cancelled');

        expect(fp.isAborted).to.be.true;
        expect(controller.signal.aborted).to.be.true;
        expect(controller.signal.reason).to.equal('cancelled');
    });

    it('should abort without reason', () => {

        const controller = new AbortController();
        const fp = FetchPromise.create(() => new Promise(() => {}), controller);

        fp.abort();

        expect(fp.isAborted).to.be.true;
        expect(controller.signal.aborted).to.be.true;
    });

    it('should set isAborted when controller is aborted externally', () => {

        const controller = new AbortController();
        const fp = FetchPromise.create(() => new Promise(() => {}), controller);

        controller.abort('external');

        expect(fp.isAborted).to.be.true;
    });

    it('should set isFinished on resolve', async () => {

        const controller = new AbortController();
        const response = { data: 'ok' } as any;
        const fp = FetchPromise.create(() => Promise.resolve(response), controller);

        const result = await fp;

        expect(result).to.deep.equal(response);
        expect(fp.isFinished).to.be.true;
        expect(fp.isAborted).to.be.false;
    });

    it('should set isFinished on reject when not aborted', async () => {

        const controller = new AbortController();
        const fp = FetchPromise.create(() => Promise.reject(new Error('fail')), controller);

        await expect(fp).rejects.toThrow('fail');
        expect(fp.isFinished).to.be.true;
        expect(fp.isAborted).to.be.false;
    });

    it('should not set isFinished on reject when aborted', async () => {

        const controller = new AbortController();
        const fp = FetchPromise.create(() => {

            controller.abort('cancelled');
            return Promise.reject(new Error('aborted'));
        }, controller);

        await expect(fp).rejects.toThrow('aborted');
        expect(fp.isAborted).to.be.true;
        expect(fp.isFinished).to.be.false;
    });

    it('should preserve directive methods on created instance', () => {

        const controller = new AbortController();
        const fp = FetchPromise.create(() => Promise.resolve({ data: null } as any), controller);

        fp.json();

        expect(fp.directive).to.equal('json');
    });

    it('abort() should be a no-op without a controller (plain constructor)', () => {

        const fp = new FetchPromise((resolve) => resolve({ data: null } as any));

        expect(() => fp.abort()).not.to.throw();
        expect(fp.isAborted).to.be.true;
    });
});


describe('FetchPromise: async iteration', () => {

    it('should iterate chunks when stream directive is set', async () => {

        const chunk1 = new Uint8Array([1, 2, 3]);
        const chunk2 = new Uint8Array([4, 5, 6]);

        const body = new ReadableStream<Uint8Array>({

            start(controller) {

                controller.enqueue(chunk1);
                controller.enqueue(chunk2);
                controller.close();
            }
        });

        const mockResponse = new Response(body);
        const fp = new FetchPromise((resolve) => resolve({ data: mockResponse } as any));
        const streamFp = fp.stream();

        const chunks: Uint8Array[] = [];

        for await (const chunk of streamFp) {

            chunks.push(chunk);
        }

        expect(chunks).to.have.length(2);
        expect(chunks[0]).to.deep.equal(chunk1);
        expect(chunks[1]).to.deep.equal(chunk2);
    });

    it('should throw when iterating without stream directive', async () => {

        const fp = new FetchPromise((resolve) => resolve({ data: null } as any));

        const chunks: Uint8Array[] = [];
        let error: Error | undefined;

        try {

            for await (const chunk of fp) {

                chunks.push(chunk);
            }
        }
        catch (err) {

            error = err as Error;
        }

        expect(error).to.be.instanceOf(Error);
        expect(error!.message).to.equal('Cannot iterate: not a stream. Call .stream() before iterating.');
    });

    it('should handle empty stream', async () => {

        const body = new ReadableStream<Uint8Array>({

            start(controller) {

                controller.close();
            }
        });

        const mockResponse = new Response(body);
        const fp = new FetchPromise((resolve) => resolve({ data: mockResponse } as any));
        const streamFp = fp.stream();

        const chunks: Uint8Array[] = [];

        for await (const chunk of streamFp) {

            chunks.push(chunk);
        }

        expect(chunks).to.have.length(0);
    });

    it('should throw when response body is null', async () => {

        const mockResponse = { body: null } as Response;
        const fp = new FetchPromise((resolve) => resolve({ data: mockResponse } as any));
        const streamFp = fp.stream();

        let error: Error | undefined;

        try {

            for await (const _chunk of streamFp) {

                // should not reach here
            }
        }
        catch (err) {

            error = err as Error;
        }

        expect(error).to.be.instanceOf(Error);
        expect(error!.message).to.equal('Response body is not readable');
    });
});


describe('FetchPromise: chaining with then/catch', () => {

    it('should still resolve after setting a directive', async () => {

        const fp = new FetchPromise((resolve) => resolve({ data: 'hello' } as any));
        fp.text();

        const result = await fp;
        expect(result).to.deep.equal({ data: 'hello' });
    });
});
