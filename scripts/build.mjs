#!/user/bin/env node
import readline from 'readline';
import fs, { mkdirSync } from 'fs';
import path from 'path';
import proc from 'child_process';

const BUILD_FOLDER = 'dist';
const CWD = process.cwd();
const ROOT = path.join(import.meta.dirname, '..');
const RELEASE_FLAG = process.argv.includes('--release');

if (!CWD.includes(ROOT)) {
    console.error('Where are you running this script from?');
    process.exit(127);
}

const PATHS = {
    SRC: path.join(CWD, 'src'),
    BUILD: path.join(CWD, BUILD_FOLDER),
    CJS: path.join(CWD, BUILD_FOLDER, 'cjs'),
    ESM: path.join(CWD, BUILD_FOLDER, 'esm'),
    TYPES: path.join(CWD, BUILD_FOLDER, 'types')
}

const rmRf = (dir) => {

    if (fs.existsSync(dir)) {

        fs.rmSync(dir, { recursive: true });
    }
};

const cpR = (src, dest) => {

    fs.cpSync(src, dest, { recursive: true });
}

/**
 * Remove all .ts files from a directory
 */
const rmTsFiles = (dir) => {

    const files = fs.readdirSync(dir);

    files.forEach(file => {

        const filePath = path.join(dir, file);

        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {

            rmTsFiles(filePath)
        }
        else if (file.endsWith('.ts')) {

            fs.rmSync(filePath);
        }
    });
}

/**
 * Rename all files with a specific extension in a directory
 */
const renameFilesExt = async (dir, from, to) => {

    if (!from.startsWith('.')) {
        from = `.${from}`;
    }

    if (!to.startsWith('.')) {
        to = `.${to}`;
    }


    const files = fs.readdirSync(dir);

    for (const file of files) {

        const fullPath = path.join(dir, file);
        const newPath = fullPath.replace(from, to);

        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {

            renameFilesExt(fullPath, from, to);
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

                    // Replace the .ts extension with .mjs
                    contents += line.replace('.ts', '.mjs');
                    contents += '\n';
                    continue;
                }

                else if (
                    to === '.cjs' &&
                    requireRgx.test(line)
                ) {

                    // Remove the .ts extension from the require statement
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

            fs.rmSync(fullPath);

            // Keep the .js extension for cjs modules
            to === '.cjs' && fs.renameSync(newPath, fullPath);
        }
    }
}

/**
 * Run a shell command
 */
const shell = (cmd) => {

    const [cmdName, ...args] = cmd.split(' ');

    proc.spawnSync(cmdName, args, {
        cwd: CWD,
        stdio: 'inherit',
        shell: true,
        env: process.env
    })
}


// Build the typescript declaration files
if (
    CWD === ROOT &&
    !process.env.CI
) {

    shell(`pnpm tsc --project tsconfig.docs.json`);

    process.exit(0);
}


// Clean up the build folder and recreate it
rmRf(PATHS.BUILD);
fs.mkdirSync(PATHS.BUILD);

// Copy the source files to the build folder
// and remove all .ts files so that we capture
// non-ts files during our build
cpR(PATHS.SRC, PATHS.CJS);
cpR(PATHS.SRC, PATHS.ESM);

rmTsFiles(PATHS.CJS);
rmTsFiles(PATHS.ESM);

// Build the cjs and esm modules using swc from
// the source files
shell(`pnpm swc src/* -d ${PATHS.CJS} -C module.type=commonjs`);
shell(`pnpm swc src/* -d ${PATHS.ESM} -C module.type=es6`);

// Rename all .js files to .cjs and .mjs
await renameFilesExt(PATHS.CJS, 'js', 'cjs');
await renameFilesExt(PATHS.ESM, 'js', 'mjs');

if (RELEASE_FLAG === false) {

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
const RootPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
const LibPkg = JSON.parse(fs.readFileSync(path.join(CWD, 'package.json'), 'utf-8'));

const Pkg = {

    license: RootPkg.license,
    homepage: RootPkg.homepage,
    bugs: RootPkg.bugs,
    author: RootPkg.author,

    name: LibPkg.name,
    description: LibPkg.description,
    version: LibPkg.version,
    dependencies: LibPkg.dependencies,
    peerDependencies: LibPkg.peerDependencies,
    keywords: LibPkg.keywords,
    files: LibPkg.files.concat(RootPkg.files),

    exports: {
        '.': {
            require: './dist/cjs/index.js',
            import: './dist/esm/index.mjs',
            types: './src/index.ts',
        }
    }
}

if (process.env.CI) {

    fs.writeFileSync(
        path.join(CWD, 'package.json'),
        JSON.stringify(Pkg, null, 2)
    );

    fs.cpSync(
        path.join(ROOT, 'LICENSE'),
        path.join(CWD, 'LICENSE')
    )

    fs.cpSync(
        path.join(ROOT, 'readme.md'),
        path.join(CWD, 'readme.md')
    )
}
else {

    fs.writeFileSync(
        path.join(PATHS.BUILD, 'package.json'),
        JSON.stringify(Pkg, null, 2)
    );

    fs.cpSync(
        path.join(ROOT, 'LICENSE'),
        path.join(PATHS.BUILD, 'LICENSE')
    )

    fs.cpSync(
        path.join(ROOT, 'readme.md'),
        path.join(PATHS.BUILD, 'readme.md')
    )
}
