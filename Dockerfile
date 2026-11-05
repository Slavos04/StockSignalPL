# Multi-stage build for StockSignalPl on Ubuntu Linux with Node.js & PostgreSQL
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# Runner Stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src/server ./src/server
COPY --from=builder /app/src/data ./src/data
COPY --from=builder /app/src/types ./src/types
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/vite.config.ts ./vite.config.ts

EXPOSE 3000

CMD ["npx", "tsx", "server.ts"]
