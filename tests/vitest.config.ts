import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/**/*.ts'],
        exclude: [
            'src/_helpers.ts',
            'src/fetch/_helpers.ts',
            'src/_playground.ts',
            'src/_memory-tests/**',
            'src/experiments/**',
            'src/index.ts',
            'src/setup.ts'
        ],
        setupFiles: ['src/setup.ts'],
        environment: 'jsdom',
        globals: true,
        pool: 'forks',
        testTimeout: 10000,
        hookTimeout: 10000,
        reporters: ['default'],
        clearMocks: true,
        restoreMocks: true,
        sequence: {
            shuffle: false,
            concurrent: false
        },
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            reportsDirectory: './coverage',
            include: ['../packages/*/src/**/*.ts'],
            exclude: ['**/*.test.ts', '**/*.spec.ts']
        }
    }
});
