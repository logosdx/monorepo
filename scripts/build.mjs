#!/usr/bin/env zx

import 'zx/globals';
import readline from 'readline';

const BUILD_FOLDER = 'dist';
const CWD = process.cwd();
const ROOT = path.join(import.meta.dirname, '..');
const VITE_CONFIG = path.join(ROOT, 'scripts', 'vite.config.ts');
const RELEASE_FLAG = process.argv.includes('--release');
const RootPkg = await fs.readJson(path.join(ROOT, 'package.json'));
const LibPkg = await fs.readJson(path.join(CWD, 'package.json'));

$.verbose = false;

if (!CWD.includes(ROOT)) {

    console.error('Where are you running this script from?');
    process.exit(127);
}

const PATHS = {
    SRC: path.join(CWD, 'src'),
    BUILD: path.join(CWD, BUILD_FOLDER),
    CJS: path.join(CWD, BUILD_FOLDER, 'cjs'),
    ESM: path.join(CWD, BUILD_FOLDER, 'esm'),
    TYPES: path.join(CWD, BUILD_FOLDER, 'types'),
    BROWSER: path.join(CWD, BUILD_FOLDER, 'browser')
};

const log = {
    info: (msg) => console.log(chalk.cyan(`→ ${msg}`)),
    success: (msg) => console.log(chalk.green(`✓ ${msg}`)),
    warn: (msg) => console.log(chalk.yellow(`⚠ ${msg}`)),
    error: (msg) => console.log(chalk.red(`✗ ${msg}`)),
}

/**
 * Remove all .ts files from a directory recursively
 */
const rmTsFiles = async (dir) => {

    const files = await fs.readdir(dir);

    for (const file of files) {

        const filePath = path.join(dir, file);
        const stat = await fs.stat(filePath);

        if (stat.isDirectory()) {

            await rmTsFiles(filePath);
        }
        else if (file.endsWith('.ts')) {

            await fs.remove(filePath);
        }
    }
};

/**
 * Rename all files with a specific extension in a directory
 * and update import/export/require statements accordingly
 */
const renameFilesExt = async (dir, from, to) => {

    if (!from.startsWith('.')) {

        from = `.${from}`;
    }

    if (!to.startsWith('.')) {

        to = `.${to}`;
    }

    const files = await fs.readdir(dir);

    for (const file of files) {

        const fullPath = path.join(dir, file);
        const newPath = fullPath.replace(from, to);

        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {

            await renameFilesExt(fullPath, from, to);
        }
        else if (file.endsWith(from)) {

            const newFile = fs.createWriteStream(newPath, { flags: 'w' });
            const oldFile = fs.createReadStream(fullPath);

            const lines = readline.createInterface({
                input: oldFile,
            });

            const importRgx = /import.*\.ts/;
            const exportRgx = /export.*\.ts/;
            const requireRgx = /require.*\.ts/;

            let contents = '';

            for await (const line of lines) {

                if (
                    to === '.mjs' && (
                        importRgx.test(line) ||
                        exportRgx.test(line)
                    )
                ) {

                    contents += line.replace('.ts', '.mjs');
                    contents += '\n';
                    continue;
                }
                else if (
                    to === '.cjs' &&
                    requireRgx.test(line)
                ) {

                    contents += line.replace('.ts', '');
                    contents += '\n';
                    continue;
                }
                else {

                    contents += line;
                    contents += '\n';
                }
            }

            newFile.write(contents);

            oldFile.close();
            newFile.close();

            await fs.remove(fullPath);

            // Keep the .js extension for cjs modules
            if (to === '.cjs') {

                await fs.rename(newPath, fullPath);
            }
        }
    }
};

/**
 * Validates that a module actually exports something.
 * Browser-only packages that throw "not supported in this environment"
 * are considered valid - the module loaded but detected non-browser context.
 */
const validateModuleExports = async (filePath, format) => {

    try {

        const mod = await import(filePath);
        const exportKeys = Object.keys(mod);

        if (exportKeys.length === 0) {

            return `${format}: ${filePath} has no exports`;
        }

        return null;
    }
    catch (err) {

        // Browser-only packages throw when imported in Node.js
        // This is valid behavior - the module loaded, just not in browser
        if (err.message.includes('not supported in this environment')) {

            return null;
        }

        return `${format}: Failed to import ${filePath} - ${err.message}`;
    }
};

/**
 * Validates core build artifacts (ESM, CJS, types, browser)
 */
