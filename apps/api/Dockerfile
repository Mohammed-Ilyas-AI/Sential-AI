# Cloud Run image for @sentinel/api
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci
COPY . .
RUN npm run build --workspace @sentinel/api

FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/packages/shared ./packages/shared
USER node
EXPOSE 8080
CMD ["node", "dist/main.js"]
