#!/usr/bin/env bash

cat << EOF >| src/metadata/package.ts
export const name = '$(node -p "require('./package.json').name")';
export const version = '$(node -p "require('./package.json').version")';
export const description = '$(node -p "require('./package.json').description")';
EOF
git add src/metadata/package.ts
