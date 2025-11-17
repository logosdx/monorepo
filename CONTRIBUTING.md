# Contributing to LogosDX

Thank you for your interest in contributing to LogosDX! This guide will help you understand our development workflow and release process.

## Development Workflow

### Getting Started

    ```bash
    # Install dependencies
    pnpm install

    # Build all packages
    pnpm build

    # Run tests
    pnpm test

    # Watch mode for development
    pnpm watch
    ```

### Code Standards

Please refer to [CLAUDE.md](./CLAUDE.md) for detailed coding standards, patterns, and architecture guidelines.

**Key principles:**

- Use `attempt`/`attemptSync` for error handling (no try-catch)
- Follow 4-block function structure (Declaration → Validation → Business Logic → Commit)
- Add tests for all paths (happy, error, bad inputs, edge cases)
- Use relative imports in tests to validate implementation

## Release Cycle

We use [Changesets](https://github.com/changesets/changesets) to manage versions and releases.

### 1. Create a Changeset

When you make changes that should be published, create a changeset:

    ```bash
    pnpm changeset
    ```

This will prompt you to:

- Select which packages changed
- Choose version bump type (major, minor, patch)
- Write a summary of the changes

**Commit the changeset file** along with your changes:

    ```bash
    git add .
    git commit -m "feat: your feature description"
    git push
    ```

### 2. Version Packages (Automated)

When changes are pushed to `master`, CI automatically:

- Runs build, lint, and tests
- Creates/updates a **"Version Packages"** PR
- Updates package.json versions and CHANGELOG.md files

**Review the PR** to ensure versions and changelogs are correct.

### 3. Merge to Release Branch

Once the "Version Packages" PR looks good:

    ```bash
    # Merge the Version Packages PR to master first
    # Then merge master to release branch
    git checkout release
    git merge master
    git push origin release
    ```

### 4. Publish (Automated)

Pushing to the `release` branch triggers CI to:

1. **Build** all packages
2. **Run full test suite**
3. **Publish** to npm (via changesets)
4. **Update documentation** (TypeDoc + VitePress)

**This is fully automated** - no manual npm publish needed.

### Release Flow Diagram

    ```
    Developer Changes
          ↓
    pnpm changeset
          ↓
    Commit & Push to master
          ↓
    CI creates "Version Packages" PR
          ↓
    Review & Merge PR to master
          ↓
    Merge master to release branch
          ↓
    CI: Test → Publish → Docs
    ```

## Manual Release Override

You can manually trigger a publish using:

    ```bash
    # From master branch after Version Packages PR is merged
    pnpm run release
    ```

Or trigger the workflow manually via GitHub Actions UI.

## Testing

### Running Tests

    ```bash
    # Run all tests
    pnpm test

    # Watch mode
    pnpm tdd

    # Coverage report
    pnpm test:coverage

    # Run specific test file (filename contains "filepart")
    pnpm test filepart

    # Run only marked tests (it.only)
    pnpm test:only
    ```

### Test Requirements

Each exported function must test:

- ✅ Happy path (expected usage)
- ✅ Error paths (network failures, invalid responses)
- ✅ Bad inputs (null, undefined, wrong types, malformed data)
- ✅ Edge cases and unintended usage patterns

See [tests/CLAUDE.md](./tests/CLAUDE.md) for comprehensive testing guidelines.

## Documentation

### Building Documentation

    ```bash
    # Build VitePress docs
    pnpm docs:build

    # Dev server with hot reload
    pnpm docs:dev

    # Preview built docs
    pnpm docs:preview

    # Build TypeDoc API docs
    pnpm build:docs
    ```

Documentation is automatically updated when packages are published to the `release` branch.

## Creating New Packages

Use the provided script to scaffold a new package:

    ```bash
    pnpm new
    ```

This creates a package with the correct structure, tsconfig, and package.json setup.

## Questions or Issues?

- **Bugs**: [Open an issue](https://github.com/logosdx/monorepo/issues)
- **Questions**: Check [CLAUDE.md](./CLAUDE.md) or open a discussion
- **LLM Helpers**: See [llm-helpers/](./llm-helpers/) for AI-assisted development

## License

By contributing, you agree that your contributions will be licensed under the same BSD-3-Clause license that covers this project.
