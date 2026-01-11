import {
    describe,
    it,
    expect,
    vi
} from 'vitest'

import { PropertyStore } from '../../../packages/fetch/src/property-store.ts';


type TestHeaders = Record<string, string>;


describe('@logosdx/fetch: PropertyStore', () => {

    describe('constructor', () => {

        it('should create with empty options', () => {

            const store = new PropertyStore<TestHeaders>();

            expect(store.defaults).to.deep.equal({});
        });

        it('should create with defaults', () => {

            const store = new PropertyStore<TestHeaders>({
                defaults: { 'Content-Type': 'application/json' }
            });

            expect(store.defaults).to.deep.equal({ 'Content-Type': 'application/json' });
        });

        it('should create with method overrides', () => {

            const store = new PropertyStore<TestHeaders>({
                defaults: { 'Content-Type': 'application/json' },
                methodOverrides: {
                    POST: { 'X-Custom': 'post-value' }
                }
            });

            expect(store.forMethod('POST')).to.deep.equal({ 'X-Custom': 'post-value' });
        });

        it('should normalize method names to lowercase', () => {

            const store = new PropertyStore<TestHeaders>({
                methodOverrides: {
                    POST: { 'X-Custom': 'value' }
                } as any
            });

            expect(store.forMethod('post')).to.deep.equal({ 'X-Custom': 'value' });
        });
    });

    describe('set()', () => {

        it('should set single key-value pair globally', () => {

            const store = new PropertyStore<TestHeaders>();

            store.set('Authorization', 'Bearer token');

            expect(store.defaults).to.deep.equal({ Authorization: 'Bearer token' });
        });

        it('should set multiple values globally', () => {

            const store = new PropertyStore<TestHeaders>();

            store.set({
                Authorization: 'Bearer token',
                'X-API-Key': 'abc123'
            });

            expect(store.defaults).to.deep.equal({
                Authorization: 'Bearer token',
                'X-API-Key': 'abc123'
            });
        });

        it('should set single key-value for specific method', () => {

            const store = new PropertyStore<TestHeaders>();

            store.set('X-Custom', 'post-value', 'POST');

            expect(store.defaults).to.deep.equal({});
            expect(store.forMethod('POST')).to.deep.equal({ 'X-Custom': 'post-value' });
        });

        it('should set multiple values for specific method', () => {

            const store = new PropertyStore<TestHeaders>();

            store.set({
                'X-Custom': 'post-value',
                'X-Other': 'other-value'
            }, 'POST');

            expect(store.forMethod('POST')).to.deep.equal({
                'X-Custom': 'post-value',
                'X-Other': 'other-value'
            });
        });

        it('should normalize method to lowercase', () => {

            const store = new PropertyStore<TestHeaders>();

            store.set('X-Custom', 'value', 'POST' as any);

            expect(store.forMethod('post')).to.deep.equal({ 'X-Custom': 'value' });
        });

        it('should merge with existing values', () => {

            const store = new PropertyStore<TestHeaders>({
                defaults: { 'Content-Type': 'application/json' }
            });

            store.set('Authorization', 'Bearer token');

            expect(store.defaults).to.deep.equal({
                'Content-Type': 'application/json',
                Authorization: 'Bearer token'
            });
        });

        it('should call validation function for global set', () => {

            const validate = vi.fn();
            const store = new PropertyStore<TestHeaders>({ validate });

            store.set('Authorization', 'Bearer token');

            expect(validate).toHaveBeenCalledTimes(1);
            expect(validate).toHaveBeenCalledWith({ Authorization: 'Bearer token' });
        });

        it('should call validation function for method-specific set', () => {

            const validate = vi.fn();
            const store = new PropertyStore<TestHeaders>({
                defaults: { 'Content-Type': 'application/json' },
                validate
            });

            store.set('X-Custom', 'value', 'POST');

            expect(validate).toHaveBeenCalledTimes(1);
            expect(validate).toHaveBeenCalledWith(
                { 'Content-Type': 'application/json', 'X-Custom': 'value' },
                'post'
            );
        });
    });

    describe('remove()', () => {

        it('should remove single key globally', () => {

            const store = new PropertyStore<TestHeaders>({
                defaults: { Authorization: 'token', 'X-Other': 'value' }
            });

            store.remove('Authorization');

            expect(store.defaults).to.deep.equal({ 'X-Other': 'value' });
        });

        it('should remove multiple keys globally', () => {

            const store = new PropertyStore<TestHeaders>({
                defaults: { Authorization: 'token', 'X-Other': 'value', 'X-Third': 'third' }
            });

            store.remove(['Authorization', 'X-Other']);

            expect(store.defaults).to.deep.equal({ 'X-Third': 'third' });
        });

        it('should remove key for specific method', () => {

            const store = new PropertyStore<TestHeaders>({
                methodOverrides: {
                    POST: { 'X-Custom': 'value', 'X-Other': 'other' }
                }
            });

            store.remove('X-Custom', 'POST');

            expect(store.forMethod('POST')).to.deep.equal({ 'X-Other': 'other' });
        });

        it('should remove multiple keys for specific method', () => {

            const store = new PropertyStore<TestHeaders>({
                methodOverrides: {
                    POST: { 'X-Custom': 'value', 'X-Other': 'other', 'X-Third': 'third' }
                }
            });

            store.remove(['X-Custom', 'X-Other'], 'POST');

            expect(store.forMethod('POST')).to.deep.equal({ 'X-Third': 'third' });
        });

        it('should handle removing non-existent key', () => {

            const store = new PropertyStore<TestHeaders>({
                defaults: { Authorization: 'token' }
            });

            store.remove('NonExistent');

            expect(store.defaults).to.deep.equal({ Authorization: 'token' });
        });

        it('should handle removing from non-existent method', () => {

            const store = new PropertyStore<TestHeaders>();

            store.remove('X-Custom', 'DELETE');

            expect(store.forMethod('DELETE')).to.deep.equal({});
        });
    });

    describe('has()', () => {

        it('should return true for existing global key', () => {

            const store = new PropertyStore<TestHeaders>({
                defaults: { Authorization: 'token' }
            });

            expect(store.has('Authorization')).to.be.true;
        });

        it('should return false for non-existing global key', () => {

            const store = new PropertyStore<TestHeaders>();

            expect(store.has('Authorization')).to.be.false;
        });

        it('should return true for existing method-specific key', () => {

            const store = new PropertyStore<TestHeaders>({
                methodOverrides: {
                    POST: { 'X-Custom': 'value' }
                }
            });

            expect(store.has('X-Custom', 'POST')).to.be.true;
        });

        it('should return false for non-existing method-specific key', () => {

            const store = new PropertyStore<TestHeaders>({
                methodOverrides: {
                    POST: { 'X-Custom': 'value' }
                }
            });

            expect(store.has('X-Other', 'POST')).to.be.false;
        });

        it('should check global when method key not found', () => {

            const store = new PropertyStore<TestHeaders>({
                defaults: { Authorization: 'token' },
                methodOverrides: {
                    POST: { 'X-Custom': 'value' }
                }
            });

            // Authorization is global, checking with POST method should still find it
            expect(store.has('Authorization', 'POST')).to.be.true;
        });
    });

    describe('defaults getter', () => {

        it('should return clone of defaults', () => {

            const store = new PropertyStore<TestHeaders>({
                defaults: { Authorization: 'token' }
            });

            const defaults = store.defaults;
            defaults['Modified'] = 'value';

            expect(store.defaults).to.deep.equal({ Authorization: 'token' });
        });
    });

    describe('all getter', () => {

        it('should return defaults and method overrides', () => {

            const store = new PropertyStore<TestHeaders>({
                defaults: { 'Content-Type': 'application/json' },
                methodOverrides: {
                    POST: { 'X-Custom': 'post' },
                    PUT: { 'X-Custom': 'put' }
                }
            });

            const all = store.all;

            expect(all).to.deep.equal({
                default: { 'Content-Type': 'application/json' },
                post: { 'X-Custom': 'post' },
                put: { 'X-Custom': 'put' }
            });
        });

        it('should return only defaults when no method overrides', () => {

            const store = new PropertyStore<TestHeaders>({
                defaults: { Authorization: 'token' }
            });

            expect(store.all).to.deep.equal({
                default: { Authorization: 'token' }
            });
        });
    });

    describe('forMethod()', () => {

        it('should return method-specific overrides', () => {

            const store = new PropertyStore<TestHeaders>({
                methodOverrides: {
                    POST: { 'X-Custom': 'value' }
                }
            });

            expect(store.forMethod('POST')).to.deep.equal({ 'X-Custom': 'value' });
        });

        it('should return empty object for non-existing method', () => {

            const store = new PropertyStore<TestHeaders>();

            expect(store.forMethod('DELETE')).to.deep.equal({});
        });

        it('should normalize method to lowercase', () => {

            const store = new PropertyStore<TestHeaders>({
                methodOverrides: {
                    POST: { 'X-Custom': 'value' }
                }
            });

            expect(store.forMethod('POST' as any)).to.deep.equal({ 'X-Custom': 'value' });
        });

        it('should return clone not reference', () => {

            const store = new PropertyStore<TestHeaders>({
                methodOverrides: {
                    POST: { 'X-Custom': 'value' }
                }
            });

            const overrides = store.forMethod('POST');
            overrides['Modified'] = 'changed';

            expect(store.forMethod('POST')).to.deep.equal({ 'X-Custom': 'value' });
        });
    });

    describe('resolve()', () => {

        it('should merge defaults with method overrides', () => {

            const store = new PropertyStore<TestHeaders>({
                defaults: { 'Content-Type': 'application/json', Authorization: 'token' },
                methodOverrides: {
                    POST: { 'X-Custom': 'post-value' }
                }
            });

            const resolved = store.resolve('POST');

            expect(resolved).to.deep.equal({
                'Content-Type': 'application/json',
                Authorization: 'token',
                'X-Custom': 'post-value'
            });
        });

        it('should include request overrides with highest priority', () => {

            const store = new PropertyStore<TestHeaders>({
                defaults: { 'Content-Type': 'application/json' },
                methodOverrides: {
                    POST: { 'Content-Type': 'text/plain' }
                }
            });

            const resolved = store.resolve('POST', { 'Content-Type': 'application/xml' });

            expect(resolved['Content-Type']).to.equal('application/xml');
        });

        it('should allow method overrides to override defaults', () => {

            const store = new PropertyStore<TestHeaders>({
                defaults: { 'Content-Type': 'application/json' },
                methodOverrides: {
                    POST: { 'Content-Type': 'multipart/form-data' }
                }
            });

            const resolved = store.resolve('POST');

            expect(resolved['Content-Type']).to.equal('multipart/form-data');
        });

        it('should return only defaults when no method overrides', () => {

            const store = new PropertyStore<TestHeaders>({
                defaults: { Authorization: 'token' }
            });

            const resolved = store.resolve('GET');

            expect(resolved).to.deep.equal({ Authorization: 'token' });
        });

        it('should handle undefined request overrides', () => {

            const store = new PropertyStore<TestHeaders>({
                defaults: { Authorization: 'token' }
            });

            const resolved = store.resolve('GET', undefined);

            expect(resolved).to.deep.equal({ Authorization: 'token' });
        });

        it('should normalize method to lowercase', () => {

            const store = new PropertyStore<TestHeaders>({
                methodOverrides: {
                    POST: { 'X-Custom': 'value' }
                }
            });

            const resolved = store.resolve('POST' as any);

            expect(resolved).to.deep.equal({ 'X-Custom': 'value' });
        });
    });
});
