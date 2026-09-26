# sentinel-ui: the Angular SPA served from a static container. Build context: repository root.
FROM node:22.23.3-slim AS build
WORKDIR /workspace
COPY package.json package-lock.json .npmrc tsconfig.base.json ./
COPY packages ./packages
COPY apps/ui ./apps/ui
COPY apps/core/package.json ./apps/core/package.json
COPY apps/stream/package.json ./apps/stream/package.json
COPY apps/simulator/package.json ./apps/simulator/package.json
RUN npm ci
RUN npm run build --workspace @sentinel/ui

FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime
COPY infra/cloud-run/sentinel-ui/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/ui/dist/sentinel-ui/browser /usr/share/nginx/html
EXPOSE 8080
