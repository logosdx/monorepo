import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';

import { StorageAdapter } from '../../../packages/storage/src/index.ts';
import { createStorageContext } from '../../../packages/react/src/index.ts';
import { renderHook } from './_helpers.ts';


interface TestStore {
    theme: 'light' | 'dark';
    userId: string;
    prefs: { lang: string; notifications: boolean };
}

describe('@logosdx/react: storage', () => {

    beforeEach(() => { window.localStorage.clear(); });
    afterEach(() => { window.localStorage.clear(); });

    it('createStorageContext returns [Provider, useHook] tuple', () => {

        const storage = new StorageAdapter<TestStore>(window.localStorage, 'test');
        const result = createStorageContext(storage);

        expect(result).to.be.an('array').with.lengthOf(2);
        expect(result[0]).to.be.a('function');
        expect(result[1]).to.be.a('function');
    });

    it('useHook returns the expected API shape', () => {

        const storage = new StorageAdapter<TestStore>(window.localStorage, 'test');
        const [, useStorage] = createStorageContext(storage);

        const { result } = renderHook(() => useStorage());

        expect(result.current.get).to.be.a('function');
        expect(result.current.set).to.be.a('function');
        expect(result.current.remove).to.be.a('function');
        expect(result.current.assign).to.be.a('function');
        expect(result.current.has).to.be.a('function');
        expect(result.current.clear).to.be.a('function');
        expect(result.current.wrap).to.be.a('function');
        expect(result.current.keys).to.be.a('function');
        expect(result.current.instance).to.equal(storage);
    });

    it('get() reads values from storage', () => {

        const storage = new StorageAdapter<TestStore>(window.localStorage, 'test');
        storage.set('theme', 'dark');

        const [, useStorage] = createStorageContext(storage);
        const { result } = renderHook(() => useStorage());

        expect(result.current.get('theme')).to.equal('dark');
    });

    it('set() writes values and triggers re-render', () => {

        const storage = new StorageAdapter<TestStore>(window.localStorage, 'test');
        const [, useStorage] = createStorageContext(storage);

        let renderCount = 0;
        const { result } = renderHook(() => {

            renderCount++;
            return useStorage();
        });

        const before = renderCount;

        act(() => { result.current.set('theme', 'dark'); });

        expect(result.current.get('theme')).to.equal('dark');
        expect(renderCount).to.be.greaterThan(before);
    });

    it('set() supports bulk writes', () => {

        const storage = new StorageAdapter<TestStore>(window.localStorage, 'test');
        const [, useStorage] = createStorageContext(storage);

        const { result } = renderHook(() => useStorage());

        act(() => { result.current.set({ theme: 'dark', userId: '42' } as any); });

        expect(result.current.get('theme')).to.equal('dark');
        expect(result.current.get('userId')).to.equal('42');
    });

    it('remove() deletes values and triggers re-render', () => {

        const storage = new StorageAdapter<TestStore>(window.localStorage, 'test');
        storage.set('theme', 'dark');

        const [, useStorage] = createStorageContext(storage);

        let renderCount = 0;
        const { result } = renderHook(() => {

            renderCount++;
            return useStorage();
        });

        const before = renderCount;

        act(() => { result.current.remove('theme'); });

        expect(result.current.has('theme')).to.be.false;
        expect(renderCount).to.be.greaterThan(before);
    });

    it('assign() merges into existing value and triggers re-render', () => {

        const storage = new StorageAdapter<TestStore>(window.localStorage, 'test');
        storage.set('prefs', { lang: 'en', notifications: true });

        const [, useStorage] = createStorageContext(storage);
        const { result } = renderHook(() => useStorage());

        act(() => { result.current.assign('prefs', { lang: 'es' }); });

        expect(result.current.get('prefs')).to.deep.equal({
            lang: 'es',
            notifications: true,
        });
    });

    it('has() checks key existence', () => {

        const storage = new StorageAdapter<TestStore>(window.localStorage, 'test');
        storage.set('theme', 'light');

        const [, useStorage] = createStorageContext(storage);
        const { result } = renderHook(() => useStorage());

        expect(result.current.has('theme')).to.be.true;
        expect(result.current.has('userId')).to.be.false;
    });

    it('keys() returns stored keys', () => {

        const storage = new StorageAdapter<TestStore>(window.localStorage, 'test');
        storage.set('theme', 'light');
        storage.set('userId', '42');

        const [, useStorage] = createStorageContext(storage);
        const { result } = renderHook(() => useStorage());

        expect(result.current.keys()).to.include('theme');
        expect(result.current.keys()).to.include('userId');
    });

    it('clear() removes all prefixed keys and triggers re-render', () => {

        const storage = new StorageAdapter<TestStore>(window.localStorage, 'test');
        storage.set('theme', 'dark');
        storage.set('userId', 'abc');

        const [, useStorage] = createStorageContext(storage);

        let renderCount = 0;
        const { result } = renderHook(() => {

            renderCount++;
            return useStorage();
        });

        const before = renderCount;

        act(() => { result.current.clear(); });

        expect(result.current.keys()).to.have.lengthOf(0);
        expect(renderCount).to.be.greaterThan(before);
    });

    it('cleans up event listeners on unmount', () => {

        const storage = new StorageAdapter<TestStore>(window.localStorage, 'test');
        const [, useStorage] = createStorageContext(storage);

        let renderCount = 0;
        const { unmount } = renderHook(() => {

            renderCount++;
            return useStorage();
        });

        const before = renderCount;
        unmount();

        storage.set('theme', 'dark');

        expect(renderCount).to.equal(before);
    });

    it('Provider wraps children with context', () => {

        const storage = new StorageAdapter<TestStore>(window.localStorage, 'test');
        const [Provider, useStorage] = createStorageContext(storage);

        const { result } = renderHook(
            () => useStorage(),
            Provider
        );

        expect(result.current.instance).to.equal(storage);
    });
});
