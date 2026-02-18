import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import path from 'path';

const packagesRoot = path.resolve(__dirname, '..', 'packages');

export default defineConfig({
    test: {
        projects: [
            {
                test: {
                    name: 'unit',
                    include: ['src/**/*.ts'],
                    exclude: [
                        'src/_helpers.ts',
                        'src/fetch/_helpers.ts',
                        'src/react/_helpers.ts',
                        'src/storage/_helpers.ts',
                        'src/_playground.ts',
                        'src/_memory-tests/**',
                        'src/experiments/**',
                        'src/index.ts',
                        'src/setup.ts',
                        'src/smoke/**',
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
                        concurrent: false,
                    },
                    coverage: {
                        provider: 'v8',
                        reporter: ['text', 'json', 'html'],
                        reportsDirectory: './coverage',
                        include: ['../packages/*/src/**/*.ts'],
                        exclude: ['**/*.test.ts', '**/*.spec.ts'],
                    },
                },
            },
            {
                define: {
                    __PACKAGES_ROOT__: JSON.stringify(packagesRoot),
                },
                server: {
                    fs: {
                        allow: [path.resolve(__dirname, '..')],
                        strict: false,
                    },
                },
                test: {
                    name: 'browser',
                    include: ['src/smoke/**/*.test.ts'],
                    globals: true,
                    testTimeout: 15000,
                    hookTimeout: 15000,
                    setupFiles: ['src/smoke/setup.ts'],
                    browser: {
                        enabled: true,
                        provider: playwright(),
                        headless: true,
                        instances: [{ browser: 'chromium' }],
                    },
                },
            },
        ],
    },
});
