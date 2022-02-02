FROM node:16.13.2-alpine
ENV NODE_VERSION 16.13.2
WORKDIR /ca9
COPY package.json /ca9
RUN npm i --only=production && npm cache clean --force
RUN npm i -g pm2
COPY . /ca9
CMD ["pm2-runtime", "./ca9/dist/app.js"]