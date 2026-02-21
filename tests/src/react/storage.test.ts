import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';

import { StorageAdapter, WebStorageDriver } from '../../../packages/storage/src/index.ts';
import { createStorageContext } from '../../../packages/react/src/index.ts';
import { renderHook } from './_helpers.ts';


interface TestStore {
    theme: 'light' | 'dark';
    userId: string;
    prefs: { lang: string; notifications: boolean };
}

function createTestStorage() {

    return new StorageAdapter<TestStore>({
        driver: new WebStorageDriver(window.localStorage),
        prefix: 'test',
    });
}

describe('@logosdx/react: storage', () => {

    beforeEach(() => { window.localStorage.clear(); });
    afterEach(() => { window.localStorage.clear(); });

    it('createStorageContext returns [Provider, useHook] tuple', () => {

        const storage = createTestStorage();
        const result = createStorageContext(storage);

        expect(result).to.be.an('array').with.lengthOf(2);
        expect(result[0]).to.be.a('function');
        expect(result[1]).to.be.a('function');
    });

    it('useHook returns the expected API shape', () => {

        const storage = createTestStorage();
        const [, useStorage] = createStorageContext(storage);

        const { result } = renderHook(() => useStorage());

        expect(result.current.get).to.be.a('function');
        expect(result.current.set).to.be.a('function');
        expect(result.current.remove).to.be.a('function');
        expect(result.current.assign).to.be.a('function');
        expect(result.current.has).to.be.a('function');
        expect(result.current.clear).to.be.a('function');
        expect(result.current.scope).to.be.a('function');
        expect(result.current.keys).to.be.a('function');
        expect(result.current.instance).to.equal(storage);
    });

    it('get() reads values from storage', async () => {

        const storage = createTestStorage();
        await storage.set('theme', 'dark');

        const [, useStorage] = createStorageContext(storage);
        const { result } = renderHook(() => useStorage());

        const value = await result.current.get('theme');
        expect(value).to.equal('dark');
    });

    it('set() writes values and triggers re-render', async () => {

        const storage = createTestStorage();
        const [, useStorage] = createStorageContext(storage);

        let renderCount = 0;
        const { result } = renderHook(() => {

            renderCount++;
            return useStorage();
        });

        const before = renderCount;

        await act(async () => { await result.current.set('theme', 'dark'); });

        const value = await result.current.get('theme');
        expect(value).to.equal('dark');
        expect(renderCount).to.be.greaterThan(before);
    });

    it('set() supports bulk writes', async () => {

        const storage = createTestStorage();
        const [, useStorage] = createStorageContext(storage);

        const { result } = renderHook(() => useStorage());

        await act(async () => {
            await result.current.set({ theme: 'dark', userId: '42' } as any);
        });

        expect(await result.current.get('theme')).to.equal('dark');
        expect(await result.current.get('userId')).to.equal('42');
    });

    it('remove() deletes values and triggers re-render', async () => {

        const storage = createTestStorage();
        await storage.set('theme', 'dark');

        const [, useStorage] = createStorageContext(storage);

        let renderCount = 0;
        const { result } = renderHook(() => {

            renderCount++;
            return useStorage();
        });

        const before = renderCount;

        await act(async () => { await result.current.remove('theme'); });

        expect(await result.current.has('theme')).to.be.false;
        expect(renderCount).to.be.greaterThan(before);
    });

    it('assign() merges into existing value and triggers re-render', async () => {

        const storage = createTestStorage();
        await storage.set('prefs', { lang: 'en', notifications: true });

        const [, useStorage] = createStorageContext(storage);
        const { result } = renderHook(() => useStorage());

        await act(async () => {
            await result.current.assign('prefs', { lang: 'es' });
        });

        expect(await result.current.get('prefs')).to.deep.equal({
            lang: 'es',
            notifications: true,
        });
    });

    it('has() checks key existence', async () => {

        const storage = createTestStorage();
        await storage.set('theme', 'light');

        const [, useStorage] = createStorageContext(storage);
        const { result } = renderHook(() => useStorage());

        expect(await result.current.has('theme')).to.be.true;
        expect(await result.current.has('userId')).to.be.false;
    });

    it('keys() returns stored keys', async () => {

        const storage = createTestStorage();
        await storage.set('theme', 'light');
        await storage.set('userId', '42');

        const [, useStorage] = createStorageContext(storage);
        const { result } = renderHook(() => useStorage());

        const keys = await result.current.keys();
        expect(keys).to.include('theme');
        expect(keys).to.include('userId');
    });

    it('clear() removes all prefixed keys and triggers re-render', async () => {

        const storage = createTestStorage();
        await storage.set('theme', 'dark');
        await storage.set('userId', 'abc');

        const [, useStorage] = createStorageContext(storage);

        let renderCount = 0;
        const { result } = renderHook(() => {

            renderCount++;
            return useStorage();
        });

        const before = renderCount;

        await act(async () => { await result.current.clear(); });

        const keys = await result.current.keys();
        expect(keys).to.have.lengthOf(0);
        expect(renderCount).to.be.greaterThan(before);
    });

    it('cleans up event listeners on unmount', async () => {

        const storage = createTestStorage();
        const [, useStorage] = createStorageContext(storage);

        let renderCount = 0;
        const { unmount } = renderHook(() => {

            renderCount++;
            return useStorage();
        });

        const before = renderCount;
        unmount();

        await storage.set('theme', 'dark');

        expect(renderCount).to.equal(before);
    });

    it('Provider wraps children with context', () => {

        const storage = createTestStorage();
        const [Provider, useStorage] = createStorageContext(storage);

        const { result } = renderHook(
            () => useStorage(),
            Provider
        );

        expect(result.current.instance).to.equal(storage);
    });
});
