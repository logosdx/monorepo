import { describe, it, expect } from 'vitest';
import { jsonToInterface } from '../../packages/localize/src/extractor.ts';

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
