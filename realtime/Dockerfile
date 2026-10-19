# syntax=docker/dockerfile:1
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
RUN apk add --no-cache git
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY nest-cli.json tsconfig.json ./
COPY src ./src
COPY agents ./agents
RUN npm run build

FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=4100 AGENTS_PATH=/app/agents
RUN apk add --no-cache git ffmpeg
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/agents ./agents
RUN mkdir -p /app/data/baileys && chown -R node:node /app/data
USER node
EXPOSE 4100
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","dist/main.js"]
