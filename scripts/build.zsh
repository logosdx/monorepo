#!/bin/bash

BUILD_FOLDER=dist
ROOT_PATH="`cd $(dirname $0)/..; pwd`"
THIS_ROOT="`cd $(pwd)/../..; pwd`"

if [[ "$ROOT_PATH" != "$THIS_ROOT" ]]; then
    echo "\nWhere are you?\n"
    exit 127;
fi

rm -rf $BUILD_FOLDER;
mkdir -p $BUILD_FOLDER

COPY_FILES=$(echo ./src/*);

# Copy recursively into build folder
for p in $(echo ./src/*); do

    [[ -d $p ]] && {

        cp -R $p $BUILD_FOLDER;
    }
done

# Remove typescript files
find $BUILD_FOLDER -name "*.ts" -type f | grep -v template | xargs rm -rf;

# Transpile TS files
pnpm swc src/* -d $BUILD_FOLDER;
pnpm types