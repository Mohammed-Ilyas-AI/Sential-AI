# sentinel-ui: the Angular SPA served from a static container. Build context: repository root.
FROM node:24.18.0-slim AS build
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
# Rendered at container start into /etc/nginx/conf.d/default.conf (see default.conf.template).
COPY infra/cloud-run/sentinel-ui/default.conf.template /etc/nginx/templates/default.conf.template
# Local defaults; Cloud Run sets the deployed values (infra/cloud-run/sentinel-ui/service.yaml).
ENV CORE_API_BASE_URL=http://localhost:8080 \
    STREAM_URL=ws://localhost:8081/stream \
    DEMO_TIME_COMPRESSION=true
COPY --from=build /workspace/apps/ui/dist/sentinel-ui/browser /usr/share/nginx/html
EXPOSE 8080
