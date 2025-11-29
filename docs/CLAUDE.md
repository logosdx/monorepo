# CLAUDE.md - Docs Folder Memory

This file provides comprehensive context about the LogosDX documentation structure, conventions, and build system.

## Documentation Architecture


**VitePress-powered static site with TypeDoc API integration:**
```
docs/
├── index.md                     # VitePress home page (hero layout)
├── getting-started.md           # Installation & basic usage
├── what-is-logosdx.md           # Philosophy & core concepts
├── cheat-sheet.md               # Comprehensive quick reference
├── documentation-guideline.md   # Documentation writing guide
├── packages/                    # Individual package documentation
│   ├── dom.md
│   ├── fetch.md
│   ├── localize.md
│   ├── observer.md
│   ├── storage.md
│   └── utils.md
└── public/                      # Static assets, logos, icons
```

## Content Strategy & Organization

### Documentation Hierarchy
1. **Introduction Materials**: Home → Philosophy → Getting Started
2. **Reference Materials**: Cheat Sheet → Package Documentation
3. **API Documentation**: External TypeDoc integration (typedoc.logosdx.dev)

### Content Flow Pattern
**Package Pages Structure:**
```
Installation → Quick Start → Core Concepts → API Reference → Advanced Examples → Type Definitions
```

**Consistent Headers:**
- Installation (with multiple package managers)
- Quick Start (copy-paste ready examples)
- Core Concepts (theory and patterns)
- [Main Class/Function] (detailed usage)
- Error Handling (always included)
- Type Definitions (TypeScript interfaces)

## Writing Style & Conventions

### Voice & Tone
- **Professional but accessible** with personality and humor
- **Second person** ("you"), **present tense**, **action-oriented**
- **Real-world examples** using domain concepts (loans, users, payments)
- **Copy-paste ready** - all examples are complete and runnable

### Content Formatting Standards

#### Frontmatter (YAML)
```yaml
---
title: Package Name
description: Brief package description
---
```

#### Code Examples (4-space indentation per CLAUDE.md)
```typescript
// Always show error handling with attempt()
const [users, err] = await attempt(() => api.get<User[]>('/users'));
if (err) {
    console.error('Failed to fetch users:', err.message);
    return;
}
console.log('Users:', users);
```

#### Multi-Package Manager Support
````markdown

::: code-group
```bash [npm]
npm install @logosdx/utils
```

```bash [yarn]
yarn add @logosdx/utils
```

```bash [pnpm]
pnpm add @logosdx/utils
```
:::

````

### Documentation Conventions

#### Progressive Complexity
1. **Basic Usage**: Simple, single-function examples
2. **With Options**: Configuration and customization
3. **Advanced Composition**: Multiple utilities working together
4. **Production Patterns**: Error handling, monitoring, resilience

#### Real-world Context
```typescript
// ✅ Domain-specific examples
const [loan, err] = await attempt(() => api.get<Loan>(`/loans/${id}`));

// ❌ Generic examples
const [data, err] = await attempt(() => api.get<Data>(`/data/${id}`));
```

#### Type Safety Focus
Always include TypeScript interfaces and module augmentation:
```typescript
// Interface definitions
interface User {
    id: string;
    email: string;
    preferences: UserPreferences;
}

// Module augmentation examples
declare module '@logosdx/fetch' {
    namespace FetchEngine {
        interface InstanceHeaders {
            'x-custom-header': string;
        }
    }
}
```

## Build System & Deployment

### VitePress Configuration
```javascript
// .vitepress/config.js
export default {
    title: 'LogosDX',
    themeConfig: {
        logo: '/images/logo.svg',
        nav: [
            { text: 'Home', link: '/' },
            { text: 'API', link: 'https://typedoc.logosdx.dev' }
        ],
        sidebar: {
            '/': [
                { text: 'Introduction', items: [...] },
                { text: 'Packages', items: [...] }
            ]
        }
    }
}
```

### Build Scripts & Commands
```bash
# Development
pnpm docs:dev          # Local development server
pnpm docs:build        # Static site build
pnpm docs:preview      # Preview built site

# Deployment (dual strategy)
./scripts/docs.zsh --main      # Deploy to logosdx.dev
./scripts/docs.zsh --typedoc   # Deploy API docs to typedoc.logosdx.dev
```

### Deployment Architecture
- **Main Site**: VitePress documentation on logosdx.dev
- **API Docs**: TypeDoc reference on typedoc.logosdx.dev
- **Integration**: Cross-links between documentation types
- **Version Management**: Automatic package version extraction

## Key Documentation Patterns

