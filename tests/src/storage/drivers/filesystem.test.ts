import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, unlinkSync, mkdirSync } from 'node:fs';
import { FileSystemDriver } from '../../../../packages/storage/src/drivers/filesystem.ts';

const TMP_DIR = 'tmp';
const TMP_FILE = `${TMP_DIR}/test-storage.json`;

describe('@logosdx/storage: FileSystemDriver', () => {

    let driver: FileSystemDriver;

    beforeEach(() => {

        if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });
        if (existsSync(TMP_FILE)) unlinkSync(TMP_FILE);
        driver = new FileSystemDriver(TMP_FILE);
    });

    afterEach(() => {

        if (existsSync(TMP_FILE)) unlinkSync(TMP_FILE);
    });

    it('should set and get a value', async () => {

        await driver.set('key1', 'value1');
        const result = await driver.get('key1');
        expect(result).to.equal('value1');
    });

    it('should return null for missing key', async () => {

        const result = await driver.get('nonexistent');
        expect(result).to.be.null;
    });

    it('should persist to disk', async () => {

        await driver.set('key1', 'value1');

        const fresh = new FileSystemDriver(TMP_FILE);
        const result = await fresh.get('key1');
        expect(result).to.equal('value1');
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

    it('should handle non-existent file gracefully', async () => {

        const fresh = new FileSystemDriver(`${TMP_DIR}/does-not-exist.json`);
        const result = await fresh.get('anything');
        expect(result).to.be.null;
    });
});
