import { describe, it, expect } from 'vitest';

describe('@logosdx/storage: types', () => {

    it('StorageDriver interface is importable', async () => {

        const mod = await import(
            '../../../packages/storage/src/types.ts'
        );

        // StorageDriver is a type-only export, verify module loads and exports exist
        expect(mod).to.exist;
    });
});
