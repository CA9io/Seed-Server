#!/bin/bash

rm .dist/ -rf
rm .node_modules/ -rf
npm install --only=prod
npm install pm2 typescript
tsc
cp config.json ./dist/config/config.json


if [[ "$OSTYPE" == "cygwin"* ]]; then
    DEFAULT_PATH="$1" node ./dist/index.js
elif [[ "$OSTYPE" == "msys"* ]]; then
    DEFAULT_PATH="$1" node ./dist/index.js
else
    DEFAULT_PATH="$1" pm2 start ./dist/index.js
fi