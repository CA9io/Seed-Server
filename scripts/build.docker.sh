#!/bin/bash

cd ..
rm .dist/ -rf
rm .node_modules/ -rf
npm install --only=prod
npm install -g pm2 typescript
tsc
cp config.json ./dist/config/config.json
rm ./node_modules/ -rf
docker build -t ca9-seed-server .