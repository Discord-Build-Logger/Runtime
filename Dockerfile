FROM node:22-alpine

WORKDIR /usr/app

COPY package.json .
RUN npm install -g pnpm
RUN pnpm install

RUN mkdir node_modules/.cache && chmod -R 777 node_modules/.cache

COPY . .

RUN pnpm build

CMD ["pnpm", "run", "start"]