const validateCoreBuild = async () => {

    const errors = [];

    // Check ESM output exists and has exports
    const esmIndex = path.join(PATHS.ESM, 'index.mjs');

    if (!await fs.pathExists(esmIndex)) {

        errors.push(`ESM: Missing ${esmIndex}`);
    }
    else {

        const esmError = await validateModuleExports(esmIndex, 'ESM');
        if (esmError) errors.push(esmError);
    }

    // Check CJS output exists and has exports
    const cjsIndex = path.join(PATHS.CJS, 'index.js');

    if (!await fs.pathExists(cjsIndex)) {

        errors.push(`CJS: Missing ${cjsIndex}`);
    }
    else {

        const cjsError = await validateModuleExports(cjsIndex, 'CJS');
        if (cjsError) errors.push(cjsError);
    }

    // Check Types output
    const typesIndex = path.join(PATHS.TYPES, 'index.d.ts');
    if (!await fs.pathExists(typesIndex)) errors.push(`Types: Missing ${typesIndex}`);

    // Check Browser bundle
    const browserBundle = path.join(PATHS.BROWSER, 'bundle.js');
    if (!await fs.pathExists(browserBundle)) errors.push(`Browser: Missing ${browserBundle}`);

    return errors;
};

/**
 * Validates release-specific artifacts (package.json, LICENSE, README)
 */
const validateReleaseBuild = async () => {

    const errors = [];

    const pkgPath = process.env.CI
        ? path.join(CWD, 'package.json')
        : path.join(PATHS.BUILD, 'package.json');

    if (!await fs.pathExists(pkgPath)) {

        errors.push(`Package: Missing ${pkgPath}`);
    }
    else {

        const pkg = await fs.readJson(pkgPath);

        // Validate package.json has required exports
        if (!pkg.exports?.['.']) {

            errors.push('Package: Missing exports["."] configuration');
        }
        else {

            const exports = pkg.exports['.'];
            if (!exports.types)   errors.push('Package: Missing exports["."].types');
            if (!exports.require) errors.push('Package: Missing exports["."].require');
            if (!exports.import)  errors.push('Package: Missing exports["."].import');
        }

        // Validate CDN entry points
        if (!pkg.unpkg)    errors.push('Package: Missing unpkg field');
        if (!pkg.jsdelivr) errors.push('Package: Missing jsdelivr field');

        // Validate required package.json fields
        if (!pkg.name)    errors.push('Package: Missing name field');
        if (!pkg.version) errors.push('Package: Missing version field');
        if (!pkg.license) errors.push('Package: Missing license field');
    }

    // Check LICENSE
    const licensePath = process.env.CI
        ? path.join(CWD, 'LICENSE')
        : path.join(PATHS.BUILD, 'LICENSE');

    if (!await fs.pathExists(licensePath)) errors.push(`LICENSE: Missing ${licensePath}`);

    // Check README
    const readmePath = process.env.CI
        ? path.join(CWD, 'readme.md')
        : path.join(PATHS.BUILD, 'readme.md');

    if (!await fs.pathExists(readmePath)) errors.push(`README: Missing ${readmePath}`);

    return errors;
};

/**
 * Runs the core build steps (CJS, ESM, browser, types)
 */
const runBuild = async () => {

    // Clean up the build folder and recreate it
    await fs.remove(PATHS.BUILD);
    await fs.ensureDir(PATHS.BUILD);

    log.info('Building CJS and ESM modules...');

    // Copy the source files to the build folder
    // and remove all .ts files so that we capture
    // non-ts files during our build
    await fs.copy(PATHS.SRC, PATHS.CJS);
    await fs.copy(PATHS.SRC, PATHS.ESM);

    await rmTsFiles(PATHS.CJS);
    await rmTsFiles(PATHS.ESM);

    // Build the cjs and esm modules using swc from the source files
    await $`pnpm swc src/* -d ${PATHS.CJS} -C module.type=commonjs`;
    await $`pnpm swc src/* -d ${PATHS.ESM} -C module.type=es6`;

    log.info('Processing build artifacts...');

    // Move all non-ts files from src to the build folders
    await $`cp -R ${PATHS.CJS}/src/* ${PATHS.CJS}`;
    await $`cp -R ${PATHS.ESM}/src/* ${PATHS.ESM}`;

    // Remove the now empty src folders
    await fs.remove(`${PATHS.CJS}/src`);
    await fs.remove(`${PATHS.ESM}/src`);

    log.info('Renaming .js files to .cjs and .mjs...');

    // Rename all .js files to .cjs and .mjs
    await renameFilesExt(PATHS.CJS, 'js', 'cjs');
    await renameFilesExt(PATHS.ESM, 'js', 'mjs');

    log.info('Building browser bundle...');

    // Build browser bundle
    await $`BUNDLE_NAME=${LibPkg.browserNamespace} BUNDLE_PATH=${PATHS.BUILD} PACKAGE_PATH=${CWD} pnpm vite build --config ${VITE_CONFIG}`;

    log.info('Generating TypeScript declaration files...');

    // Write dts files to the `types` folder
    await $`pnpm tsc --emitDeclarationOnly --project tsconfig.json`;
};

