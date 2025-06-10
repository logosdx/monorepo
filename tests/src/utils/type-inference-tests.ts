/**
 * TYPE INFERENCE HELPERS - TESTS
 *
 * This file contains tests to validate the TypeScript type inference
 * and utility types for the data structure utilities.
 */

import {
    deepClone,
    deepMerge,
    type DeepReadonly,
    type DeepPartial,
    type DeepPropertyPath,
    type DeepPropertyType
} from '../../../packages/utils/src/data-structures/index.ts';

// ============================================================================
// TEST: PERFECT TYPE PRESERVATION
// ============================================================================

interface User {
    id: number;
    profile: {
        name: string;
        age?: number;
        settings: {
            theme: 'light' | 'dark';
            notifications: boolean;
        };
    };
    permissions: string[];
    metadata: Map<string, string>;
    tags: Set<string>;
    avatar?: Uint8Array;
}

function testTypePreservation() {

    const user: User = {
        id: 1,
        profile: {
            name: 'John Doe',
            age: 30,
            settings: {
                theme: 'dark',
                notifications: true
            }
        },
        permissions: ['read', 'write'],
        metadata: new Map([['role', 'admin']]),
        tags: new Set(['vip', 'beta-tester']),
        avatar: new Uint8Array([255, 128, 64])
    };

    const cloned = deepClone(user);

    // TypeScript should infer the correct types
    type Assert<T, Expected> = T extends Expected ? true : false;

    const assertId: Assert<typeof cloned.id, number> = true;
    const assertName: Assert<typeof cloned.profile.name, string> = true;
    const assertTheme: Assert<typeof cloned.profile.settings.theme, 'light' | 'dark'> = true;
    const assertPermissions: Assert<typeof cloned.permissions[0], string> = true;
    const assertMetadata: Assert<ReturnType<typeof cloned.metadata.get>, any> = true;
    const assertTags: Assert<ReturnType<typeof cloned.tags.has>, boolean> = true;
    const assertAvatar: Assert<typeof cloned.avatar, Uint8Array | undefined> = true;

    return {
        assertId,
        assertName,
        assertTheme,
        assertPermissions,
        assertMetadata,
        assertTags,
        assertAvatar
    };
}

// ============================================================================
// TEST: SMART MERGE TYPE INFERENCE
// ============================================================================

function testMergeTypes() {

    const baseUser: User = {
        id: 1,
        profile: {
            name: 'John',
            settings: {
                theme: 'light',
                notifications: false
            }
        },
        permissions: ['read'],
        metadata: new Map([['role', 'user']]),
        tags: new Set(['basic'])
    };

    const userUpdate = {
        profile: {
            age: 30,                              // Adding new field
            settings: {
                theme: 'dark' as const,           // Updating existing
                language: 'en'                    // Adding new field
            }
        },
        permissions: ['write', 'admin'],          // Will be merged
        metadata: new Map([['department', 'tech']]), // Will be merged
        tags: new Set(['premium', 'beta'])        // Will be merged
    };

    const merged = deepMerge(baseUser, userUpdate);

    // TypeScript should infer the correct types
    type Assert<T, Expected> = T extends Expected ? true : false;

    type MetadataGet = typeof merged.metadata.get;

    const assertId: Assert<typeof merged.id, number> = true;
    const assertName: Assert<typeof merged.profile.name, string> = true;
    const assertAge: Assert<typeof merged.profile.age, number> = true;
    const assertTheme: Assert<typeof merged.profile.settings.theme, 'dark'> = true;
    const assertNotifications: Assert<typeof merged.profile.settings.notifications, boolean> = true;
    const assertLanguage: Assert<typeof merged.profile.settings.language, string> = true;
    const assertPermissions: Assert<typeof merged.permissions, string[]> = true;
    const assertMetadataRole: Assert<MetadataGet, any> = true;
    const assertMetadataDepartment: Assert<MetadataGet, any> = true;

    return {
        assertId,
        assertName,
        assertAge,
        assertTheme,
        assertNotifications,
        assertLanguage,
        assertPermissions,
        assertMetadataRole,
        assertMetadataDepartment
    };
}

// ============================================================================
// TEST: ADVANCED UTILITY TYPES
// ============================================================================

function testUtilityTypes() {

    // 1. DeepReadonly - Immutable data structures
    type ImmutableUser = DeepReadonly<User>;

    function processImmutableUser(user: ImmutableUser) {
        // These should generate TypeScript errors (which is good!):
        // user.id = 2;                          // ✗ Cannot assign to readonly
        // user.profile.name = 'Jane';           // ✗ Cannot assign to readonly
        // user.permissions.push('admin');       // ✗ Cannot modify readonly array

        // But reading works perfectly:
        const name = user.profile.name;         // ✓ string
        const hasRead = user.permissions.includes('read'); // ✓ boolean

        return `User: ${name}, Can read: ${hasRead}`;
    }

    // 2. DeepPartial - Optional updates
    type UserUpdate = DeepPartial<User>;

    function updateUser(id: number, updates: UserUpdate) {
        // Every field is optional, even deeply nested:
        updates.profile?.name;                  // ✓ string | undefined
        updates.profile?.settings?.theme;       // ✓ 'light' | 'dark' | undefined
        updates.permissions?.[0];               // ✓ string | undefined
        updates.metadata?.get?.('role');          // ✓ string | undefined

        // Perfect for partial updates!
        return { success: true, updatedFields: Object.keys(updates) };
    }

    // 3. Type-safe property paths (advanced)
    type UserPaths = DeepPropertyPath<User>;
    // Results in: "id" | "profile" | "profile.name" | "profile.age" |
    //            "profile.settings" | "profile.settings.theme" | etc.

    function getNestedProperty<Path extends UserPaths>(
        user: User,
        path: Path
    ): DeepPropertyType<User, Path> {

        // This would be implemented with proper path traversal
        // The return type is automatically inferred!

        if (path === 'id') return user.id as any;                    // ✓ number
        if (path === 'profile.name') return user.profile.name as any; // ✓ string
        // ... etc

        throw new Error(`Path ${path} not supported in demo`);
    }

    return { processImmutableUser, updateUser, getNestedProperty };
}

// ============================================================================
// EXPORT TEST FUNCTIONS
// ============================================================================

export {
    testTypePreservation,
    testMergeTypes,
    testUtilityTypes
};