### Error Handling Integration
**Always demonstrate proper error handling:**
```typescript
// Basic pattern
const [result, err] = await attempt(() => operation());
if (err) {
    console.error('Operation failed:', err.message);
    return;
}

// With retry pattern
const [result, err] = await attempt(() =>
    retry(() => riskyOperation(), { attempts: 3 })
);
```

### Composition Examples
**Show how utilities work together:**
```typescript
// Authentication flow example
const authenticateUser = async (credentials: LoginCredentials) => {
    const [response, err] = await attempt(() =>
        retry(() =>
            api.post<AuthResponse>('/auth/login', credentials)
        )
    );

    if (err) {
        observer.emit('auth.failed', { error: err });
        return [null, err];
    }

    storage.assign('user', response.user);
    observer.emit('auth.success', response.user);
    return [response, null];
};
```

### Type Definition Documentation
**Include complete interface documentation:**
```typescript
namespace FetchEngine {
    interface Config {
        baseUrl?: string;
        headers?: Record<string, string>;
        params?: Record<string, unknown>;
        timeout?: number;
        retry?: boolean | RetryConfig;
    }

    interface RetryConfig {
        attempts?: number;
        delay?: number;
        backoff?: 'fixed' | 'exponential';
    }
}
```

## Target Audience & Use Cases

### Primary Audience
- **TypeScript Developers** building production applications
- **Full-stack Engineers** needing runtime-agnostic utilities
- **Development Teams** wanting consistent error handling patterns
- **Library Authors** seeking composable, well-typed utilities

### Documentation Coverage
1. **Production Resilience**: Retry logic, circuit breakers, timeouts
2. **Type Safety**: Complete TypeScript support with examples
3. **Cross-platform Development**: Browser, Node.js, React Native examples
4. **Event-driven Architecture**: Observer patterns with type-safe events
5. **HTTP Client Needs**: Enhanced fetch with retry and lifecycle events
6. **DOM Manipulation**: Framework-free DOM utilities
7. **Data Persistence**: Type-safe storage abstractions
8. **Internationalization**: Simple i18n without framework overhead

## Content Creation Guidelines

### Documentation Checklist
- ✅ **Installation instructions** (npm/yarn/pnpm + CDN)
- ✅ **Copy-paste examples** that actually run
- ✅ **Error handling patterns** using attempt()
- ✅ **TypeScript interfaces** with examples
- ✅ **Real-world use cases** (not foo/bar)
- ✅ **Progressive complexity** (basic → advanced)
- ✅ **Cross-references** to related utilities
- ✅ **Performance considerations** where relevant

### Anti-patterns to Avoid
- ❌ **Generic examples** (use domain-specific code)
- ❌ **Missing error handling** (always show attempt pattern)
- ❌ **Incomplete examples** (must be runnable)
- ❌ **Abstract concepts** (show concrete implementations)
- ❌ **Framework assumptions** (focus on vanilla TypeScript)

## Philosophy Integration

### Documentation Principles
1. **Rational Design**: Explain WHY behind design decisions
2. **Production Focus**: Examples show monitoring and resilience
3. **Composability**: Demonstrate how utilities combine
4. **Type Safety**: Complete TypeScript examples throughout
5. **Developer Experience**: Copy-paste ready, clear error messages

### Example Integration Pattern
```typescript
// Philosophy demonstration: "Do not try something that might fail"
// Bad: Direct operation (might fail)
const user = await fetchUser(id); // Could throw

// Good: Safe operation with error handling
const [user, err] = await attempt(() => fetchUser(id));
if (err) {
    logger.error('User fetch failed:', err);
    return defaultUser;
}
```

## Cross-References & Navigation

### Internal Linking Strategy
- **Package cross-references**: Link between related utilities
- **Progressive examples**: Link from basic to advanced usage
- **Type definitions**: Link to TypeDoc for detailed API

### External Integration
- **GitHub**: Direct edit links for community contributions
- **TypeDoc**: Comprehensive API reference with search
- **NPM**: Direct links to package installations

## Key Documentation Insights

1. **Philosophy-Driven**: Emphasizes WHY behind design decisions
2. **Production-Ready**: All examples show error handling and monitoring
3. **Type-Safe**: Extensive TypeScript examples with proper interfaces
4. **Composable**: Shows how utilities work together, not in isolation
5. **Developer-Focused**: Copy-paste ready examples with meaningful contexts
6. **Performance-Conscious**: Includes optimization tips and patterns
7. **Community-Friendly**: Clear contribution guidelines and edit links

This documentation system serves as a comprehensive reference for developers building production TypeScript applications who need reliable, well-typed utilities with excellent developer experience.