/**
 * Runs build and validates output, retrying the entire build if validation fails
 */
const buildWithRetry = async (maxRetries = 3) => {

    for (let attempt = 1; attempt <= maxRetries; attempt++) {

        if (attempt > 1) {

            log.warn(`Build attempt ${attempt}/${maxRetries}...`);
        }

        await runBuild();

        const errors = await validateCoreBuild();

        if (errors.length === 0) {

            log.success('Build validation passed');
            return true;
        }

        if (attempt < maxRetries) {

            log.warn(`Validation failed on attempt ${attempt}/${maxRetries}:`);
            errors.forEach(err => log.warn(`  - ${err}`));
            log.warn('Retrying entire build...');
            await sleep(500);
        }
        else {

            log.error(`Build failed after ${maxRetries} attempts:`);
            errors.forEach(err => log.error(`  - ${err}`));
            return false;
        }
    }

    return false;
};

// Build the typescript declaration files for docs
if (CWD === ROOT && !process.env.CI) {

    await $`pnpm tsc --project tsconfig.docs.json`;
    process.exit(0);
}

log.info(`Building ${LibPkg.name}@${LibPkg.version}...`);

// Run build with retry logic (retries entire build if validation fails)
const buildPassed = await buildWithRetry(3);

if (!buildPassed) {

    process.exit(1);
}

if (RELEASE_FLAG === false) {

    log.info('Non-release build complete.');
    process.exit(0);
}

/**
 * Update the package.json file with the new exports
 * and remove the scripts and devDependencies
 *
 * This is done so that the package.json file is ready
 * for publishing to npm. This also allows us to use a
 * different configuration for the package.json file so
 * local development is easier and purely typescript.
 *
 * For example, during development and testing, the file
 * would have a `main` field pointing to the typescript
 * source files, but when published to npm, the `main`
 * field is omitted and the `exports` field is used instead.
 */
// Export paths differ based on where package.json will be placed:
// - CI: package.json in package root → paths include ./dist/
// - Local: package.json in dist/ folder → paths are relative from there
// Export condition order matters: types must come first for TypeScript resolution
const exportPaths = process.env.CI
    ? {
        types:   './dist/types/index.d.ts',
        require: './dist/cjs/index.js',
        import:  './dist/esm/index.mjs',
    }
    : {
        types:   './types/index.d.ts',
        require: './cjs/index.js',
        import:  './esm/index.mjs',
    };

// Browser bundle paths for CDN usage (unpkg, jsdelivr)
const browserPath = process.env.CI
    ? './dist/browser/bundle.js'
    : './browser/bundle.js';

const Pkg = {

    name: LibPkg.name,
    version: LibPkg.version,
    description: LibPkg.description,
    license: RootPkg.license,
    homepage: RootPkg.homepage,
    bugs: RootPkg.bugs,
    author: RootPkg.author,
    keywords: LibPkg.keywords,
    sideEffects: false,
    files: process.env.CI ? LibPkg.files.concat(RootPkg.files) : ['**/*'],

    exports: {
        '.': exportPaths
    },

    // CDN entry points for browser bundle
    unpkg: browserPath,
    jsdelivr: browserPath,

    dependencies: LibPkg.dependencies,
    peerDependencies: LibPkg.peerDependencies,
};

log.info('Setting up package.json, LICENSE, and README for release...');

// Write package.json, LICENSE, and README to the build folder
if (process.env.CI) {

    await fs.writeJson(path.join(CWD, 'package.json'), Pkg, { spaces: 2 });
    await fs.copy(path.join(ROOT, 'LICENSE'), path.join(CWD, 'LICENSE'));
    await fs.copy(path.join(ROOT, 'readme.md'), path.join(CWD, 'readme.md'));
}
else {

    await fs.writeJson(path.join(PATHS.BUILD, 'package.json'), Pkg, { spaces: 2 });
    await fs.copy(path.join(ROOT, 'LICENSE'), path.join(PATHS.BUILD, 'LICENSE'));
    await fs.copy(path.join(ROOT, 'readme.md'), path.join(PATHS.BUILD, 'readme.md'));
}

// Final validation for release-specific files (package.json, LICENSE, README)
const releaseErrors = await validateReleaseBuild();

if (releaseErrors.length > 0) {

    log.error('Release validation failed:');
    releaseErrors.forEach(err => log.error(`  - ${err}`));
    process.exit(1);
}

log.success(`Release build complete for ${LibPkg.name}@${LibPkg.version}`);
