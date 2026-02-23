import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
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

    it('should quote keys with special characters', () => {

        const input = { 'my-key': 'val', 'has space': 'val', normal: 'val' };
        const result = jsonToInterface(input, 0);
        expect(result).to.contain("'my-key': string;");
        expect(result).to.contain("'has space': string;");
        expect(result).to.contain('normal: string;');
    });

    it('should handle empty objects', () => {

        const input = { section: {} };
        const result = jsonToInterface(input, 0);
        expect(result).toBe('section: {\n};\n');
    });
});

describe('localize: scanDirectory', () => {

    // @ts-expect-error import.meta.dirname not recognized under CommonJS module resolution
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

    it('should merge root and multiple namespaces, discovering codes nested in subdirectories', () => {

        setup();

        // Root locales
        writeFileSync(join(tmpDir, 'en.json'), JSON.stringify({
            app: { title: 'My App' },
        }));
        writeFileSync(join(tmpDir, 'es.json'), JSON.stringify({
            app: { title: 'Mi App' },
        }));

        // auth namespace (en + es)
        mkdirSync(join(tmpDir, 'auth'), { recursive: true });
        writeFileSync(join(tmpDir, 'auth', 'en.json'), JSON.stringify({
            login: 'Log in',
            logout: 'Log out',
        }));
        writeFileSync(join(tmpDir, 'auth', 'es.json'), JSON.stringify({
            login: 'Iniciar sesión',
            logout: 'Cerrar sesión',
        }));

        // billing namespace (en + es + fr)
        mkdirSync(join(tmpDir, 'billing'), { recursive: true });
        writeFileSync(join(tmpDir, 'billing', 'en.json'), JSON.stringify({
            invoice: 'Invoice',
            payment: 'Payment',
        }));
        writeFileSync(join(tmpDir, 'billing', 'es.json'), JSON.stringify({
            invoice: 'Factura',
            payment: 'Pago',
        }));
        writeFileSync(join(tmpDir, 'billing', 'fr.json'), JSON.stringify({
            invoice: 'Facture',
            payment: 'Paiement',
        }));

        const result = scanDirectory(tmpDir, 'en');

        // Root shape from en.json
        expect(result.rootShape).to.deep.equal({
            app: { title: 'My App' },
        });

        // Namespace shapes from en.json in each subdirectory
        expect(result.namespaces).to.deep.equal({
            auth: { login: 'Log in', logout: 'Log out' },
            billing: { invoice: 'Invoice', payment: 'Payment' },
        });

        // All codes collected, including fr only found in billing/
        expect(result.codes).to.include('en');
        expect(result.codes).to.include('es');
        expect(result.codes).to.include('fr');
        expect(result.codes).to.have.length(3);
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

        expect(result).to.include('export interface Translations extends LocaleManager.LocaleType {');
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

        expect(result).to.include('export interface AppLocale extends LocaleManager.LocaleType {');
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

    it('should include auto-generated header and LocaleType import', () => {

        const scan: ScanResult = {
            rootShape: { key: 'val' },
            namespaces: {},
            codes: ['en'],
        };

        const result = generateOutput(scan, 'T');

        expect(result).to.match(/^\/\/ Auto-generated by @logosdx\/localize/);
        expect(result).to.include("import type { LocaleManager } from '@logosdx/localize';");
        expect(result).to.include('export interface T extends LocaleManager.LocaleType {');
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

    it('should produce valid TypeScript with empty codes', () => {

        const scan: ScanResult = {
            rootShape: null,
            namespaces: {},
            codes: [],
        };

        const result = generateOutput(scan, 'T');

        expect(result).to.include('export type LocaleCodes = never;');
    });
});

describe('localize: CLI integration', () => {

    // @ts-expect-error import.meta.dirname not recognized under CommonJS module resolution
    const cliPath = join(import.meta.dirname, '../../packages/localize/src/cli.ts');
    // @ts-expect-error import.meta.dirname not recognized under CommonJS module resolution
    const tmpDir = join(import.meta.dirname, '../../tmp/test-i18n-cli');
    // @ts-expect-error import.meta.dirname not recognized under CommonJS module resolution
    const outFile = join(import.meta.dirname, '../../tmp/test-output.ts');

    const setup = () => {

        rmSync(tmpDir, { recursive: true, force: true });
        mkdirSync(tmpDir, { recursive: true });
    };

    afterEach(() => {

        rmSync(tmpDir, { recursive: true, force: true });
        rmSync(outFile, { force: true });
    });

    it('should generate types from namespaced directory', () => {

        setup();
        mkdirSync(join(tmpDir, 'common'), { recursive: true });
        writeFileSync(join(tmpDir, 'common', 'en.json'), JSON.stringify({ ok: 'OK', cancel: 'Cancel' }));
        writeFileSync(join(tmpDir, 'common', 'es.json'), JSON.stringify({ ok: 'Aceptar', cancel: 'Cancelar' }));

        execSync(`npx tsx ${cliPath} extract --dir ${tmpDir} --out ${outFile}`, { stdio: 'pipe' });

        const output = readFileSync(outFile, 'utf-8');
        expect(output).to.include('export interface AppLocale extends LocaleManager.LocaleType {');
        expect(output).to.include('common: {');
        expect(output).to.include('ok: string;');
        expect(output).to.include("export type LocaleCodes = 'en' | 'es';");
    });

    it('should use custom interface name via --name', () => {

        setup();
        writeFileSync(join(tmpDir, 'en.json'), JSON.stringify({ title: 'Hello' }));

        execSync(`npx tsx ${cliPath} extract --dir ${tmpDir} --out ${outFile} --name MyLocale`, { stdio: 'pipe' });

        const output = readFileSync(outFile, 'utf-8');
        expect(output).to.include('export interface MyLocale extends LocaleManager.LocaleType {');
    });

    it('should exit with error on missing --dir', () => {

        expect(() => {

            execSync(`npx tsx ${cliPath} extract --out ${outFile}`, { stdio: 'pipe' });
        }).to.throw();
    });

    it('should exit with error on missing --out', () => {

        setup();

        expect(() => {

            execSync(`npx tsx ${cliPath} extract --dir ${tmpDir}`, { stdio: 'pipe' });
        }).to.throw();
    });

    it('should exit with error on invalid --name', () => {

        setup();
        writeFileSync(join(tmpDir, 'en.json'), JSON.stringify({ title: 'Hi' }));

        expect(() => {

            execSync(`npx tsx ${cliPath} extract --dir ${tmpDir} --out ${outFile} --name "Bad Name"`, { stdio: 'pipe' });
        }).to.throw();
    });

    it('should generate merged types from root + namespaces with codes discovered in subdirectories', () => {

        setup();

        // Root: en, es
        writeFileSync(join(tmpDir, 'en.json'), JSON.stringify({ app: { title: 'My App' } }));
        writeFileSync(join(tmpDir, 'es.json'), JSON.stringify({ app: { title: 'Mi App' } }));

        // auth: en, es
        mkdirSync(join(tmpDir, 'auth'), { recursive: true });
        writeFileSync(join(tmpDir, 'auth', 'en.json'), JSON.stringify({ login: 'Log in' }));
        writeFileSync(join(tmpDir, 'auth', 'es.json'), JSON.stringify({ login: 'Iniciar sesión' }));

        // billing: en, es, fr (fr only here)
        mkdirSync(join(tmpDir, 'billing'), { recursive: true });
        writeFileSync(join(tmpDir, 'billing', 'en.json'), JSON.stringify({ invoice: 'Invoice' }));
        writeFileSync(join(tmpDir, 'billing', 'es.json'), JSON.stringify({ invoice: 'Factura' }));
        writeFileSync(join(tmpDir, 'billing', 'fr.json'), JSON.stringify({ invoice: 'Facture' }));

        execSync(`npx tsx ${cliPath} extract --dir ${tmpDir} --out ${outFile} --name Locale`, { stdio: 'pipe' });

        const output = readFileSync(outFile, 'utf-8');

        // Import and extends
        expect(output).to.include("import type { LocaleManager } from '@logosdx/localize';");
        expect(output).to.include('export interface Locale extends LocaleManager.LocaleType {');

        // Root shape
        expect(output).to.include('app: {');
        expect(output).to.include('title: string;');

        // Namespaces
        expect(output).to.include('auth: {');
        expect(output).to.include('login: string;');
        expect(output).to.include('billing: {');
        expect(output).to.include('invoice: string;');

        // All 3 codes including fr discovered in billing/
        expect(output).to.include("export type LocaleCodes = 'en' | 'es' | 'fr';");
    });
});
