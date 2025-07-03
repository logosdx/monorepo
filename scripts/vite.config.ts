import path from 'path';
import { defineConfig } from 'vite';

const {
    BUNDLE_NAME,
    BUNDLE_PATH,
    PACKAGE_PATH,
} = process.env;

if (!BUNDLE_NAME || !BUNDLE_PATH) {
    throw new Error('BUNDLE_NAME and BUNDLE_PATH must be set');
}

const sourcePath = path.join(PACKAGE_PATH!, 'src');
const entryPath = path.join(sourcePath, 'index.ts');

export default defineConfig({
    build: {
        lib: {
            entry: entryPath,
            name: BUNDLE_NAME,
            formats: ['iife'],
            fileName: () => 'bundle.js',
        },
        outDir: path.join(BUNDLE_PATH!, 'browser'),
        target: 'es2020',
        sourcemap: true,
        minify: true,
        rollupOptions: {
            treeshake: 'smallest',
            output: {
                // Ensure global variable definition for IIFE
                globals: {},
            },
        },
    },
});