import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { jsonToInterface, scanDirectory, generateOutput, ScanResult } from '../../packages/localize/src/extractor.ts';

describe('localize: jsonToInterface', () => {

    it('should convert flat string values to string type', () => {

        const input = { greeting: 'hello', farewell: 'goodbye' };
        const result = jsonToInterface(input, 0);
        expect(result).toBe('greeting: string;\nfarewell: string;\n');
    });

    it('should handle nested objects recursively', () => {

        const input = { nav: { home: 'Home', about: 'About' } };
        const result = jsonToInterface(input, 0);
        expect(result).toBe(
            'nav: {\n' +
            '    home: string;\n' +
            '    about: string;\n' +
            '};\n'
        );
    });

    it('should convert number values to string type', () => {

        const input = { count: 42, label: 'items' };
        const result = jsonToInterface(input, 0);
        expect(result).toBe('count: string;\nlabel: string;\n');
    });

    it('should handle deeply nested objects', () => {

        const input = { a: { b: { c: 'deep' } } };
        const result = jsonToInterface(input, 0);
        expect(result).toBe(
            'a: {\n' +
            '    b: {\n' +
            '        c: string;\n' +
            '    };\n' +
            '};\n'
        );
    });

    it('should skip array values', () => {

        const input = { tags: ['a', 'b'], name: 'test' };
        const result = jsonToInterface(input, 0);
        expect(result).toBe('name: string;\n');
    });

    it('should respect depth for indentation', () => {

        const input = { key: 'value' };
        const result = jsonToInterface(input, 2);
        expect(result).toBe('        key: string;\n');
    });
});

describe('localize: scanDirectory', () => {

    const tmpDir = join(import.meta.dirname, '../../tmp/test-i18n');

    const setup = () => {

        rmSync(tmpDir, { recursive: true, force: true });
        mkdirSync(tmpDir, { recursive: true });
    };

    afterEach(() => {

        rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should read root shape and collect codes from flat layout', () => {

        setup();
        writeFileSync(join(tmpDir, 'en.json'), JSON.stringify({ greeting: 'hello' }));
        writeFileSync(join(tmpDir, 'es.json'), JSON.stringify({ greeting: 'hola' }));

        const result = scanDirectory(tmpDir, 'en');

        expect(result.rootShape).to.deep.equal({ greeting: 'hello' });
        expect(result.codes).to.include('en');
        expect(result.codes).to.include('es');
        expect(result.namespaces).to.deep.equal({});
    });

    it('should read namespace shapes from subdirectories', () => {

        setup();
        mkdirSync(join(tmpDir, 'common'), { recursive: true });
        writeFileSync(join(tmpDir, 'common', 'en.json'), JSON.stringify({ ok: 'OK' }));
        writeFileSync(join(tmpDir, 'common', 'es.json'), JSON.stringify({ ok: 'Aceptar' }));

        const result = scanDirectory(tmpDir, 'en');

        expect(result.rootShape).to.be.null;
        expect(result.namespaces).to.deep.equal({ common: { ok: 'OK' } });
        expect(result.codes).to.include('en');
        expect(result.codes).to.include('es');
    });

    it('should handle mixed layout with flat and namespaced files', () => {

        setup();
        writeFileSync(join(tmpDir, 'en.json'), JSON.stringify({ title: 'App' }));
        mkdirSync(join(tmpDir, 'errors'), { recursive: true });
        writeFileSync(join(tmpDir, 'errors', 'en.json'), JSON.stringify({ notFound: '404' }));

        const result = scanDirectory(tmpDir, 'en');

        expect(result.rootShape).to.deep.equal({ title: 'App' });
        expect(result.namespaces).to.deep.equal({ errors: { notFound: '404' } });
    });

    it('should return empty namespaces when locale file is missing in subdirectory', () => {

        setup();
        mkdirSync(join(tmpDir, 'common'), { recursive: true });
        writeFileSync(join(tmpDir, 'common', 'fr.json'), JSON.stringify({ ok: 'OK' }));

        const result = scanDirectory(tmpDir, 'en');

        expect(result.rootShape).to.be.null;
        expect(result.namespaces).to.deep.equal({});
        expect(result.codes).to.include('fr');
    });

    it('should throw on malformed JSON', () => {

        setup();
        writeFileSync(join(tmpDir, 'en.json'), '{ broken json }');

        expect(() => scanDirectory(tmpDir, 'en')).to.throw();
    });
});

describe('localize: generateOutput', () => {

    it('should generate from root shape only', () => {

        const scan: ScanResult = {
            rootShape: { greeting: 'hello', farewell: 'goodbye' },
            namespaces: {},
            codes: ['en', 'es'],
        };

        const result = generateOutput(scan, 'Translations');

        expect(result).to.include('export interface Translations {');
        expect(result).to.include('    greeting: string;');
        expect(result).to.include('    farewell: string;');
        expect(result).to.include("export type LocaleCodes = 'en' | 'es';");
    });

    it('should generate from namespaces only', () => {

        const scan: ScanResult = {
            rootShape: null,
            namespaces: { common: { ok: 'OK', cancel: 'Cancel' } },
            codes: ['en'],
        };

        const result = generateOutput(scan, 'AppLocale');

        expect(result).to.include('export interface AppLocale {');
        expect(result).to.include('    common: {');
        expect(result).to.include('        ok: string;');
        expect(result).to.include('        cancel: string;');
        expect(result).to.include('    };');
    });

    it('should generate from mixed layout', () => {

        const scan: ScanResult = {
            rootShape: { title: 'App' },
            namespaces: { errors: { notFound: '404' } },
            codes: ['en', 'fr'],
        };

        const result = generateOutput(scan, 'Mixed');

        expect(result).to.include('    title: string;');
        expect(result).to.include('    errors: {');
        expect(result).to.include('        notFound: string;');
    });

    it('should include auto-generated header comment', () => {

        const scan: ScanResult = {
            rootShape: { key: 'val' },
            namespaces: {},
            codes: ['en'],
        };

        const result = generateOutput(scan, 'T');

        expect(result).to.match(/^\/\/ Auto-generated by @logosdx\/localize/);
    });

    it('should sort locale codes alphabetically', () => {

        const scan: ScanResult = {
            rootShape: null,
            namespaces: {},
            codes: ['zh', 'en', 'ar', 'fr'],
        };

        const result = generateOutput(scan, 'T');

        expect(result).to.include("export type LocaleCodes = 'ar' | 'en' | 'fr' | 'zh';");
    });
});
