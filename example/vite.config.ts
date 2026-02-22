import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({

    plugins: [react()],

    build: {
        rollupOptions: {
            input: {
                dom: resolve(__dirname, 'index-dom.html'),
                react: resolve(__dirname, 'index-react.html'),
            },
        },
    },

    server: {
        proxy: {
            '/api': 'http://localhost:3001',
        },
    },
});
