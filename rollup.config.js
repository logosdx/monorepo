const { readdirSync, statSync } = require('fs');
const path = require('path');
const nodeResolve = require('@rollup/plugin-node-resolve');
const babel = require('@rollup/plugin-babel');
const commonjs = require('@rollup/plugin-commonjs');
const terser = require('@rollup/plugin-terser');

const pkgPath = (...rest) => path.resolve(__dirname, 'packages', ...rest);

const dirs = readdirSync(pkgPath()).map(
    (name) => {

        const stat = statSync(pkgPath(name));

        if (stat.isDirectory()) {

            const pkg = require(pkgPath(name, 'package.json'));

            return {
                name,
                input: pkgPath(name, 'dist/index.js'),
                output: pkgPath(name, 'dist/bundle.js'),
                pkg,
            }
        }
    }
).filter(Boolean);


/**
 * @type {import('rollup').RollupOptions[]}
 */
const configs = dirs.map(
    ({ name, pkg, input, output }) => {

        return {
            input,
            output: {
                name: pkg.browserFuncName || name,
                file: pkg.cdn ? pkgPath(name, pkg.cdn) : output,
                format: 'iife',
                sourcemap: true,
                inlineDynamicImports: true,
            },
            plugins: [
                commonjs(),
                nodeResolve({
                    browser: true
                }),
                babel({

                }),
                terser(),
            ]
        }
    }
)

module.exports = configs;