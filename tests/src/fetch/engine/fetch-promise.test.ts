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


describe('FetchPromise: chaining with then/catch', () => {

    it('should still resolve after setting a directive', async () => {

        const fp = new FetchPromise((resolve) => resolve({ data: 'hello' } as any));
        fp.text();

        const result = await fp;
        expect(result).to.deep.equal({ data: 'hello' });
    });
});
