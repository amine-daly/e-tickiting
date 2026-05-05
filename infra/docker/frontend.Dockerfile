FROM node:20-bookworm-slim AS build
WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/frontend/package.json ./apps/frontend/package.json

RUN npm ci

COPY apps/frontend ./apps/frontend
WORKDIR /workspace/apps/frontend

RUN npm run build && \
    mkdir -p /tmp/frontend-dist && \
    if [ -d dist/frontend/browser ]; then \
      cp -R dist/frontend/browser/. /tmp/frontend-dist/; \
    else \
      cp -R dist/frontend/. /tmp/frontend-dist/; \
    fi

FROM nginx:1.27-alpine

COPY infra/docker/frontend.nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /tmp/frontend-dist/ /usr/share/nginx/html/

EXPOSE 80
