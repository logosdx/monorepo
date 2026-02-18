import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageDriver, SessionStorageDriver } from '../../../../packages/storage/src/drivers/web.ts';

describe('@logosdx/storage: WebStorageDriver', () => {

    let driver: LocalStorageDriver;

    beforeEach(() => {

        localStorage.clear();
    });

    it('should set and get a value', async () => {

        driver = new LocalStorageDriver();
        await driver.set('key1', 'value1');
        const result = await driver.get('key1');
        expect(result).to.equal('value1');
    });

    it('should return null for missing key', async () => {

        driver = new LocalStorageDriver();
        const result = await driver.get('nonexistent');
        expect(result).to.be.null;
    });

    it('should remove a key', async () => {

        driver = new LocalStorageDriver();
        await driver.set('key1', 'value1');
        await driver.remove('key1');
        const result = await driver.get('key1');
        expect(result).to.be.null;
    });

    it('should return all keys', async () => {

        driver = new LocalStorageDriver();
        await driver.set('a', '1');
        await driver.set('b', '2');
        const keys = await driver.keys();
        expect(keys).to.include('a');
        expect(keys).to.include('b');
    });

    it('should clear all keys', async () => {

        driver = new LocalStorageDriver();
        await driver.set('a', '1');
        await driver.set('b', '2');
        await driver.clear();
        const keys = await driver.keys();
        expect(keys).to.have.length(0);
    });

    it('SessionStorageDriver uses sessionStorage', async () => {

        sessionStorage.clear();
        const sDriver = new SessionStorageDriver();
        await sDriver.set('x', 'y');
        expect(sessionStorage.getItem('x')).to.equal('y');
    });
});
