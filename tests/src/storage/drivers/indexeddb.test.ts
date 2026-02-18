import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IndexedDBDriver } from '../../../../packages/storage/src/drivers/indexeddb.ts';

describe('@logosdx/storage: IndexedDBDriver', () => {

    let driver: IndexedDBDriver;

    beforeEach(() => {

        driver = new IndexedDBDriver('test-db-' + Math.random(), 'test-store');
    });

    it('should set and get a value', async () => {

        await driver.set('key1', 'value1');
        const result = await driver.get('key1');
        expect(result).to.equal('value1');
    });

    it('should store structured data', async () => {

        const obj = { nested: { deep: true }, arr: [1, 2, 3] };
        await driver.set('complex', obj);
        const result = await driver.get('complex');
        expect(result).to.deep.equal(obj);
    });

    it('should return null for missing key', async () => {

        const result = await driver.get('nonexistent');
        expect(result).to.be.null;
    });

    it('should remove a key', async () => {

        await driver.set('key1', 'value1');
        await driver.remove('key1');
        expect(await driver.get('key1')).to.be.null;
    });

    it('should return all keys', async () => {

        await driver.set('a', '1');
        await driver.set('b', '2');
        const keys = await driver.keys();
        expect(keys).to.include('a');
        expect(keys).to.include('b');
    });

    it('should clear all keys', async () => {

        await driver.set('a', '1');
        await driver.clear();
        expect(await driver.keys()).to.have.length(0);
    });
});
