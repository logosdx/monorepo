#!/bin/bash

BUILD_FOLDER=dist

ROOT_PATH="`cd $(dirname $0)/..; pwd`"
THIS_ROOT="`cd $(pwd)/../..; pwd`"

if [[ "$ROOT_PATH" != "$THIS_ROOT" ]]; then
    echo "\nWhere are you?\n"
    exit 127;
fi

rm -rf $BUILD_FOLDER;
mkdir -p $BUILD_FOLDER/cjs
mkdir -p $BUILD_FOLDER/esm

COPY_FILES=$(echo ./src/*);

# Copy recursively into build folder
for p in $(echo ./src/*); do

    [[ -d $p ]] && {

        cp -R $p $BUILD_FOLDER/cjs;
        cp -R $p $BUILD_FOLDER/esm;

    }
done

# Remove typescript files
find $BUILD_FOLDER -name "*.ts" -type f | grep -v template | xargs rm -rf;

# Transpile TS files
pnpm swc src/* -d $BUILD_FOLDER/cjs -C module.type=commonjs;
pnpm swc src/* -d $BUILD_FOLDER/esm -C module.type=es6;

pnpm tsc --emitDeclarationOnly --declarationDir $BUILD_FOLDER/cjs
pnpm tsc --emitDeclarationOnly --declarationDir $BUILD_FOLDER/esm
