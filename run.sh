#!/bin/bash

rm .dist/ -rf
npm install --only=prod
npm install -g pm2 typescript
tsc
cp config.json ./dist/config/config.json

if [[ "$OSTYPE" == "cygwin"* ]]; then
    node ./dist/index.js
elif [[ "$OSTYPE" == "msys"* ]]; then
    node ./dist/index.js
else
    pm2 start ./dist/index.js
fi